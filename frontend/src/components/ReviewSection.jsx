// src/components/ReviewSection.jsx
// Review & Rating System — US-13
// Drop this inside a completed gig detail page or profile page.
//
// Props (gig-context mode — show form + gig reviews):
//   gigID       : number   — the completed gig
//   revieweeID  : number   — who the current user is reviewing
//   revieweeName: string
//
// Props (profile mode — show a user's review feed):
//   profileUserID : number  — whose reviews to show
//   readOnly      : true    — hide the submission form

import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ── Star Rating Input ─────────────────────────────────────────────────────────
function StarInput({ value, onChange, disabled }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div style={{ display: 'flex', gap: '6px', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => !disabled && setHovered(0)}
          style={{
            fontSize: '2rem',
            lineHeight: 1,
            color: star <= (hovered || value) ? '#f59e0b' : '#2a2a2a',
            transition: 'color 0.12s ease',
            userSelect: 'none',
            filter: star <= (hovered || value) ? 'drop-shadow(0 0 6px #f59e0b88)' : 'none',
          }}
          title={`${star} star${star > 1 ? 's' : ''}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ── Star Display (read-only) ──────────────────────────────────────────────────
function StarDisplay({ value, size = '1rem' }) {
  return (
    <span style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            fontSize: size,
            color: star <= value ? '#f59e0b' : '#2a2a2a',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ── Utilities (outside components — pure functions) ───────────────────────────
const timeAgo = (dateStr) => {
  const diff = new Date().getTime() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d} days ago`;
  const m = Math.floor(d / 30);
  return `${m} month${m > 1 ? 's' : ''} ago`;
};

// ── Review Card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  const initials = review.ReviewerName
    ? review.ReviewerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div
      style={{
        background: '#1e1e1e',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f59e0b44')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {review.ReviewerPic ? (
          <img
            src={review.ReviewerPic}
            alt={review.ReviewerName}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#0f0f0f',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
              {review.ReviewerName}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '99px',
                background: review.ReviewerRole === 'client' ? '#f59e0b22' : '#22c55e22',
                color: review.ReviewerRole === 'client' ? '#f59e0b' : '#22c55e',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {review.ReviewerRole}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '2px' }}>
            {timeAgo(review.CreatedAt)}
            {review.GigTitle && (
              <> · <span style={{ color: '#f59e0baa' }}>{review.GigTitle}</span></>
            )}
          </div>
        </div>

        <StarDisplay value={review.Rating} size="1.1rem" />
      </div>

      {/* Review text */}
      {review.ReviewText && (
        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: '#ccc',
            lineHeight: '1.6',
            borderLeft: '3px solid #f59e0b44',
            paddingLeft: '14px',
          }}
        >
          {review.ReviewText}
        </p>
      )}
    </div>
  );
}

// ── Rating Summary Badge ──────────────────────────────────────────────────────
function RatingSummary({ average, total }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: '#1e1e1e',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '24px',
      }}
    >
      <span
        style={{
          fontSize: '2.4rem',
          fontWeight: 800,
          color: '#f59e0b',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Number(average).toFixed(1)}
      </span>
      <div>
        <StarDisplay value={Math.round(average)} size="1.2rem" />
        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '3px' }}>
          {total} review{total !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

// ── Review Form ───────────────────────────────────────────────────────────────
function ReviewForm({ gigID, revieweeID, revieweeName, onSuccess }) {
  const [rating,     setRating]     = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [submitted,  setSubmitted]  = useState(false);

  const MAX_CHARS = 500;
  const remaining = MAX_CHARS - reviewText.length;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a star rating before submitting.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await API.post('/reviews', {
        gigID,
        revieweeID,
        rating,
        reviewText: reviewText.trim() || undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          background: '#1e1e1e',
          border: '1px solid #22c55e44',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: '#22c55e',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Review submitted!</div>
        <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
          Your review of {revieweeName} is now public.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#1e1e1e',
        border: '1px solid #2a2a2a',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          Rate your experience with{' '}
          <span style={{ color: '#f59e0b' }}>{revieweeName}</span>
        </h3>
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#888' }}>
          Reviews are permanent and publicly visible. You cannot edit after submitting.
        </p>
      </div>

      {/* Star input */}
      <div>
        <label
          style={{ fontSize: '0.82rem', color: '#888', display: 'block', marginBottom: '8px' }}
        >
          Rating <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <StarInput value={rating} onChange={setRating} disabled={loading} />
        {rating > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '6px', display: 'block' }}>
            {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
          </span>
        )}
      </div>

      {/* Text input */}
      <div>
        <label
          style={{ fontSize: '0.82rem', color: '#888', display: 'block', marginBottom: '8px' }}
        >
          Review{' '}
          <span style={{ color: '#555', fontStyle: 'italic' }}>(optional)</span>
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) setReviewText(e.target.value);
          }}
          placeholder={`Share details about working with ${revieweeName}…`}
          rows={4}
          disabled={loading}
          style={{
            width: '100%',
            background: '#141414',
            border: `1px solid ${reviewText.length > 0 ? '#f59e0b44' : '#2a2a2a'}`,
            borderRadius: '10px',
            padding: '12px 14px',
            color: '#fff',
            fontSize: '0.9rem',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
            lineHeight: '1.6',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#f59e0b88')}
          onBlur={(e) =>
            (e.target.style.borderColor = reviewText.length > 0 ? '#f59e0b44' : '#2a2a2a')
          }
        />
        <div
          style={{
            textAlign: 'right',
            fontSize: '0.75rem',
            marginTop: '4px',
            color: remaining < 50 ? '#ef4444' : '#555',
          }}
        >
          {remaining} / {MAX_CHARS}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#ef444415',
            border: '1px solid #ef444444',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          background: rating > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#2a2a2a',
          color: rating > 0 ? '#0f0f0f' : '#555',
          border: 'none',
          borderRadius: '10px',
          padding: '12px 24px',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: rating > 0 && !loading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          alignSelf: 'flex-start',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Submitting…' : 'Submit Review'}
      </button>
    </div>
  );
}

