// features/reviews/reviewController.js
// HTTP handlers for all review & rating endpoints (US-13)

const reviewModel = require('./reviewModel');

// ── POST /api/reviews ─────────────────────────────────────────────────────────
// Submit a new review for a completed gig.
// Body: { gigID, revieweeID, rating, reviewText? }
// Auth: verifyToken (student or client)
const submitReview = async (req, res) => {
  try {
    const reviewerID = req.user.id;
    const { gigID, revieweeID, rating, reviewText } = req.body;

    // basic input presence check
    if (!gigID || !revieweeID || !rating) {
      return res.status(400).json({
        error: 'gigID, revieweeID, and rating are required.',
      });
    }

    // prevent self-review
    if (reviewerID === Number(revieweeID)) {
      return res.status(400).json({ error: 'You cannot review yourself.' });
    }

    const reviewID = await reviewModel.submitReview({
      gigID:      Number(gigID),
      reviewerID,
      revieweeID: Number(revieweeID),
      rating:     Number(rating),
      reviewText: reviewText?.trim() || null,
    });

    return res.status(201).json({
      message:  'Review submitted successfully.',
      reviewID,
    });
  } catch (err) {
    // business-rule errors thrown from the model come back as 400
    const clientErrors = [
      'Rating must be between 1 and 5.',
      'Review text must not exceed 500 characters.',
      'You can only review someone you completed a gig with.',
      'The 7-day review window for this gig has closed.',
      'You have already submitted a review for this gig.',
    ];
    if (clientErrors.includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('submitReview error:', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

// ── GET /api/reviews/user/:userID ─────────────────────────────────────────────
// Public: all non-flagged reviews on a user's profile.
const getReviewsForUser = async (req, res) => {
  try {
    const { userID } = req.params;
    const [reviews, summary] = await Promise.all([
      reviewModel.getReviewsForUser(Number(userID)),
      reviewModel.getRatingSummary(Number(userID)),
    ]);
    return res.json({ ...summary, reviews });
  } catch (err) {
    console.error('getReviewsForUser error:', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

// ── GET /api/reviews/gig/:gigID ───────────────────────────────────────────────
// Get both reviews exchanged on a specific gig.
const getReviewsByGig = async (req, res) => {
  try {
    const { gigID } = req.params;
    const reviews = await reviewModel.getReviewsByGig(Number(gigID));
    return res.json({ reviews });
  } catch (err) {
    console.error('getReviewsByGig error:', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

// ── GET /api/reviews/gig/:gigID/status ───────────────────────────────────────
// Check whether the review window is still open and whether the current user
// has already reviewed. Used to drive the frontend review form visibility.
// Auth: verifyToken
const getReviewWindowStatus = async (req, res) => {
  try {
    const { gigID }   = req.params;
    const reviewerID  = req.user.id;

    const [window, reviewed] = await Promise.all([
      reviewModel.getReviewWindowStatus(Number(gigID)),
      reviewModel.hasReviewed(Number(gigID), reviewerID),
    ]);

    if (!window) {
      return res.status(404).json({ error: 'Gig not found or not yet completed.' });
    }

    return res.json({ ...window, hasReviewed: reviewed });
  } catch (err) {
    console.error('getReviewWindowStatus error:', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

module.exports = {
  submitReview,
  getReviewsForUser,
  getReviewsByGig,
  getReviewWindowStatus,
};