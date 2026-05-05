// src/pages/LeaderboardPage.jsx
// US-14 — Student Leaderboard
// Formula: (AvgRating × 40%) + (CompletedGigs × 30%) + (SuccessRate × 30%)

import { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const medal = (rank) => {
  if (rank === 1) return { icon: '🥇', color: '#FFD700', glow: 'rgba(255,215,0,0.35)' };
  if (rank === 2) return { icon: '🥈', color: '#C0C0C0', glow: 'rgba(192,192,192,0.25)' };
  if (rank === 3) return { icon: '🥉', color: '#CD7F32', glow: 'rgba(205,127,50,0.25)' };
  return null;
};

const initials = (name) =>
  name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '??';

const avatarGradient = (rank) => {
  const palettes = [
    'linear-gradient(135deg,#6c63ff,#ff6584)',
    'linear-gradient(135deg,#00e5a0,#6c63ff)',
    'linear-gradient(135deg,#f5c842,#ff6584)',
    'linear-gradient(135deg,#6c63ff,#00e5a0)',
    'linear-gradient(135deg,#ff6584,#f5c842)',
  ];
  return palettes[(rank - 1) % palettes.length];
};

const stars = (rating) => {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  return (
    <span style={{ display: 'inline-flex', gap: '1px', fontSize: '0.78rem' }}>
      {[1,2,3,4,5].map((i) => (
        <span
          key={i}
          style={{
            color: i <= full ? '#f5c842' : (i === full + 1 && half) ? '#f5c842' : '#2a2a3d',
            opacity: i === full + 1 && half ? 0.6 : 1,
          }}
        >★</span>
      ))}
    </span>
  );
};

// ── Podium (top 3) ────────────────────────────────────────────────────────────
function Podium({ top3 }) {
  const order = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd
  const heights = ['120px', '160px', '100px'];
  const ranks   = [2, 1, 3];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: '12px',
      margin: '0 auto 3rem',
      maxWidth: '600px',
    }}>
      {order.map((student, idx) => {
        if (!student) return null;
        const m = medal(ranks[idx]);
        return (
          <div
            key={student.UserID}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              flex: ranks[idx] === 1 ? 1.1 : 1,
              animation: `podiumRise 0.6s ease ${idx * 0.1}s both`,
            }}
          >
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              {student.ProfilePic ? (
                <img
                  src={student.ProfilePic}
                  alt={student.FullName}
                  style={{
                    width: ranks[idx] === 1 ? 80 : 64,
                    height: ranks[idx] === 1 ? 80 : 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `3px solid ${m.color}`,
                    boxShadow: `0 0 20px ${m.glow}`,
                  }}
                />
              ) : (
                <div style={{
                  width: ranks[idx] === 1 ? 80 : 64,
                  height: ranks[idx] === 1 ? 80 : 64,
                  borderRadius: '50%',
                  background: avatarGradient(student.Rank),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Syne', sans-serif",
                  fontWeight: 800,
                  fontSize: ranks[idx] === 1 ? '1.5rem' : '1.1rem',
                  color: '#0a0a0f',
                  border: `3px solid ${m.color}`,
                  boxShadow: `0 0 24px ${m.glow}`,
                }}>
                  {initials(student.FullName)}
                </div>
              )}
              <span style={{
                position: 'absolute', bottom: -6, right: -6,
                fontSize: ranks[idx] === 1 ? '1.4rem' : '1.1rem',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}>{m.icon}</span>
            </div>

            {/* Name & uni */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: ranks[idx] === 1 ? '0.95rem' : '0.82rem',
                color: '#eeeef5',
                maxWidth: '130px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{student.FullName}</div>
              <div style={{ fontSize: '0.7rem', color: '#7777a0', marginTop: '2px' }}>
                {student.AvgRating.toFixed(1)} ★ · {student.CompletedGigs} gigs
              </div>
            </div>

            {/* Podium block */}
            <div style={{
              width: '100%',
              height: heights[idx],
              background: `linear-gradient(180deg, ${m.color}22 0%, ${m.color}08 100%)`,
              border: `1px solid ${m.color}44`,
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              paddingTop: '14px',
            }}>
              <span style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800, fontSize: '1.5rem',
                color: m.color, opacity: 0.7,
              }}>#{ranks[idx]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Row (rank 4–100) ──────────────────────────────────────────────────────────
function LeaderboardRow({ student, isMe, animDelay }) {
  const m = medal(student.Rank);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 1fr auto auto auto',
        alignItems: 'center',
        gap: '16px',
        padding: '14px 20px',
        background: isMe
          ? 'linear-gradient(90deg, rgba(108,99,255,0.12), rgba(108,99,255,0.04))'
          : hovered ? '#1a1a26' : '#12121a',
        border: `1px solid ${isMe ? 'rgba(108,99,255,0.4)' : hovered ? '#2a2a3d' : '#1e1e2e'}`,
        borderRadius: '12px',
        transition: 'all 0.2s ease',
        cursor: 'default',
        animation: `fadeUp 0.4s ease ${animDelay}s both`,
        boxShadow: isMe ? '0 0 20px rgba(108,99,255,0.1)' : 'none',
      }}
    >
      {/* Rank */}
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: '1rem',
        color: m ? m.color : '#7777a0',
        textAlign: 'center',
        minWidth: 0,
      }}>
        {m ? m.icon : `#${student.Rank}`}
      </div>

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {student.ProfilePic ? (
          <img src={student.ProfilePic} alt={student.FullName} style={{
            width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
          }}/>
        ) : (
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: avatarGradient(student.Rank),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.85rem',
            color: '#0a0a0f',
          }}>{initials(student.FullName)}</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 600,
              fontSize: '0.9rem', color: '#eeeef5',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{student.FullName}</span>
            {isMe && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                padding: '2px 7px', borderRadius: '99px',
                background: 'rgba(108,99,255,0.2)', color: '#9d97ff',
                border: '1px solid rgba(108,99,255,0.35)', flexShrink: 0,
              }}>YOU</span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7777a0', marginTop: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.University || 'University not set'}
          </div>
        </div>
      </div>

      {/* Rating */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#f5c842' }}>
          {student.AvgRating.toFixed(1)}
        </div>
        <div>{stars(student.AvgRating)}</div>
      </div>

      {/* Gigs */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#00e5a0' }}>
          {student.CompletedGigs}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#7777a0' }}>gigs</div>
      </div>

      {/* Success rate */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '56px' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#6c63ff' }}>
          {student.SuccessRate.toFixed(0)}%
        </div>
        <div style={{ fontSize: '0.7rem', color: '#7777a0' }}>success</div>
      </div>
    </div>
  );
}

// ── My Rank Banner ─────────────────────────────────────────────────────────────
function MyRankBanner({ myRank }) {
  if (!myRank) return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(108,99,255,0.08), transparent)',
      border: '1px solid rgba(108,99,255,0.2)',
      borderRadius: '12px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: '12px',
      marginBottom: '24px',
    }}>
      <span style={{ fontSize: '1.4rem' }}>🎯</span>
      <div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#9d97ff' }}>
          Keep going — you need 5 completed gigs to appear on the leaderboard
        </div>
        <div style={{ fontSize: '0.78rem', color: '#7777a0', marginTop: '2px' }}>
          Complete more gigs to earn your rank!
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(108,99,255,0.15), rgba(0,229,160,0.08))',
      border: '1px solid rgba(108,99,255,0.35)',
      borderRadius: '12px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', flexWrap: 'wrap',
      marginBottom: '24px',
      boxShadow: '0 0 30px rgba(108,99,255,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.6rem' }}>🏆</span>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#9d97ff' }}>
            Your Rank
          </div>
          <div style={{ fontSize: '0.78rem', color: '#7777a0' }}>
            {myRank.CompletedGigs} gigs · {myRank.AvgRating.toFixed(1)}★ · {myRank.SuccessRate.toFixed(0)}% success
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        fontSize: '2.4rem', color: '#6c63ff', lineHeight: 1,
      }}>
        #{myRank.Rank}
      </div>
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────
function FilterBar({ universities, filters, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: '12px', flexWrap: 'wrap',
      marginBottom: '28px', alignItems: 'center',
    }}>
      {/* University select */}
      <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
        <select
          value={filters.university}
          onChange={(e) => onChange({ ...filters, university: e.target.value })}
          style={{
            width: '100%',
            background: '#12121a',
            border: '1px solid #2a2a3d',
            borderRadius: '10px',
            padding: '10px 14px',
            color: filters.university ? '#eeeef5' : '#7777a0',
            fontSize: '0.85rem',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
          }}
        >
          <option value="">🏫 All Universities</option>
          {universities.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <span style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          color: '#7777a0', pointerEvents: 'none', fontSize: '0.8rem',
        }}>▾</span>
      </div>

      {/* Skill search */}
      <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
        <input
          type="text"
          placeholder="🔍 Filter by skill (e.g. React)"
          value={filters.skill}
          onChange={(e) => onChange({ ...filters, skill: e.target.value })}
          style={{
            width: '100%',
            background: '#12121a',
            border: '1px solid #2a2a3d',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#eeeef5',
            fontSize: '0.85rem',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#6c63ff88')}
          onBlur={(e)  => (e.target.style.borderColor = '#2a2a3d')}
        />
      </div>

      {/* Reset */}
      {(filters.university || filters.skill) && (
        <button
          onClick={() => onChange({ university: '', skill: '' })}
          style={{
            background: 'transparent',
            border: '1px solid #2a2a3d',
            borderRadius: '10px',
            padding: '10px 16px',
            color: '#7777a0',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#ff6584'; e.target.style.color = '#ff6584'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#2a2a3d'; e.target.style.color = '#7777a0'; }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

// ── Column Headers ─────────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '52px 1fr auto auto auto',
      gap: '16px',
      padding: '0 20px 10px',
      borderBottom: '1px solid #1e1e2e',
      marginBottom: '8px',
    }}>
      <div style={{ fontSize: '0.72rem', color: '#7777a0', fontWeight: 600, textAlign: 'center' }}>RANK</div>
      <div style={{ fontSize: '0.72rem', color: '#7777a0', fontWeight: 600 }}>STUDENT</div>
      <div style={{ fontSize: '0.72rem', color: '#7777a0', fontWeight: 600, textAlign: 'right' }}>RATING</div>
      <div style={{ fontSize: '0.72rem', color: '#7777a0', fontWeight: 600, textAlign: 'right' }}>GIGS</div>
      <div style={{ fontSize: '0.72rem', color: '#7777a0', fontWeight: 600, textAlign: 'right', minWidth: '56px' }}>SUCCESS</div>
    </div>
  );
}

// ── Stat Pills ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color }) {
  return (
    <div style={{
      background: '#12121a',
      border: '1px solid #1e1e2e',
      borderRadius: '12px',
      padding: '16px 20px',
      flex: 1, minWidth: '120px',
      display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
      <div style={{ fontSize: '1.2rem' }}>{icon}</div>
      <div style={{
        fontFamily: "'Syne', sans-serif", fontWeight: 800,
        fontSize: '1.5rem', color, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#7777a0' }}>{label}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const { user } = useAuth();

  const [leaderboard,   setLeaderboard]   = useState([]);
  const [myRank,        setMyRank]        = useState(undefined); // undefined = not fetched yet
  const [universities,  setUniversities]  = useState([]);
  const [filters,       setFilters]       = useState({ university: '', skill: '' });
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  const debounceRef = useRef(null);

  // Fetch leaderboard with debounce on skill input
  const fetchLeaderboard = async (f) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (f.university) params.append('university', f.university);
      if (f.skill)      params.append('skill',      f.skill);
      const res = await API.get(`/leaderboard?${params.toString()}`);
      setLeaderboard(res.data.leaderboard || []);
    } catch {
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLeaderboard(newFilters), 400);
  };

  // Initial data load
  useEffect(() => {
    const init = async () => {
      try {
        const [lbRes, uniRes] = await Promise.all([
          API.get('/leaderboard'),
          API.get('/leaderboard/universities'),
        ]);
        setLeaderboard(lbRes.data.leaderboard || []);
        setUniversities(uniRes.data.universities || []);
      } catch {
        setError('Failed to load leaderboard.');
      } finally {
        setLoading(false);
      }
    };

    const fetchMyRank = async () => {
      try {
        const res = await API.get('/leaderboard/my-rank');
        setMyRank(res.data.rank); // null if unqualified
      } catch {
        setMyRank(null);
      }
    };

    init();
    if (user?.role === 'student') fetchMyRank();
  }, [user]);

  const top3 = leaderboard.slice(0, 3);
  const rest  = leaderboard.slice(3);
  const myID  = user?.id;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes podiumRise {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        .lb-page * { box-sizing: border-box; }
        .lb-page select option { background: #12121a; color: #eeeef5; }
      `}</style>

      <div
        className="lb-page"
        style={{
          minHeight: '100vh',
          background: '#0a0a0f',
          color: '#eeeef5',
          fontFamily: "'DM Sans', sans-serif",
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient background glows */}
        <div style={{
          position: 'fixed', top: '-150px', right: '-100px',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}/>
        <div style={{
          position: 'fixed', bottom: '-200px', left: '-100px',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(0,229,160,0.05) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}/>

        <div style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '3rem 1.5rem 4rem',
          position: 'relative', zIndex: 1,
        }}>

          {/* ── Page Header ── */}
          <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeUp 0.5s ease both' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>🏆</div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              margin: '0 0 0.5rem',
              background: 'linear-gradient(90deg, #6c63ff, #00e5a0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Student Leaderboard
            </h1>
            <p style={{ color: '#7777a0', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.6 }}>
              Top students ranked by performance. Minimum 5 completed gigs to qualify.
            </p>

            {/* Formula badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              marginTop: '16px',
              background: '#12121a', border: '1px solid #2a2a3d',
              borderRadius: '99px', padding: '7px 16px',
              fontSize: '0.75rem', color: '#7777a0',
            }}>
              <span style={{ color: '#f5c842' }}>★ Rating ×40%</span>
              <span>+</span>
              <span style={{ color: '#00e5a0' }}>Gigs ×30%</span>
              <span>+</span>
              <span style={{ color: '#6c63ff' }}>Success ×30%</span>
            </div>
          </div>

          {/* ── My Rank (students only) ── */}
          {user?.role === 'student' && myRank !== undefined && (
            <div style={{ animation: 'fadeUp 0.5s ease 0.1s both' }}>
              <MyRankBanner myRank={myRank} />
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{
              background: '#2d1212', border: '1px solid #7f1d1d',
              borderRadius: '12px', padding: '16px 20px',
              color: '#f87171', fontSize: '0.9rem', marginBottom: '24px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  height: '68px', borderRadius: '12px',
                  background: 'linear-gradient(90deg, #12121a 25%, #1a1a26 50%, #12121a 75%)',
                  backgroundSize: '200% 100%',
                  animation: `shimmer 1.4s ease infinite, fadeUp 0.3s ease ${i * 0.05}s both`,
                }}/>
              ))}
            </div>
          )}

          {!loading && leaderboard.length === 0 && !error && (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              color: '#7777a0', fontSize: '0.9rem',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📭</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px', color: '#eeeef5' }}>
                No students found
              </div>
              {(filters.university || filters.skill)
                ? 'Try adjusting your filters.'
                : 'Students need at least 5 completed gigs to appear here.'}
            </div>
          )}

          {!loading && leaderboard.length > 0 && (
            <>
              {/* ── Stats row ── */}
              <div style={{
                display: 'flex', gap: '12px', flexWrap: 'wrap',
                marginBottom: '2.5rem',
                animation: 'fadeUp 0.5s ease 0.15s both',
              }}>
                <StatPill icon="👥" label="Qualified students" value={leaderboard.length} color="#6c63ff" />
                <StatPill icon="⭐" label="Avg rating (top 10)" color="#f5c842"
                  value={leaderboard.slice(0,10).length
                    ? (leaderboard.slice(0,10).reduce((a,s) => a + s.AvgRating, 0) / Math.min(10, leaderboard.length)).toFixed(2)
                    : '—'}
                />
                <StatPill icon="✅" label="Total gigs completed" color="#00e5a0"
                  value={leaderboard.reduce((a, s) => a + s.CompletedGigs, 0)}
                />
              </div>

              {/* ── Podium ── */}
              {!filters.university && !filters.skill && top3.length >= 3 && (
                <div style={{ animation: 'fadeUp 0.5s ease 0.2s both' }}>
                  <Podium top3={top3} />
                </div>
              )}

              {/* ── Filters ── */}
              <FilterBar
                universities={universities}
                filters={filters}
                onChange={handleFilterChange}
              />

              {/* ── Table ── */}
              <TableHeader />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {leaderboard.map((student, idx) => (
                  <LeaderboardRow
                    key={student.UserID}
                    student={student}
                    isMe={student.UserID === myID}
                    animDelay={Math.min(idx * 0.03, 0.4)}
                  />
                ))}
              </div>

              {/* ── Footer note ── */}
              <div style={{
                textAlign: 'center', marginTop: '32px',
                fontSize: '0.75rem', color: '#3a3a5a',
              }}>
                Leaderboard refreshes every 24 hours at midnight · Showing top {leaderboard.length} students
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}