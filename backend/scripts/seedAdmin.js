const { admin } = require('../config/firebase');
const { sql, poolPromise } = require('../config/db');

const email = process.env.ADMIN_EMAIL || 'admin@gradeandgrind.com';
const password = process.env.ADMIN_PASSWORD || 'Admin@12345';

const ensureFirebaseAdmin = async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, {
      password,
      emailVerified: true,
      disabled: false,
    });
    return user.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const user = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      disabled: false,
    });
    return user.uid;
  }
};

const ensureSqlAdmin = async () => {
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
};

(async () => {
  const uid = await ensureFirebaseAdmin();
  await ensureSqlAdmin();
  console.log(`Admin ready: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Firebase UID: ${uid}`);
  process.exit(0);
})().catch((err) => {
  console.error('Admin seed failed:', err.message);
  process.exit(1);
});
