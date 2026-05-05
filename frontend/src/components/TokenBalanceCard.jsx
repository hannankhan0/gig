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
  card: { background: '#111', border: '1px solid #252525', borderRadius: 12, padding: 16, margin: '0 0 16px' },
  compact: { maxWidth: 420 },
  top: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: '#777', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' },
  plan: { color: '#f59e0b', fontWeight: 900, marginTop: 3 },
  buy: { background: '#f59e0b', color: '#000', border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 900 },
  balance: { fontSize: '1.8rem', fontWeight: 900, marginTop: 12 },
  track: { height: 8, background: '#222', borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', background: '#f59e0b' },
  meta: { display: 'flex', justifyContent: 'space-between', color: '#777', fontSize: '0.76rem', marginTop: 8 },
  warn: { marginTop: 10, color: '#fbbf24', background: '#1c1207', border: '1px solid #78350f', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' },
  block: { marginTop: 10, color: '#f87171', background: '#2d1212', border: '1px solid #7f1d1d', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem' },
};
