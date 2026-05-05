const admin = require('firebase-admin');
require('dotenv').config();

const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .replace(/^"|"[,]?$/g, '')
  .replace(/,\s*$/, '');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

module.exports = { admin };
