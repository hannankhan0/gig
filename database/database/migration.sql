-- ============================================================
-- Grade & Grind — Gig Status Management Migration (US-12)
-- Adds submission, revision, and completion tracking to Gigs.
-- Run this against GradeGrindDB before deploying the new endpoints.
-- ============================================================

USE GradeAndGrindDB;  -- change this if your DB has a different name
GO

-- Add SubmissionURL: student pastes their work link when submitting
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmissionURL'
)
BEGIN
  ALTER TABLE Gigs ADD SubmissionURL NVARCHAR(1000) NULL;
  PRINT 'Added Gigs.SubmissionURL';
END
GO

-- Add SubmissionNote: optional message from student with their submission
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmissionNote'
)
BEGIN
  ALTER TABLE Gigs ADD SubmissionNote NVARCHAR(500) NULL;
  PRINT 'Added Gigs.SubmissionNote';
END
GO

-- Add RevisionNote: client feedback when requesting a revision
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Gigs') AND name = 'RevisionNote'
)
BEGIN
  ALTER TABLE Gigs ADD RevisionNote NVARCHAR(500) NULL;
  PRINT 'Added Gigs.RevisionNote';
END
GO

-- Add SubmittedAt: timestamp when student marks work as submitted
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Gigs') AND name = 'SubmittedAt'
)
BEGIN
  ALTER TABLE Gigs ADD SubmittedAt DATETIME2 NULL;
  PRINT 'Added Gigs.SubmittedAt';
END
GO

-- Add CompletedAt: timestamp when client marks gig as completed
-- (used by review system to enforce the 7-day review window)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Gigs') AND name = 'CompletedAt'
)
BEGIN
  ALTER TABLE Gigs ADD CompletedAt DATETIME2 NULL;
  PRINT 'Added Gigs.CompletedAt';
END
GO

-- Expand Status check to include 'submitted' and 'revision'
-- MSSQL requires dropping and re-adding the constraint
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('Gigs') AND name = 'CK__Gigs__Status__'
    OR  name LIKE '%Gigs%Status%'
)
BEGIN
  DECLARE @cname NVARCHAR(200);
  SELECT @cname = name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('Gigs') AND name LIKE '%Status%';

  IF @cname IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE Gigs DROP CONSTRAINT [' + @cname + ']');
    PRINT 'Dropped old Status check constraint: ' + @cname;
  END
END
GO

ALTER TABLE Gigs
  ADD CONSTRAINT CK_Gigs_Status CHECK (
    Status IN ('open', 'in_progress', 'submitted', 'revision', 'completed', 'cancelled', 'paused')
  );
PRINT 'Added updated CK_Gigs_Status constraint.';
GO