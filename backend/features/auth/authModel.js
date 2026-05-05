// features/auth/authModel.js
// all database queries for authentication
// firebase handles passwords — we only store profile data

const { sql, poolPromise } = require('../../config/db');

// find user by email — used in verifyToken, login, register
const findUserByEmail = async (email) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('email', sql.NVarChar, email)
    .query(`select UserID, FullName, Email, Phone, University,
                   ProfilePic, Role, IsVerified, IsBanned, CreatedAt
            from Users
            where Email = @email`);
  return result.recordset[0];
};

// save user to db after firebase account is created
// role is sent from the frontend signup form (student or client)
const createUser = async ({ fullName, email, phone, university, role }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('fullName',   sql.NVarChar, fullName)
    .input('email',      sql.NVarChar, email)
    .input('phone',      sql.NVarChar, phone      || null)
    .input('university', sql.NVarChar, university || null)
    .input('role',       sql.NVarChar, role)
    .query(`insert into Users (FullName, Email, Phone, University, Role)
            output inserted.UserID
            values (@fullName, @email, @phone, @university, @role)`);
  return result.recordset[0].UserID;
};

// save profile picture url after cloudinary upload
const updateProfilePic = async (email, profilePicUrl) => {
  const pool = await poolPromise;
  await pool.request()
    .input('email',      sql.NVarChar, email)
    .input('profilePic', sql.NVarChar, profilePicUrl || null)
    .query(`update Users
            set ProfilePic = @profilePic
            where Email = @email`);
};

// create wallet for new user — every user gets one on registration
const createWallet = async (userID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID', sql.Int, userID)
    .query(`insert into Wallets (UserID, TokenBalance)
            values (@userID, 0)`);
};

// create empty student profile after registration
const createStudentProfile = async (userID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID', sql.Int, userID)
    .query(`insert into StudentProfiles (UserID)
            values (@userID)`);
};

// create empty client profile after registration
const createClientProfile = async (userID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID', sql.Int, userID)
    .query(`insert into ClientProfiles (UserID)
            values (@userID)`);
};

module.exports = {
  findUserByEmail,
  createUser,
  updateProfilePic,
  createWallet,
  createStudentProfile,
  createClientProfile,
};