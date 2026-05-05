// src/pages/StudentProfilePage.jsx
// US-03: student profile creation and editing
// US-04: CV upload

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SKILL_SUGGESTIONS = [
  'React', 'Node.js', 'JavaScript', 'Python', 'SQL', 'TypeScript', 'Java',
  'C++', 'Figma', 'UI/UX Design', 'HTML/CSS', 'Express', 'MongoDB', 'Git',
  'Machine Learning', 'Data Analysis', 'Content Writing', 'Graphic Design',
  'Flutter', 'Swift', 'Kotlin', 'PHP', 'Laravel', 'Django', 'Firebase',
];

const DEGREES = ['BSCS', 'BSDS', 'BSSE', 'BSAI', 'BBA', 'BSE', 'MSCS', 'MBA', 'Other'];

export default function StudentProfilePage() {
  const navigate          = useNavigate();
  const { user }          = useAuth();

  const [profile,        setProfile]        = useState(null);
  const [skills,         setSkills]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [preview,        setPreview]        = useState(false);

  const [bio,            setBio]            = useState('');
  const [degree,         setDegree]         = useState('');
  const [gradYear,       setGradYear]       = useState('');
  const [portfolioURL,   setPortfolioURL]   = useState('');
  const [linkedInURL,    setLinkedInURL]    = useState('');
  const [phone,          setPhone]          = useState('');
  const [university,     setUniversity]     = useState('');
  const [isAvailable,    setIsAvailable]    = useState(true);
  const [isPublished,    setIsPublished]    = useState(false);
  const [skillInput,     setSkillInput]     = useState('');
  const [suggestions,    setSuggestions]    = useState([]);

  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPrev, setProfilePicPrev] = useState(null);
  const [cvUploading,    setCvUploading]    = useState(false);
  const [cvError,        setCvError]        = useState('');

  const picInputRef = useRef(null);
  const cvInputRef  = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/profile/me');
        const p   = res.data.profile;
        const sk  = res.data.skills;
        setProfile(p);
        setSkills(sk.map(s => s.SkillName));
        setBio(p.Bio || '');
        setDegree(p.Degree || '');
        setGradYear(p.GraduationYear || '');
        setPortfolioURL(p.PortfolioURL || '');
        setLinkedInURL(p.LinkedInURL || '');
        setPhone(p.Phone || '');
        setUniversity(p.University || '');
        setIsAvailable(p.IsAvailable !== 0);
        setIsPublished(p.IsPublished === 1 || p.IsPublished === true);
        setProfilePicPrev(p.ProfilePic || null);
      } catch {
        setError('Could not load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSkillInput = (val) => {
    setSkillInput(val);
    if (val.trim().length > 0) {
      setSuggestions(SKILL_SUGGESTIONS.filter(s =>
        s.toLowerCase().includes(val.toLowerCase()) && !skills.includes(s)
      ));
    } else {
      setSuggestions([]);
    }
  };

  const addSkill = (name) => {
    const trimmed = name.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    if (skills.length >= 20) { setError('Maximum 20 skills allowed.'); return; }
    setSkills(prev => [...prev, trimmed]);
    setSkillInput('');
    setSuggestions([]);
  };

  const removeSkill = (name) => setSkills(prev => prev.filter(s => s !== name));

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    }
  };

  const handlePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePicFile(file);
    setProfilePicPrev(URL.createObjectURL(file));
  };

  const handleCvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCvError('');
    if (file.type !== 'application/pdf') { setCvError('Only PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024)    { setCvError('File must be under 5MB.'); return; }
    setCvUploading(true);
    try {
      const form = new FormData();
      form.append('cv', file);
      const res = await API.post('/profile/me/cv', form);
      setProfile(prev => ({ ...prev, CVURL: res.data.cvURL }));
      setSuccess('CV uploaded successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setCvError(err.response?.data?.error || 'CV upload failed.');
    } finally {
      setCvUploading(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  const handleCvDelete = async () => {
    if (!window.confirm('Remove your CV?')) return;
    try {
      await API.delete('/profile/me/cv');
      setProfile(prev => ({ ...prev, CVURL: null }));
      setSuccess('CV removed.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setCvError('Could not remove CV.');
    }
  };

  const handleSave = async (publishStatus) => {
    setError(''); setSuccess('');
    if (phone && !/^03\d{9}$/.test(phone)) { setError('Phone must be 11 digits starting with 03.'); return; }
    const urlRegex = /^https?:\/\/.+/;
    if (portfolioURL && !urlRegex.test(portfolioURL)) { setError('Portfolio URL must start with http:// or https://'); return; }
    if (linkedInURL  && !urlRegex.test(linkedInURL))  { setError('LinkedIn URL must start with http:// or https://'); return; }
    if (gradYear && (parseInt(gradYear) < 2020 || parseInt(gradYear) > 2035)) {
      setError('Graduation year must be between 2020 and 2035.'); return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append('bio',            bio);
      form.append('degree',         degree);
      form.append('graduationYear', gradYear);
      form.append('portfolioURL',   portfolioURL);
      form.append('linkedInURL',    linkedInURL);
      form.append('phone',          phone);
      form.append('university',     university);
      form.append('isAvailable',    isAvailable ? 'true' : 'false');
      form.append('skills',         JSON.stringify(skills));
      if (publishStatus !== undefined) form.append('publish', publishStatus ? 'true' : 'false');
      if (profilePicFile) form.append('profilePic', profilePicFile);

      const res = await API.put('/profile/me', form);
      setProfile(res.data.profile);
      setSkills(res.data.skills.map(s => s.SkillName));
      setIsPublished(res.data.profile.IsPublished === 1 || res.data.profile.IsPublished === true);
      setProfilePicFile(null);
      setSuccess(publishStatus ? 'Profile published! Clients can now find you.' : 'Profile saved as draft.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={s.loadingWrap}>
      <div style={s.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (preview) {
    return (
      <div style={s.root}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.previewBanner}>
          <span>Preview: this is how clients see your profile</span>
          <button style={s.previewBackBtn} onClick={() => setPreview(false)}>Back to Edit</button>
        </div>
        <div style={s.previewCard}>
          <div style={s.previewTop}>
            <div style={s.avatarLg}>
              {profilePicPrev
                ? <img src={profilePicPrev} alt="" style={s.avatarImg} />
                : <span style={s.avatarInitial}>{user?.fullName?.[0]}</span>
              }
            </div>
            <div>
              <div style={s.previewName}>{user?.fullName}</div>
              <div style={s.previewMeta}>
                {[degree, university, gradYear ? `Class of ${gradYear}` : null].filter(Boolean).join(' · ') || 'No info added yet'}
              </div>
              <span style={{
                ...s.availBadge,
                background: isAvailable ? '#052e16' : '#2d1212',
                color:      isAvailable ? '#4ade80' : '#f87171',
                border:     `1px solid ${isAvailable ? '#14532d' : '#7f1d1d'}`,
              }}>
                {isAvailable ? 'Available for gigs' : 'Not available'}
              </span>
            </div>
          </div>
          {bio && <p style={s.previewBio}>{bio}</p>}
          {skills.length > 0 && (
            <div style={s.skillRow}>
              {skills.map(sk => <span key={sk} style={s.skillTag}>{sk}</span>)}
            </div>
          )}
          <div style={s.previewLinks}>
            {portfolioURL && <a href={portfolioURL} target="_blank" rel="noreferrer" style={s.link}>Portfolio</a>}
            {linkedInURL  && <a href={linkedInURL}  target="_blank" rel="noreferrer" style={s.link}>LinkedIn</a>}
            {profile?.CVURL && <span style={{ ...s.link, color: '#4ade80', cursor: 'default' }}>CV on file</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <nav style={s.nav}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        <span style={s.navTitle}>Edit Profile</span>
        <button style={s.previewBtn} onClick={() => setPreview(true)}>Preview</button>
      </nav>

      <div style={s.body}>
        {error   && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        <Section title="Profile Picture">
          <div style={s.picRow}>
            <div style={s.avatarMd} onClick={() => picInputRef.current?.click()}>
              {profilePicPrev
                ? <img src={profilePicPrev} alt="" style={s.avatarImg} />
                : <span style={s.avatarInitial}>{user?.fullName?.[0]}</span>
              }
            </div>
            <div>
              <p style={s.hint}>JPG, PNG, or WebP. Cropped to 300 x 300.</p>
              <button style={s.outlineBtn} onClick={() => picInputRef.current?.click()}>Upload Photo</button>
            </div>
            <input ref={picInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePicChange} />
          </div>
        </Section>

        <Section title="Basic Information">
          <div style={{ marginBottom: '14px' }}>
            <Label text="Bio">
              <textarea value={bio} onChange={e => setBio(e.target.value)}
                rows={3} maxLength={500} placeholder="Tell clients about yourself..."
                style={{ ...s.input, resize: 'vertical' }} />
              <p style={s.charCount}>{bio.length}/500</p>
            </Label>
          </div>
          <div style={s.grid2}>
            <Label text="Degree">
              <select value={degree} onChange={e => setDegree(e.target.value)} style={s.input}>
                <option value="">Select degree</option>
                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Label>
            <Label text="Graduation Year">
              <input value={gradYear} onChange={e => setGradYear(e.target.value)}
                type="number" min="2020" max="2035" placeholder="e.g. 2026" style={s.input} />
            </Label>
          </div>
          <div style={s.grid2}>
            <Label text="Phone (optional)">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="03001234567" style={s.input} />
              {phone && !/^03\d{9}$/.test(phone) && (
                <p style={s.fieldError}>Must be 11 digits starting with 03</p>
              )}
            </Label>
            <Label text="University">
              <input value={university} onChange={e => setUniversity(e.target.value)}
                placeholder="e.g. FAST-NU Lahore" style={s.input} />
            </Label>
          </div>
          <div style={s.grid2}>
            <Label text="Portfolio URL">
              <input value={portfolioURL} onChange={e => setPortfolioURL(e.target.value)}
                placeholder="https://myportfolio.com" style={s.input} />
              {portfolioURL && !/^https?:\/\/.+/.test(portfolioURL) && (
                <p style={s.fieldError}>Must start with http:// or https://</p>
              )}
            </Label>
            <Label text="LinkedIn URL">
              <input value={linkedInURL} onChange={e => setLinkedInURL(e.target.value)}
                placeholder="https://linkedin.com/in/username" style={s.input} />
              {linkedInURL && !/^https?:\/\/.+/.test(linkedInURL) && (
                <p style={s.fieldError}>Must start with http:// or https://</p>
              )}
            </Label>
          </div>
          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLabel}>Available for gigs</div>
              <div style={s.toggleSub}>Clients can see you are open to new work</div>
            </div>
            <button onClick={() => setIsAvailable(prev => !prev)}
              style={{ ...s.toggle, background: isAvailable ? '#f59e0b' : '#2a2a2a' }}>
              <div style={{ ...s.toggleThumb, transform: isAvailable ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>
        </Section>

        <Section title={`Skills (${skills.length}/20)`}>
          <div style={s.skillRow}>
            {skills.map(sk => (
              <span key={sk} style={s.skillTagEdit}>
                {sk}
                <button onClick={() => removeSkill(sk)} style={s.removeSkillBtn}>x</button>
              </span>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              value={skillInput} onChange={e => handleSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              placeholder="Type a skill and press Enter..."
              style={s.input} disabled={skills.length >= 20}
            />
            {suggestions.length > 0 && (
              <div style={s.suggestions}>
                {suggestions.slice(0, 6).map(sug => (
                  <button key={sug} onClick={() => addSkill(sug)} style={s.suggestionItem}>{sug}</button>
                ))}
              </div>
            )}
          </div>
          <p style={s.hint}>Press Enter or comma to add. Click x to remove. Max 20 skills.</p>
        </Section>

        {/* CV upload only, no download */}
        <Section title="CV / Resume">
          {profile?.CVURL ? (
            <div style={s.cvRow}>
              <span style={s.cvName}>CV uploaded</span>
              <button onClick={handleCvDelete} style={s.cvDeleteBtn}>Remove</button>
            </div>
          ) : (
            <button onClick={() => cvInputRef.current?.click()} disabled={cvUploading} style={s.outlineBtn}>
              {cvUploading ? 'Uploading...' : 'Upload CV (PDF, max 5MB)'}
            </button>
          )}
          <input ref={cvInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleCvUpload} />
          {cvError && <p style={s.fieldError}>{cvError}</p>}
          <p style={s.hint}>PDF only, max 5MB.</p>
        </Section>

        <Section title="Profile Visibility">
          <div style={s.publishRow}>
            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
              {isPublished ? 'Published: visible to clients' : 'Draft: only you can see this'}
            </div>
            <div style={s.toggleSub}>
              {isPublished
                ? 'Your profile is live. Save to update without unpublishing.'
                : 'Publish your profile so clients can discover you.'}
            </div>
          </div>
        </Section>

        <div style={s.actionRow}>
          <button onClick={() => handleSave(false)} disabled={saving} style={s.draftBtn}>
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} style={s.publishBtn}>
            {saving ? 'Publishing...' : 'Save and Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Label({ text, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={s.label}>{text}</label>
      {children}
    </div>
  );
}

const s = {
  root: { minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif" },
  loadingWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' },
  spinner: { width: 36, height: 36, border: '3px solid #222', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '56px', background: '#111', borderBottom: '1px solid #1e1e1e' },
  backBtn: { background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  navTitle: { fontWeight: 800, fontSize: '1rem', color: '#fff' },
  previewBtn: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '8px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' },
  body: { maxWidth: '700px', margin: '0 auto', padding: '24px 16px 60px' },
  errorBox: { padding: '12px 16px', background: '#2d1212', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' },
  successBox: { padding: '12px 16px', background: '#052e16', border: '1px solid #14532d', color: '#4ade80', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem' },
  section: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: '14px', padding: '20px', marginBottom: '16px' },
  sectionTitle: { margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 700, color: '#e5e5e5' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' },
  label: { fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', padding: '10px 12px', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  charCount: { margin: '3px 0 0', color: '#444', fontSize: '0.72rem', textAlign: 'right' },
  hint: { margin: '6px 0 0', color: '#555', fontSize: '0.75rem' },
  fieldError: { margin: '4px 0 0', color: '#f87171', fontSize: '0.75rem' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', padding: '12px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #2a2a2a' },
  toggleLabel: { fontWeight: 600, fontSize: '0.88rem', color: '#e5e5e5', marginBottom: '2px' },
  toggleSub: { color: '#666', fontSize: '0.78rem' },
  toggle: { width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  toggleThumb: { position: 'absolute', top: 3, left: 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'transform 0.2s' },
  picRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  avatarMd: { width: 72, height: 72, borderRadius: '50%', background: '#2a2a2a', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarLg: { width: 90, height: 90, borderRadius: '50%', background: '#2a2a2a', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { color: '#f59e0b', fontWeight: 800, fontSize: '1.5rem' },
  outlineBtn: { background: 'transparent', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '8px', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' },
  skillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' },
  skillTag: { padding: '4px 12px', background: '#1a1200', border: '1px solid #f59e0b30', color: '#f59e0b', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 },
  skillTagEdit: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#1a1200', border: '1px solid #f59e0b30', color: '#f59e0b', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 },
  removeSkillBtn: { background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.7rem', padding: 0, lineHeight: 1 },
  suggestions: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', zIndex: 10, overflow: 'hidden', marginTop: '2px' },
  suggestionItem: { display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#ccc', fontSize: '0.85rem', textAlign: 'left', cursor: 'pointer' },
  cvRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', marginBottom: '8px' },
  cvName: { color: '#aaa', fontSize: '0.85rem' },
  cvDeleteBtn: { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  publishRow: { padding: '12px', background: '#1a1a1a', borderRadius: '10px', border: '1px solid #2a2a2a' },
  actionRow: { display: 'flex', gap: '12px', marginTop: '8px' },
  draftBtn: { flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' },
  publishBtn: { flex: 1, padding: '12px', background: '#f59e0b', border: 'none', color: '#000', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' },
  previewBanner: { background: '#1a1200', borderBottom: '1px solid #f59e0b30', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 },
  previewBackBtn: { background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
  previewCard: { maxWidth: '600px', margin: '32px auto', background: '#141414', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '28px' },
  previewTop: { display: 'flex', gap: '18px', alignItems: 'flex-start', marginBottom: '16px' },
  previewName: { fontWeight: 800, fontSize: '1.3rem', color: '#fff', marginBottom: '4px' },
  previewMeta: { color: '#666', fontSize: '0.85rem', marginBottom: '8px' },
  availBadge: { display: 'inline-block', padding: '3px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 },
  previewBio: { color: '#aaa', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '16px', borderTop: '1px solid #1e1e1e', paddingTop: '14px' },
  previewLinks: { display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid #1e1e1e', paddingTop: '14px' },
  link: { color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600 },
};