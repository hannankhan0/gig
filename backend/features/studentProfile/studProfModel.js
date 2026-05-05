// features/studentProfile/studProfModel.js
// all database queries for student profile management

const { sql, poolPromise } = require('../../config/db');

// ─── GET ──────────────────────────────────────────────────────────────────────

const getStudentProfile = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
      select
        u.UserID, u.FullName, u.Email, u.Phone, u.University,
        u.ProfilePic, u.Role, u.IsVerified, u.CreatedAt,
        sp.ProfileID, sp.Bio, sp.Degree, sp.GraduationYear,
        sp.CVURL, sp.PortfolioURL, sp.LinkedInURL,
        sp.IsAvailable, sp.IsPublished, sp.UpdatedAt
      from Users u
      join StudentProfiles sp on sp.UserID = u.UserID
      where u.UserID = @userID and u.Role = 'student'
    `);
  return result.recordset[0];
};

const getStudentSkills = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
      select StudentSkillID, SkillName
      from StudentSkills
      where UserID = @userID
      order by SkillName
    `);
  return result.recordset;
};

const getPublicStudentProfile = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
      select
        u.UserID, u.FullName, u.University, u.ProfilePic, u.IsVerified,
        sp.Bio, sp.Degree, sp.GraduationYear, sp.CVURL,
        sp.PortfolioURL, sp.LinkedInURL, sp.IsAvailable, sp.IsPublished,
        coalesce(avg(cast(r.Rating as float)), 0) as AverageRating,
        count(r.ReviewID) as TotalReviews,
        count(distinct case when a.Status = 'accepted' then a.ApplicationID end) as CompletedGigs
      from Users u
      join StudentProfiles sp on sp.UserID = u.UserID
      left join Reviews r     on r.RevieweeID = u.UserID
      left join Applications a on a.StudentID = u.UserID
      where u.UserID = @userID
        and u.Role = 'student'
        and u.IsBanned = 0
        and sp.IsPublished = 1
      group by
        u.UserID, u.FullName, u.University, u.ProfilePic, u.IsVerified,
        sp.Bio, sp.Degree, sp.GraduationYear, sp.CVURL,
        sp.PortfolioURL, sp.LinkedInURL, sp.IsAvailable, sp.IsPublished
    `);
  return result.recordset[0];
};

const getDraftStudentProfile = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
      select
        u.UserID, u.FullName, u.University, u.ProfilePic, u.IsVerified,
        sp.Bio, sp.Degree, sp.GraduationYear, sp.CVURL,
        sp.PortfolioURL, sp.LinkedInURL, sp.IsAvailable, sp.IsPublished,
        0 as AverageRating, 0 as TotalReviews, 0 as CompletedGigs
      from Users u
      join StudentProfiles sp on sp.UserID = u.UserID
      where u.UserID = @userID
        and u.Role = 'student'
        and u.IsBanned = 0
    `);
  return result.recordset[0];
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const updateStudentProfile = async (userID, { bio, degree, graduationYear, portfolioURL, linkedInURL, isAvailable }) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID',         sql.Int,      userID)
    .input('bio',            sql.NVarChar,  bio           || null)
    .input('degree',         sql.NVarChar,  degree        || null)
    .input('graduationYear', sql.Int,       graduationYear || null)
    .input('portfolioURL',   sql.NVarChar,  portfolioURL  || null)
    .input('linkedInURL',    sql.NVarChar,  linkedInURL   || null)
    .input('isAvailable',    sql.Bit,       isAvailable !== undefined ? isAvailable : 1)
    .query(`
      update StudentProfiles
      set Bio            = @bio,
          Degree         = @degree,
          GraduationYear = @graduationYear,
          PortfolioURL   = @portfolioURL,
          LinkedInURL    = @linkedInURL,
          IsAvailable    = @isAvailable,
          UpdatedAt      = getdate()
      where UserID = @userID
    `);
};

const updateUserInfo = async (userID, { phone, university }) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID',     sql.Int,     userID)
    .input('phone',      sql.NVarChar, phone      || null)
    .input('university', sql.NVarChar, university || null)
    .query(`
      update Users
      set Phone = @phone, University = @university
      where UserID = @userID
    `);
};

const setPublishStatus = async (userID, isPublished) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID',      sql.Int, userID)
    .input('isPublished', sql.Bit, isPublished)
    .query(`
      update StudentProfiles
      set IsPublished = @isPublished, UpdatedAt = getdate()
      where UserID = @userID
    `);
};

const updateCVURL = async (userID, cvURL) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID', sql.Int,     userID)
    .input('cvURL',  sql.NVarChar, cvURL || null)
    .query(`
      update StudentProfiles
      set CVURL = @cvURL, UpdatedAt = getdate()
      where UserID = @userID
    `);
};

// ─── SKILLS ───────────────────────────────────────────────────────────────────

const addSkill = async (userID, skillName) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID',    sql.Int,     userID)
    .input('skillName', sql.NVarChar, skillName.trim())
    .query(`
      if not exists (
        select 1 from StudentSkills
        where UserID = @userID and SkillName = @skillName
      )
      insert into StudentSkills (UserID, SkillName) values (@userID, @skillName)
    `);
};

const removeSkill = async (userID, skillName) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID',    sql.Int,     userID)
    .input('skillName', sql.NVarChar, skillName.trim())
    .query(`delete from StudentSkills where UserID = @userID and SkillName = @skillName`);
};

// FIX: wrapped in a transaction so partial failures don't corrupt skill list
const replaceSkills = async (userID, skillNames) => {
  const pool = await poolPromise;
  const txn  = new sql.Transaction(pool);
  await txn.begin();
  try {
    await txn.request()
      .input('userID', sql.Int, userID)
      .query(`delete from StudentSkills where UserID = @userID`);

    for (const skill of skillNames) {
      const trimmed = skill.trim();
      if (!trimmed) continue;
      await txn.request()
        .input('userID',    sql.Int,     userID)
        .input('skillName', sql.NVarChar, trimmed)
        .query(`
          if not exists (select 1 from StudentSkills where UserID = @userID and SkillName = @skillName)
            insert into StudentSkills (UserID, SkillName) values (@userID, @skillName)
        `);
    }
    await txn.commit();
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

module.exports = {
  getStudentProfile,
  getStudentSkills,
  getPublicStudentProfile,
  getDraftStudentProfile,
  updateStudentProfile,
  updateUserInfo,
  setPublishStatus,
  updateCVURL,
  addSkill,
  removeSkill,
  replaceSkills,
};