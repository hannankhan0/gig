// src/pages/AuthPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const UNIVERSITIES = [
  'FAST-NU Lahore', 'FAST-NU Karachi', 'FAST-NU Islamabad',
  'LUMS', 'NUST', 'UET Lahore', 'COMSATS Lahore',
  'Punjab University', 'UMT', 'Bahria University', 'Air University', 'Other',
];

function getPasswordStrength(pass) {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 8)             score++;
  if (/[a-z]/.test(pass))          score++;
  if (/[A-Z]/.test(pass))          score++;
  if (/[0-9]/.test(pass))          score++;
  if (/[^a-zA-Z0-9\s]/.test(pass)) score++;
  if (score <= 2) return { score, label: 'Weak',   color: '#f87171' };
  if (score === 3) return { score, label: 'Fair',   color: '#fbbf24' };
  if (score === 4) return { score, label: 'Good',   color: '#34d399' };
  return              { score, label: 'Strong', color: '#4ade80' };
}

export default function AuthPage() {
  const navigate                           = useNavigate();
  const { setUser, manualLoginInProgressRef: manualLoginInProgress } = useAuth();

  const [tab,        setTab]        = useState('signin');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const [siEmail, setSiEmail] = useState('');
  const [siPass,  setSiPass]  = useState('');

  const [role,       setRole]       = useState('student');
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [suEmail,    setSuEmail]    = useState('');
  const [university, setUniversity] = useState('');
  const [suPass,     setSuPass]     = useState('');
  const [phone,      setPhone]      = useState('');

  const clear = () => { setError(''); setSuccess(''); };

  // ── SIGN IN ───────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault(); clear();
    setLoading(true);
    manualLoginInProgress.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, siEmail, siPass);

      let verified = false;
      for (let i = 0; i < 3; i++) {
        await cred.user.reload();
        if (auth.currentUser?.emailVerified) { verified = true; break; }
        await new Promise(r => setTimeout(r, 800));
      }

      if (!verified) {
        setError('Please verify your email first. Check your inbox.');
        await signOut(auth);
        setLoading(false);
        manualLoginInProgress.current = false;
        return;
      }

      await auth.currentUser.getIdToken(true);
      const res = await API.post('/auth/login');
      setUser(res.data.user);
      localStorage.setItem('gg_user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/invalid-credential')     setError('Wrong email or password.');
      else if (err.code === 'auth/user-not-found')    setError('No account found with this email.');
      else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Try again later.');
      else if (err.response?.data?.error)             setError(err.response.data.error);
      else setError('Something went wrong. Please try again.');
    }
    setLoading(false);
    manualLoginInProgress.current = false;
  };

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault(); clear();
    if (!siEmail) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, siEmail);
      setSuccess('Password reset link sent. Check your inbox.');
    } catch {
      setSuccess('If that email exists, a reset link has been sent.');
    }
    setLoading(false);
  };

  // ── SIGN UP ───────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault(); clear();

    if (firstName.trim().length < 2)       { setError('First name must be at least 2 characters.'); return; }
    if (lastName.trim().length < 2)        { setError('Last name must be at least 2 characters.'); return; }
    if (!/^[a-zA-Z\s]+$/.test(firstName))  { setError('First name can only contain letters.'); return; }
    if (!/^[a-zA-Z\s]+$/.test(lastName))   { setError('Last name can only contain letters.'); return; }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(suEmail)) { setError('Please enter a valid email address.'); return; }

    const blockedDomains = ['test.com', 'fake.com', 'temp.com', 'example.com', 'mailinator.com'];
    if (blockedDomains.includes(suEmail.split('@')[1]?.toLowerCase())) {
      setError('Please use a real email address.'); return;
    }
    if (phone.trim() && !/^03\d{9}$/.test(phone.trim())) {
      setError('Phone must be exactly 11 digits starting with 03.'); return;
    }
    if (role === 'student' && !university) { setError('Please select your university.'); return; }
    if (suPass.length < 8)                { setError('Password must be at least 8 characters.'); return; }
    if (!/[a-z]/.test(suPass))            { setError('Password must contain at least one lowercase letter.'); return; }
    if (!/[A-Z]/.test(suPass))            { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(suPass))            { setError('Password must contain at least one number.'); return; }
    if (!/[^a-zA-Z0-9\s]/.test(suPass))   { setError('Password must contain at least one special character (e.g. !@#$).'); return; }
    if (/\s/.test(suPass))                { setError('Password cannot contain spaces.'); return; }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail, suPass);
      await sendEmailVerification(cred.user);

      const form = new FormData();
      form.append('fullName',   `${firstName.trim()} ${lastName.trim()}`);
      form.append('phone',      phone.trim());
      form.append('university', university);
      form.append('role',       role);

      await API.post('/auth/register', form);
      await signOut(auth);

      setSuccess('Account created! Check your email for a verification link, then sign in.');
      setTab('signin');
      setSiEmail(suEmail);
      setFirstName(''); setLastName(''); setSuEmail('');
      setUniversity(''); setSuPass(''); setPhone('');

    } catch (err) {
      if (auth.currentUser) {
        try { await auth.currentUser.delete(); } catch { /* ignore */ }
      }
      if (err.code === 'auth/email-already-in-use') setError('Email already registered. Please sign in.');
      else if (err.code === 'auth/invalid-email')   setError('Invalid email format.');
      else if (err.code === 'auth/weak-password')   setError('Password is too weak.');
      else if (err.response?.data?.error)           setError(err.response.data.error);
      else setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  // ── GOOGLE ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    clear();
    setLoading(true);
    manualLoginInProgress.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
      await auth.currentUser.getIdToken(true);

      try {
        const res = await API.post('/auth/login');
        setUser(res.data.user);
        localStorage.setItem('gg_user', JSON.stringify(res.data.user));
        navigate('/dashboard');
      } catch (err) {
        if (err.response?.status === 404) {
          localStorage.setItem('gg_google_signup', JSON.stringify({
            email:    auth.currentUser.email,
            fullName: auth.currentUser.displayName || '',
          }));
          navigate('/complete-profile');
        } else {
          setError(err.response?.data?.error || 'Login failed. Please try again.');
          await signOut(auth);
        }
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') setError('Google sign-in was cancelled.');
      else setError('Google sign-in failed. Please try again.');
    }
    setLoading(false);
    manualLoginInProgress.current = false;
  };

  const handleDevAdmin = async () => {
    clear();
    setLoading(true);
    try {
      const res = await API.post('/auth/dev-admin-login');
      localStorage.setItem('gg_dev_token', res.data.devToken);
      localStorage.setItem('gg_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Local admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  const passChecks = [
    { check: suPass.length >= 8,                  label: '8+ chars'     },
    { check: /[a-z]/.test(suPass),               label: 'Lowercase'    },
    { check: /[A-Z]/.test(suPass),               label: 'Uppercase'    },
    { check: /[0-9]/.test(suPass),               label: 'Number'       },
    { check: /[^a-zA-Z0-9\s]/.test(suPass),      label: 'Symbol (!@#)' },
    { check: !/\s/.test(suPass) && suPass.length > 0, label: 'No spaces' },
  ];

  const strength = getPasswordStrength(suPass);

  return (
    <div className="min-h-screen flex" style={{ background: '#0f0f0f' }}>

      {/* LEFT PANEL */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1200 50%, #0f0f0f 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: '#f59e0b' }}>🎓</div>
          <span className="text-xl font-bold tracking-tight">
            Grade<span style={{ color: '#f59e0b' }}>&</span>Grind
          </span>
        </div>
        <div>
          <div className="inline-block px-4 py-2 rounded-full text-xs font-semibold tracking-widest mb-8"
            style={{ border: '1px solid #444', color: '#aaa' }}>
            STUDENT FREELANCING
          </div>
          <h1 className="text-6xl font-black leading-none mb-6" style={{ letterSpacing: '-0.02em' }}>
            Turn your<br />skills into<br />
            <span style={{ color: '#f59e0b' }}>income.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-md" style={{ color: '#888' }}>
            Pakistan's first freelancing platform built exclusively for
            university students. Find gigs, build your portfolio, and
            get paid all around your schedule.
          </p>
        </div>
        <div className="flex gap-12">
          {[
            { value: '2.4k+', label: 'Active Students' },
            { value: '850+',  label: 'Gigs Posted' },
            { value: '98%',   label: 'Satisfaction' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-black" style={{ color: '#f59e0b' }}>{s.value}</div>
              <div className="text-sm mt-1" style={{ color: '#666' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto"
        style={{ background: '#111111' }}>
        <div className="w-full max-w-md py-8">

          <div className="text-center mb-8">
            <h2 className="text-4xl font-black mb-2"
              style={{ color: '#222', WebkitTextStroke: '1px #444', letterSpacing: '-0.02em' }}>
              {tab === 'signin' ? 'Welcome back.' : 'Join the grind.'}
            </h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              {tab === 'signin'
                ? 'Sign in to your Grade and Grind account'
                : 'Create your free student or client account'}
            </p>
          </div>

          {/* TABS */}
          <div className="flex rounded-2xl p-1 mb-8 gap-1"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            {['signin', 'signup'].map(t => (
              <button key={t}
                onClick={() => { setTab(t); clear(); setForgotMode(false); }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ background: tab === t ? '#f59e0b' : 'transparent', color: tab === t ? '#000' : '#666' }}>
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#ff5e7815', border: '1px solid #ff5e7840', color: '#ff8090' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#22d3a515', border: '1px solid #22d3a540', color: '#22d3a5' }}>
              {success}
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === 'signin' && (
            <form onSubmit={forgotMode ? handleForgot : handleSignIn}>
              {forgotMode && (
                <p className="text-sm mb-4" style={{ color: '#888' }}>
                  Enter your email and we will send a password reset link.
                </p>
              )}
              <div className="mb-4">
                <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>
                  EMAIL ADDRESS
                </label>
                <InputField type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                  placeholder="you@university.edu.pk" required />
              </div>
              {!forgotMode && (
                <div className="mb-2">
                  <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>
                    PASSWORD
                  </label>
                  <div className="relative">
                    <InputField type={showPass ? 'text' : 'password'}
                      value={siPass} onChange={e => setSiPass(e.target.value)}
                      placeholder="Enter your password" required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#555' }}>
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
              )}
              {!forgotMode && (
                <div className="text-right mb-6">
                  <button type="button" onClick={() => { setForgotMode(true); clear(); }}
                    className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                    Forgot password?
                  </button>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base mb-4 transition-all"
                style={{ background: '#f59e0b', color: '#000', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Please wait...' : forgotMode ? 'Send Reset Link' : 'Sign In'}
              </button>
              {forgotMode ? (
                <button type="button" onClick={() => { setForgotMode(false); clear(); }}
                  className="w-full py-3 rounded-xl text-sm font-medium"
                  style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#666' }}>
                  Back to Sign In
                </button>
              ) : (
                <>
                  <Divider />
                  <GoogleBtn onClick={handleGoogle} loading={loading} />
                  <button type="button" onClick={handleDevAdmin} disabled={loading}
                    className="w-full py-3 rounded-xl text-sm font-semibold mt-3"
                    style={{ background: '#1a1200', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
                    Local Admin Login
                  </button>
                </>
              )}
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp}>
              {/* role selector */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { value: 'student', icon: '🎓', title: 'Student', desc: 'Find and complete gigs' },
                  { value: 'client',  icon: '💼', title: 'Client',  desc: 'Post gigs and hire' },
                ].map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)}
                    className="p-4 rounded-2xl text-center transition-all duration-200"
                    style={{
                      background: role === r.value ? '#1a1200' : '#1a1a1a',
                      border: `1px solid ${role === r.value ? '#f59e0b' : '#2a2a2a'}`,
                    }}>
                    <div className="text-2xl mb-2">{r.icon}</div>
                    <div className="font-bold text-sm" style={{ color: role === r.value ? '#f59e0b' : '#fff' }}>
                      {r.title}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#666' }}>{r.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>FIRST NAME</label>
                  <InputField value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ali" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>LAST NAME</label>
                  <InputField value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Khan" required />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>
                  {role === 'student' ? 'UNIVERSITY EMAIL' : 'EMAIL ADDRESS'}
                </label>
                <InputField type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)}
                  placeholder={role === 'student' ? 'you@lhr.nu.edu.pk' : 'you@company.com'} required />
              </div>

              {role === 'student' && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>UNIVERSITY</label>
                    <select value={university} onChange={e => setUniversity(e.target.value)} required
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: university ? '#fff' : '#555' }}>
                      <option value="" disabled>Select your university</option>
                      {UNIVERSITIES.map(u => (
                        <option key={u} value={u} style={{ background: '#1a1a1a' }}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>
                      PHONE <span style={{ color: '#444', fontWeight: 400 }}>(OPTIONAL)</span>
                    </label>
                    <InputField value={phone} onChange={e => setPhone(e.target.value)} placeholder="03001234567" />
                    {phone && !/^03\d{9}$/.test(phone) && (
                      <p className="text-xs mt-1" style={{ color: '#ff8090' }}>Must be 11 digits starting with 03</p>
                    )}
                  </div>
                </>
              )}

              <div className="mb-6">
                <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: '#555' }}>PASSWORD</label>
                <div className="relative">
                  <InputField type={showPass ? 'text' : 'password'}
                    value={suPass} onChange={e => setSuPass(e.target.value)}
                    placeholder="Min. 8 chars, uppercase, number, symbol" required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#555' }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>

                {/* PASSWORD STRENGTH METER */}
                {suPass.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    {/* strength bar segments */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '7px' }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{
                          flex: 1, height: '4px', borderRadius: '2px',
                          background: i <= strength.score ? strength.color : '#2a2a2a',
                          transition: 'background 0.25s',
                        }} />
                      ))}
                    </div>

                    {/* strength label */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#555' }}>Password strength</span>
                      {strength.label && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: strength.color }}>
                          {strength.label}
                        </span>
                      )}
                    </div>

                    {/* requirement chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {passChecks.map(({ check, label }) => (
                        <span key={label} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 9px', borderRadius: '20px',
                          fontSize: '0.69rem', fontWeight: 600,
                          background: check ? '#22d3a512' : '#ff5e7810',
                          color:      check ? '#22d3a5'   : '#ff8090',
                          border:     `1px solid ${check ? '#22d3a528' : '#ff5e7820'}`,
                          transition: 'all 0.2s',
                        }}>
                          <span>{check ? '✓' : '✗'}</span>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-base mb-4 transition-all"
                style={{ background: '#f59e0b', color: '#000', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <Divider />
              <GoogleBtn onClick={handleGoogle} loading={loading} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ type = 'text', value, onChange, placeholder, required }) {
  return (
    <input type={type} value={value} onChange={onChange}
      placeholder={placeholder} required={required}
      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
      onFocus={e => e.target.style.borderColor = '#f59e0b'}
      onBlur={e  => e.target.style.borderColor = '#2a2a2a'}
    />
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 my-5">
      <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
      <span className="text-xs" style={{ color: '#444' }}>or continue with</span>
      <div className="flex-1 h-px" style={{ background: '#2a2a2a' }} />
    </div>
  );
}

function GoogleBtn({ onClick, loading }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 transition-all"
      style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}>
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        width="18" height="18" alt="Google" />
      Continue with Google
    </button>
  );
}
