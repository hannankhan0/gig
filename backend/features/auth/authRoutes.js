// features/auth/authRoutes.js
// only 2 routes — firebase handles everything else

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary }        = require('../../config/cloudinary');
const { register, login, devAdminLogin }   = require('./authController');

// cloudinary storage for profile pictures

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'gradeandgrind/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 300, height: 300, crop: 'fill' }],
  },
});

const upload = multer({ storage });

// POST /api/auth/register — save profile after firebase signup
// frontend sends firebase token in Authorization header
router.post('/register',
  upload.fields([{ name: 'profilePic', maxCount: 1 }]),
  register
);

// POST /api/auth/login — verify firebase token, return user profile
router.post('/login', login);

// Local development helper while Firebase service-account credentials are being fixed.
router.post('/dev-admin-login', devAdminLogin);

module.exports = router;
