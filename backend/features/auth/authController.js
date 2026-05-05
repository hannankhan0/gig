// features/auth/authController.js
// handles saving profile after firebase registration
// and returning user profile on login

const { admin } = require('../../config/firebase');
const { sql, poolPromise } = require('../../config/db');
const {
  findUserByEmail,
  createUser,
  updateProfilePic,
  createWallet,
  createStudentProfile,
  createClientProfile,
} = require('./authModel');

// ─── REGISTER ─────────────────────────────────────────────────────────────────
// POST /api/auth/register
// called after firebase creates the account and sends verification email
// frontend sends firebase token + profile fields + optional profile pic
// role must be 'student' or 'client' — sent from the signup form

const register = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'firebase token required.' });
    }

    // verify firebase token to get email
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: 'invalid firebase token.' });
    }

    const email = decoded.email;
    const { fullName, phone, university, role } = req.body;

    // --- validation ---
    if (!fullName || !role) {
      return res.status(400).json({ error: 'full name and role are required.' });
    }
    if (!['student', 'client'].includes(role)) {
      return res.status(400).json({ error: 'role must be student or client.' });
    }
    if (phone && !/^03\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'phone must be 11 digits starting with 03.' });
    }

    // --- check if already registered ---
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'account already exists. please log in.' });
    }

    // --- save user to db ---
    const userID = await createUser({ fullName, email, phone, university, role });

    // --- save profile pic if uploaded ---
    const profilePicUrl = req.files?.profilePic?.[0]?.path || null;
    if (profilePicUrl) {
      await updateProfilePic(email, profilePicUrl);
    }

    // --- create wallet for this user ---
    await createWallet(userID);

    // --- create role-specific profile ---
    if (role === 'student') {
      await createStudentProfile(userID);
    } else {
      await createClientProfile(userID);
    }

    res.status(201).json({
      message: 'account created successfully.',
      role,
    });

  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'something went wrong. please try again.' });
  }
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// firebase handles password checking on the frontend
// frontend sends firebase token → we verify it → return user profile

const login = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'firebase token required.' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: 'invalid or expired token. please log in again.' });
    }

    // get profile from our database
    const user = await findUserByEmail(decoded.email);

    if (!user) {
      return res.status(404).json({
        error: 'profile not found. please complete registration.',
        needsRegistration: true,
      });
    }
    if (user.IsBanned) {
      return res.status(403).json({ error: 'your account has been suspended. contact support.' });
    }
    if (!decoded.email_verified && user.Role !== 'admin') {
      return res.status(403).json({
        error: 'please verify your email first. check your inbox for the verification link.',
      });
    }

    res.json({
      message: 'login successful',
      user: {
        id:         user.UserID,
        fullName:   user.FullName,
        email:      user.Email,
        role:       user.Role,
        university: user.University,
        profilePic: user.ProfilePic,
        isVerified: user.IsVerified,
      },
    });

  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'something went wrong. please try again.' });
  }
};

const devAdminLogin = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'not found.' });
    }

    const email = process.env.ADMIN_EMAIL || 'admin@gradeandgrind.com';
    const pool = await poolPromise;

    await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        if exists (select 1 from Users where Email = @email)
          update Users
          set Role = 'admin', IsVerified = 1, IsBanned = 0
          where Email = @email
        else
          insert into Users (FullName, Email, Role, IsVerified, IsBanned)
          values ('Admin User', @email, 'admin', 1, 0)
      `);

    const user = await findUserByEmail(email);
    res.json({
      message: 'local admin login successful',
      devToken: `dev-admin:${email}`,
      user: {
        id: user.UserID,
        fullName: user.FullName,
        email: user.Email,
        role: user.Role,
        university: user.University,
        profilePic: user.ProfilePic,
        isVerified: user.IsVerified,
      },
    });
  } catch (err) {
    console.error('devAdminLogin error:', err.message);
    res.status(500).json({ error: 'could not start local admin session.' });
  }
};

module.exports = { register, login, devAdminLogin };
