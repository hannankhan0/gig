// src/components/GigWorkModal.jsx
// US-12: Gig Status Management — work submission, revision, completion
// Used by both StudentDashboard and ClientDashboard.
//
// Props:
//   gigID       : number   — the gig being managed
//   gigTitle    : string
//   userRole    : 'student' | 'client'
//   gigStatus   : current gig status string
//   onClose     : () => void
//   onUpdated   : () => void  — called after any status change so parent reloads

import { useState, useEffect } from 'react';
import API from '../api/axios';
import ReviewSection from './ReviewSection';

// ── Shared helpers ─────────────────────────────────────────────────────────────
const STATUS_META = {
  in_progress: { label: 'In Progress', color: '#fbbf24', bg: '#1c1207', border: '#78350f' },
  submitted:   { label: 'Submitted',   color: '#a78bfa', bg: '#1a1035', border: '#4c1d95' },
  revision:    { label: 'Revision',    color: '#fb923c', bg: '#1c0f07', border: '#7c2d12' },
  completed:   { label: 'Completed',   color: '#60a5fa', bg: '#0f172a', border: '#1e3a5f' },
};

function StatusPill({ status }) {
  const s = STATUS_META[status] || { label: status, color: '#888', bg: '#1c1c1c', border: '#333' };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      {s.label}
    </span>
  );
}

