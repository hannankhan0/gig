USE GradeAndGrindDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Conversations')
BEGIN
  CREATE TABLE Conversations (
    ConversationID INT IDENTITY(1,1) PRIMARY KEY,
    GigID INT NULL FOREIGN KEY REFERENCES Gigs(GigID),
    StudentID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    ClientID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_Conversations_DifferentUsers CHECK (StudentID <> ClientID)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UX_Conversations_GigStudentClient'
)
BEGIN
  CREATE UNIQUE INDEX UX_Conversations_GigStudentClient
  ON Conversations(GigID, StudentID, ClientID)
  WHERE GigID IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'ConversationID')
BEGIN
  ALTER TABLE Messages ADD ConversationID INT NULL FOREIGN KEY REFERENCES Conversations(ConversationID);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'IsHidden')
BEGIN
  ALTER TABLE Messages ADD IsHidden BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'MessageID')
BEGIN
  ALTER TABLE Reports ADD MessageID INT NULL FOREIGN KEY REFERENCES Messages(MessageID);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reports') AND name = 'ResolvedAt')
BEGIN
  ALTER TABLE Reports ADD ResolvedAt DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AdminActivityLogs')
BEGIN
  CREATE TABLE AdminActivityLogs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    AdminID INT NOT NULL FOREIGN KEY REFERENCES Users(UserID),
    ActionType NVARCHAR(50) NOT NULL,
    TargetType NVARCHAR(50) NOT NULL,
    TargetID INT NULL,
    Description NVARCHAR(500) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
  );
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('Gigs') AND name LIKE '%Status%'
)
BEGIN
  DECLARE @statusConstraint NVARCHAR(200);
  SELECT TOP 1 @statusConstraint = name
  FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('Gigs') AND name LIKE '%Status%';
  IF @statusConstraint IS NOT NULL
    EXEC('ALTER TABLE Gigs DROP CONSTRAINT [' + @statusConstraint + ']');
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('Gigs') AND name = 'CK_Gigs_Status_Admin'
)
BEGIN
  ALTER TABLE Gigs
    ADD CONSTRAINT CK_Gigs_Status_Admin CHECK (
      Status IN ('open', 'in_progress', 'submitted', 'revision', 'completed', 'cancelled', 'paused', 'removed')
    );
END
GO

INSERT INTO Conversations (GigID, StudentID, ClientID)
SELECT g.GigID, a.StudentID, g.ClientID
FROM Applications a
JOIN Gigs g ON g.GigID = a.GigID
WHERE a.Status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM Conversations c
    WHERE c.GigID = g.GigID AND c.StudentID = a.StudentID AND c.ClientID = g.ClientID
  );
GO

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
GO

IF NOT EXISTS (SELECT 1 FROM Users WHERE Email = 'ahmed.khan@example.com')
BEGIN
  INSERT INTO Users (FullName, Email, Phone, University, Role, IsVerified)
  VALUES
    ('Zain Mirza', 'zain.mirza@example.com', '03001234567', 'FAST-NU Lahore', 'student', 1),
    ('Ahmed Khan', 'ahmed.khan@example.com', '03012345678', NULL, 'client', 1),
    ('Rania Ali', 'rania.ali@example.com', '03023456789', NULL, 'client', 1),
    ('Noor Baig', 'noor.baig@example.com', '03034567890', NULL, 'client', 1);

  INSERT INTO StudentProfiles (UserID, Bio, Degree, GraduationYear, IsAvailable, IsPublished)
  SELECT UserID, 'Frontend student freelancer focused on React dashboards.', 'BSCS', 2026, 1, 1
  FROM Users WHERE Email = 'zain.mirza@example.com';

  INSERT INTO ClientProfiles (UserID, CompanyName, Industry, Description)
  SELECT UserID, FullName + ' Studio', 'Technology', 'Local client hiring student talent.'
  FROM Users WHERE Email IN ('ahmed.khan@example.com', 'rania.ali@example.com', 'noor.baig@example.com');

  INSERT INTO Wallets (UserID, TokenBalance)
  SELECT UserID, 0
  FROM Users
  WHERE Email IN ('zain.mirza@example.com', 'ahmed.khan@example.com', 'rania.ali@example.com', 'noor.baig@example.com');
END
GO

IF NOT EXISTS (SELECT 1 FROM Gigs WHERE Title = 'Web App Dashboard')
BEGIN
  DECLARE @Ahmed INT = (SELECT UserID FROM Users WHERE Email = 'ahmed.khan@example.com');
  DECLARE @Rania INT = (SELECT UserID FROM Users WHERE Email = 'rania.ali@example.com');
  DECLARE @Noor INT = (SELECT UserID FROM Users WHERE Email = 'noor.baig@example.com');
  DECLARE @Sadeem INT = (SELECT UserID FROM Users WHERE FullName = 'Sadeem Arshad');
  DECLARE @Zain INT = (SELECT UserID FROM Users WHERE Email = 'zain.mirza@example.com');

  INSERT INTO Gigs (ClientID, Title, Description, Budget, Deadline, Category, RequiredSkills, Status)
  VALUES
    (@Ahmed, 'Web App Dashboard', 'Build a dark analytics dashboard for a web app.', 7000, '2026-06-15', 'Development', 'React,Dashboard,CSS', 'in_progress'),
    (@Rania, 'UI Landing Page Design', 'Design a professional product landing page.', 3500, '2026-06-20', 'Design', 'Figma,UI Design', 'open');

  DECLARE @DashGig INT = SCOPE_IDENTITY() - 1;

  INSERT INTO Applications (GigID, StudentID, CoverLetter, MatchScore, Status)
  VALUES
    (@DashGig, @Sadeem, 'I can build this dashboard with the existing dark theme.', 92, 'accepted'),
    (@DashGig, @Zain, 'I have worked on dashboards and can assist quickly.', 81, 'rejected');

  INSERT INTO Conversations (GigID, StudentID, ClientID)
  VALUES (@DashGig, @Sadeem, @Ahmed);

  DECLARE @Conv INT = SCOPE_IDENTITY();

  INSERT INTO Messages (ConversationID, SenderID, ReceiverID, GigID, Body)
  VALUES
    (@Conv, @Ahmed, @Sadeem, @DashGig, 'Hi Sadeem, let us use the orange accent from Grade & Grind.'),
    (@Conv, @Sadeem, @Ahmed, @DashGig, 'Sure, I will share the first dashboard screen today.');

  INSERT INTO Reports (ReporterID, ReportedUserID, ReportedGigID, Reason)
  VALUES (@Sadeem, @Noor, NULL, 'Suspicious client profile details need review.');
END
GO
