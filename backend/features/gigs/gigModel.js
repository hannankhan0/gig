// features/gigs/gigModel.js
// all database queries for gigs, applications, and gig matching

const { sql, poolPromise } = require('../../config/db');

// ─── GIGS ──────────────────────────────────────────────────────────────────────

const getAllOpenGigs = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select
      g.GigID, g.Title, g.Description, g.Budget, g.Deadline,
      g.Category, g.RequiredSkills, g.Status, g.CreatedAt,
      u.FullName   as ClientName,
      u.IsVerified as ClientVerified,
      cp.CompanyName,
      (select count(*) from Applications a where a.GigID = g.GigID) as ApplicationCount
    from Gigs g
    join  Users          u  on g.ClientID = u.UserID
    left join ClientProfiles cp on cp.UserID = u.UserID
    where g.Status = 'open'
    order by g.CreatedAt desc
  `);
  return result.recordset;
};

const getMatchedGigs = async (userID) => {
  const pool = await poolPromise;

  const skillsResult = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`select SkillName from StudentSkills where UserID = @userID`);

  const skills = skillsResult.recordset.map(r => r.SkillName);
  if (skills.length === 0) {
    const gigs = await getAllOpenGigs();
    return gigs.map(gig => ({ ...gig, matchScore: 0 }));
  }

  const req = pool.request();
  skills.forEach((skill, i) => req.input(`skill${i}`, sql.NVarChar, `%${skill}%`));

  const result = await req.query(`
    select
      g.GigID, g.Title, g.Description, g.Budget, g.Deadline,
      g.Category, g.RequiredSkills, g.Status, g.CreatedAt,
      u.FullName   as ClientName,
      u.IsVerified as ClientVerified,
      cp.CompanyName,
      (select count(*) from Applications a where a.GigID = g.GigID) as ApplicationCount
    from Gigs g
    join  Users          u  on g.ClientID = u.UserID
    left join ClientProfiles cp on cp.UserID = u.UserID
    where g.Status = 'open'
    order by g.CreatedAt desc
  `);

  return result.recordset.map(gig => {
    const required   = (gig.RequiredSkills || '').toLowerCase().split(',').map(s => s.trim());
    const matched    = skills.filter(sk => required.some(r => r.includes(sk.toLowerCase())));
    const matchScore = required.length > 0
      ? Math.round((matched.length / required.length) * 100) : 0;
    return { ...gig, matchScore };
  }).sort((a, b) => b.matchScore - a.matchScore || new Date(b.CreatedAt) - new Date(a.CreatedAt));
};

const getGigByID = async (gigID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select
        g.GigID, g.Title, g.Description, g.Budget, g.Deadline,
        g.Category, g.RequiredSkills, g.Status, g.CreatedAt,
        u.FullName   as ClientName,
        u.UserID     as ClientID,
        u.IsVerified as ClientVerified,
        u.ProfilePic as ClientPic,
        cp.CompanyName, cp.Industry, cp.WebsiteURL
      from Gigs g
      join  Users          u  on g.ClientID = u.UserID
      left join ClientProfiles cp on cp.UserID = u.UserID
      where g.GigID = @gigID
    `);
  return result.recordset[0];
};

const getGigsByClient = async (clientID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('clientID', sql.Int, clientID)
    .query(`
      select
        g.GigID, g.Title, g.Description, g.Budget, g.Deadline,
        g.Category, g.RequiredSkills, g.Status, g.CreatedAt,
        count(a.ApplicationID)                                  as TotalApplications,
        sum(case when a.Status = 'pending'  then 1 else 0 end) as PendingCount,
        sum(case when a.Status = 'accepted' then 1 else 0 end) as AcceptedCount,
        max(c.ConversationID) as ConversationID
      from Gigs g
      left join Applications a on a.GigID = g.GigID
      left join Conversations c on c.GigID = g.GigID
      where g.ClientID = @clientID
      group by g.GigID, g.Title, g.Description, g.Budget, g.Deadline,
               g.Category, g.RequiredSkills, g.Status, g.CreatedAt
      order by g.CreatedAt desc
    `);
  return result.recordset;
};

const createGig = async ({ clientID, title, description, budget, deadline, category, requiredSkills }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('clientID',       sql.Int,      clientID)
    .input('title',          sql.NVarChar, title)
    .input('description',    sql.NVarChar, description    || null)
    .input('budget',         sql.Decimal,  budget         || null)
    .input('deadline',       sql.Date,     deadline       || null)
    .input('category',       sql.NVarChar, category       || null)
    .input('requiredSkills', sql.NVarChar, requiredSkills || null)
    .query(`
      insert into Gigs (ClientID, Title, Description, Budget, Deadline, Category, RequiredSkills)
      output inserted.GigID
      values (@clientID, @title, @description, @budget, @deadline, @category, @requiredSkills)
    `);
  return result.recordset[0].GigID;
};

