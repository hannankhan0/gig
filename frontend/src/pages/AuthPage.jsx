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
  if (pass.length >= 8) score++;
  if (/[a-z]/.test(pass)) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^a-zA-Z0-9\s]/.test(pass)) score++;
  if (score <= 2) return { score, label: 'Weak', color: '#f87171' };
  if (score === 3) return { score, label: 'Fair', color: '#fbbf24' };
  if (score === 4) return { score, label: 'Good', color: '#34d399' };
  return { score, label: 'Strong', color: '#4ade80' };
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { setUser, manualLoginInProgressRef: manualLoginInProgress } = useAuth();

  const [tab, setTab] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');

  const [role, setRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [suPass, setSuPass] = useState('');
  const [phone, setPhone] = useState('');

  const clear = () => { setError(''); setSuccess(''); };

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
      if (err.code === 'auth/invalid-credential') setError('Wrong email or password.');
      else if (err.code === 'auth/user-not-found') setError('No account found with this email.');
      else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Try again later.');
      else if (err.response?.data?.error) setError(err.response.data.error);
      else setError('Something went wrong. Please try again.');
    }
    setLoading(false);
    manualLoginInProgress.current = false;
  };

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

  const handleSignUp = async (e) => {
    e.preventDefault(); clear();

    if (firstName.trim().length < 2) { setError('First name must be at least 2 characters.'); return; }
    if (lastName.trim().length < 2) { setError('Last name must be at least 2 characters.'); return; }
    if (!/^[a-zA-Z\s]+$/.test(firstName)) { setError('First name can only contain letters.'); return; }
    if (!/^[a-zA-Z\s]+$/.test(lastName)) { setError('Last name can only contain letters.'); return; }

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
    if (suPass.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[a-z]/.test(suPass)) { setError('Password must contain at least one lowercase letter.'); return; }
    if (!/[A-Z]/.test(suPass)) { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(suPass)) { setError('Password must contain at least one number.'); return; }
    if (!/[^a-zA-Z0-9\s]/.test(suPass)) { setError('Password must contain at least one special character (e.g. !@#$).'); return; }
    if (/\s/.test(suPass)) { setError('Password cannot contain spaces.'); return; }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail, suPass);
      await sendEmailVerification(cred.user);

      const form = new FormData();
      form.append('fullName', `${firstName.trim()} ${lastName.trim()}`);
      form.append('phone', phone.trim());
      form.append('university', university);
      form.append('role', role);

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
      else if (err.code === 'auth/invalid-email') setError('Invalid email format.');
      else if (err.code === 'auth/weak-password') setError('Password is too weak.');
      else if (err.response?.data?.error) setError(err.response.data.error);
      else setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

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
            email: auth.currentUser.email,
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
    { check: suPass.length >= 8, label: '8+ chars' },
    { check: /[a-z]/.test(suPass), label: 'Lowercase' },
    { check: /[A-Z]/.test(suPass), label: 'Uppercase' },
    { check: /[0-9]/.test(suPass), label: 'Number' },
    { check: /[^a-zA-Z0-9\s]/.test(suPass), label: 'Symbol' },
    { check: !/\s/.test(suPass) && suPass.length > 0, label: 'No spaces' },
  ];

  const strength = getPasswordStrength(suPass);

  return (
    <div style={st.page}>
      <style>{`
        .gg-auth-hero-panel { grid-template-columns: minmax(0, 1.03fr) minmax(340px, 0.97fr); }
        .gg-auth-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .gg-auth-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gg-auth-features { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .gg-auth-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gg-auth-two-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 980px) {
          .gg-auth-hero-panel { grid-template-columns: 1fr !important; min-height: auto !important; }
          .gg-auth-mockup { min-height: 390px !important; }
          .gg-auth-features { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 680px) {
          .gg-auth-nav-links a { display: none !important; }
          .gg-auth-stats,
          .gg-auth-steps,
          .gg-auth-features,
          .gg-auth-roles,
          .gg-auth-two-fields { grid-template-columns: 1fr !important; }
          .gg-auth-mockup { min-height: 330px !important; transform: scale(0.92); transform-origin: top center; }
        }
      `}</style>
      <div style={st.bgGlowOne} />
      <div style={st.bgGlowTwo} />

      <nav style={st.nav}>
        <div style={st.logo}>
          <span style={st.logoMark}>G&G</span>
          <span>Grade &amp; Grind</span>
        </div>
        <div className="gg-auth-nav-links" style={st.navLinks}>
          <a href="#how" style={st.navLink}>How it works</a>
          <a href="#features" style={st.navLink}>Features</a>
          <button type="button" onClick={() => { setTab('signin'); setForgotMode(false); clear(); }} style={st.navGhost}>Login</button>
          <button type="button" onClick={() => { setTab('signup'); setForgotMode(false); clear(); }} style={st.navCta}>Sign up</button>
        </div>
      </nav>

      <main style={st.main}>
        <section className="gg-auth-hero-panel" style={st.heroPanel}>
          <div style={st.heroCopy}>
            <div style={st.eyebrow}>University freelance marketplace</div>
            <h1 style={st.heroTitle}>Turn Student Skills Into Paid Opportunities</h1>
            <p style={st.heroText}>
              Grade &amp; Grind connects university students with clients who need fast,
              affordable, skill-based freelance work.
            </p>
            <div style={st.heroActions}>
              <button type="button" onClick={() => { setTab('signup'); clear(); }} style={st.primaryBtn}>Get Started</button>
              <a href="#how" style={st.secondaryBtn}>How It Works</a>
            </div>
            <div className="gg-auth-stats" style={st.statsGrid}>
              {[
                ['1,200+', 'Students'],
                ['300+', 'Active Gigs'],
                ['2,000+', 'Applications'],
                ['4.8', 'Avg Rating'],
              ].map(([value, label]) => (
                <div key={label} style={st.stat}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="gg-auth-mockup" style={st.mockupWrap}>
            <div style={st.mockupCardMain}>
              <div style={st.mockupTop}>
                <span style={st.pill}>Open Gig</span>
                <span style={st.price}>PKR 18,000</span>
              </div>
              <h3 style={st.mockupTitle}>Build a React Dashboard</h3>
              <p style={st.mockupText}>Matched with 12 student developers from FAST, NUST, and LUMS.</p>
              <div style={st.progressTrack}><div style={st.progressFill} /></div>
            </div>
            <div style={st.floatingCardOne}>
              <span style={st.avatar}>SA</span>
              <div>
                <strong>Sadeem Arshad</strong>
                <p>96% skill match</p>
              </div>
            </div>
            <div style={st.floatingCardTwo}>
              <span>Token Balance</span>
              <strong>8,750</strong>
            </div>
            <div style={st.floatingCardThree}>
              <span>Application</span>
              <strong>Accepted</strong>
            </div>
          </div>
        </section>

        <section id="how" style={st.section}>
          <div style={st.sectionHeader}>
            <span style={st.eyebrow}>Simple workflow</span>
            <h2 style={st.sectionTitle}>Built for clients and students</h2>
          </div>
          <div className="gg-auth-steps" style={st.stepsGrid}>
            <RoleFlow title="For Clients" steps={['Post a gig', 'Review student applications', 'Chat and hire', 'Complete project']} />
            <RoleFlow title="For Students" steps={['Build profile', 'Apply to gigs', 'Communicate with clients', 'Earn and grow reputation']} />
          </div>
        </section>

        <section id="features" style={st.section}>
          <div style={st.sectionHeader}>
            <span style={st.eyebrow}>Platform tools</span>
            <h2 style={st.sectionTitle}>Everything needed to run real project work</h2>
          </div>
          <div className="gg-auth-features" style={st.featureGrid}>
            {[
              ['Skill-based gig matching', 'Students discover gigs aligned with their profile and strengths.'],
              ['Real-time chat', 'Clients and students coordinate project details in one place.'],
              ['Token-based access', 'Clear usage model for applications, posting, and premium actions.'],
              ['Reviews and ratings', 'Reputation grows with completed work and quality feedback.'],
              ['Student leaderboard', 'High-performing students get stronger platform visibility.'],
              ['Admin moderation', 'Platform controls keep users, gigs, chats, and reports manageable.'],
            ].map(([title, text]) => (
              <div key={title} style={st.featureCard}>
                <div style={st.featureIcon}>{title.slice(0, 2).toUpperCase()}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="gg-auth-roles" style={st.roleCards}>
          <AudienceCard title="For Students" text="Find paid work, build a portfolio, and create a trusted university freelance reputation." onClick={() => { setRole('student'); setTab('signup'); clear(); }} />
          <AudienceCard title="For Clients" text="Post affordable projects, compare student applicants, chat, and hire quickly." onClick={() => { setRole('client'); setTab('signup'); clear(); }} />
        </section>

        <section style={st.finalCta}>
          <h2>Ready to start your first gig?</h2>
          <p>Create an account and start using Grade &amp; Grind today.</p>
          <button type="button" onClick={() => { setTab('signup'); clear(); }} style={st.primaryBtn}>Create Account</button>
        </section>
      </main>

      <aside style={st.authRail}>
        <div style={st.authCard}>
          <div style={st.authHeader}>
            <div>
              <span style={st.eyebrow}>{tab === 'signin' ? 'Welcome back' : 'Create account'}</span>
              <h2>{tab === 'signin' ? 'Sign in to continue' : 'Join Grade & Grind'}</h2>
            </div>
          </div>

          <div style={st.tabs}>
            {['signin', 'signup'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); clear(); setForgotMode(false); }}
                style={{ ...st.tab, ...(tab === t ? st.tabActive : {}) }}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {error && <div style={st.error}>{error}</div>}
          {success && <div style={st.success}>{success}</div>}

          {tab === 'signin' ? (
            <form onSubmit={forgotMode ? handleForgot : handleSignIn} style={st.form}>
              {forgotMode && <p style={st.formNote}>Enter your email and we will send a password reset link.</p>}
              <Field label="Email Address">
                <InputField type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@university.edu.pk" required />
              </Field>
              {!forgotMode && (
                <Field label="Password">
                  <PasswordWrap show={showPass} onToggle={() => setShowPass(!showPass)}>
                    <InputField type={showPass ? 'text' : 'password'} value={siPass} onChange={e => setSiPass(e.target.value)} placeholder="Enter your password" required />
                  </PasswordWrap>
                </Field>
              )}
              {!forgotMode && (
                <button type="button" onClick={() => { setForgotMode(true); clear(); }} style={st.textButton}>Forgot password?</button>
              )}
              <button type="submit" disabled={loading} style={st.submitBtn}>
                {loading ? 'Please wait...' : forgotMode ? 'Send Reset Link' : 'Sign In'}
              </button>
              {forgotMode ? (
                <button type="button" onClick={() => { setForgotMode(false); clear(); }} style={st.outlineBtn}>Back to Sign In</button>
              ) : (
                <>
                  <Divider />
                  <GoogleBtn onClick={handleGoogle} loading={loading} />
                  <button type="button" onClick={handleDevAdmin} disabled={loading} style={st.adminBtn}>Local Admin Login</button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSignUp} style={st.form}>
              <div style={st.roleGrid}>
                {[
                  { value: 'student', title: 'Student', desc: 'Find and complete gigs' },
                  { value: 'client', title: 'Client', desc: 'Post gigs and hire' },
                ].map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)} style={{ ...st.roleBtn, ...(role === r.value ? st.roleActive : {}) }}>
                    <strong>{r.title}</strong>
                    <span>{r.desc}</span>
                  </button>
                ))}
              </div>

              <div className="gg-auth-two-fields" style={st.twoFields}>
                <Field label="First Name">
                  <InputField value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ali" required />
                </Field>
                <Field label="Last Name">
                  <InputField value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Khan" required />
                </Field>
              </div>

              <Field label={role === 'student' ? 'University Email' : 'Email Address'}>
                <InputField type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder={role === 'student' ? 'you@lhr.nu.edu.pk' : 'you@company.com'} required />
              </Field>

              {role === 'student' && (
                <>
                  <Field label="University">
                    <select value={university} onChange={e => setUniversity(e.target.value)} required style={st.input}>
                      <option value="" disabled>Select your university</option>
                      {UNIVERSITIES.map(u => <option key={u} value={u} style={{ background: '#151a21' }}>{u}</option>)}
                    </select>
                  </Field>
                  <Field label="Phone (optional)">
                    <InputField value={phone} onChange={e => setPhone(e.target.value)} placeholder="03001234567" />
                    {phone && !/^03\d{9}$/.test(phone) && <p style={st.inputHintDanger}>Must be 11 digits starting with 03</p>}
                  </Field>
                </>
              )}

              <Field label="Password">
                <PasswordWrap show={showPass} onToggle={() => setShowPass(!showPass)}>
                  <InputField type={showPass ? 'text' : 'password'} value={suPass} onChange={e => setSuPass(e.target.value)} placeholder="8+ chars, uppercase, number, symbol" required />
                </PasswordWrap>
                {suPass.length > 0 && (
                  <div style={st.strengthWrap}>
                    <div style={st.strengthBars}>
                      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ background: i <= strength.score ? strength.color : '#2a313b' }} />)}
                    </div>
                    <div style={st.strengthMeta}>
                      <span>Password strength</span>
                      <strong style={{ color: strength.color }}>{strength.label}</strong>
                    </div>
                    <div style={st.checks}>
                      {passChecks.map(({ check, label }) => (
                        <span key={label} style={{ ...st.check, ...(check ? st.checkOk : st.checkBad) }}>{check ? 'OK' : '--'} {label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Field>

              <button type="submit" disabled={loading} style={st.submitBtn}>{loading ? 'Creating account...' : 'Create Account'}</button>
              <Divider />
              <GoogleBtn onClick={handleGoogle} loading={loading} />
            </form>
          )}
        </div>
      </aside>

      <footer style={st.footer}>
        <strong>Grade &amp; Grind</strong>
        <span>Student-focused freelance marketplace.</span>
        <span>Copyright 2026 Grade &amp; Grind.</span>
      </footer>
    </div>
  );
}

function RoleFlow({ title, steps }) {
  return (
    <div style={st.flowCard}>
      <h3>{title}</h3>
      {steps.map((step, i) => (
        <div key={step} style={st.flowStep}>
          <span>{i + 1}</span>
          <p>{step}</p>
        </div>
      ))}
    </div>
  );
}

function AudienceCard({ title, text, onClick }) {
  return (
    <div style={st.audienceCard}>
      <div style={st.featureIcon}>{title.includes('Students') ? 'ST' : 'CL'}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button type="button" onClick={onClick} style={st.cardCta}>Create Account</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={st.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PasswordWrap({ children, show, onToggle }) {
  return (
    <div style={st.passwordWrap}>
      {children}
      <button type="button" onClick={onToggle} style={st.showBtn}>{show ? 'Hide' : 'Show'}</button>
    </div>
  );
}

function InputField({ type = 'text', value, onChange, placeholder, required }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      style={st.input}
    />
  );
}

function Divider() {
  return (
    <div style={st.divider}>
      <span />
      <p>or continue with</p>
      <span />
    </div>
  );
}

function GoogleBtn({ onClick, loading }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} style={st.googleBtn}>
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google" />
      Continue with Google
    </button>
  );
}

const st = {
  page: { minHeight: '100vh', background: '#080808', color: '#f9fafb', position: 'relative', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" },
  bgGlowOne: { position: 'fixed', width: 420, height: 420, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', filter: 'blur(80px)', top: -140, left: -120, pointerEvents: 'none' },
  bgGlowTwo: { position: 'fixed', width: 460, height: 460, borderRadius: '50%', background: 'rgba(255,163,26,0.08)', filter: 'blur(90px)', right: -160, top: 220, pointerEvents: 'none' },
  nav: { position: 'sticky', top: 0, zIndex: 20, minHeight: 74, padding: '16px clamp(18px, 4vw, 56px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,8,8,0.82)', backdropFilter: 'blur(18px)' },
  logo: { display: 'flex', alignItems: 'center', gap: 11, fontWeight: 900, letterSpacing: '-0.02em' },
  logoMark: { width: 38, height: 38, borderRadius: 12, background: '#f59e0b', color: '#080808', display: 'grid', placeItems: 'center', fontSize: '0.76rem', fontWeight: 950 },
  navLinks: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  navLink: { color: '#9ca3af', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 },
  navGhost: { background: 'rgba(255,255,255,0.04)', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 800 },
  navCta: { background: '#f59e0b', color: '#080808', border: 0, borderRadius: 10, padding: '10px 15px', cursor: 'pointer', fontWeight: 900 },
  main: { width: 'min(1180px, calc(100% - 36px))', margin: '0 auto', padding: '44px 0 72px', position: 'relative', zIndex: 1 },
  heroPanel: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.03fr) minmax(340px, 0.97fr)', gap: 32, alignItems: 'center', minHeight: 'calc(100vh - 150px)' },
  heroCopy: { maxWidth: 680 },
  eyebrow: { display: 'inline-flex', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 999, padding: '6px 11px', fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' },
  heroTitle: { fontSize: 'clamp(2.7rem, 7vw, 5.8rem)', lineHeight: 0.94, letterSpacing: '-0.055em', margin: '18px 0 18px', maxWidth: 760 },
  heroText: { color: '#9ca3af', fontSize: '1.08rem', lineHeight: 1.7, maxWidth: 620 },
  heroActions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 },
  primaryBtn: { background: '#f59e0b', color: '#080808', border: 0, borderRadius: 12, padding: '13px 18px', cursor: 'pointer', fontWeight: 950, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  secondaryBtn: { background: 'rgba(255,255,255,0.04)', color: '#f9fafb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 18px', cursor: 'pointer', fontWeight: 850, textDecoration: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 36 },
  stat: { background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 15 },
  mockupWrap: { position: 'relative', minHeight: 470 },
  mockupCardMain: { position: 'absolute', inset: '72px 34px auto 32px', minHeight: 260, background: 'linear-gradient(145deg, rgba(21,26,33,0.96), rgba(12,12,12,0.96))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 24, boxShadow: '0 28px 90px rgba(0,0,0,0.46)' },
  mockupTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pill: { color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.26)', borderRadius: 999, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 900 },
  price: { color: '#f59e0b', fontWeight: 950 },
  mockupTitle: { fontSize: '1.65rem', margin: '30px 0 8px', letterSpacing: '-0.03em' },
  mockupText: { color: '#9ca3af', lineHeight: 1.55 },
  progressTrack: { height: 10, background: '#242b35', borderRadius: 999, marginTop: 28, overflow: 'hidden' },
  progressFill: { width: '72%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #facc15)' },
  floatingCardOne: { position: 'absolute', left: 0, top: 10, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(18,18,18,0.86)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' },
  floatingCardTwo: { position: 'absolute', right: 0, top: 24, background: 'rgba(18,18,18,0.86)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 16, minWidth: 150, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' },
  floatingCardThree: { position: 'absolute', right: 26, bottom: 62, background: 'rgba(18,18,18,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 16, minWidth: 170, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: '#f59e0b', color: '#080808', display: 'grid', placeItems: 'center', fontWeight: 950 },
  section: { padding: '46px 0' },
  sectionHeader: { maxWidth: 720, marginBottom: 22 },
  sectionTitle: { fontSize: 'clamp(1.8rem, 3vw, 2.7rem)', letterSpacing: '-0.04em', margin: '12px 0 0' },
  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 },
  flowCard: { background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20 },
  flowStep: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 },
  featureCard: { background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, background: 'rgba(245,158,11,0.13)', color: '#f59e0b', display: 'grid', placeItems: 'center', fontWeight: 950, marginBottom: 12, fontSize: '0.75rem' },
  roleCards: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, padding: '30px 0' },
  audienceCard: { background: 'linear-gradient(145deg, rgba(245,158,11,0.11), rgba(255,255,255,0.04))', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 22, padding: 24 },
  cardCta: { background: '#f59e0b', color: '#080808', border: 0, borderRadius: 10, padding: '10px 13px', cursor: 'pointer', fontWeight: 900 },
  finalCta: { margin: '42px 0 20px', background: '#111827', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 24, padding: '34px 24px', textAlign: 'center' },
  authRail: { width: 'min(500px, calc(100% - 28px))', margin: '0 auto 70px', position: 'relative', zIndex: 2 },
  authCard: { background: 'rgba(18,18,18,0.92)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 24, padding: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.46)', backdropFilter: 'blur(18px)' },
  authHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 18 },
  tabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#0f1115', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 5, marginBottom: 16 },
  tab: { background: 'transparent', border: 0, color: '#9ca3af', borderRadius: 10, padding: '11px 10px', cursor: 'pointer', fontWeight: 900 },
  tabActive: { background: '#f59e0b', color: '#080808' },
  error: { background: 'rgba(239,68,68,0.11)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 12, padding: 12, fontSize: '0.86rem', marginBottom: 12 },
  success: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', color: '#86efac', borderRadius: 12, padding: 12, fontSize: '0.86rem', marginBottom: 12 },
  form: { display: 'grid', gap: 13 },
  formNote: { color: '#9ca3af', margin: 0, fontSize: '0.86rem' },
  field: { display: 'grid', gap: 7, color: '#9ca3af', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', background: '#151a21', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb', borderRadius: 12, padding: '12px 13px', outline: 'none', fontSize: '0.94rem', fontFamily: 'inherit', boxSizing: 'border-box' },
  passwordWrap: { position: 'relative' },
  showBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#d1d5db', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.72rem' },
  textButton: { justifySelf: 'end', background: 'transparent', border: 0, color: '#f59e0b', cursor: 'pointer', fontWeight: 900 },
  submitBtn: { background: '#f59e0b', color: '#080808', border: 0, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', fontWeight: 950, fontSize: '0.98rem' },
  outlineBtn: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontWeight: 850 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: '0.78rem' },
  googleBtn: { background: '#151a21', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  adminBtn: { background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', fontWeight: 850 },
  roleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  roleBtn: { background: '#151a21', border: '1px solid rgba(255,255,255,0.1)', color: '#f9fafb', borderRadius: 14, padding: 13, cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 4 },
  roleActive: { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.55)' },
  twoFields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  inputHintDanger: { color: '#fca5a5', margin: '3px 0 0', fontSize: '0.74rem' },
  strengthWrap: { display: 'grid', gap: 7, marginTop: 8 },
  strengthBars: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 },
  strengthMeta: { display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.75rem' },
  checks: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  check: { borderRadius: 999, padding: '4px 8px', fontSize: '0.68rem', fontWeight: 900, border: '1px solid' },
  checkOk: { background: 'rgba(34,197,94,0.1)', color: '#86efac', borderColor: 'rgba(34,197,94,0.25)' },
  checkBad: { background: 'rgba(239,68,68,0.08)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.18)' },
  footer: { width: 'min(1180px, calc(100% - 36px))', margin: '0 auto', padding: '22px 0 34px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 14, flexWrap: 'wrap', color: '#9ca3af', position: 'relative', zIndex: 1 },
};
