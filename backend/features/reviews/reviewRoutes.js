// features/reviews/reviewRoutes.js

const express    = require('express');
const router     = express.Router();
const controller = require('./reviewController');
const { verifyToken } = require('../../middleware/verifyTokens');
const { roleGuard }   = require('../../middleware/roleGuard');

// ── Public routes ─────────────────────────────────────────────────────────────

// GET /api/reviews/user/:userID
// Anyone can view a user's public review feed + aggregate rating.
router.get('/user/:userID', controller.getReviewsForUser);

// GET /api/reviews/gig/:gigID
// Anyone can view the reviews exchanged on a completed gig.
router.get('/gig/:gigID', controller.getReviewsByGig);

// ── Protected routes ──────────────────────────────────────────────────────────

// GET /api/reviews/gig/:gigID/status
// Auth users only — check window + whether they've already reviewed.
router.get(
  '/gig/:gigID/status',
  verifyToken,
  controller.getReviewWindowStatus,
);

// POST /api/reviews
// Students and clients can both submit reviews; admin cannot.
router.post(
  '/',
  verifyToken,
  roleGuard('student', 'client'),
  controller.submitReview,
);

module.exports = router;