const updateGig = async (gigID, clientID, { title, description, budget, deadline, category, requiredSkills }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID',          sql.Int,      gigID)
    .input('clientID',       sql.Int,      clientID)
    .input('title',          sql.NVarChar, title)
    .input('description',    sql.NVarChar, description    || null)
    .input('budget',         sql.Decimal,  budget         || null)
    .input('deadline',       sql.Date,     deadline       || null)
    .input('category',       sql.NVarChar, category       || null)
    .input('requiredSkills', sql.NVarChar, requiredSkills || null)
    .query(`
      update Gigs
      set Title          = @title,
          Description    = @description,
          Budget         = @budget,
          Deadline       = @deadline,
          Category       = @category,
          RequiredSkills = @requiredSkills
      where GigID = @gigID and ClientID = @clientID and Status in ('open', 'paused')
    `);
  return result.rowsAffected[0];
};

// pause: open -> paused (hides from students, reversible)
// resume: paused -> open
// close: any active status -> cancelled (permanent)
const updateGigStatus = async (gigID, clientID, status) => {
  const pool = await poolPromise;

  let whereClause;
  if (status === 'paused') {
    // can only pause an open gig
    whereClause = `Status = 'open'`;
  } else if (status === 'open') {
    // can only resume a paused gig
    whereClause = `Status = 'paused'`;
  } else if (status === 'cancelled') {
    // can close open or paused gigs (not already completed/cancelled)
    whereClause = `Status in ('open', 'paused', 'in_progress')`;
  } else {
    return 0;
  }

  const result = await pool.request()
    .input('gigID',    sql.Int,      gigID)
    .input('clientID', sql.Int,      clientID)
    .input('status',   sql.NVarChar, status)
    .query(`
      update Gigs set Status = @status
      where GigID = @gigID
        and ClientID = @clientID
        and ${whereClause}
    `);
  return result.rowsAffected[0];
};

// hard delete — only allowed on open or paused gigs with no accepted applications
const deleteGig = async (gigID, clientID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID',    sql.Int, gigID)
    .input('clientID', sql.Int, clientID)
    .query(`
      delete from Gigs output deleted.GigID
      where GigID    = @gigID
        and ClientID = @clientID
        and Status   in ('open', 'paused')
        and not exists (
          select 1 from Applications
          where GigID = @gigID and Status = 'accepted'
        )
    `);
  return result.recordset[0];
};

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

