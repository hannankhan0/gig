// src/components/PostGigModal.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import AddFundsModal from './AddFundsModal';

const CATEGORIES = ['Development', 'Design', 'Writing', 'Data', 'Marketing', 'Video', 'Other'];
const TODAY = new Date().toISOString().split('T')[0]; // FIX: min date for deadline

export default function PostGigModal({ onClose, onSuccess, editGig }) {
  const navigate = useNavigate();
  // editGig is passed when editing an existing gig — null when creating new
  const isEdit = Boolean(editGig);

  const [form, setForm] = useState({
    title: '', description: '', budget: '', deadline: '',
    category: '', requiredSkills: '',
  });
  const [error,      setError]      = useState('');
  const [needsTokens, setNeedsTokens] = useState(false);
  const [needsFunds, setNeedsFunds] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [showFunds, setShowFunds] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // pre-fill form if editing
  useEffect(() => {
    if (editGig) {
      setForm({
        title:          editGig.Title          || '',
        description:    editGig.Description    || '',
        budget:         editGig.Budget         || '',
        deadline:       editGig.Deadline ? editGig.Deadline.split('T')[0] : '',
        category:       editGig.Category       || '',
        requiredSkills: editGig.RequiredSkills || '',
      });
    }
  }, [editGig]);

  useEffect(() => {
    if (!isEdit) API.get('/money-wallet').then(res => setWallet(res.data.wallet)).catch(() => {});
  }, [isEdit]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim() || form.title.trim().length < 5) {
      setError('Title must be at least 5 characters.');
      return;
    }
    if (!form.deadline) {
      setError('Deadline is required.');
      return;
    }
    if (new Date(form.deadline) <= new Date()) {
      setError('Deadline must be a future date.');
      return;
    }
    if (form.budget && (isNaN(form.budget) || parseFloat(form.budget) < 0)) {
      setError('Budget must be a positive number.');
      return;
    }
    setError('');
    setNeedsTokens(false);
    setNeedsFunds(false);
    setSubmitting(true);
    try {
      const payload = {
        title:          form.title.trim(),
        description:    form.description.trim() || undefined,
        budget:         form.budget ? parseFloat(form.budget) : undefined,
        deadline:       form.deadline || undefined,
        category:       form.category || undefined,
        requiredSkills: form.requiredSkills.trim() || undefined,
      };

      const res = isEdit
        ? await API.put(`/gigs/${editGig.GigID}`, payload)
        : await API.post('/gigs', payload);
      await onSuccess?.(res.data);
    } catch (err) {
      const data = err.response?.data;
      setNeedsTokens(data?.code === 'INSUFFICIENT_TOKENS');
      setNeedsFunds(data?.code === 'INSUFFICIENT_DEPOSIT_BALANCE');
      setError(data?.message || data?.error || 'Failed to save gig. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{isEdit ? 'Edit gig' : 'Post a gig'}</h2>
            <p style={styles.sub}>
              {isEdit ? 'Update your gig details below.' : 'Describe your project and required skills'}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Fields */}
        <div style={styles.fields}>
          <Field label="Title" required>
            <input
              style={styles.input}
              placeholder="e.g. Logo design for startup (min 5 chars)"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              maxLength={150}
            />
          </Field>

          <Field label="Description">
            <textarea
              style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }}
              placeholder="Describe your gig in detail..."
              value={form.description}
              onChange={e => set('description', e.target.value)}
              maxLength={2000}
            />
          </Field>

          <div style={styles.row}>
          <Field label="Budget (PKR)" hint="Leave blank if negotiable">
              <input
                style={styles.input}
                type="number"
                min="0"
                placeholder="0"
                value={form.budget}
                onChange={e => set('budget', e.target.value)}
              />
            </Field>
            <Field label="Deadline" required>
              <input
                style={styles.input}
                type="date"
                min={TODAY}  // FIX: cannot select past dates
                value={form.deadline}
                onChange={e => set('deadline', e.target.value)}
              />
            </Field>
          </div>

          {!isEdit && form.budget && (
            <div style={styles.escrowBox}>
              <div><strong>Required deposit:</strong> PKR {Number(parseFloat(form.budget || 0) * 0.3).toLocaleString()}</div>
              <div><strong>Wallet balance:</strong> PKR {Number(wallet?.available_balance || 0).toLocaleString()}</div>
              {Number(wallet?.available_balance || 0) < Number(parseFloat(form.budget || 0) * 0.3) && (
                <div style={{ color: '#fbbf24', marginTop: 6 }}>Add funds before posting this gig.</div>
              )}
            </div>
          )}

          <Field label="Category">
            <select
              style={{ ...styles.input, cursor: 'pointer' }}
              value={form.category}
              onChange={e => set('category', e.target.value)}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Required Skills" hint="Comma-separated — used to match students automatically">
            <input
              style={styles.input}
              placeholder="e.g. React, Node.js, Figma"
              value={form.requiredSkills}
              onChange={e => set('requiredSkills', e.target.value)}
              maxLength={500}
            />
          </Field>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {needsTokens && (
          <button style={{ ...styles.submitBtn, margin: '0 24px 12px' }} onClick={() => navigate('/billing')}>
            Buy Tokens
          </button>
        )}
        {needsFunds && (
          <button style={{ ...styles.submitBtn, margin: '0 24px 12px' }} onClick={() => setShowFunds(true)}>
            Add Funds
          </button>
        )}

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving...' : 'Posting...') : isEdit ? 'Save Changes' : 'Post Gig'}
          </button>
        </div>
        {showFunds && <AddFundsModal onClose={() => setShowFunds(false)} onSuccess={setWallet} />}
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={styles.label}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
      {hint && <p style={styles.hint}>{hint}</p>}
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: '#141414', border: '1px solid #2a2a2a', borderRadius: '16px', width: '520px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  header: { padding: '24px 24px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff' },
  sub: { margin: '3px 0 0', color: '#666', fontSize: '0.85rem' },
  closeBtn: { background: 'none', border: 'none', color: '#555', fontSize: '1.1rem', cursor: 'pointer', padding: '4px', lineHeight: 1 },
  fields: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#aaa' },
  hint: { margin: '3px 0 0', color: '#555', fontSize: '0.75rem' },
  input: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff', padding: '10px 12px', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  escrowBox: { background: '#111827', border: '1px solid #f59e0b33', color: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: '0.82rem', lineHeight: 1.6 },
  error: { margin: '0 24px', color: '#f87171', fontSize: '0.83rem' },
  footer: { padding: '16px 24px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e1e1e' },
  cancelBtn: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: '8px', padding: '9px 20px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' },
  submitBtn: { background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '9px 24px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' },
};
