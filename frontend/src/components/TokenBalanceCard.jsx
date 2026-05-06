import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const planMax = {
  'Free Trial': 10000,
  Plus: 10000,
  Pro: 25000,
  Max: 60000,
};

export default function TokenBalanceCard({ compact = false }) {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    API.get('/wallet')
      .then(res => setWallet(res.data.wallet))
      .catch(() => setWallet(null));
  }, []);

  if (!wallet) return null;

  const max = planMax[wallet.current_plan] || 10000;
  const percent = Math.min(100, Math.round((wallet.balance_tokens / max) * 100));
  const warning = wallet.balance_tokens <= 0
    ? 'You are out of tokens. Please buy a token plan.'
    : wallet.balance_tokens <= 1000
      ? 'Low token balance. Buy a plan to continue using premium actions.'
      : null;

  return (
    <div style={{ ...st.card, ...(compact ? st.compact : {}) }}>
      <div style={st.top}>
        <div>
          <div style={st.label}>Current Plan</div>
          <div style={st.plan}>{wallet.current_plan}</div>
        </div>
        <button style={st.buy} onClick={() => navigate('/billing')}>Buy Tokens</button>
      </div>
      <div style={st.balance}>{Number(wallet.balance_tokens).toLocaleString()} <span>tokens</span></div>
      <div style={st.track}><div style={{ ...st.fill, width: `${percent}%` }} /></div>
      <div style={st.meta}>
        <span>Used {Number(wallet.total_spent_tokens).toLocaleString()}</span>
        <span>Earned {Number(wallet.total_earned_tokens).toLocaleString()}</span>
      </div>
      {warning && <div style={wallet.balance_tokens <= 0 ? st.block : st.warn}>{warning}</div>}
    </div>
  );
}

const st = {
  card: { background: 'linear-gradient(145deg, rgba(17,24,39,0.82), rgba(10,12,18,0.9))', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 18, margin: '0 0 16px', boxShadow: '0 18px 50px rgba(0,0,0,0.22)' },
  compact: { maxWidth: 420 },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: '#9ca3af', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' },
  plan: { color: '#f59e0b', fontWeight: 900, marginTop: 3 },
  buy: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 11, padding: '9px 13px', cursor: 'pointer', fontWeight: 950, boxShadow: '0 12px 24px rgba(245,158,11,0.18)' },
  balance: { fontSize: '2rem', fontWeight: 950, marginTop: 14, letterSpacing: '-0.04em' },
  track: { height: 9, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginTop: 9 },
  fill: { height: '100%', background: 'linear-gradient(90deg,#f59e0b,#facc15)' },
  meta: { display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.76rem', marginTop: 9, gap: 10, flexWrap: 'wrap' },
  warn: { marginTop: 10, color: '#fbbf24', background: '#1c1207', border: '1px solid #78350f', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' },
  block: { marginTop: 10, color: '#f87171', background: '#2d1212', border: '1px solid #7f1d1d', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' },
};
