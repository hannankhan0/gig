// features/studentProfile/studProfController.js
// handles all student profile operations

const {
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
} = require('./studProfModel');

const { poolPromise, sql } = require('../../config/db');

const URL_REGEX   = /^https?:\/\/.+/;
const PHONE_REGEX = /^03\d{9}$/;

// ─── GET OWN PROFILE ──────────────────────────────────────────────────────────
const getMyProfile = async (req, res) => {
  try {
    const userID  = req.user.id;
    const profile = await getStudentProfile(userID);
    if (!profile) return res.status(404).json({ error: 'student profile not found.' });
    const skills = await getStudentSkills(userID);
    res.json({ profile, skills });
  } catch (err) {
    console.error('getMyProfile error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── GET PUBLIC PROFILE ───────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const targetID = parseInt(req.params.userID);
    if (isNaN(targetID)) return res.status(400).json({ error: 'invalid user id.' });

    const requester = req.user;
    const isOwner   = requester.id === targetID;
    const isAdmin   = requester.role === 'admin';

    const profile = (isOwner || isAdmin)
      ? await getDraftStudentProfile(targetID)
      : await getPublicStudentProfile(targetID);

    if (!profile) return res.status(404).json({ error: 'profile not found or not published.' });

    const skills = await getStudentSkills(targetID);
    res.json({ profile, skills });
  } catch (err) {
    console.error('getProfile error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── BROWSE ALL PUBLISHED STUDENTS (clients) ──────────────────────────────────
// GET /api/profile/browse
const browseStudents = async (req, res) => {
  try {
    const pool   = await poolPromise;
    const result = await pool.request().query(`
      select
        u.UserID, u.FullName, u.University, u.ProfilePic, u.IsVerified,
        sp.Bio, sp.Degree, sp.GraduationYear,
        sp.PortfolioURL, sp.IsAvailable, sp.IsPublished,
        coalesce(avg(cast(r.Rating as float)), 0)                             as AverageRating,
        count(distinct r.ReviewID)                                            as TotalReviews,
        count(distinct case when a.Status = 'accepted' then a.ApplicationID end) as CompletedGigs
      from Users u
      join StudentProfiles sp on sp.UserID = u.UserID
      left join Reviews    r  on r.RevieweeID = u.UserID
      left join Applications a on a.StudentID = u.UserID
      where u.Role    = 'student'
        and u.IsBanned = 0
        and sp.IsPublished = 1
      group by
        u.UserID, u.FullName, u.University, u.ProfilePic, u.IsVerified,
        sp.Bio, sp.Degree, sp.GraduationYear,
        sp.PortfolioURL, sp.IsAvailable, sp.IsPublished
      order by AverageRating desc
    `);

    // attach skills for each student
    const students = await Promise.all(result.recordset.map(async s => {
      const skills = await getStudentSkills(s.UserID);
      return { ...s, skills: skills.map(sk => sk.SkillName) };
    }));

    res.json({ students });
  } catch (err) {
    console.error('browseStudents error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const userID = req.user.id;

    const {
      phone, university, bio, degree, graduationYear,
      portfolioURL, linkedInURL, isAvailable, publish,
    } = req.body;

    if (phone && phone.trim() && !PHONE_REGEX.test(phone.trim())) {
      return res.status(400).json({ error: 'phone must be 11 digits starting with 03.' });
    }
    if (portfolioURL && portfolioURL.trim() && !URL_REGEX.test(portfolioURL.trim())) {
      return res.status(400).json({ error: 'portfolio URL must start with http:// or https://' });
    }
    if (linkedInURL && linkedInURL.trim() && !URL_REGEX.test(linkedInURL.trim())) {
      return res.status(400).json({ error: 'LinkedIn URL must start with http:// or https://' });
    }
    if (graduationYear) {
      const year = parseInt(graduationYear);
      if (isNaN(year) || year < 2020 || year > 2035) {
        return res.status(400).json({ error: 'graduation year must be between 2020 and 2035.' });
      }
    }

    let skills;
    if (req.body.skills !== undefined) {
      try {
        skills = typeof req.body.skills === 'string'
          ? JSON.parse(req.body.skills)
          : req.body.skills;
      } catch {
        return res.status(400).json({ error: 'skills must be a valid JSON array.' });
      }
    }

    if (Array.isArray(skills) && skills.length > 20) {
      return res.status(400).json({ error: 'maximum 20 skills allowed.' });
    }

    await updateUserInfo(userID, {
      phone:      phone?.trim()      || null,
      university: university?.trim() || null,
    });

    await updateStudentProfile(userID, {
      bio:            bio?.trim()           || null,
      degree:         degree?.trim()        || null,
      graduationYear: graduationYear ? parseInt(graduationYear) : null,
      portfolioURL:   portfolioURL?.trim()  || null,
      linkedInURL:    linkedInURL?.trim()   || null,
      isAvailable:    isAvailable !== undefined
        ? (isAvailable === true || isAvailable === 'true' ? 1 : 0) : 1,
    });

    if (Array.isArray(skills)) {
      await replaceSkills(userID, skills);
    }

    if (publish !== undefined) {
      await setPublishStatus(userID, publish === true || publish === 'true' ? 1 : 0);
    }

    if (req.files?.profilePic?.[0]?.path) {
      const { updateProfilePic } = require('../auth/authModel');
      await updateProfilePic(req.user.email, req.files.profilePic[0].path);
    }

    const profile       = await getStudentProfile(userID);
    const updatedSkills = await getStudentSkills(userID);

    res.json({
      message: publish ? 'profile published.' : 'profile saved as draft.',
      profile,
      skills: updatedSkills,
    });
  } catch (err) {
    console.error('updateProfile error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── PUBLISH / UNPUBLISH ──────────────────────────────────────────────────────
const togglePublish = async (req, res) => {
  try {
    const userID      = req.user.id;
    const { publish } = req.body;
    if (publish === undefined) return res.status(400).json({ error: 'publish field required (true or false).' });
    await setPublishStatus(userID, publish ? 1 : 0);
    res.json({ message: publish ? 'profile is now public.' : 'profile saved as draft.' });
  } catch (err) {
    console.error('togglePublish error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── UPLOAD CV ────────────────────────────────────────────────────────────────
const uploadCV = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded.' });
    await updateCVURL(req.user.id, req.file.path);
    res.json({ message: 'cv uploaded successfully.', cvURL: req.file.path });
  } catch (err) {
    console.error('uploadCV error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── DELETE CV ────────────────────────────────────────────────────────────────
const deleteCV = async (req, res) => {
  try {
    await updateCVURL(req.user.id, null);
    res.json({ message: 'cv removed.' });
  } catch (err) {
    console.error('deleteCV error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── ADD SKILL ────────────────────────────────────────────────────────────────
const addSkillHandler = async (req, res) => {
  try {
    const { skillName } = req.body;
    if (!skillName?.trim()) return res.status(400).json({ error: 'skill name is required.' });
    if (skillName.trim().length > 50) return res.status(400).json({ error: 'skill name too long (max 50 chars).' });

    const existing = await getStudentSkills(req.user.id);
    if (existing.length >= 20) {
      return res.status(400).json({ error: 'maximum 20 skills allowed.' });
    }

    await addSkill(req.user.id, skillName);
    const skills = await getStudentSkills(req.user.id);
    res.json({ message: 'skill added.', skills });
  } catch (err) {
    console.error('addSkill error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

// ─── REMOVE SKILL ─────────────────────────────────────────────────────────────
const removeSkillHandler = async (req, res) => {
  try {
    const skillName = decodeURIComponent(req.params.skillName);
    if (!skillName?.trim()) return res.status(400).json({ error: 'skill name is required.' });
    await removeSkill(req.user.id, skillName);
    const skills = await getStudentSkills(req.user.id);
    res.json({ message: 'skill removed.', skills });
  } catch (err) {
    console.error('removeSkill error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

module.exports = {
  getMyProfile, getProfile, browseStudents, updateProfile, togglePublish,
  uploadCV, deleteCV, addSkillHandler, removeSkillHandler,
};