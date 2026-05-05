// src/components/ApplicationDetailModal.jsx
// Shown when student clicks an application card.
// Features: full gig details, live countdown timer to deadline, status timeline.

import { useState, useEffect, useRef } from 'react';

// ── Live Countdown ─────────────────────────────────────────────────────────────
function Countdown({ deadline }) {
  const calcRemaining = () => {
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return null;
    const totalSecs = Math.floor(diff / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return { d, h, m, s, totalSecs };
  };

  const [remaining, setRemaining] = useState(calcRemaining);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(intervalRef.current);
  }, [deadline]);

  if (!remaining) return (
    <div style={{
      background: '#2d1212', border: '1px solid #7f1d1d',
      borderRadius: '14px', padding: '20px',
      textAlign: 'center', color: '#f87171',
      fontWeight: 700, fontSize: '1rem',
    }}>⚠️ Deadline has passed</div>
  );

  // urgency color — red if < 2 days, amber if < 5, green otherwise
  const urgent = remaining.d < 2;
  const warn   = remaining.d < 5;
  const color  = urgent ? '#f87171' : warn ? '#fbbf24' : '#4ade80';
  const bg     = urgent ? '#2d1212' : warn ? '#1c1207' : '#052e16';
  const border = urgent ? '#7f1d1d' : warn ? '#78350f' : '#14532d';

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: '14px', padding: '20px 24px',
    }}>
      <div style={{
        fontSize: '0.7rem', color, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ animation: urgent ? 'pulse 1s ease infinite' : 'none' }}>⏱</span>
        Time Remaining Until Deadline
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {[
          { val: remaining.d, label: 'Days' },
          { val: pad(remaining.h), label: 'Hours' },
          { val: pad(remaining.m), label: 'Mins' },
          { val: pad(remaining.s), label: 'Secs' },
        ].map(({ val, label }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: '#0a0a0a',
                borderRadius: '10px',
                padding: '10px 14px',
                minWidth: '56px',
                fontFamily: "'DM Mono', 'Courier New', monospace",
                fontWeight: 800,
                fontSize: '1.8rem',
                color,
                lineHeight: 1,
                letterSpacing: '0.04em',
                border: `1px solid ${border}`,
                transition: 'color 0.3s',
              }}>{val}</div>
              <div style={{
                fontSize: '0.65rem', color, opacity: 0.7,
                fontWeight: 600, marginTop: '5px',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{label}</div>
            </div>
            {i < 3 && (
              <div style={{
                fontSize: '1.4rem', color, opacity: 0.5, fontWeight: 800,
                animation: 'colonBlink 1s ease infinite',
                marginBottom: '16px',
              }}>:</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status Timeline ───────────────────────────────────────────────────────────
function StatusTimeline({ appStatus, gigStatus }) {
  const stages = [
    { key: 'applied',     label: 'Applied',     icon: '📝' },
    { key: 'accepted',    label: 'Accepted',    icon: '✅' },
    { key: 'in_progress', label: 'In Progress', icon: '⚙️' },
    { key: 'submitted',   label: 'Submitted',   icon: '📤' },
    { key: 'completed',   label: 'Completed',   icon: '🎉' },
  ];

  const statusOrder = ['applied', 'accepted', 'in_progress', 'submitted', 'completed'];

  const currentKey = gigStatus === 'completed' ? 'completed'
    : gigStatus === 'submitted' ? 'submitted'
    : gigStatus === 'in_progress' ? 'in_progress'
    : appStatus === 'accepted' ? 'accepted'
    : 'applied';

  const currentIdx = statusOrder.indexOf(currentKey);

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        Progress
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {stages.map((stage, i) => {
          const done   = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: i < stages.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', zIndex: 1 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: done ? (active ? '#f59e0b' : '#1a3a1a') : '#1a1a1a',
                  border: `2px solid ${done ? (active ? '#f59e0b' : '#14532d') : '#2a2a2a'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem',
                  boxShadow: active ? '0 0 14px rgba(245,158,11,0.4)' : 'none',
                  transition: 'all 0.3s',
                }}>{done ? (active ? stage.icon : '✓') : ''}</div>
                <div style={{
                  fontSize: '0.62rem', color: done ? (active ? '#f59e0b' : '#4ade80') : '#444',
                  fontWeight: active ? 700 : 500,
                  whiteSpace: 'nowrap',
                }}>{stage.label}</div>
              </div>
              {i < stages.length - 1 && (
                <div style={{
                  flex: 1, height: '2px', marginBottom: '18px',
                  background: i < currentIdx ? '#14532d' : '#1e1e1e',
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, valueColor = '#e5e5e5' }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '11px 0', borderBottom: '1px solid #1a1a1a',
    }}>
      <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', color: valueColor, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function ApplicationDetailModal({ app, onClose, onAction }) {
  const deadline = app.Deadline ? new Date(app.Deadline) : null;
  const isPast   = deadline && deadline < new Date();

  const skills = app.RequiredSkills
    ? app.RequiredSkills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const appStatusColors = {
    pending:   '#a78bfa',
    accepted:  '#4ade80',
    rejected:  '#f87171',
    withdrawn: '#888',
  };
  const gigStatusColors = {
    open:        '#34d399',
    in_progress: '#fbbf24',
    submitted:   '#a78bfa',
    revision:    '#fb923c',
    completed:   '#60a5fa',
    cancelled:   '#888',
  };

  const matchColor = app.MatchScore >= 80 ? '#4ade80' : app.MatchScore >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(7px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style>{`
        @keyframes admIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        @keyframes colonBlink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
        }
        .adm-scroll::-webkit-scrollbar { width: 4px; }
        .adm-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px; }
      `}</style>

      <div
        className="adm-scroll"
        style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderRadius: '20px',
          width: '100%', maxWidth: '640px',
          maxHeight: '92vh',
          overflowY: 'auto',
          animation: 'admIn 0.22s ease both',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'sticky', top: '16px', float: 'right', marginRight: '16px',
            background: '#1e1e1e', border: '1px solid #2a2a2a',
            borderRadius: '8px', width: '32px', height: '32px',
            color: '#888', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
          }}
        >✕</button>

        <div style={{ padding: '28px' }}>

          {/* Header badges */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {app.Category && (
              <span style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '3px 10px', fontSize: '0.73rem', color: '#888', fontWeight: 600 }}>
                {app.Category}
              </span>
            )}
            <span style={{ background: `${appStatusColors[app.ApplicationStatus] || '#888'}18`, border: `1px solid ${appStatusColors[app.ApplicationStatus] || '#888'}44`, borderRadius: '8px', padding: '3px 10px', fontSize: '0.73rem', color: appStatusColors[app.ApplicationStatus] || '#888', fontWeight: 700 }}>
              Application: {app.ApplicationStatus}
            </span>
            <span style={{ background: `${gigStatusColors[app.GigStatus] || '#888'}18`, border: `1px solid ${gigStatusColors[app.GigStatus] || '#888'}44`, borderRadius: '8px', padding: '3px 10px', fontSize: '0.73rem', color: gigStatusColors[app.GigStatus] || '#888', fontWeight: 700 }}>
              Gig: {app.GigStatus?.replace('_', ' ')}
            </span>
          </div>

          {/* Title */}
          <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
            {app.GigTitle}
          </h2>
          <div style={{ color: '#555', fontSize: '0.82rem', marginBottom: '20px' }}>
            {app.CompanyName || app.ClientName} · Applied {new Date(app.AppliedAt).toLocaleDateString('en-PK', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          {/* Status Timeline */}
          <StatusTimeline appStatus={app.ApplicationStatus} gigStatus={app.GigStatus} />

          {/* Countdown — only show if accepted and not completed/cancelled */}
          {app.ApplicationStatus === 'accepted' && !['completed', 'cancelled'].includes(app.GigStatus) && deadline && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Deadline Countdown
              </div>
              <Countdown deadline={deadline} />
            </div>
          )}

          {/* Info rows */}
          <div style={{ marginBottom: '20px' }}>
            <InfoRow
              label="Budget"
              value={app.Budget ? `PKR ${Number(app.Budget).toLocaleString()}` : 'Negotiable'}
              valueColor="#f59e0b"
            />
            <InfoRow
              label="Deadline"
              value={deadline
                ? deadline.toLocaleDateString('en-PK', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                : 'Not set'}
              valueColor={isPast ? '#f87171' : '#e5e5e5'}
            />
            <InfoRow label="Match Score" value={`${app.MatchScore}%`} valueColor={matchColor} />
            {app.CompanyName && <InfoRow label="Client" value={app.CompanyName} />}
          </div>

          {/* Description */}
          {app.GigDescription && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Description</div>
              <p style={{ margin: 0, color: '#bbb', fontSize: '0.87rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                {app.GigDescription}
              </p>
            </div>
          )}

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

          {/* Your Cover Letter */}
          {app.CoverLetter && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Your Cover Letter</div>
              <div style={{
                background: '#0f0f0f', border: '1px solid #1e1e1e',
                borderRadius: '10px', padding: '14px 16px',
                color: '#aaa', fontSize: '0.86rem', lineHeight: 1.7,
                fontStyle: 'italic',
              }}>
                "{app.CoverLetter}"
              </div>
            </div>
          )}

          {/* Revision note */}
          {app.GigStatus === 'revision' && app.RevisionNote && (
            <div style={{
              background: '#1c0f07', border: '1px solid #7c2d12',
              borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '0.72rem', color: '#fb923c', fontWeight: 700, marginBottom: '6px' }}>⚠️ Revision Requested</div>
              <p style={{ margin: 0, color: '#fed7aa', fontSize: '0.86rem', lineHeight: 1.6 }}>{app.RevisionNote}</p>
            </div>
          )}

          {/* Action button */}
          {app.ApplicationStatus === 'accepted' && ['in_progress', 'revision', 'submitted', 'completed'].includes(app.GigStatus) && (
            <button
              onClick={() => { onClose(); onAction(app); }}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                border: 'none',
                background:
                  app.GigStatus === 'completed' ? '#0f172a' :
                  app.GigStatus === 'submitted' ? '#1a1035' :
                  app.GigStatus === 'revision'  ? '#1c0f07' : '#f59e0b',
                color:
                  app.GigStatus === 'completed' ? '#60a5fa' :
                  app.GigStatus === 'submitted' ? '#a78bfa' :
                  app.GigStatus === 'revision'  ? '#fb923c' : '#000',
                ...(app.GigStatus !== 'in_progress' ? {
                  border: `1px solid ${
                    app.GigStatus === 'completed' ? '#1e3a5f' :
                    app.GigStatus === 'submitted' ? '#4c1d95' : '#7c2d12'
                  }`,
                } : {}),
              }}
            >
              {app.GigStatus === 'completed' ? '✓ View Completion Details' :
               app.GigStatus === 'submitted' ? '↑ View Submission' :
               app.GigStatus === 'revision'  ? '⚠ Address Revision Request' :
               '↑ Submit Your Work'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}