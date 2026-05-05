// features/reviews/reviewModel.js

const { sql, poolPromise } = require('../../config/db');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when the gig is completed AND both the reviewer and reviewee
 * were actual participants (student + client pair on the same gig).
 */
const _verifyParticipants = async (pool, gigID, reviewerID, revieweeID) => {
  const result = await pool.request()
    .input('gigID',      sql.Int, gigID)
    .input('reviewerID', sql.Int, reviewerID)
    .input('revieweeID', sql.Int, revieweeID)
    .query(`
      select 1
      from Gigs g
      join Applications a on a.GigID = g.GigID and a.Status = 'accepted'
      where g.GigID   = @gigID
        and g.Status  = 'completed'
        -- reviewer and reviewee must be the two sides of this gig
        and (
              (g.ClientID  = @reviewerID and a.StudentID = @revieweeID)
           or (a.StudentID = @reviewerID and g.ClientID  = @revieweeID)
            )
    `);
  return result.recordset.length > 0;
};

/**
 * Returns true when the gig was completed within the last 7 days.
 * We use CompletedAt; fall back to UpdatedAt if that column doesn't exist.
 */
const _withinReviewWindow = async (pool, gigID) => {
  // Using a DATEDIFF on the most recent status transition.
  // Assumes Gigs has a CompletedAt column (set when status -> 'completed').
  // Adjust the column name below if yours differs.
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select 1
      from Gigs
      where GigID     = @gigID
        and Status    = 'completed'
        and CompletedAt IS NOT NULL
        and DATEDIFF(day, CompletedAt, SYSDATETIME()) <= 7
    `);
  return result.recordset.length > 0;
};

// ── Basic profanity filter ─────────────────────────────────────────────────────
// Extend this list or swap for a proper npm package (e.g. "bad-words") in prod.
const BANNED_WORDS = [
  'fuck', 'shit', 'bastard', 'bitch', 'asshole', 'cunt',
  'dick', 'piss', 'damn', 'hell', 'crap', 'slut', 'whore',
];

/**
 * Returns true when the text contains a banned word.
 * Case-insensitive, whole-word match (with word boundaries).
 */
const _containsProfanity = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`);
    return regex.test(lower);
  });
};

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Submit a review. Returns the new ReviewID.
 * Throws descriptive errors for every integrity/business-rule violation.
 */
const submitReview = async ({ gigID, reviewerID, revieweeID, rating, reviewText }) => {
  const pool = await poolPromise;

  // 1. Validate rating range (belt-and-suspenders; DB also enforces this)
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }

  // 2. Validate review text length
  if (reviewText && reviewText.length > 500) {
    throw new Error('Review text must not exceed 500 characters.');
  }

  // 3. Verify both users participated in this gig and it is completed
  const validPair = await _verifyParticipants(pool, gigID, reviewerID, revieweeID);
  if (!validPair) {
    throw new Error('You can only review someone you completed a gig with.');
  }

  // 4. Enforce 7-day review window
  const inWindow = await _withinReviewWindow(pool, gigID);
  if (!inWindow) {
    throw new Error('The 7-day review window for this gig has closed.');
  }

  // 5. One review per reviewer per gig (UNIQUE constraint will also catch this)
  const dupCheck = await pool.request()
    .input('gigID',      sql.Int, gigID)
    .input('reviewerID', sql.Int, reviewerID)
    .query(`
      select 1 from Reviews
      where GigID = @gigID and ReviewerID = @reviewerID
    `);
  if (dupCheck.recordset.length > 0) {
    throw new Error('You have already submitted a review for this gig.');
  }

  // 6. Profanity check — store anyway but flag for admin moderation
  const isFlagged = _containsProfanity(reviewText) ? 1 : 0;

  // 7. Insert
  const result = await pool.request()
    .input('gigID',      sql.Int,      gigID)
    .input('reviewerID', sql.Int,      reviewerID)
    .input('revieweeID', sql.Int,      revieweeID)
    .input('rating',     sql.TinyInt,  rating)
    .input('Comment', sql.NVarChar, reviewText || null)
    .input('isFlagged',  sql.Bit,      isFlagged)
    .query(`
      insert into Reviews (GigID, ReviewerID, RevieweeID, Rating, Comment, IsFlagged)
      output inserted.ReviewID
      values (@gigID, @reviewerID, @revieweeID, @rating, @Comment, @isFlagged)
    `);

  return result.recordset[0].ReviewID;
};

