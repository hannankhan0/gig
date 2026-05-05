// server.js
const express = require('express');
const cors    = require('cors');
require('dotenv').config();

require('./config/db');
const { ensureSchema } = require('./config/ensureSchema');

const authRoutes        = require('./features/auth/authRoutes');
const profileRoutes     = require('./features/studentProfile/studProfRoutes');
const gigRoutes         = require('./features/gigs/gigRoutes');
const reviewRoutes      = require('./features/reviews/reviewRoutes');
const leaderboardRoutes = require('./features/leaderboard/leaderboardRoutes');
const chatRoutes        = require('./features/chat/chatRoutes');
const adminRoutes       = require('./features/admin/adminRoutes');
const walletRoutes      = require('./features/wallet/walletRoutes');

// future routes uncomment as each feature is built:
// const applicationRoutes = require('./features/applications/applicationRoutes');
// const walletRoutes      = require('./features/wallet/walletRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/profile',     profileRoutes);
app.use('/api/gigs',        gigRoutes);
app.use('/api/reviews',     reviewRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api',             chatRoutes);
app.use('/api',             walletRoutes);
app.use('/api/admin',       adminRoutes);

// app.use('/api/applications', applicationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'grade and grind backend is running' });
});

const PORT = process.env.PORT || 4000;
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('schema initialization failed:', err.message);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err.message)
})

process.on('uncaughtException', (err) => {
  console.error('uncaught exception:', err.message)
})
