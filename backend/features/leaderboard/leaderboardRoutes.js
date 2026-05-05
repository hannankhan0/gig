// features/leaderboard/leaderboardRoutes.js

const express    = require('express');
const router     = express.Router();
const controller = require('./leaderboardController');
const { verifyToken } = require('../../middleware/verifyTokens');
const { roleGuard }   = require('../../middleware/roleGuard');

// GET /api/leaderboard — public
router.get('/', controller.getLeaderboard);

// GET /api/leaderboard/universities — public (for filter dropdown)
router.get('/universities', controller.getUniversities);

// GET /api/leaderboard/my-rank — student only
router.get('/my-rank', verifyToken, roleGuard('student'), controller.getMyRank);

module.exports = router;