// ── Read operations ───────────────────────────────────────────────────────────

/**
 * All public reviews for a user (used on profile pages).
 * Excludes flagged reviews from the public feed.
 */
const getReviewsForUser = async (revieweeID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('revieweeID', sql.Int, revieweeID)
    .query(`
      select
        r.ReviewID,
        r.Rating,
        r.Comment,
        r.CreatedAt,
        r.IsFlagged,
        u.FullName    as ReviewerName,
        u.ProfilePic  as ReviewerPic,
        u.Role        as ReviewerRole,
        g.Title       as GigTitle,
        g.GigID
      from Reviews r
      join Users u on u.UserID = r.ReviewerID
      join Gigs  g on g.GigID  = r.GigID
      where r.RevieweeID = @revieweeID
        and r.IsFlagged  = 0          -- hide flagged content from public view
      order by r.CreatedAt desc
    `);
  return result.recordset;
};

/**
 * Aggregated rating summary for a user (avg + count).
 * Uses the view created in the migration for efficiency.
 */
const getRatingSummary = async (revieweeID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('revieweeID', sql.Int, revieweeID)
    .query(`
      select
        coalesce(AverageRating, 0) as AverageRating,
        coalesce(TotalReviews,  0) as TotalReviews
      from vw_UserRatings
      where UserID = @revieweeID
    `);
  // Return zeros if user has no reviews yet
  return result.recordset[0] ?? { AverageRating: 0, TotalReviews: 0 };
};

/**
 * Check whether a specific user has already reviewed a specific gig.
 * Used on the frontend to show/hide the review form.
 */
const hasReviewed = async (gigID, reviewerID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID',      sql.Int, gigID)
    .input('reviewerID', sql.Int, reviewerID)
    .query(`
      select 1 from Reviews
      where GigID = @gigID and ReviewerID = @reviewerID
    `);
  return result.recordset.length > 0;
};

/**
 * Get both reviews for a completed gig (student review + client review).
 * Useful on the gig-detail page to show the full exchange.
 */
const getReviewsByGig = async (gigID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select
        r.ReviewID,
        r.Rating,
        r.Comment,
        r.CreatedAt,
        r.IsFlagged,
        reviewer.FullName   as ReviewerName,
        reviewer.ProfilePic as ReviewerPic,
        reviewer.Role       as ReviewerRole,
        reviewee.FullName   as RevieweeName,
        reviewee.Role       as RevieweeRole
      from Reviews r
      join Users reviewer on reviewer.UserID = r.ReviewerID
      join Users reviewee on reviewee.UserID = r.RevieweeID
      where r.GigID = @gigID
      order by r.CreatedAt asc
    `);
  return result.recordset;
};

/**
 * Check whether a gig is still within the 7-day review window.
 * Exposed so the frontend can display a countdown / disable the form.
 */
const getReviewWindowStatus = async (gigID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('gigID', sql.Int, gigID)
    .query(`
      select
        CompletedAt,
        DATEDIFF(day, CompletedAt, SYSDATETIME())      as DaysElapsed,
        7 - DATEDIFF(day, CompletedAt, SYSDATETIME())  as DaysRemaining,
        CASE
          WHEN DATEDIFF(day, CompletedAt, SYSDATETIME()) <= 7 THEN 1
          ELSE 0
        END as IsOpen
      from Gigs
      where GigID = @gigID and Status = 'completed'
    `);
  return result.recordset[0] ?? null;
};

module.exports = {
  submitReview,
  getReviewsForUser,
  getRatingSummary,
  hasReviewed,
  getReviewsByGig,
  getReviewWindowStatus,
};