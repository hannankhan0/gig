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
    <div style={st.root}>
      <header style={st.header}>
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
  root: { minHeight: '100vh', background: '#080808', color: '#fff', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" },
  header: { display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 },
  back: { background: '#1a1a1a', color: '#f59e0b', border: '1px solid #f59e0b44', borderRadius: 8, padding: '9px 12px', cursor: 'pointer' },
  title: { margin: 0, fontSize: '1.55rem' },
  muted: { margin: '4px 0 0', color: '#888', fontSize: '0.86rem' },
  walletGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 },
  stat: { background: '#111', border: '1px solid #242424', borderRadius: 12, padding: 16 },
  section: { fontSize: '1rem', margin: '18px 0 12px' },
  plans: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 },
  planCard: { background: '#111', border: '1px solid #242424', borderRadius: 12, padding: 16 },
  activePlan: { borderColor: '#f59e0b66' },
  planName: { fontWeight: 900, color: '#f59e0b' },
  price: { fontSize: '1.3rem', fontWeight: 900, marginTop: 10 },
  tokens: { color: '#aaa', margin: '6px 0 14px' },
  buy: { background: '#f59e0b', color: '#000', border: 0, borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontWeight: 900 },
  disabled: { background: '#222', color: '#777', border: 0, borderRadius: 8, padding: '9px 14px' },
  helper: { color: '#777', fontSize: '0.76rem', marginTop: 8 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 },
  tableWrap: { background: '#111', border: '1px solid #242424', borderRadius: 12, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  td: { padding: 12, borderBottom: '1px solid #1f1f1f', color: '#ddd', fontSize: '0.78rem', verticalAlign: 'top' },
  empty: { color: '#777', padding: 24 },
  error: { background: '#2d1212', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 10, padding: 12, marginBottom: 12 },
};