// ── Window Countdown ──────────────────────────────────────────────────────────
function WindowBadge({ daysRemaining }) {
  const urgent = daysRemaining <= 2;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '99px',
        background: urgent ? '#ef444415' : '#f59e0b15',
        border: `1px solid ${urgent ? '#ef444444' : '#f59e0b44'}`,
        fontSize: '0.78rem',
        color: urgent ? '#ef4444' : '#f59e0b',
        fontWeight: 600,
      }}
    >
      <span>{urgent ? '⚠' : '⏱'}</span>
      {daysRemaining > 0
        ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left to review`
        : 'Review window closes today'}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReviewSection({
  // gig-context props
  gigID,
  revieweeID,
  revieweeName,
  // profile props
  profileUserID,
  readOnly = false,
}) {
  const { user }         = useAuth();
  const [reviews,  setReviews]  = useState([]);
  const [summary,  setSummary]  = useState({ AverageRating: 0, TotalReviews: 0 });
  const [window_,  setWindow]   = useState(null);   // review window status for gig mode
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Determine which user's reviews to show
  const targetUserID = profileUserID ?? revieweeID;

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch reviews independently so a window-status failure doesn't kill the feed
      const reviewsRes = await API.get(`/reviews/user/${targetUserID}`);
      const data = reviewsRes.data;
      setSummary({ AverageRating: data.AverageRating, TotalReviews: data.TotalReviews });
      setReviews(data.reviews || []);

      // Window status is optional — only needed to show the submit form
      if (gigID && !readOnly) {
        try {
          const windowRes = await API.get(`/reviews/gig/${gigID}/status`);
          setWindow(windowRes.data);
        } catch {
          // Gig not completed yet or CompletedAt is null — that's fine, just hide the form
          setWindow(null);
        }
      }
    } catch (err) {
      setError('Failed to load reviews.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserID != null) fetchData();
  }, [targetUserID, gigID]);

  // Show the form when:
  //  • not read-only
  //  • a gigID is provided
  //  • window data loaded and the window is open
  //  • current user hasn't reviewed yet
  const showForm =
    !readOnly &&
    gigID &&
    window_ &&
    window_.IsOpen &&
    !window_.hasReviewed &&
    user?.id !== revieweeID;

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#555', fontSize: '0.9rem' }}>
        Loading reviews…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '20px',
          background: '#ef444415',
          borderRadius: '10px',
          color: '#ef4444',
          fontSize: '0.9rem',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        fontFamily: 'inherit',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
          Reviews
        </h2>
        {window_?.IsOpen && !window_.hasReviewed && !readOnly && (
          <WindowBadge daysRemaining={window_.DaysRemaining} />
        )}
        {window_?.hasReviewed && (
          <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>✓ You reviewed this gig</span>
        )}
      </div>

      {/* Aggregate rating */}
      {summary.TotalReviews > 0 && (
        <RatingSummary average={summary.AverageRating} total={summary.TotalReviews} />
      )}

      {/* Submission form */}
      {showForm && (
        <ReviewForm
          gigID={gigID}
          revieweeID={revieweeID}
          revieweeName={revieweeName}
          onSuccess={fetchData}
        />
      )}

      {/* Review feed */}
      {reviews.length === 0 ? (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            color: '#555',
            background: '#1a1a1a',
            borderRadius: '12px',
            border: '1px dashed #2a2a2a',
          }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>☆</div>
          <div style={{ fontSize: '0.9rem' }}>No reviews yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reviews.map((r) => (
            <ReviewCard key={r.ReviewID} review={r} />
          ))}
        </div>
      )}
    </section>
  );
}