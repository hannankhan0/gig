// features/leaderboard/leaderboardController.js

const model = require('./leaderboardModel');

// GET /api/leaderboard?university=FAST-NU&skill=React
const getLeaderboard = async (req, res) => {
  try {
    const { university = null, skill = null } = req.query;
    const rows = await model.getLeaderboard(
      university || null,
      skill      || null,
    );
    return res.json({ leaderboard: rows });
  } catch (err) {
    console.error('getLeaderboard error:', err.message);
    return res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
};

// GET /api/leaderboard/my-rank  (auth required — student only)
const getMyRank = async (req, res) => {
  try {
    const rank = await model.getMyRank(req.user.id);
    return res.json({ rank });   // null if not yet qualified
  } catch (err) {
    console.error('getMyRank error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch your rank.' });
  }
};

// GET /api/leaderboard/universities
const getUniversities = async (req, res) => {
  try {
    const universities = await model.getUniversities();
    return res.json({ universities });
  } catch (err) {
    console.error('getUniversities error:', err.message);
    return res.status(500).json({ error: 'Failed to load universities.' });
  }
};

module.exports = { getLeaderboard, getMyRank, getUniversities };