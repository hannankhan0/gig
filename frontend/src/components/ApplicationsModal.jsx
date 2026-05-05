// src/components/ApplicationsModal.jsx
// client views applicants for a gig and can accept one
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

function StarRating({ rating }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: '0.78rem', letterSpacing: '1px' }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span style={{ color: '#666', marginLeft: '4px' }}>{rating > 0 ? rating.toFixed(1) : 'No reviews'}</span>
    </span>
  );
}

function MatchBadge({ score }) {
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      {score}% match
    </span>
  );
}

function StatusPill({ status }) {
  const map = {
    pending:  { bg: '#1a1a2e', color: '#a78bfa', border: '#4c1d95' },
    accepted: { bg: '#052e16', color: '#4ade80', border: '#14532d' },
    rejected: { bg: '#2d1212', color: '#f87171', border: '#7f1d1d' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', padding: '3px 12px', fontSize: '0.7rem', fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

export default function ApplicationsModal({ gigID, onClose, onAccepted }) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [accepting,    setAccepting]    = useState(null); // applicationID being accepted
  const [error,        setError]        = useState('');
  const [expanded,     setExpanded]     = useState(null); // expanded cover letter

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get(`/gigs/${gigID}/applications`);
        setApplications(res.data.applications);
      } catch (err) {
        setError(err.response?.data?.error || 'Could not load applications.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gigID]);

  const handleAccept = async (appID) => {
    if (!window.confirm('Accept this applicant? All other applications will be rejected and the gig will move to In Progress.')) return;
    setAccepting(appID);
    try {
      await API.patch(`/gigs/applications/${appID}/accept`, { gigID });
      onAccepted();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept application.');
      setAccepting(null);
    }
  };

  const handleAcceptRequest = async (conversationID) => {
    if (!conversationID) return;
    try {
      await API.patch(`/conversations/${conversationID}/accept-request`);
      setApplications(applications.map(app =>
        app.ConversationID === conversationID ? { ...app, ConversationStatus: 'active' } : app
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept message request.');
    }
  };

  const hasAccepted = applications.some(a => a.Status === 'accepted');

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Applicants</h2>
            <p style={styles.sub}>
              {applications.length} application{applications.length !== 1 ? 's' : ''} — sorted by match score
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.center}><div style={styles.spinner} /></div>
          ) : error ? (
            <p style={styles.errorText}>{error}</p>
          ) : applications.length === 0 ? (
            <p style={styles.empty}>No applications yet.</p>
          ) : (
            applications.map(app => (
              <div key={app.ApplicationID} style={{
                ...styles.card,
                borderColor: app.Status === 'accepted' ? '#14532d' : '#1e1e1e',
              }}>
                {/* Applicant info row */}
                <div style={styles.cardTop}>
                  <div style={styles.avatar}>
                    {app.ProfilePic
                      ? <img src={app.ProfilePic} alt="" style={styles.avatarImg} />
                      : <span style={styles.avatarInitial}>{app.StudentName?.[0]}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.studentName}>{app.StudentName}</div>
                    <div style={styles.studentMeta}>
                      {app.Degree && <span>{app.Degree}</span>}
                      {app.University && <span> · {app.University}</span>}
                    </div>
                    <StarRating rating={app.AverageRating} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <MatchBadge score={app.MatchScore} />
                    <StatusPill status={app.Status} />
                  </div>
                </div>

                {/* Bio */}
                {app.Bio && (
                  <p style={styles.bio}>{app.Bio}</p>
                )}

                {/* Cover letter */}
                {app.CoverLetter && (
                  <div style={styles.coverLetterWrap}>
                    <button
                      style={styles.toggleBtn}
                      onClick={() => setExpanded(expanded === app.ApplicationID ? null : app.ApplicationID)}
                    >
                      {expanded === app.ApplicationID ? '▲ Hide' : '▼ Cover letter'}
                    </button>
                    {expanded === app.ApplicationID && (
                      <p style={styles.coverLetterText}>{app.CoverLetter}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {app.ConversationID && app.ConversationStatus === 'request' && (
                  <button
                    style={styles.secondaryBtn}
                    onClick={() => handleAcceptRequest(app.ConversationID)}
                  >
                    Accept Message Request
                  </button>
                )}
                {app.ConversationID && app.ConversationStatus !== 'request' && (
                  <button
                    style={styles.secondaryBtn}
                    onClick={() => navigate(`/messages?conversation=${app.ConversationID}`)}
                  >
                    Open Chat
                  </button>
                )}
                {app.Status === 'pending' && !hasAccepted && (
                  <button
                    style={{ ...styles.acceptBtn, opacity: accepting ? 0.6 : 1 }}
                    onClick={() => handleAccept(app.ApplicationID)}
                    disabled={!!accepting}
                  >
                    {accepting === app.ApplicationID ? 'Accepting...' : 'Accept Applicant'}
                  </button>
                )}
                {app.Status === 'accepted' && (
                  <p style={styles.acceptedNote}>✓ Accepted — gig is now in progress</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '16px', width: '600px', maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },

  header: { padding: '22px 24px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  title: { margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' },
  sub: { margin: '3px 0 0', color: '#666', fontSize: '0.83rem' },
  closeBtn: { background: 'none', border: 'none', color: '#555', fontSize: '1.1rem', cursor: 'pointer', padding: '4px', lineHeight: 1 },

  body: { overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  center: { display: 'flex', justifyContent: 'center', padding: '40px' },
  spinner: { width: 32, height: 32, border: '2px solid #222', borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  card: { background: '#1a1a1a', border: '1px solid', borderRadius: '12px', padding: '16px' },
  cardTop: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' },

  avatar: { width: 42, height: 42, borderRadius: '50%', background: '#2a2a2a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { color: '#f59e0b', fontWeight: 800, fontSize: '1rem' },

  studentName: { fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '2px' },
  studentMeta: { color: '#666', fontSize: '0.78rem', marginBottom: '4px' },

  bio: { color: '#888', fontSize: '0.82rem', lineHeight: 1.5, margin: '0 0 10px', padding: '8px 10px', background: '#141414', borderRadius: '6px', border: '1px solid #1e1e1e' },

  coverLetterWrap: { marginTop: '8px' },
  toggleBtn: { background: 'none', border: 'none', color: '#f59e0b', fontSize: '0.78rem', cursor: 'pointer', padding: 0, fontWeight: 600 },
  coverLetterText: { color: '#aaa', fontSize: '0.83rem', lineHeight: 1.6, margin: '8px 0 0', padding: '10px', background: '#141414', borderRadius: '6px', border: '1px solid #1e1e1e' },

  acceptBtn: { marginTop: '12px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', transition: 'opacity 0.15s' },
  secondaryBtn: { marginTop: '12px', marginRight: '8px', background: '#1f1607', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: '8px', padding: '8px 14px', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' },
  acceptedNote: { color: '#4ade80', fontSize: '0.82rem', fontWeight: 600, marginTop: '10px' },

  errorText: { color: '#f87171', fontSize: '0.85rem' },
  empty: { color: '#555', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' },
};
