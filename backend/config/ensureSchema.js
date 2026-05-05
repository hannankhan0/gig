const { poolPromise } = require('./db');

const run = async (pool, query) => {
  await pool.request().query(query);
};

const ensureSchema = async () => {
  const pool = await poolPromise;

  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmissionURL')
      ALTER TABLE Gigs ADD SubmissionURL NVARCHAR(1000) NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmissionNote')
      ALTER TABLE Gigs ADD SubmissionNote NVARCHAR(500) NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Gigs') AND name = 'RevisionNote')
      ALTER TABLE Gigs ADD RevisionNote NVARCHAR(500) NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmittedAt')
      ALTER TABLE Gigs ADD SubmittedAt DATETIME2 NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Gigs') AND name = 'CompletedAt')
      ALTER TABLE Gigs ADD CompletedAt DATETIME2 NULL;
  `);

  const statusConstraints = await pool.request().query(`
    SELECT name FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('Gigs') AND definition LIKE '%Status%'
  `);
  for (const row of statusConstraints.recordset) {
    await run(pool, `ALTER TABLE Gigs DROP CONSTRAINT [${row.name}]`);
  }
  await run(pool, `
    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('Gigs') AND name = 'CK_Gigs_Status_Workflow'
    )
      ALTER TABLE Gigs ADD CONSTRAINT CK_Gigs_Status_Workflow CHECK (
        Status IN ('open', 'in_progress', 'submitted', 'revision', 'completed', 'cancelled', 'paused', 'removed')
      );
  `);

  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Conversations')
      CREATE TABLE Conversations (
        ConversationID INT IDENTITY(1,1) PRIMARY KEY,
        GigID INT NULL FOREIGN KEY REFERENCES Gigs(GigID),
        StudentID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
        ClientID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_Conversations_DifferentUsers CHECK (StudentID <> ClientID)
      );
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Conversations_GigStudentClient')
      CREATE UNIQUE INDEX UX_Conversations_GigStudentClient
      ON Conversations(GigID, StudentID, ClientID)
      WHERE GigID IS NOT NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'ConversationID')
      ALTER TABLE Messages ADD ConversationID INT NULL FOREIGN KEY REFERENCES Conversations(ConversationID);
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'IsHidden')
      ALTER TABLE Messages ADD IsHidden BIT NOT NULL DEFAULT 0;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Conversations') AND name = 'ConversationStatus')
      ALTER TABLE Conversations ADD ConversationStatus NVARCHAR(20) NOT NULL DEFAULT 'active';
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Conversations') AND name = 'RequestAcceptedAt')
      ALTER TABLE Conversations ADD RequestAcceptedAt DATETIME NULL;
  `);
  await run(pool, `
    UPDATE c
    SET ConversationStatus = 'request',
        RequestAcceptedAt = NULL
    FROM Conversations c
    JOIN Applications a ON a.GigID = c.GigID AND a.StudentID = c.StudentID
    WHERE a.Status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM Applications ax
        WHERE ax.GigID = c.GigID
          AND ax.StudentID = c.StudentID
          AND ax.Status = 'accepted'
      );
  `);
  await run(pool, `
    UPDATE c
    SET ConversationStatus = 'active',
        RequestAcceptedAt = COALESCE(RequestAcceptedAt, GETDATE())
    FROM Conversations c
    JOIN Applications a ON a.GigID = c.GigID AND a.StudentID = c.StudentID
    WHERE a.Status = 'accepted';
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'MessageID')
      ALTER TABLE Reports ADD MessageID INT NULL FOREIGN KEY REFERENCES Messages(MessageID);
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'ResolvedAt')
      ALTER TABLE Reports ADD ResolvedAt DATETIME NULL;
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdminActivityLogs')
      CREATE TABLE AdminActivityLogs (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        AdminID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
        ActionType NVARCHAR(50) NOT NULL,
        TargetType NVARCHAR(50) NOT NULL,
        TargetID INT NULL,
        Description NVARCHAR(500) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'token_plans')
      CREATE TABLE token_plans (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL UNIQUE,
        price_pkr INT NOT NULL,
        tokens INT NOT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_wallets')
      CREATE TABLE user_wallets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL UNIQUE FOREIGN KEY REFERENCES Users(UserID),
        balance_tokens INT NOT NULL DEFAULT 10000,
        current_plan NVARCHAR(50) NOT NULL DEFAULT 'Free Trial',
        total_earned_tokens INT NOT NULL DEFAULT 10000,
        total_spent_tokens INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'token_transactions')
      CREATE TABLE token_transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
        wallet_id INT NOT NULL FOREIGN KEY REFERENCES user_wallets(id),
        type NVARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit', 'adjustment', 'refund')),
        amount_tokens INT NOT NULL,
        balance_after INT NOT NULL,
        reason NVARCHAR(120) NOT NULL,
        reference_type NVARCHAR(60) NULL,
        reference_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
  `);
  await run(pool, `
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'token_purchases')
      CREATE TABLE token_purchases (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
        plan_id INT NOT NULL FOREIGN KEY REFERENCES token_plans(id),
        plan_name NVARCHAR(50) NOT NULL,
        price_pkr INT NOT NULL,
        tokens INT NOT NULL,
        status NVARCHAR(30) NOT NULL CHECK (status IN ('pending', 'paid_demo', 'failed_demo', 'cancelled', 'refunded')),
        demo_transaction_id NVARCHAR(80) NOT NULL UNIQUE,
        payment_method_demo NVARCHAR(50) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        paid_at DATETIME NULL
      );
  `);
  const purchaseStatusConstraints = await pool.request().query(`
    SELECT name FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('token_purchases') AND definition LIKE '%status%'
  `);
  for (const row of purchaseStatusConstraints.recordset) {
    await run(pool, `ALTER TABLE token_purchases DROP CONSTRAINT [${row.name}]`);
  }
  await run(pool, `
    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('token_purchases') AND name = 'CK_token_purchases_status'
    )
      ALTER TABLE token_purchases ADD CONSTRAINT CK_token_purchases_status CHECK (
        status IN ('pending', 'paid_demo', 'paid_sandbox', 'paid', 'failed_demo', 'failed_sandbox', 'cancelled', 'refunded')
      );
  `);
  await run(pool, `
    MERGE token_plans AS target
    USING (VALUES
      ('Free Trial', 0, 10000, 1),
      ('Plus', 500, 10000, 1),
      ('Pro', 1000, 25000, 1),
      ('Max', 2000, 60000, 1)
    ) AS source(name, price_pkr, tokens, is_active)
    ON target.name = source.name
    WHEN MATCHED THEN UPDATE SET price_pkr = source.price_pkr, tokens = source.tokens, is_active = source.is_active
    WHEN NOT MATCHED THEN INSERT (name, price_pkr, tokens, is_active)
      VALUES (source.name, source.price_pkr, source.tokens, source.is_active);
  `);
  await run(pool, `
    INSERT INTO user_wallets (user_id, balance_tokens, current_plan, total_earned_tokens, total_spent_tokens)
    SELECT u.UserID, 10000, 'Free Trial', 10000, 0
    FROM Users u
    WHERE u.Role IN ('student', 'client')
      AND NOT EXISTS (SELECT 1 FROM user_wallets w WHERE w.user_id = u.UserID);
  `);
  await run(pool, `
    INSERT INTO token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason)
    SELECT w.user_id, w.id, 'credit', 10000, w.balance_tokens, 'free_trial_signup_bonus'
    FROM user_wallets w
    WHERE NOT EXISTS (
      SELECT 1 FROM token_transactions t
      WHERE t.wallet_id = w.id AND t.reason = 'free_trial_signup_bonus'
    );
  `);
  await run(pool, `
    INSERT INTO Conversations (GigID, StudentID, ClientID, ConversationStatus, RequestAcceptedAt)
    SELECT g.GigID, a.StudentID, g.ClientID
         , 'active', GETDATE()
    FROM Applications a
    JOIN Gigs g ON g.GigID = a.GigID
    WHERE a.Status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM Conversations c
        WHERE c.GigID = g.GigID AND c.StudentID = a.StudentID AND c.ClientID = g.ClientID
      );
  `);
  await run(pool, `
    UPDATE m
    SET ConversationID = c.ConversationID
    FROM Messages m
    JOIN Conversations c
      ON c.GigID = m.GigID
     AND (
          (c.StudentID = m.SenderID AND c.ClientID = m.ReceiverID)
       OR (c.ClientID = m.SenderID AND c.StudentID = m.ReceiverID)
     )
    WHERE m.ConversationID IS NULL;
  `);
};

module.exports = { ensureSchema };
