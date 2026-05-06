import { useState } from 'react';
import API from '../api/axios';

export default function WithdrawFundsModal({ available = 0, onClose, onSuccess }) {
  const [form, setForm] = useState({ amount: '', method: 'JazzCash', title: '', account: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || amount > Number(available)) { setError('Enter an amount within your available balance.'); return; }
    if (!form.title.trim() || !form.account.trim()) { setError('Account title and account number are required.'); return; }
    setBusy(true);
    setError('');
    try {
      await API.post('/withdrawals', {
        amount,
        method: form.method,
        account_title: form.title.trim(),
        account_number: form.account.trim(),
      });
      await onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Could not request withdrawal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>
        <h2 style={st.title}>Withdraw Funds</h2>
        <p style={st.muted}>Available: PKR {Number(available).toLocaleString()}</p>
        <label style={st.label}>Amount (PKR)</label>
        <input style={st.input} value={form.amount} onChange={e => set('amount', e.target.value.replace(/\D/g, ''))} />
        <label style={st.label}>Method</label>
        <select style={st.input} value={form.method} onChange={e => set('method', e.target.value)}>
          <option>JazzCash</option><option>Easypaisa</option><option>Bank Transfer</option>
        </select>
        <label style={st.label}>Account Title</label>
        <input style={st.input} value={form.title} onChange={e => set('title', e.target.value)} />
        <label style={st.label}>Account Number</label>
        <input style={st.input} value={form.account} onChange={e => set('account', e.target.value)} />
        {error && <div style={st.error}>{error}</div>}
        <button style={st.pay} onClick={submit} disabled={busy}>{busy ? 'Submitting...' : 'Request Withdrawal'}</button>
        <button style={st.cancel} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 300, padding: 18 },
  modal: { width: 'min(460px,100%)', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: 24, boxShadow: '0 28px 90px rgba(0,0,0,0.5)' },
  title: { margin: 0, fontSize: '1.35rem', fontWeight: 950, color: '#fff' },
  muted: { margin: '6px 0 18px', color: '#9ca3af', fontSize: '0.88rem' },
  label: { display: 'block', color: '#aab0bd', fontSize: '0.8rem', fontWeight: 800, margin: '12px 0 7px' },
  input: { width: '100%', boxSizing: 'border-box', background: '#070a0f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '12px 13px', outline: 'none' },
  pay: { width: '100%', marginTop: 16, background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 12, padding: '13px 16px', fontWeight: 950, cursor: 'pointer' },
  cancel: { width: '100%', marginTop: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' },
  error: { marginTop: 12, color: '#fca5a5', background: '#2d1212', border: '1px solid #7f1d1d', borderRadius: 10, padding: 10, fontSize: '0.83rem' },
};
