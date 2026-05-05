// features/studentProfile/studProfRoutes.js

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary }        = require('../../config/cloudinary');
const { verifyToken }       = require('../../middleware/verifyTokens');
const { roleGuard }         = require('../../middleware/roleGuard');
const {
  getMyProfile,
  getProfile,
  browseStudents,
  updateProfile,
  togglePublish,
  uploadCV,
  deleteCV,
  addSkillHandler,
  removeSkillHandler,
} = require('./studProfController');

// ─── CLOUDINARY STORAGE ───────────────────────────────────────────────────────

const profilePicStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'gradeandgrind/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 300, height: 300, crop: 'fill' }],
  },
});

const cvStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'gradeandgrind/cvs',
    allowed_formats: ['pdf'],
    resource_type:   'raw',
    format:          'pdf',
  },
});

const uploadProfilePic = multer({ storage: profilePicStorage });
const uploadCVFile     = multer({
  storage: cvStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('only pdf files are allowed.'), false);
    }
  },
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// NOTE: /browse and /me must come before /:userID to avoid being matched as a userID

// GET /api/profile/browse — clients browse all published student profiles
router.get('/browse', verifyToken, browseStudents);

// GET /api/profile/me — student views own profile
router.get('/me', verifyToken, getMyProfile);

// GET /api/profile/:userID — view any student profile (published or draft based on role)
router.get('/:userID', verifyToken, getProfile);

// PUT /api/profile/me — update profile and skills (student only)
router.put('/me',
  verifyToken,
  roleGuard('student'),
  uploadProfilePic.fields([{ name: 'profilePic', maxCount: 1 }]),
  updateProfile
);

// PATCH /api/profile/me/publish — publish or unpublish (student only)
router.patch('/me/publish', verifyToken, roleGuard('student'), togglePublish);

// POST /api/profile/me/cv — upload CV pdf (student only)
router.post('/me/cv',
  verifyToken,
  roleGuard('student'),
  (req, res, next) => {
    uploadCVFile.single('cv')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  uploadCV
);

// DELETE /api/profile/me/cv — remove CV (student only)
router.delete('/me/cv', verifyToken, roleGuard('student'), deleteCV);

// POST /api/profile/me/skills — add a skill (student only)
router.post('/me/skills', verifyToken, roleGuard('student'), addSkillHandler);

// DELETE /api/profile/me/skills/:skillName — remove a skill (student only)
router.delete('/me/skills/:skillName', verifyToken, roleGuard('student'), removeSkillHandler);

module.exports = router;