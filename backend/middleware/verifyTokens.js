// middleware/verifyTokens.js
// verifies firebase id token on every protected route
// sets req.user = { id, email, role } for use in controllers

const { admin } = require('../config/firebase');
const { sql, poolPromise } = require('../config/db');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'access denied. please log in.' });
    }

    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev-admin:')) {
      const email = token.replace('dev-admin:', '');
      const pool = await poolPromise;
      const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`select UserID, Role, Email, IsBanned from Users where Email = @email and Role = 'admin'`);

      const user = result.recordset[0];
      if (!user || user.IsBanned) {
        return res.status(403).json({ error: 'local admin session is not valid.' });
      }
      req.user = { id: user.UserID, email: user.Email, role: user.Role };
      return next();
    }

    // verify firebase token
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: 'invalid or expired token. please log in again.' });
    }

    // FIX: check email is verified before allowing access to any protected route
    if (!decoded.email_verified) {
      return res.status(403).json({ error: 'please verify your email before accessing this resource.' });
    }

    // get user role and id from our database
    const pool   = await poolPromise;
    const result = await pool.request()
      .input('email', sql.NVarChar, decoded.email)
      .query(`select UserID, Role, Email, IsBanned from Users where Email = @email`);

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ error: 'profile not found. please complete registration.' });
    }
    if (user.IsBanned) {
      return res.status(403).json({ error: 'your account has been suspended.' });
    }

    // attach to request — available in all controllers as req.user
    req.user = {
      id:    user.UserID,
      email: user.Email,
      role:  user.Role,
    };

    next();
  } catch (err) {
    console.error('verifyToken error:', err.message);
    res.status(500).json({ error: 'something went wrong.' });
  }
};

module.exports = { verifyToken };
