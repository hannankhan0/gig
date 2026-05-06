import { useEffect, useState } from 'react';
import API from '../api/axios';
import AddFundsModal from './AddFundsModal';
import WithdrawFundsModal from './WithdrawFundsModal';

export default function MoneyWalletCard({ role }) {
  const [wallet, setWallet] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = async () => {
    const res = await API.get('/money-wallet');
    setWallet(res.data.wallet);
  };
  useEffect(() => { load().catch(() => {}); }, []);
  if (!wallet) return <div style={st.card}>Loading wallet...</div>;

  const isClient = role === 'client';
  return (
    <div style={st.card}>
      <div style={st.top}>
        <div>
          <div style={st.label}>{isClient ? 'Money Wallet' : 'Earnings Wallet'}</div>
          <div style={st.balance}>PKR {Number(wallet.available_balance).toLocaleString()}</div>
        </div>
        <button style={st.action} onClick={() => isClient ? setShowAdd(true) : setShowWithdraw(true)}>
          {isClient ? 'Add Funds' : 'Withdraw'}
        </button>
      </div>
      <div style={st.grid}>
        <Metric label={isClient ? 'Locked Escrow' : 'Pending'} value={isClient ? wallet.locked_balance : wallet.pending_balance} />
        <Metric label={isClient ? 'Total Spent' : 'Total Earned'} value={isClient ? wallet.total_spent : wallet.total_earned} />
        <Metric label={isClient ? 'Deposited' : 'Withdrawn'} value={isClient ? wallet.total_deposited : wallet.total_withdrawn} />
      </div>
      {showAdd && <AddFundsModal onClose={() => setShowAdd(false)} onSuccess={setWallet} />}
      {showWithdraw && <WithdrawFundsModal available={wallet.available_balance} onClose={() => setShowWithdraw(false)} onSuccess={load} />}
    </div>
  );
}

function Metric({ label, value }) {
  return <div style={st.metric}><span>{label}</span><strong>PKR {Number(value || 0).toLocaleString()}</strong></div>;
}

const st = {
  card: { background: 'linear-gradient(145deg, rgba(17,24,39,0.82), rgba(10,12,18,0.9))', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 18, margin: '0 0 16px', boxShadow: '0 18px 50px rgba(0,0,0,0.22)', color: '#fff' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  label: { color: '#9ca3af', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' },
  balance: { fontSize: '1.9rem', fontWeight: 950, marginTop: 8, letterSpacing: '-0.04em' },
  action: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 11, padding: '9px 13px', cursor: 'pointer', fontWeight: 950 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14 },
  metric: { background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 10, display: 'grid', gap: 4 },
};