// ── Student view: submit / resubmit work ──────────────────────────────────────
function StudentSubmitView({ gigID, detail, onUpdated, showToast }) {
  const [url,  setUrl]  = useState(detail?.SubmissionURL || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isResubmit = detail?.Status === 'revision';

  const handleSubmit = async () => {
    if (!url.trim()) { showToast('A submission link is required.', false); return; }
    setBusy(true);
    try {
      await API.patch(`/gigs/${gigID}/submit`, { submissionURL: url.trim(), submissionNote: note.trim() || undefined });
      showToast(isResubmit ? 'Work resubmitted!' : 'Work submitted!');
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit.', false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Revision note from client */}
      {isResubmit && detail?.RevisionNote && (
        <div style={{
          background: '#1c0f07', border: '1px solid #7c2d12',
          borderRadius: '10px', padding: '14px 16px',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700, marginBottom: '6px' }}>
            📋 Client requested revisions:
          </div>
          <div style={{ color: '#fcd9b0', fontSize: '0.88rem', lineHeight: '1.5' }}>
            {detail.RevisionNote}
          </div>
        </div>
      )}

      {/* Previous submission */}
      {detail?.SubmissionURL && (
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Previous submission</div>
          <a href={detail.SubmissionURL} target="_blank" rel="noreferrer"
            style={{ color: '#a78bfa', fontSize: '0.85rem', wordBreak: 'break-all' }}>
            {detail.SubmissionURL}
          </a>
          {detail.SubmissionNote && (
            <div style={{ color: '#777', fontSize: '0.8rem', marginTop: '6px' }}>{detail.SubmissionNote}</div>
          )}
        </div>
      )}

      <div>
        <label style={st.label}>
          Submission Link <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://github.com/your-repo or Google Drive link..."
          style={st.input}
        />
        <div style={{ color: '#555', fontSize: '0.75rem', marginTop: '4px' }}>
          GitHub, Google Drive, Figma, or any shareable link.
        </div>
      </div>

      <div>
        <label style={st.label}>
          Note to client <span style={{ color: '#555', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={note}
          onChange={e => { if (e.target.value.length <= 500) setNote(e.target.value); }}
          placeholder="Briefly describe what you delivered..."
          rows={3}
          style={st.textarea}
        />
        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#555' }}>{note.length}/500</div>
      </div>

      <button onClick={handleSubmit} disabled={busy} style={st.primaryBtn}>
        {busy ? 'Submitting…' : isResubmit ? '↺ Resubmit Work' : '↑ Submit Work'}
      </button>
    </div>
  );
}

// ── Client view: review submission, mark complete, or request revision ─────────
function ClientReviewView({ gigID, detail, onUpdated, showToast }) {
  const [revNote, setRevNote] = useState('');
  const [showRevForm, setShowRevForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleComplete = async () => {
    if (!window.confirm('Mark this gig as completed? This will start the 7-day review window.')) return;
    setBusy(true);
    try {
      await API.patch(`/gigs/${gigID}/complete`);
      showToast('Gig completed! Both parties can now leave a review.');
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to complete.', false);
    } finally {
      setBusy(false);
    }
  };

  const handleRevision = async () => {
    if (!revNote.trim()) { showToast('Revision feedback is required.', false); return; }
    setBusy(true);
    try {
      await API.patch(`/gigs/${gigID}/revision`, { revisionNote: revNote.trim() });
      showToast('Revision requested. Student has been notified.');
      onUpdated();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to request revision.', false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Submission card */}
      <div style={{
        background: '#1a1035', border: '1px solid #4c1d9566',
        borderRadius: '12px', padding: '16px 18px',
      }}>
        <div style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 700, marginBottom: '8px' }}>
          ✓ Work Submitted by {detail.StudentName}
        </div>
        <a href={detail.SubmissionURL} target="_blank" rel="noreferrer"
          style={{ color: '#c4b5fd', fontSize: '0.9rem', wordBreak: 'break-all', display: 'block' }}>
          {detail.SubmissionURL}
        </a>
        {detail.SubmissionNote && (
          <div style={{ color: '#9d8ecc', fontSize: '0.82rem', marginTop: '8px', lineHeight: 1.5 }}>
            {detail.SubmissionNote}
          </div>
        )}
        {detail.SubmittedAt && (
          <div style={{ color: '#555', fontSize: '0.72rem', marginTop: '8px' }}>
            Submitted {new Date(detail.SubmittedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleComplete} disabled={busy} style={st.completeBtn}>
          ✓ Mark as Completed
        </button>
        <button
          onClick={() => setShowRevForm(v => !v)}
          disabled={busy}
          style={st.revisionBtn}>
          ↺ Request Revision
        </button>
      </div>

      {/* Revision form */}
      {showRevForm && (
        <div style={{
          background: '#141414', border: '1px solid #7c2d12',
          borderRadius: '10px', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <label style={st.label}>
            What needs to be changed? <span style={{ color: '#f59e0b' }}>*</span>
          </label>
          <textarea
            value={revNote}
            onChange={e => { if (e.target.value.length <= 500) setRevNote(e.target.value); }}
            placeholder="Be specific so the student knows exactly what to fix..."
            rows={3}
            style={st.textarea}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#555' }}>{revNote.length}/500</span>
            <button onClick={handleRevision} disabled={busy || !revNote.trim()} style={st.primaryBtn}>
              {busy ? 'Sending…' : 'Send Revision Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Completed view: show review section ───────────────────────────────────────
function CompletedView({ gigID, detail, userRole, currentUserID }) {
  // The current user reviews the other party
  const revieweeID   = userRole === 'student' ? null : detail?.StudentID;
  const revieweeName = userRole === 'student' ? null : detail?.StudentName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: '#0f172a', border: '1px solid #1e3a5f',
        borderRadius: '10px', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '1.4rem' }}>✓</span>
        <div>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem' }}>Gig Completed</div>
          {detail?.CompletedAt && (
            <div style={{ color: '#555', fontSize: '0.75rem' }}>
              {new Date(detail.CompletedAt).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
            </div>
          )}
        </div>
      </div>

      {/* Review section — clients review the student */}
      {userRole === 'client' && revieweeID && (
        <ReviewSection
          gigID={gigID}
          revieweeID={revieweeID}
          revieweeName={revieweeName}
        />
      )}

      {/* Students see reviews left on them */}
      {userRole === 'student' && (
        <ReviewSection
          profileUserID={currentUserID}
          readOnly
        />
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function GigWorkModal({ gigID, gigTitle, userRole, gigStatus, onClose, onUpdated, currentUserID }) {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/gigs/${gigID}/work`);
      setDetail(res.data.detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [gigID]);

  const handleUpdated = () => {
    load();
    onUpdated();
  };

  const currentStatus = detail?.Status || gigStatus;

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={st.modalHeader}>
          <div>
            <div style={st.modalTitle}>{gigTitle}</div>
            <div style={{ marginTop: '6px' }}>
              {currentStatus && <StatusPill status={currentStatus} />}
            </div>
          </div>
          <button onClick={onClose} style={st.closeBtn}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(80vh - 80px)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '40px 0' }}>Loading…</div>
          ) : (
            <>
              {/* Student: in_progress or revision → submit/resubmit */}
              {userRole === 'student' && ['in_progress', 'revision'].includes(currentStatus) && (
                <StudentSubmitView
                  gigID={gigID}
                  detail={detail}
                  onUpdated={handleUpdated}
                  showToast={showToast}
                />
              )}

              {/* Student: submitted — show what they sent, waiting */}
              {userRole === 'student' && currentStatus === 'submitted' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ color: '#a78bfa', fontSize: '0.9rem', fontWeight: 600 }}>
                    ✓ Work submitted — waiting for client to review.
                  </div>
                  {detail?.SubmissionURL && (
                    <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Your submission</div>
                      <a href={detail.SubmissionURL} target="_blank" rel="noreferrer"
                        style={{ color: '#a78bfa', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                        {detail.SubmissionURL}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Client: submitted — review and decide */}
              {userRole === 'client' && currentStatus === 'submitted' && detail && (
                <ClientReviewView
                  gigID={gigID}
                  gigTitle={gigTitle}
                  detail={detail}
                  studentID={detail.StudentID}
                  onUpdated={handleUpdated}
                  showToast={showToast}
                />
              )}

              {/* Both: completed */}
              {currentStatus === 'completed' && (
                <CompletedView
                  gigID={gigID}
                  gigTitle={gigTitle}
                  detail={detail}
                  userRole={userRole}
                  currentUserID={currentUserID}
                />
              )}

              {/* Client: in_progress — waiting for student */}
              {userRole === 'client' && currentStatus === 'in_progress' && (
                <div style={{ color: '#fbbf24', fontSize: '0.9rem', padding: '20px 0', textAlign: 'center' }}>
                  ⏳ Waiting for the student to submit their work.
                </div>
              )}

              {/* Client: revision — waiting for resubmission */}
              {userRole === 'client' && currentStatus === 'revision' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ color: '#fb923c', fontSize: '0.9rem', fontWeight: 600 }}>
                    ↺ Revision requested — waiting for student to resubmit.
                  </div>
                  {detail?.RevisionNote && (
                    <div style={{ background: '#1c0f07', border: '1px solid #7c2d12', borderRadius: '10px', padding: '12px 14px', color: '#fcd9b0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      Your feedback: {detail.RevisionNote}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
            background: toast.ok ? '#052e16' : '#2d1212',
            border: `1px solid ${toast.ok ? '#14532d' : '#7f1d1d'}`,
            color: toast.ok ? '#4ade80' : '#f87171',
            borderRadius: '10px', padding: '10px 20px', fontSize: '0.85rem', fontWeight: 600,
            whiteSpace: 'nowrap', zIndex: 10,
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '18px', width: '560px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' },

  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid #1e1e1e' },
  modalTitle:  { fontWeight: 800, fontSize: '1.05rem', color: '#fff', margin: 0 },
  closeBtn:    { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 },

  label:    { display: 'block', fontSize: '0.82rem', color: '#aaa', marginBottom: '6px', fontWeight: 600 },
  input:    { width: '100%', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' },

  primaryBtn:  { background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  completeBtn: { background: '#0f172a', border: '1px solid #1e3a5f', color: '#60a5fa', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  revisionBtn: { background: '#1c0f07', border: '1px solid #7c2d12', color: '#fb923c', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
};