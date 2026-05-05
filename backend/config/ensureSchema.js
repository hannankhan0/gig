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
