// src/pages/StudentDashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import GigWorkModal from '../components/GigWorkModal';
import GigDetailModal from '../components/GigDetailModal';
import ApplicationDetailModal from '../components/ApplicationDetailModal';


// ── Inline card countdown ─────────────────────────────────────────────────────
function CardCountdown({ deadline }) {
  const calc = () => {
    const diff = new Date(deadline) - new Date();
    if (diff <= 0) return null;
    const s = Math.floor(diff / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
      diff,
    };
  };

  const [t, setT] = useState(calc);
  const ref = useRef(null);

  useEffect(() => {
    ref.current = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(ref.current);
  }, [deadline]);

  const pad = (n) => String(n).padStart(2, '0');

  if (!t) return (
    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#f87171', fontWeight: 700 }}>
      ⚠️ Deadline passed
    </div>
  );

  const urgent = t.d < 2;
  const warn   = t.d < 5;
  const color  = urgent ? '#f87171' : warn ? '#fbbf24' : '#4ade80';
  const bg     = urgent ? '#2d1212' : warn ? '#1c1207' : '#052e16';
  const border = urgent ? '#7f1d1d44' : warn ? '#78350f44' : '#14532d44';

  return (
    <div style={{
      marginTop: '10px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '10px',
      padding: '8px 12px',
    }}>
      <div style={{
        fontSize: '0.62rem', color, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={{ animation: urgent ? 'pulse 1s ease infinite' : 'none' }}>⏱</span>
        Time Remaining
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {[{ val: t.d, label: 'D' }, { val: pad(t.h), label: 'H' }, { val: pad(t.m), label: 'M' }, { val: pad(t.s), label: 'S' }].map(({ val, label }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                background: '#0a0a0a',
                border: `1px solid ${border}`,
                borderRadius: '7px',
                padding: '5px 8px',
                minWidth: '38px',
                fontFamily: "'DM Mono', 'Courier New', monospace",
                fontWeight: 800,
                fontSize: '1.1rem',
                color,
                lineHeight: 1,
                letterSpacing: '0.04em',
              }}>{val}</div>
              <div style={{ fontSize: '0.55rem', color, opacity: 0.6, fontWeight: 700, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
            {i < 3 && <div style={{ fontSize: '1rem', color, opacity: 0.4, marginBottom: '12px', animation: 'colonBlink 1s ease infinite' }}>:</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES = ['All', 'Development', 'Design', 'Writing', 'Data', 'Marketing', 'Video', 'Other'];

const appStatusColors = {
  pending:   { bg: '#1a1a2e', color: '#a78bfa', border: '#4c1d95' },
  accepted:  { bg: '#052e16', color: '#4ade80', border: '#14532d' },
  rejected:  { bg: '#2d1212', color: '#f87171', border: '#7f1d1d' },
  withdrawn: { bg: '#1c1c1c', color: '#888',    border: '#333' },
};

const gigStatusColors = {
  open:        { bg: '#0c1f17', color: '#34d399', border: '#064e3b' },
  in_progress: { bg: '#1c1207', color: '#fbbf24', border: '#78350f' },
  completed:   { bg: '#0f172a', color: '#60a5fa', border: '#1e3a5f' },
  cancelled:   { bg: '#1c1212', color: '#888',    border: '#333' },
};

function MatchBadge({ score }) {
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
      {score}% match
    </span>
  );
}

function StatusPill({ status, map }) {
  const fallback = { bg: '#1c1c1c', color: '#888', border: '#333' };
  const s = (status && map[status]) ? map[status] : fallback;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      {status?.replace('_', ' ') || 'unknown'}
    </span>
  );
}

// profile completeness for US-07 acceptance criteria
function getCompleteness(user, profile) {
  if (!profile) return 0;
  const checks = [
    !!user?.fullName,
    !!profile.Bio,
    !!profile.Degree,
    !!profile.GraduationYear,
    !!profile.University,
    !!profile.CVURL,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function StudentDashboard() {
  const { user, setUser }  = useAuth();
  const navigate           = useNavigate();
  const [matchedGigs,     setMatchedGigs]     = useState([]);
  const [myApplications,  setMyApplications]  = useState([]);
  const [profile,         setProfile]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [applyModal,      setApplyModal]       = useState(null);
  const [workModal,       setWorkModal]        = useState(null);  // US-12
  const [gigDetail,       setGigDetail]        = useState(null);
  const [appDetail,       setAppDetail]        = useState(null);
  const [coverLetter,     setCoverLetter]      = useState('');
  const [submitting,      setSubmitting]       = useState(false);
  const [toast,           setToast]            = useState(null);
  const [categoryFilter,  setCategoryFilter]   = useState('All'); // US-07.1 filter

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [gigsRes, appsRes, profRes] = await Promise.all([
          API.get('/gigs/matched'),
          API.get('/gigs/applications/mine'),
          API.get('/profile/me').catch(() => ({ data: { profile: null } })),
        ]);
        setMatchedGigs(gigsRes.data.gigs);
        setMyApplications(appsRes.data.applications);
        setProfile(profRes.data.profile);
      } catch (err) {
        console.error(err);
        showToast(err.response?.data?.error || 'Could not load gigs. Please try again.', false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // FIX: client-side category filter — US-07.1
  const filteredGigs = categoryFilter === 'All'
    ? matchedGigs
    : matchedGigs.filter(g => g.Category === categoryFilter);

  const handleApply = (gig) => {
    setApplyModal(gig);
    setCoverLetter('');
  };

  const submitApplication = async () => {
    if (!applyModal) return;
    setSubmitting(true);
    try {
      // FIX: removed matchScore from payload — computed server-side
      const res = await API.post(`/gigs/${applyModal.GigID}/apply`, { coverLetter, applicationMessage: coverLetter });
      showToast(`Application submitted! Match score: ${res.data.matchScore}%`);
      setApplyModal(null);
      const appsRes = await API.get('/gigs/applications/mine');
      setMyApplications(appsRes.data.applications);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to apply.', false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (appID) => {
    if (!window.confirm('Withdraw this application?')) return;
    try {
      await API.patch(`/gigs/applications/${appID}/withdraw`);
      showToast('Application withdrawn.');
      const appsRes = await API.get('/gigs/applications/mine');
      setMyApplications(appsRes.data.applications);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to withdraw.', false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    navigate('/auth');
  };

  if (loading) return (
    <div style={st.loadingWrap}>
      <div style={st.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes colonBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );

  const appliedGigIDs  = new Set(myApplications.map(a => a.GigID));
  const completeness   = getCompleteness(user, profile);

  return (
    <div style={st.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes colonBlink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      {/* NAVBAR */}
      <nav style={st.nav}>
        <span style={st.navBrand}>Grade &amp; Grind</span>
        <div style={st.navRight}>
          <div style={st.userChip}>
            <span style={st.chipName}>{user?.fullName?.split(' ')[0]}</span>
            <span style={st.chipRole}>Student</span>
          </div>
          <button onClick={() => navigate("/leaderboard")} style={{ background: "transparent", border: "1px solid #f59e0b44", color: "#f59e0b", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>🏆 Leaderboard</button>
          <button onClick={() => navigate("/messages")} style={{ background: "transparent", border: "1px solid #f59e0b44", color: "#f59e0b", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>Messages</button>
          <button style={st.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={st.hero}>
        <div>
          <h1 style={st.heroTitle}>Student Dashboard</h1>
          <p style={st.heroSub}>Find gigs matched to your skills and manage your applications</p>
        </div>
        {/* FIX: use navigate() instead of window.location.href */}
        <button style={st.editProfileBtn} onClick={() => navigate('/profile/edit')}>
          ✏️ Edit Profile
        </button>
      </div>

      {/* FIX: profile completion status — US-07 acceptance criteria */}
      {completeness < 100 && (
        <div style={st.completeBanner}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px', color: '#fff' }}>
              Profile {completeness}% complete
            </div>
            <div style={st.progressBar}>
              <div style={{ ...st.progressFill, width: `${completeness}%` }} />
            </div>
          </div>
          <button style={st.completeBtn} onClick={() => navigate('/profile/edit')}>
            Complete Profile →
          </button>
        </div>
      )}

      <div style={st.body}>
        {/* LEFT: Matched Gigs */}
        <div style={st.col}>
          <div style={st.sectionHeader}>
            <h2 style={st.sectionTitle}>Matched Gigs ({filteredGigs.length})</h2>
          </div>

          {/* FIX: category filter — US-07.1 */}
          <div style={st.filterRow}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                style={{
                  ...st.filterChip,
                  background:  categoryFilter === cat ? '#f59e0b' : '#1a1a1a',
                  color:       categoryFilter === cat ? '#000'    : '#666',
                  borderColor: categoryFilter === cat ? '#f59e0b' : '#2a2a2a',
                }}>
                {cat}
              </button>
            ))}
          </div>

          {filteredGigs.length === 0 ? (
            <div style={st.empty}>
              {categoryFilter === 'All'
                ? 'No matched gigs right now. Add more skills to your profile to get matches!'
                : `No matched gigs in ${categoryFilter}. Try a different category.`}
            </div>
          ) : (
            filteredGigs.map(gig => (
              <div key={gig.GigID} style={{...st.gigCard, cursor:'pointer', transition:'border-color 0.2s, transform 0.15s'}} onClick={() => setGigDetail(gig)} onMouseEnter={e=>{e.currentTarget.style.borderColor='#f59e0b55';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e1e1e';e.currentTarget.style.transform='translateY(0)';}}>
                <div style={st.gigCardTop}>
                  <div style={{ flex: 1 }}>
                    <div style={st.gigTitle}>{gig.Title}</div>
                    <div style={st.gigDesc}>{gig.Description}</div>
                  </div>
                </div>
                <div style={st.gigMeta}>
                  <span style={st.gigBudget}>
                    {gig.Budget ? `PKR ${Number(gig.Budget).toLocaleString()}` : 'Negotiable'}
                    &nbsp;|&nbsp;
                    Due {new Date(gig.Deadline).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <MatchBadge score={gig.matchScore} />
                  {gig.Category && (
                    <span style={st.catBadge}>{gig.Category}</span>
                  )}
                </div>
                {!appliedGigIDs.has(gig.GigID) ? (
                  <button style={st.applyBtn} onClick={() => handleApply(gig)}>
                    Apply Now
                  </button>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: '10px', display: 'block' }}>
                    ✓ Applied
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* RIGHT: My Applications */}
        <div style={st.col}>
          <h2 style={st.sectionTitle}>My Applications ({myApplications.length})</h2>
          {myApplications.length === 0 ? (
            <div style={st.empty}>No applications yet. Apply to a gig to get started!</div>
          ) : (
            myApplications.map(app => (
              <div key={app.ApplicationID} style={{...st.assignCard, cursor:'pointer', transition:'border-color 0.2s, transform 0.15s'}} onClick={() => setAppDetail(app)} onMouseEnter={e=>{e.currentTarget.style.borderColor='#f59e0b44';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e1e1e';e.currentTarget.style.transform='translateY(0)';}}>
                <div style={st.assignTitle}>{app.GigTitle}</div>
                <div style={st.assignMeta}>
                  <StatusPill status={app.ApplicationStatus} map={appStatusColors} />
                  <StatusPill status={app.GigStatus} map={gigStatusColors} />
                  {app.MatchScore > 0 && <MatchBadge score={app.MatchScore} />}
                </div>
                <div style={{ color: '#555', fontSize: '0.75rem', marginTop: '6px' }}>
                  {app.CompanyName || app.ClientName} · Applied {new Date(app.AppliedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
                </div>
                {app.Deadline && <CardCountdown deadline={app.Deadline} />}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {app.ApplicationStatus === 'pending' && (
                    <button style={st.withdrawBtn} onClick={e => { e.stopPropagation(); handleWithdraw(app.ApplicationID); }}>
                      Withdraw
                    </button>
                  )}
                  {/* US-12: Submit Work button when gig is in_progress or revision */}
                  {app.ApplicationStatus === 'accepted' && ['in_progress', 'revision', 'submitted', 'completed'].includes(app.GigStatus) && (
                    <button
                      style={{
                        ...st.applyBtn,
                        marginTop: 0,
                        background: app.GigStatus === 'completed' ? '#0f172a'
                                  : app.GigStatus === 'submitted' ? '#1a1035'
                                  : app.GigStatus === 'revision'  ? '#1c0f07'
                                  : '#f59e0b',
                        color: app.GigStatus === 'completed' ? '#60a5fa'
                             : app.GigStatus === 'submitted' ? '#a78bfa'
                             : app.GigStatus === 'revision'  ? '#fb923c'
                             : '#000',
                        border: app.GigStatus === 'completed' ? '1px solid #1e3a5f'
                              : app.GigStatus === 'submitted' ? '1px solid #4c1d95'
                              : app.GigStatus === 'revision'  ? '1px solid #7c2d12'
                              : 'none',
                      }}
                      onClick={e => { e.stopPropagation(); setWorkModal(app); }}
                    >
                      {app.GigStatus === 'completed' ? '✓ View Completion'
                     : app.GigStatus === 'submitted' ? '↑ Submitted — View'
                     : app.GigStatus === 'revision'  ? '⚠ Revision Requested'
                     : '↑ Submit Work'}
                    </button>
                  )}
                  {app.ApplicationStatus === 'accepted' && app.ConversationID && (
                    <button
                      style={st.viewChatBtn}
                      onClick={e => { e.stopPropagation(); navigate(`/messages?conversation=${app.ConversationID}`); }}
                    >
                      Message
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* GIG DETAIL MODAL */}
      {gigDetail && (
        <GigDetailModal
          gig={gigDetail}
          alreadyApplied={appliedGigIDs.has(gigDetail.GigID)}
          onClose={() => setGigDetail(null)}
          onApplied={async () => {
            setGigDetail(null);
            const appsRes = await API.get('/gigs/applications/mine');
            setMyApplications(appsRes.data.applications);
          }}
        />
      )}

      {/* APPLICATION DETAIL MODAL */}
      {appDetail && (
        <ApplicationDetailModal
          app={appDetail}
          onClose={() => setAppDetail(null)}
          onAction={(app) => setWorkModal(app)}
        />
      )}

      {/* WORK MODAL — US-12 */}
      {workModal && (
        <GigWorkModal
          gigID={workModal.GigID}
          gigTitle={workModal.GigTitle}
          userRole="student"
          gigStatus={workModal.GigStatus}
          currentUserID={user?.id}
          onClose={() => setWorkModal(null)}
          onUpdated={async () => {
            const appsRes = await API.get('/gigs/applications/mine');
            setMyApplications(appsRes.data.applications);
          }}
        />
      )}

      {/* APPLY MODAL */}
      {applyModal && (
        <div style={st.overlay} onClick={() => setApplyModal(null)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <h3 style={st.modalTitle}>Apply: {applyModal.Title}</h3>
            <p style={st.modalSub}>{applyModal.Description}</p>
            {applyModal.RequiredSkills && (
              <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '14px' }}>
                Required skills: {applyModal.RequiredSkills}
              </p>
            )}
            <label style={st.label}>Message to Client <span style={{ color: '#444', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              style={st.textarea}
              placeholder="Send a short application message to the client..."
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              rows={5}
              maxLength={1000}
            />
            <p style={{ color: '#444', fontSize: '0.75rem', marginBottom: '14px', textAlign: 'right' }}>
              {coverLetter.length}/1000
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={st.applyBtn} onClick={submitApplication} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application →'}
              </button>
              <button style={st.cancelBtn} onClick={() => setApplyModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...st.toast, background: toast.ok ? '#052e16' : '#2d1212', borderColor: toast.ok ? '#14532d' : '#7f1d1d', color: toast.ok ? '#4ade80' : '#f87171' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const st = {
  root: { minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif" },
  loadingWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' },
  spinner: { width: 40, height: 40, border: '3px solid #222', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '58px', background: '#111', borderBottom: '1px solid #1e1e1e' },
  navBrand: { fontWeight: 800, fontSize: '1.1rem', color: '#fff' },
  navRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  userChip: { display: 'flex', alignItems: 'center', gap: '8px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '4px 12px 4px 14px' },
  chipName: { fontSize: '0.85rem', fontWeight: 600, color: '#e5e5e5' },
  chipRole: { background: '#14532d', color: '#4ade80', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 },
  signOutBtn: { background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '7px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },

  hero: { padding: '24px 32px 20px', borderBottom: '1px solid #1e1e1e', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff' },
  heroSub: { margin: '4px 0 0', color: '#666', fontSize: '0.88rem' },
  editProfileBtn: { background: '#1a1a1a', border: '1px solid #f59e0b40', color: '#f59e0b', borderRadius: '8px', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' },

  completeBanner: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 32px', background: '#111', borderBottom: '1px solid #1e1e1e' },
  progressBar: { height: '4px', background: '#2a2a2a', borderRadius: '2px', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#f59e0b', borderRadius: '2px', transition: 'width 0.3s' },
  completeBtn: { background: '#f59e0b', border: 'none', color: '#000', borderRadius: '8px', padding: '7px 14px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 },

  body: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '24px 32px', maxWidth: '1100px' },

  col: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e5e5e5' },

  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' },
  filterChip: { padding: '5px 12px', borderRadius: '20px', border: '1px solid', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },

  gigCard: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '14px 16px' },
  gigCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' },
  gigTitle: { fontWeight: 700, fontSize: '0.93rem', color: '#fff', marginBottom: '4px' },
  gigDesc: { color: '#777', fontSize: '0.8rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  gigMeta: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  gigBudget: { color: '#999', fontSize: '0.8rem' },
  catBadge: { padding: '2px 8px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: '6px', fontSize: '0.72rem' },

  applyBtn: { marginTop: '10px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '7px 16px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },
  cancelBtn: { background: '#1a1a1a', color: '#aaa', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '7px 16px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },

  assignCard: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '14px 16px' },
  assignTitle: { fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: '8px' },
  assignMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  withdrawBtn: { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '6px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  viewChatBtn: { background: '#1a1a1a', border: '1px solid #f59e0b44', color: '#f59e0b', borderRadius: '8px', padding: '7px 16px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' },

  empty: { color: '#555', fontSize: '0.85rem', padding: '20px 0' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '16px', padding: '28px', width: '480px', maxWidth: '90vw' },
  modalTitle: { margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#fff' },
  modalSub: { color: '#777', fontSize: '0.85rem', margin: '0 0 14px', lineHeight: 1.5 },
  label: { display: 'block', fontSize: '0.82rem', color: '#aaa', marginBottom: '6px', fontWeight: 600 },
  textarea: { width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', padding: '10px 12px', fontSize: '0.88rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },

  toast: { position: 'fixed', bottom: '28px', right: '28px', border: '1px solid', borderRadius: '10px', padding: '12px 20px', fontSize: '0.88rem', fontWeight: 600, zIndex: 200 },
};