const getApplicationsByGig = async (gigID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select
        a.ApplicationID, a.CoverLetter, a.MatchScore, a.Status, a.AppliedAt,
        u.UserID     as StudentID,
        u.FullName   as StudentName,
        u.University, u.ProfilePic,
        sp.Degree, sp.Bio, sp.CVURL, sp.PortfolioURL,
        c.ConversationID,
        coalesce(c.ConversationStatus, 'active') as ConversationStatus,
        coalesce(avg(cast(r.Rating as float)), 0) as AverageRating,
        count(distinct r.ReviewID)                as TotalReviews
      from Applications a
      join  Users            u  on a.StudentID  = u.UserID
      left join StudentProfiles sp on sp.UserID = u.UserID
      left join Conversations c on c.GigID = a.GigID and c.StudentID = a.StudentID
      left join Reviews         r  on r.RevieweeID = u.UserID
      where a.GigID = @gigID
      group by
        a.ApplicationID, a.CoverLetter, a.MatchScore, a.Status, a.AppliedAt,
        u.UserID, u.FullName, u.University, u.ProfilePic,
        sp.Degree, sp.Bio, sp.CVURL, sp.PortfolioURL,
        c.ConversationID, c.ConversationStatus
      order by a.MatchScore desc
    `);
  return result.recordset;
};

const getApplicationsByStudent = async (studentID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('studentID', sql.Int, studentID)
    .query(`
      select
        a.ApplicationID, a.Status as ApplicationStatus, a.AppliedAt, a.MatchScore,
        a.CoverLetter,
        g.GigID, g.Title as GigTitle, g.Budget, g.Deadline,
        g.Description as GigDescription, g.RequiredSkills,
        g.Category, g.Status as GigStatus,
        u.FullName as ClientName,
        cp.CompanyName,
        c.ConversationID,
        coalesce(c.ConversationStatus, 'active') as ConversationStatus
      from Applications a
      join  Gigs           g  on a.GigID    = g.GigID
      join  Users          u  on g.ClientID = u.UserID
      left join ClientProfiles cp on cp.UserID = u.UserID
      left join Conversations c on c.GigID = g.GigID and c.StudentID = a.StudentID
      where a.StudentID = @studentID
      order by a.AppliedAt desc
    `);
  return result.recordset;
};

const computeMatchScore = async (gigID, studentID) => {
  const pool = await poolPromise;

  const gigResult = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`select RequiredSkills from Gigs where GigID = @gigID`);

  const skillResult = await pool.request()
    .input('studentID', sql.Int, studentID)
    .query(`select SkillName from StudentSkills where UserID = @studentID`);

  const requiredRaw   = gigResult.recordset[0]?.RequiredSkills || '';
  const required      = requiredRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const studentSkills = skillResult.recordset.map(s => s.SkillName.toLowerCase());

  if (!required.length) return 0;

  const matches = required.filter(r => studentSkills.some(s => s.includes(r) || r.includes(s)));
  return Math.round((matches.length / required.length) * 100);
};

const applyToGig = async ({ gigID, studentID, coverLetter, applicationMessage, matchScore }) => {
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);
  await txn.begin();
  try {
    const message = (applicationMessage || coverLetter || 'Hi, I applied for this gig and would like to discuss it.').trim();
    const result = await txn.request()
      .input('gigID',       sql.Int,      gigID)
      .input('studentID',   sql.Int,      studentID)
      .input('coverLetter', sql.NVarChar, coverLetter || null)
      .input('matchScore',  sql.Int,      matchScore  || 0)
      .input('body',        sql.NVarChar, message)
      .query(`
        declare @ApplicationID int;
        declare @ConversationID int;
        declare @ClientID int;

        select @ClientID = ClientID from Gigs where GigID = @gigID;
        if @ClientID is null throw 50001, 'gig not found.', 1;

        insert into Applications (GigID, StudentID, CoverLetter, MatchScore)
        values (@gigID, @studentID, @coverLetter, @matchScore);
        set @ApplicationID = scope_identity();

        select @ConversationID = ConversationID
        from Conversations
        where GigID = @gigID and StudentID = @studentID and ClientID = @ClientID;

        if @ConversationID is null
        begin
          insert into Conversations (GigID, StudentID, ClientID, ConversationStatus)
          values (@gigID, @studentID, @ClientID, 'request');
          set @ConversationID = scope_identity();
        end
        else
        begin
          update Conversations
          set ConversationStatus = case when ConversationStatus = 'active' then 'active' else 'request' end,
              UpdatedAt = getdate()
          where ConversationID = @ConversationID;
        end

        insert into Messages (ConversationID, SenderID, ReceiverID, Body)
        values (@ConversationID, @studentID, @ClientID, @body);

        update Conversations set UpdatedAt = getdate() where ConversationID = @ConversationID;

        select @ApplicationID as ApplicationID, @ConversationID as ConversationID;
      `);
    await txn.commit();
    return result.recordset[0];
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

const hasApplied = async (gigID, studentID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID',     sql.Int, gigID)
    .input('studentID', sql.Int, studentID)
    .query(`select ApplicationID from Applications where GigID = @gigID and StudentID = @studentID`);
  return !!result.recordset[0];
};

const acceptApplication = async (applicationID, gigID) => {
  const pool = await poolPromise;
  const txn  = new sql.Transaction(pool);
  await txn.begin();
  try {
    const accepted = await txn.request()
      .input('appID', sql.Int, applicationID)
      .input('gigID', sql.Int, gigID)
      .query(`
        select a.StudentID, g.ClientID
        from Applications a
        join Gigs g on g.GigID = a.GigID
        where a.ApplicationID = @appID and a.GigID = @gigID
      `);

    const pair = accepted.recordset[0];
    if (!pair) throw { status: 404, message: 'application not found.' };

    await txn.request()
      .input('appID', sql.Int, applicationID)
      .query(`update Applications set Status = 'accepted' where ApplicationID = @appID`);

    await txn.request()
      .input('gigID', sql.Int, gigID)
      .input('appID', sql.Int, applicationID)
      .query(`
        update Applications set Status = 'rejected'
        where GigID = @gigID and ApplicationID <> @appID and Status = 'pending'
      `);

    await txn.request()
      .input('gigID', sql.Int, gigID)
      .query(`update Gigs set Status = 'in_progress' where GigID = @gigID and Status = 'open'`);

    await txn.request()
      .input('gigID', sql.Int, gigID)
      .input('studentID', sql.Int, pair.StudentID)
      .input('clientID', sql.Int, pair.ClientID)
      .query(`
        if exists (
          select 1 from Conversations
          where GigID = @gigID and StudentID = @studentID and ClientID = @clientID
        )
          update Conversations
          set ConversationStatus = 'active',
              RequestAcceptedAt = coalesce(RequestAcceptedAt, getdate()),
              UpdatedAt = getdate()
          where GigID = @gigID and StudentID = @studentID and ClientID = @clientID;
        else
          insert into Conversations (GigID, StudentID, ClientID, ConversationStatus, RequestAcceptedAt)
          values (@gigID, @studentID, @clientID, 'active', getdate());
      `);

    await txn.commit();
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

const withdrawApplication = async (applicationID, studentID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('appID',     sql.Int, applicationID)
    .input('studentID', sql.Int, studentID)
    .query(`
      update Applications set Status = 'withdrawn'
      where ApplicationID = @appID and StudentID = @studentID and Status = 'pending'
    `);
};

// ─── GIG WORK SUBMISSION (US-12) ──────────────────────────────────────────────

// Student submits completed work: in_progress -> submitted
const submitWork = async (gigID, studentID, { submissionURL, submissionNote }) => {
  const pool = await poolPromise;

  // verify this student is the accepted applicant on this gig
  const check = await pool.request()
    .input('gigID',     sql.Int, gigID)
    .input('studentID', sql.Int, studentID)
    .query(`
      select g.Status
      from Gigs g
      join Applications a
        on a.GigID = g.GigID and a.StudentID = @studentID and a.Status = 'accepted'
      where g.GigID = @gigID
    `);

  const gig = check.recordset[0];
  if (!gig) throw { status: 403, message: 'you are not the assigned student for this gig.' };
  if (!['in_progress', 'revision'].includes(gig.Status)) {
    throw { status: 400, message: 'work can only be submitted when gig is in progress or under revision.' };
  }
  if (!submissionURL || !submissionURL.trim()) {
    throw { status: 400, message: 'a submission link is required.' };
  }

  await pool.request()
    .input('gigID',          sql.Int,      gigID)
    .input('submissionURL',  sql.NVarChar, submissionURL.trim())
    .input('submissionNote', sql.NVarChar, submissionNote?.trim() || null)
    .query(`
      update Gigs
      set Status         = 'submitted',
          SubmissionURL  = @submissionURL,
          SubmissionNote = @submissionNote,
          SubmittedAt    = SYSDATETIME(),
          RevisionNote   = null
      where GigID = @gigID
    `);
};

// Client marks gig as complete: submitted -> completed
const markComplete = async (gigID, clientID) => {
  const pool = await poolPromise;

  const check = await pool.request()
    .input('gigID',    sql.Int, gigID)
    .input('clientID', sql.Int, clientID)
    .query(`select Status from Gigs where GigID = @gigID and ClientID = @clientID`);

  const gig = check.recordset[0];
  if (!gig)                          throw { status: 404, message: 'gig not found.' };
  if (gig.Status !== 'submitted')    throw { status: 400, message: 'gig must be in submitted state to mark complete.' };

  await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      update Gigs
      set Status      = 'completed',
          CompletedAt = SYSDATETIME()
      where GigID = @gigID
    `);
};

