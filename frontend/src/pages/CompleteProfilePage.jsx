// src/pages/CompleteProfilePage.jsx
// shown to Google sign-in users who don't have a DB profile yet

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const UNIVERSITIES = [
  'FAST-NU Lahore', 'FAST-NU Karachi', 'FAST-NU Islamabad',
  'LUMS', 'NUST', 'UET Lahore', 'COMSATS Lahore',
  'Punjab University', 'UMT', 'Bahria University', 'Air University', 'Other',
];

export default function CompleteProfilePage() {
  const navigate        = useNavigate();
  const { user, setUser } = useAuth();

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [role,       setRole]       = useState('student');
  const [fullName,   setFullName]   = useState('');
  const [phone,      setPhone]      = useState('');
  const [university, setUniversity] = useState('');

  useEffect(() => {
    // FIX: redirect if already logged in — prevents re-registration
    if (user) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // redirect if no firebase user session
    if (!auth.currentUser) {
      navigate('/auth', { replace: true });
      return;
    }

    // pre-fill name from Google
    const stored = localStorage.getItem('gg_google_signup');
    if (stored) {
      try {
        const { fullName: name } = JSON.parse(stored);
        if (name) setFullName(name);
      } catch { /* ignore */ }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim())               { setError('Full name is required.'); return; }
    if (!/^[a-zA-Z\s]+$/.test(fullName)) { setError('Name can only contain letters.'); return; }
    if (phone && !/^03\d{9}$/.test(phone)) { setError('Phone must be 11 digits starting with 03.'); return; }
    if (role === 'student' && !university) { setError('Please select your university.'); return; }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('fullName',   fullName.trim());
      form.append('phone',      phone.trim());
      form.append('university', university);
      form.append('role',       role);

      await API.post('/auth/register', form);

      const res = await API.post('/auth/login');
      setUser(res.data.user);
      localStorage.removeItem('gg_google_signup');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    await signOut(auth);
    localStorage.removeItem('gg_google_signup');
    navigate('/auth');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#0f0f0f', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#111', border: '1px solid #1e1e1e', borderRadius: '24px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎓</div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px' }}>One more step</h1>
          <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Complete your profile to continue</p>
        </div>

        {error && (
          <div style={{ padding: '0.7rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', background: '#ff5e7815', border: '1px solid #ff5e7840', color: '#ff8090', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* role */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>I am a</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { value: 'student', icon: '🎓', label: 'Student' },
                { value: 'client',  icon: '💼', label: 'Client' },
              ].map(r => (
                <button key={r.value} type="button" onClick={() => setRole(r.value)}
                  style={{ padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: role === r.value ? '#1a1200' : '#1a1a1a', border: `1px solid ${role === r.value ? '#f59e0b' : '#2a2a2a'}`, color: role === r.value ? '#f59e0b' : '#fff', fontWeight: 700, fontSize: '0.88rem' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{r.icon}</div>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* full name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Ali Khan" required style={inp}
              onFocus={e => e.target.style.borderColor = '#f59e0b'}
              onBlur={e  => e.target.style.borderColor = '#2a2a2a'} />
          </div>

          {/* university — students only */}
          {role === 'student' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>University</label>
              <select value={university} onChange={e => setUniversity(e.target.value)} required
                style={{ ...inp, color: university ? '#fff' : '#555' }}>
                <option value="" disabled>Select your university</option>
                {UNIVERSITIES.map(u => (
                  <option key={u} value={u} style={{ background: '#1a1a1a' }}>{u}</option>
                ))}
              </select>
            </div>
          )}

          {/* phone */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={lbl}>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="03001234567" style={inp}
              onFocus={e => e.target.style.borderColor = '#f59e0b'}
              onBlur={e  => e.target.style.borderColor = '#2a2a2a'} />
            {phone && !/^03\d{9}$/.test(phone) && (
              <p style={{ color: '#ff8090', fontSize: '0.72rem', marginTop: '4px' }}>Must be 11 digits starting with 03</p>
            )}
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', background: '#f59e0b', border: 'none', color: '#000', fontWeight: 800, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
            {loading ? 'Saving...' : 'Complete Setup →'}
          </button>

          <button type="button" onClick={handleCancel} style={{ width: '100%', padding: '0.75rem', marginTop: '10px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#555', cursor: 'pointer', fontSize: '0.85rem' }}>
            Cancel & Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' };
const inp = { width: '100%', padding: '0.75rem 1rem', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s' };