// src/pages/ClientDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import PostGigModal from '../components/PostGigModal';
import ApplicationsModal from '../components/ApplicationsModal';
import GigWorkModal from '../components/GigWorkModal';

const STATUS_COLORS = {
  open:        { bg: '#0c1f17', color: '#34d399', border: '#064e3b' },
  paused:      { bg: '#1a1500', color: '#facc15', border: '#713f12' },
  in_progress: { bg: '#1c1207', color: '#fbbf24', border: '#78350f' },
  completed:   { bg: '#0f172a', color: '#60a5fa', border: '#1e3a5f' },
  cancelled:   { bg: '#1c1212', color: '#888',    border: '#333'    },
};

const STATUS_FILTERS = ['All', 'open', 'paused', 'in_progress', 'completed', 'cancelled'];

function StatusPill({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.cancelled;
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: '20px', padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function ClientDashboard() {
  const { user, setUser }  = useAuth();
  const navigate           = useNavigate();
  const [gigs,             setGigs]             = useState([]);
  const [students,         setStudents]         = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [studentSearch,    setStudentSearch]    = useState('');
  const [statusFilter,     setStatusFilter]     = useState('All');
  const [loading,          setLoading]          = useState(true);
  const [showPostModal,    setShowPostModal]    = useState(false);
  const [editGig,          setEditGig]          = useState(null);
  const [appsModal,        setAppsModal]        = useState(null);
  const [workModal,        setWorkModal]        = useState(null);  // US-12
  const [toast,            setToast]            = useState(null);
  const [activeTab,        setActiveTab]        = useState('gigs');

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = async () => {
    try {
      const [gigsRes, studentsRes] = await Promise.all([
        API.get('/gigs/my'),
        API.get('/profile/browse').catch(() => ({ data: { students: [] } })),
      ]);
      setGigs(gigsRes.data.gigs);
      setStudents(studentsRes.data.students || []);
      setFilteredStudents(studentsRes.data.students || []);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Could not load dashboard data.', false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // real-time student search on name, university, and skills
  useEffect(() => {
    if (!studentSearch.trim()) {
      setFilteredStudents(students);
      return;
    }
    const q = studentSearch.toLowerCase();
    setFilteredStudents(students.filter(s =>
      s.FullName?.toLowerCase().includes(q)   ||
      s.University?.toLowerCase().includes(q) ||
      s.skills?.some(sk => sk.toLowerCase().includes(q))
    ));
  }, [studentSearch, students]);

  const filteredGigs = statusFilter === 'All'
    ? gigs
    : gigs.filter(g => g.Status === statusFilter);

  // pause: open -> paused (reversible)
  const handlePause = async (gigID) => {
    try {
      await API.patch(`/gigs/${gigID}/status`, { status: 'paused' });
      showToast('Gig paused. It is now hidden from students.');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not pause gig.', false);
    }
  };

  // resume: paused -> open
  const handleResume = async (gigID) => {
    try {
      await API.patch(`/gigs/${gigID}/status`, { status: 'open' });
      showToast('Gig resumed. Students can apply again.');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not resume gig.', false);
    }
  };

  // close: permanent close, no more applications
  const handleClose = async (gigID) => {
    if (!window.confirm('Close this gig permanently? Students will no longer see it.')) return;
    try {
      await API.patch(`/gigs/${gigID}/status`, { status: 'cancelled' });
      showToast('Gig closed permanently.');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not close gig.', false);
    }
  };

  // delete: hard delete from DB forever
  const handleDelete = async (gigID) => {
    if (!window.confirm('Delete this gig forever? This cannot be undone.')) return;
    try {
      await API.delete(`/gigs/${gigID}`);
      showToast('Gig permanently deleted.');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not delete gig.', false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    window.location.href = '/auth';
  };

  if (loading) return (
    <div style={st.loadingWrap}>
      <div style={st.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={st.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* NAV */}
      <nav style={st.nav}>
        <span style={st.navBrand}>Grade &amp; Grind</span>
        <div style={st.navRight}>
          <div style={st.userChip}>
            <span style={st.chipName}>{user?.fullName?.split(' ')[0]}</span>
            <span style={st.chipRoleClient}>Client</span>
          </div>
          <button onClick={() => navigate("/leaderboard")} style={{ background: "transparent", border: "1px solid #f59e0b44", color: "#f59e0b", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>🏆 Leaderboard</button>
          <button onClick={() => navigate("/messages")} style={{ background: "transparent", border: "1px solid #f59e0b44", color: "#f59e0b", borderRadius: "8px", padding: "7px 14px", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>Messages</button>
          <button style={st.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={st.hero}>
        <div>
          <h1 style={st.heroTitle}>Client Dashboard</h1>
          <p style={st.heroSub}>Manage your gigs and hire talented students</p>
        </div>
        <button style={st.postGigBtn} onClick={() => { setEditGig(null); setShowPostModal(true); }}>
          + Post Gig
        </button>
      </div>

      {/* TABS */}
      <div style={st.tabRow}>
        {['gigs', 'students'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              ...st.tabBtn,
              borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
              color:         activeTab === tab ? '#f59e0b' : '#666',
            }}>
            {tab === 'gigs' ? `My Gigs (${gigs.length})` : `Browse Students (${students.length})`}
          </button>
        ))}
      </div>

      <div style={st.body}>

        {/* GIGS TAB */}
        {activeTab === 'gigs' && (
          <div>
            {/* status filter */}
            <div style={st.filterRow}>
              {STATUS_FILTERS.map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  style={{
                    ...st.filterChip,
                    background:  statusFilter === f ? '#f59e0b' : '#1a1a1a',
                    color:       statusFilter === f ? '#000'    : '#666',
                    borderColor: statusFilter === f ? '#f59e0b' : '#2a2a2a',
                  }}>
                  {f === 'All' ? 'All' : f.replace('_', ' ')}
                </button>
              ))}
            </div>

            {filteredGigs.length === 0 ? (
              <div style={st.empty}>
                {gigs.length === 0
                  ? <>No gigs yet. <button style={st.inlineLink} onClick={() => setShowPostModal(true)}>Post your first gig</button></>
                  : 'No gigs with this status.'}
              </div>
            ) : (
              <div style={st.gigGrid}>
                {filteredGigs.map(gig => (
                  <div key={gig.GigID} style={st.gigCard}>
                    <div style={st.gigTop}>
                      <div style={{ flex: 1 }}>
                        <div style={st.gigTitle}>{gig.Title}</div>
                        <div style={st.gigDesc}>{gig.Description}</div>
                      </div>
                      <StatusPill status={gig.Status} />
                    </div>

                    <div style={st.gigMeta}>
                      <span style={st.metaText}>
                        {gig.Budget ? `PKR ${Number(gig.Budget).toLocaleString()}` : 'Negotiable'}
                        {gig.Deadline && ` · Due ${new Date(gig.Deadline).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </span>
                    </div>

                    <div style={st.statsRow}>
                      <div style={st.statChip}>
                        <span style={st.statNum}>{gig.TotalApplications}</span>
                        <span style={st.statLabel}>applicants</span>
                      </div>
                      <div style={st.statChip}>
                        <span style={st.statNum}>{gig.PendingCount}</span>
                        <span style={st.statLabel}>pending</span>
                      </div>
                      <div style={st.statChip}>
                        <span style={st.statNum}>{gig.AcceptedCount}</span>
                        <span style={st.statLabel}>accepted</span>
                      </div>
                    </div>

                    <div style={st.cardActions}>
                      {/* view applicants — always available if there are any */}
                      {gig.TotalApplications > 0 && (
                        <button style={st.viewAppsBtn} onClick={() => setAppsModal(gig.GigID)}>
                          View Applicants
                        </button>
                      )}

                      {/* US-12: Manage Work button for active/submitted/completed gigs */}
                      {['in_progress', 'submitted', 'revision', 'completed'].includes(gig.Status) && (
                        <button
                          style={{
                            ...st.viewAppsBtn,
                            background: gig.Status === 'completed' ? '#0f172a'
                                      : gig.Status === 'submitted' ? '#1a1035'
                                      : gig.Status === 'revision'  ? '#1c0f07'
                                      : '#1a1a1a',
                            color: gig.Status === 'completed' ? '#60a5fa'
                                 : gig.Status === 'submitted' ? '#a78bfa'
                                 : gig.Status === 'revision'  ? '#fb923c'
                                 : '#f59e0b',
                            borderColor: gig.Status === 'completed' ? '#1e3a5f'
                                       : gig.Status === 'submitted' ? '#4c1d95'
                                       : gig.Status === 'revision'  ? '#7c2d12'
                                       : '#f59e0b33',
                          }}
                          onClick={() => setWorkModal(gig)}
                        >
                          {gig.Status === 'completed' ? '✓ View Completion'
                         : gig.Status === 'submitted' ? '● Review Submission'
                         : gig.Status === 'revision'  ? '↺ Revision Pending'
                         : '⚙ Manage Work'}
                        </button>
                      )}

                      {/* edit — open or paused */}
                      {gig.ConversationID && (
                        <button style={st.viewAppsBtn} onClick={() => navigate(`/messages?conversation=${gig.ConversationID}`)}>
                          Message
                        </button>
                      )}

                      {(gig.Status === 'open' || gig.Status === 'paused') && (
                        <button style={st.editBtn} onClick={() => { setEditGig(gig); setShowPostModal(true); }}>
                          Edit
                        </button>
                      )}

                      {/* pause — only open gigs */}
                      {gig.Status === 'open' && (
                        <button style={st.pauseBtn} onClick={() => handlePause(gig.GigID)}>
                          Pause
                        </button>
                      )}

                      {/* resume — only paused gigs */}
                      {gig.Status === 'paused' && (
                        <button style={st.resumeBtn} onClick={() => handleResume(gig.GigID)}>
                          Resume
                        </button>
                      )}

                      {/* close permanently — open, paused, in_progress */}
                      {['open', 'paused', 'in_progress'].includes(gig.Status) && (
                        <button style={st.closeBtn} onClick={() => handleClose(gig.GigID)}>
                          Close
                        </button>
                      )}

                      {/* delete forever — open or paused only, no accepted applicant */}
                      {(gig.Status === 'open' || gig.Status === 'paused') && (
                        <button style={st.deleteBtn} onClick={() => handleDelete(gig.GigID)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div>
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search by name, university, or skill..."
              style={st.searchInput}
            />

            {filteredStudents.length === 0 ? (
              <div style={st.empty}>
                {studentSearch ? 'No students match your search.' : 'No student profiles published yet.'}
              </div>
            ) : (
              <div style={st.studentGrid}>
                {filteredStudents.map(s => (
                  <div key={s.UserID} style={st.studentCard}>
                    <div style={st.studentTop}>
                      <div style={st.avatar}>
                        {s.ProfilePic
                          ? <img src={s.ProfilePic} alt="" style={st.avatarImg} />
                          : <span style={st.avatarInitial}>{s.FullName?.[0]}</span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={st.studentName}>{s.FullName}</div>
                        <div style={st.studentMeta}>{s.University || 'No university listed'}</div>
                        {s.Degree && (
                          <div style={st.studentMeta}>
                            {s.Degree}{s.GraduationYear ? ` · ${s.GraduationYear}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                    {s.Bio && <p style={st.studentBio}>{s.Bio}</p>}
                    <div style={st.skillRow}>
                      {s.skills?.slice(0, 5).map(sk => (
                        <span key={sk} style={st.skillTag}>{sk}</span>
                      ))}
                      {s.skills?.length > 5 && (
                        <span style={{ color: '#444', fontSize: '0.72rem' }}>+{s.skills.length - 5}</span>
                      )}
                    </div>
                    <div style={st.studentFooter}>
                      <span style={{ color: s.IsAvailable ? '#4ade80' : '#f87171', fontSize: '0.75rem' }}>
                        {s.IsAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      {s.AverageRating > 0 && (
                        <span style={{ color: '#666', fontSize: '0.75rem' }}>
                          {Number(s.AverageRating).toFixed(1)} rating
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      {showPostModal && (
        <PostGigModal
          editGig={editGig}
          onClose={() => { setShowPostModal(false); setEditGig(null); }}
          onSuccess={() => {
            return loadAll().then(() => {
              setShowPostModal(false);
              setEditGig(null);
              showToast(editGig ? 'Gig updated!' : 'Gig posted and visible on your dashboard.');
            });
          }}
        />
      )}
      {appsModal && (
        <ApplicationsModal
          gigID={appsModal}
          onClose={() => setAppsModal(null)}
          onAccepted={() => { setAppsModal(null); loadAll(); showToast('Applicant accepted!'); }}
        />
      )}
      {workModal && (
        <GigWorkModal
          gigID={workModal.GigID}
          gigTitle={workModal.Title}
          userRole="client"
          gigStatus={workModal.Status}
          onClose={() => setWorkModal(null)}
          onUpdated={() => { loadAll(); }}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          ...st.toast,
          background: toast.ok ? '#052e16' : '#2d1212',
          borderColor: toast.ok ? '#14532d' : '#7f1d1d',
          color:       toast.ok ? '#4ade80' : '#f87171',
        }}>
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
  chipRoleClient: { background: '#1c3d6b', color: '#60a5fa', borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 },
  signOutBtn: { background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '7px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },

  hero: { padding: '28px 32px 24px', borderBottom: '1px solid #1e1e1e', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff' },
  heroSub: { margin: '4px 0 0', color: '#666', fontSize: '0.9rem' },
  postGigBtn: { background: '#f59e0b', color: '#000', border: 'none', borderRadius: '10px', padding: '10px 22px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' },

  tabRow: { display: 'flex', padding: '0 32px', background: '#0f0f0f', borderBottom: '1px solid #1e1e1e' },
  tabBtn: { padding: '14px 20px', background: 'none', border: 'none', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', transition: 'color 0.15s' },

  body: { padding: '24px 32px', maxWidth: '960px' },

  filterRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  filterChip: { padding: '5px 12px', borderRadius: '20px', border: '1px solid', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },

  gigGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  gigCard: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '18px 20px' },
  gigTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' },
  gigTitle: { fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: '4px' },
  gigDesc: { color: '#777', fontSize: '0.82rem', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  gigMeta: { marginBottom: '12px' },
  metaText: { color: '#888', fontSize: '0.82rem' },

  statsRow: { display: 'flex', gap: '8px', marginBottom: '14px' },
  statChip: { background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '6px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' },
  statNum: { fontWeight: 800, fontSize: '1rem', color: '#f59e0b' },
  statLabel: { fontSize: '0.68rem', color: '#666', marginTop: '1px' },

  cardActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  viewAppsBtn: { background: '#1a1a1a', border: '1px solid #f59e0b33', color: '#f59e0b', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  editBtn:     { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  pauseBtn:    { background: '#1a1500', border: '1px solid #713f12', color: '#facc15', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  resumeBtn:   { background: '#0c1f17', border: '1px solid #064e3b', color: '#34d399', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  closeBtn:    { background: '#1c1207', border: '1px solid #78350f', color: '#fbbf24', borderRadius: '8px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' },
  deleteBtn:   { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer' },

  searchInput: { width: '100%', padding: '10px 14px', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px', color: '#fff', fontSize: '0.88rem', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' },

  studentGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  studentCard: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '16px' },
  studentTop: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' },
  avatar: { width: 44, height: 44, borderRadius: '50%', background: '#2a2a2a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { color: '#f59e0b', fontWeight: 800, fontSize: '1rem' },
  studentName: { fontWeight: 700, fontSize: '0.9rem', color: '#fff' },
  studentMeta: { color: '#666', fontSize: '0.75rem' },
  studentBio: { color: '#666', fontSize: '0.8rem', lineHeight: 1.5, margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  skillRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' },
  skillTag: { padding: '2px 8px', background: '#1a1200', border: '1px solid #f59e0b20', color: '#f59e0b', borderRadius: '20px', fontSize: '0.72rem' },
  studentFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  empty: { color: '#555', fontSize: '0.88rem', padding: '20px 0' },
  inlineLink: { background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.88rem', textDecoration: 'underline', padding: 0 },

  toast: { position: 'fixed', bottom: '28px', right: '28px', border: '1px solid', borderRadius: '10px', padding: '12px 20px', fontSize: '0.88rem', fontWeight: 600, zIndex: 200 },
};