// Client requests revision: submitted -> revision
const requestRevision = async (gigID, clientID, revisionNote) => {
  const pool = await poolPromise;

  const check = await pool.request()
    .input('gigID',    sql.Int, gigID)
    .input('clientID', sql.Int, clientID)
    .query(`select Status from Gigs where GigID = @gigID and ClientID = @clientID`);

  const gig = check.recordset[0];
  if (!gig)                       throw { status: 404, message: 'gig not found.' };
  if (gig.Status !== 'submitted') throw { status: 400, message: 'can only request revision on a submitted gig.' };
  if (!revisionNote?.trim())      throw { status: 400, message: 'revision feedback is required.' };

  await pool.request()
    .input('gigID',        sql.Int,      gigID)
    .input('revisionNote', sql.NVarChar, revisionNote.trim())
    .query(`
      update Gigs
      set Status       = 'revision',
          RevisionNote = @revisionNote
      where GigID = @gigID
    `);
};

// Get full gig detail including submission info (for work modal)
const getGigWorkDetail = async (gigID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select
        g.GigID, g.Title, g.Status, g.Deadline,
        g.SubmissionURL, g.SubmissionNote, g.RevisionNote,
        g.SubmittedAt, g.CompletedAt,
        u.FullName  as StudentName,
        u.UserID    as StudentID,
        u.ProfilePic as StudentPic
      from Gigs g
      join Applications a on a.GigID = g.GigID and a.Status = 'accepted'
      join Users        u on u.UserID = a.StudentID
      where g.GigID = @gigID
    `);
  return result.recordset[0] ?? null;
};

module.exports = {
  getAllOpenGigs, getMatchedGigs, getGigByID, getGigsByClient,
  createGig, updateGig, updateGigStatus, deleteGig,
  getApplicationsByGig, getApplicationsByStudent,
  computeMatchScore, applyToGig, hasApplied,
  acceptApplication, withdrawApplication,
  submitWork, markComplete, requestRevision, getGigWorkDetail,
};
