import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function BillingPage() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    const [w, p, t, buys] = await Promise.all([
      API.get('/wallet'),
      API.get('/token-plans'),
      API.get('/wallet/transactions'),
      API.get('/wallet/purchases'),
    ]);
    setWallet(w.data.wallet);
    setPlans(p.data.plans);
    setTransactions(t.data.transactions);
    setPurchases(buys.data.purchases);
  };

  useEffect(() => { load().catch(() => setError('Could not load billing.')); }, []);

  if (!wallet) return <div style={st.root}><div style={st.empty}>Loading billing...</div></div>;

  return (
    <div style={st.root} className="gg-billing-root">
      <style>{`@media (max-width: 760px) { .gg-billing-root { padding: 18px 14px 32px !important; } .gg-billing-header { align-items: flex-start !important; flex-direction: column !important; } }`}</style>
      <header style={st.header} className="gg-billing-header">
        <button style={st.back} onClick={() => navigate('/dashboard')}>Back</button>
        <div>
          <h1 style={st.title}>Tokens & Billing</h1>
          <p style={st.muted}>Manage plans, wallet balance, purchases, and token activity.</p>
        </div>
      </header>

      {error && <div style={st.error}>{error}</div>}

      <section style={st.walletGrid}>
        {[
          ['Current Plan', wallet.current_plan],
          ['Remaining Tokens', Number(wallet.balance_tokens).toLocaleString()],
          ['Total Earned', Number(wallet.total_earned_tokens).toLocaleString()],
          ['Total Spent', Number(wallet.total_spent_tokens).toLocaleString()],
        ].map(([k, v]) => <div key={k} style={st.stat}><span>{k}</span><strong>{v}</strong></div>)}
      </section>

      <h2 style={st.section}>Plans</h2>
      <div style={st.plans}>
        {plans.map(plan => (
          <div key={plan.id} style={{ ...st.planCard, ...(plan.name === wallet.current_plan ? st.activePlan : {}) }}>
            <div style={st.planName}>{plan.name}</div>
            <div style={st.price}>PKR {Number(plan.price_pkr).toLocaleString()}</div>
            <div style={st.tokens}>{Number(plan.tokens).toLocaleString()} tokens</div>
            {plan.name === 'Free Trial' ? (
              <button style={st.disabled} disabled>{wallet.current_plan === 'Free Trial' ? 'Included' : 'Free Trial Used'}</button>
            ) : plan.alreadyPurchasedThisMonth ? (
              <>
                <button style={st.disabled} disabled>Purchased This Month</button>
                <div style={st.helper}>Available again {new Date(plan.availableAgainAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}</div>
              </>
            ) : (
              <button style={st.buy} onClick={() => window.open(`/payment/checkout/${plan.id}`, '_blank')}>Buy Plan</button>
            )}
          </div>
        ))}
      </div>

      <div style={st.twoCol}>
        <section>
          <h2 style={st.section}>Transaction History</h2>
          <Table rows={transactions} columns={[
            ['created_at', 'Date', r => new Date(r.created_at).toLocaleString()],
            ['type', 'Type'],
            ['reason', 'Reason'],
            ['amount_tokens', 'Tokens', r => Number(r.amount_tokens).toLocaleString()],
            ['balance_after', 'Balance', r => Number(r.balance_after).toLocaleString()],
          ]} />
        </section>
        <section>
          <h2 style={st.section}>Purchase History</h2>
          <Table rows={purchases} columns={[
            ['created_at', 'Date', r => new Date(r.created_at).toLocaleString()],
            ['plan_name', 'Plan'],
            ['price_pkr', 'PKR', r => Number(r.price_pkr).toLocaleString()],
            ['status', 'Status'],
            ['demo_transaction_id', 'Transaction ID'],
          ]} />
        </section>
      </div>
    </div>
  );
}

function Table({ rows, columns }) {
  if (!rows?.length) return <div style={st.empty}>No records yet.</div>;
  return (
    <div style={st.tableWrap}><table style={st.table}><tbody>
      {rows.map((r, i) => <tr key={r.id || i}>{columns.map(([k, label, render]) => <td key={k} style={st.td}><small>{label}</small><br />{render ? render(r) : r[k]}</td>)}</tr>)}
    </tbody></table></div>
  );
}

const st = {
  root: { minHeight: '100vh', background: 'radial-gradient(circle at top left, #151006 0, #070a0f 36%, #050608 100%)', color: '#fff', padding: 26, fontFamily: "'DM Sans', system-ui, sans-serif" },
  header: { display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22, maxWidth: 1180 },
  back: { background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 11, padding: '10px 13px', cursor: 'pointer', fontWeight: 900 },
  title: { margin: 0, fontSize: 'clamp(1.55rem,3vw,2.25rem)', fontWeight: 950, letterSpacing: '-0.04em' },
  muted: { margin: '6px 0 0', color: '#9ca3af', fontSize: '0.9rem' },
  walletGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 },
  stat: { background: 'rgba(17,24,39,0.74)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18, boxShadow: '0 14px 42px rgba(0,0,0,0.18)' },
  section: { fontSize: '1.05rem', margin: '22px 0 12px', fontWeight: 950, letterSpacing: '-0.02em' },
  plans: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  planCard: { background: 'linear-gradient(145deg,rgba(17,24,39,0.8),rgba(8,10,15,0.88))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 18, boxShadow: '0 18px 48px rgba(0,0,0,0.2)' },
  activePlan: { borderColor: 'rgba(245,158,11,0.55)', boxShadow: '0 18px 48px rgba(245,158,11,0.08)' },
  planName: { fontWeight: 950, color: '#f59e0b', letterSpacing: '-0.02em' },
  price: { fontSize: '1.45rem', fontWeight: 950, marginTop: 12 },
  tokens: { color: '#9ca3af', margin: '7px 0 16px' },
  buy: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 11, padding: '10px 15px', cursor: 'pointer', fontWeight: 950, boxShadow: '0 12px 26px rgba(245,158,11,0.18)' },
  disabled: { background: 'rgba(255,255,255,0.08)', color: '#7b8190', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 11, padding: '10px 15px' },
  helper: { color: '#9ca3af', fontSize: '0.76rem', marginTop: 9 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 },
  tableWrap: { background: 'rgba(17,24,39,0.68)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, overflowX: 'auto', boxShadow: '0 14px 42px rgba(0,0,0,0.15)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  td: { padding: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: '0.8rem', verticalAlign: 'top' },
  empty: { color: '#9ca3af', padding: 26, background: 'rgba(17,24,39,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 },
  error: { background: '#2d1212', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 10, padding: 12, marginBottom: 12 },
};
