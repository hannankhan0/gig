import { useState } from 'react';
import API from '../api/axios';

export default function AddFundsModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState('10000');
  const [method, setMethod] = useState('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(amount);
    if (!value || value <= 0) { setError('Enter an amount greater than 0.'); return; }
    setBusy(true);
    setError('');
    try {
      await new Promise(resolve => setTimeout(resolve, 900));
      const res = await API.post('/money-wallet/topup', { amount: value, method });
      await onSuccess?.(res.data.wallet);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Could not add funds.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={e => e.stopPropagation()}>
        <h2 style={st.title}>Add Funds</h2>
        <p style={st.muted}>Secure checkout for your Grade & Grind wallet.</p>
        <label style={st.label}>Amount (PKR)</label>
        <input style={st.input} value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} />
        <div style={st.methods}>
          {['card', 'jazzcash'].map(m => (
            <button key={m} style={{ ...st.method, ...(method === m ? st.active : {}) }} onClick={() => setMethod(m)}>
              {m === 'card' ? 'Debit / Credit Card' : 'JazzCash'}
            </button>
          ))}
        </div>
        {error && <div style={st.error}>{error}</div>}
        <button style={st.pay} onClick={submit} disabled={busy}>{busy ? 'Processing Payment...' : `Add PKR ${Number(amount || 0).toLocaleString()}`}</button>
        <button style={st.cancel} onClick={onClose}>Cancel</button>
        <p style={st.foot}>Sandbox environment for current iteration.</p>
      </div>
    </div>
  );
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', zIndex: 300, padding: 18 },
  modal: { width: 'min(460px,100%)', background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: 24, boxShadow: '0 28px 90px rgba(0,0,0,0.5)' },
  title: { margin: 0, fontSize: '1.45rem', fontWeight: 950, color: '#fff' },
  muted: { margin: '6px 0 18px', color: '#9ca3af', fontSize: '0.88rem' },
  label: { display: 'block', color: '#aab0bd', fontSize: '0.8rem', fontWeight: 800, marginBottom: 7 },
  input: { width: '100%', boxSizing: 'border-box', background: '#070a0f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '13px 14px', fontSize: '1rem', outline: 'none' },
  methods: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '16px 0' },
  method: { background: 'rgba(255,255,255,0.06)', color: '#aab0bd', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 8px', cursor: 'pointer', fontWeight: 850 },
  active: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', borderColor: '#f59e0b' },
  pay: { width: '100%', background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 12, padding: '13px 16px', fontWeight: 950, cursor: 'pointer' },
  cancel: { width: '100%', marginTop: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 16px', fontWeight: 800, cursor: 'pointer' },
  error: { marginBottom: 12, color: '#fca5a5', background: '#2d1212', border: '1px solid #7f1d1d', borderRadius: 10, padding: 10, fontSize: '0.83rem' },
  foot: { color: '#7b8190', fontSize: '0.74rem', margin: '14px 0 0', textAlign: 'center' },
};
