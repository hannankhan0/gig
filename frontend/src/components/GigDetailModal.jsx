// src/components/GigDetailModal.jsx
// Shown when student clicks a matched gig card.
// Displays full gig info + apply button inline.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function GigDetailModal({ gig, alreadyApplied, onClose, onApplied }) {
  const navigate = useNavigate();
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const deadline = gig.Deadline ? new Date(gig.Deadline) : null;
  const deadlineStr = deadline
    ? deadline.toLocaleDateString('en-PK', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : 'No deadline set';

  const skills = gig.RequiredSkills
    ? gig.RequiredSkills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const matchColor = gig.matchScore >= 80 ? '#4ade80' : gig.matchScore >= 50 ? '#fbbf24' : '#f87171';

  const handleApply = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await API.post(`/gigs/${gig.GigID}/apply`, { coverLetter, applicationMessage: coverLetter });
      setSuccess(`Application submitted! Match score: ${res.data.matchScore}%`);
      if (onApplied) onApplied();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || data?.error || 'Failed to submit application.');
      if (data?.code === 'INSUFFICIENT_TOKENS' && window.confirm('Insufficient tokens. Open billing to buy a plan?')) {
        navigate('/billing');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style>{`
        @keyframes gdmIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        .gdm-scroll::-webkit-scrollbar { width: 4px; }
        .gdm-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px; }
      `}</style>

      <div
        className="gdm-scroll"
        style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderRadius: '20px',
          width: '100%', maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'gdmIn 0.22s ease both',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'sticky', top: '16px', float: 'right', marginRight: '16px',
            background: '#1e1e1e', border: '1px solid #2a2a2a',
            borderRadius: '8px', width: '32px', height: '32px',
            color: '#888', fontSize: '1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}
        >✕</button>

        <div style={{ padding: '28px' }}>

          {/* Category + match badge */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {gig.Category && (
              <span style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: '8px', padding: '4px 12px',
                fontSize: '0.75rem', color: '#888', fontWeight: 600,
              }}>{gig.Category}</span>
            )}
            {gig.matchScore > 0 && (
              <span style={{
                background: `${matchColor}18`, border: `1px solid ${matchColor}44`,
                borderRadius: '8px', padding: '4px 12px',
                fontSize: '0.75rem', color: matchColor, fontWeight: 700,
              }}>⚡ {gig.matchScore}% match</span>
            )}
          </div>

          {/* Title */}
          <h2 style={{ margin: '0 0 10px', fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
            {gig.Title}
          </h2>

          {/* Budget + deadline row */}
          <div style={{
            display: 'flex', gap: '16px', flexWrap: 'wrap',
            padding: '14px 0', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e',
            marginBottom: '20px',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Budget</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>
                {gig.Budget ? `PKR ${Number(gig.Budget).toLocaleString()}` : 'Negotiable'}
              </div>
            </div>
            <div style={{ width: '1px', background: '#1e1e1e' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>Deadline</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e5e5e5' }}>{deadlineStr}</div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Description</div>
            <p style={{ margin: 0, color: '#bbb', fontSize: '0.88rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {gig.Description || 'No description provided.'}
            </p>
          </div>

          {/* Required Skills */}
          {skills.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Required Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {skills.map(sk => (
                  <span key={sk} style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a',
                    borderRadius: '8px', padding: '5px 12px',
                    fontSize: '0.8rem', color: '#ccc', fontWeight: 500,
                  }}>{sk}</span>
                ))}
              </div>
            </div>
          )}

          {/* Apply section */}
          {alreadyApplied ? (
            <div style={{
              background: '#052e16', border: '1px solid #14532d',
              borderRadius: '12px', padding: '16px',
              color: '#4ade80', fontSize: '0.88rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ✓ You have already applied to this gig
            </div>
          ) : success ? (
            <div style={{
              background: '#052e16', border: '1px solid #14532d',
              borderRadius: '12px', padding: '16px',
              color: '#4ade80', fontSize: '0.88rem', fontWeight: 600,
            }}>✓ {success}</div>
          ) : (
            <div>
              <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: '20px', marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#aaa', marginBottom: '6px', fontWeight: 600 }}>
                  Message to Client <span style={{ color: '#444', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Send a short application message to the client..."
                  maxLength={1000}
                  rows={4}
                  style={{
                    width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
                    borderRadius: '10px', color: '#fff', padding: '10px 12px',
                    fontSize: '0.88rem', resize: 'vertical', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#f59e0b66')}
                  onBlur={e  => (e.target.style.borderColor = '#2a2a2a')}
                />
                <div style={{ color: '#444', fontSize: '0.72rem', textAlign: 'right', marginTop: '4px' }}>
                  {coverLetter.length}/1000
                </div>
              </div>

              {error && (
                <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '10px' }}>{error}</div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleApply}
                  disabled={submitting}
                  style={{
                    flex: 1, background: submitting ? '#555' : '#f59e0b',
                    color: '#000', border: 'none', borderRadius: '10px',
                    padding: '11px', fontWeight: 800, fontSize: '0.9rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Application →'}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: '#1a1a1a', color: '#aaa', border: '1px solid #2a2a2a',
                    borderRadius: '10px', padding: '11px 20px',
                    fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                  }}
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
