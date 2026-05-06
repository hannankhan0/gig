/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import API from '../api/axios';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import ChatPage from './ChatPage';

const sections = [
  ['overview', 'Platform Overview'],
  ['users', 'Users'],
  ['gigs', 'Gigs'],
  ['applications', 'Applications'],
  ['messages', 'Messages'],
  ['reports', 'Reports'],
  ['reviews', 'Reviews'],
  ['wallet-overview', 'Wallet Overview'],
  ['wallets', 'User Wallets'],
  ['token-purchases', 'Demo Purchases'],
  ['token-transactions', 'Token Transactions'],
  ['settings', 'Settings'],
];

const statusStyle = (status) => ({
  background: status === 'pending' || status === 'open' ? '#1c1207' : status === 'resolved' || status === 'completed' || status === 'accepted' ? '#052e16' : status === 'removed' || status === 'banned' || status === 'rejected' ? '#2d1212' : '#151515',
  color: status === 'pending' || status === 'open' ? '#fbbf24' : status === 'resolved' || status === 'completed' || status === 'accepted' ? '#4ade80' : status === 'removed' || status === 'banned' || status === 'rejected' ? '#f87171' : '#aaa',
});

function Badge({ children }) {
  return <span style={{ ...st.badge, ...statusStyle(String(children).toLowerCase()) }}>{String(children).replace('_', ' ')}</span>;
}

function Table({ columns, rows, empty }) {
  if (!rows?.length) return <div style={st.empty}>{empty || 'No records found.'}</div>;
  return (
    <div style={st.tableWrap}>
      <table style={st.table}>
        <thead><tr>{columns.map(c => <th key={c.key} style={st.th}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || row.UserID || row.GigID || row.ApplicationID || row.ReportID || row.ReviewID || i} style={st.tr}>
              {columns.map(c => <td key={c.key} style={st.td}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPanel() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [toast, setToast] = useState('');

  const show = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = async () => {
    if (section === 'messages' || section === 'settings') return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (role && section === 'users') qs.set('role', role);
      if (status) qs.set('status', status);
      const suffix = qs.toString() ? `?${qs}` : '';
      const url = section === 'overview' ? '/admin/stats' : `/admin/${section}${suffix}`;
      const res = await API.get(url);
      setData(res.data);
    } catch (err) {
      show(err.response?.data?.error || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [section, role, status]);

  const run = async (fn) => {
    try {
      const msg = await fn();
      show(msg || 'Action completed.');
      load();
    } catch (err) {
      show(err.response?.data?.error || 'Action failed.');
    }
  };

  const signOutAdmin = async () => {
    await signOut(auth);
    localStorage.removeItem('gg_dev_token');
    localStorage.removeItem('gg_user');
    setUser(null);
    navigate('/auth');
  };

  const searchBar = !['overview', 'messages', 'settings', 'reviews', 'reports', 'wallet-overview', 'token-purchases', 'token-transactions'].includes(section) && (
    <div style={st.filters}>
      <input style={st.input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder={`Search ${section}...`} />
      {(section === 'users' || section === 'wallets') && (
        <select style={st.input} value={role} onChange={e => setRole(e.target.value)}>
          <option value="">All roles</option><option value="student">Student</option><option value="client">Client</option><option value="admin">Admin</option>
        </select>
      )}
      {section === 'users' && (
        <select style={st.input} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="active">Active</option><option value="banned">Banned</option>
        </select>
      )}
      {section === 'gigs' && (
        <select style={st.input} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="submitted">Submitted</option><option value="revision">Revision</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="removed">Removed</option>
        </select>
      )}
      {section === 'applications' && (
        <select style={st.input} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option>
        </select>
      )}
      <button style={st.primary} onClick={load}>Search</button>
    </div>
  );

  const content = useMemo(() => {
    if (section === 'messages') return <ChatPage adminMode />;
    if (section === 'settings') return (
      <div style={st.card}>
        <h2 style={st.cardTitle}>Settings</h2>
        <p style={st.muted}>Payments disabled for current iteration. Escrow, invoices, withdrawals, Stripe, and PayPal are future scope.</p>
      </div>
    );
    if (section === 'overview') {
      const s = data.stats || {};
      const cards = [
        ['Total Users', s.TotalUsers], ['Students', s.TotalStudents], ['Clients', s.TotalClients],
        ['Active Gigs', s.ActiveGigs], ['Completed Gigs', s.CompletedGigs], ['Pending Apps', s.PendingApplications],
        ['Open Reports', s.OpenReports], ['Banned Users', s.BannedUsers],
      ];
      return (
        <>
          <div style={st.statsGrid}>{cards.map(([label, value]) => <div key={label} style={st.stat}><span style={st.statValue}>{value ?? 0}</span><span style={st.statLabel}>{label}</span></div>)}</div>
          <div style={st.grid3}>
            <div style={st.card}><h3 style={st.cardTitle}>Recent Users</h3><Table rows={data.recentUsers} columns={[{ key: 'FullName', label: 'Name' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> }, { key: 'IsBanned', label: 'Status', render: r => <Badge>{r.IsBanned ? 'banned' : 'active'}</Badge> }]} /></div>
            <div style={st.card}><h3 style={st.cardTitle}>Recent Gigs</h3><Table rows={data.recentGigs} columns={[{ key: 'Title', label: 'Title' }, { key: 'ClientName', label: 'Client' }, { key: 'Status', label: 'Status', render: r => <Badge>{r.Status}</Badge> }]} /></div>
            <div style={st.card}><h3 style={st.cardTitle}>Recent Reports</h3><Table rows={data.recentReports} columns={[{ key: 'ReporterName', label: 'Reporter' }, { key: 'Reason', label: 'Reason' }, { key: 'Status', label: 'Status', render: r => <Badge>{r.Status}</Badge> }]} /></div>
          </div>
          <div style={st.card}><h3 style={st.cardTitle}>Recent Activity</h3><Table rows={data.activity} columns={[{ key: 'ActionType', label: 'Action' }, { key: 'TargetType', label: 'Target' }, { key: 'Description', label: 'Description' }, { key: 'CreatedAt', label: 'Date', render: r => new Date(r.CreatedAt).toLocaleString() }]} /></div>
        </>
      );
    }
    if (section === 'wallet-overview') {
      const s = data.summary || {};
      const cards = [
        ['Tokens Issued', s.TotalTokensIssued], ['Tokens Spent', s.TotalTokensSpent],
        ['Demo Revenue PKR', s.TotalDemoRevenuePKR], ['Low Balance Users', s.LowBalanceUsers],
      ];
      return (
        <>
          <div style={st.warning}>Demo payment mode active — no real financial transaction processed.</div>
          <div style={st.statsGrid}>{cards.map(([label, value]) => <div key={label} style={st.stat}><span style={st.statValue}>{Number(value || 0).toLocaleString()}</span><span style={st.statLabel}>{label}</span></div>)}</div>
          <div style={st.card}><h3 style={st.cardTitle}>Top Token Spenders</h3><Table rows={data.topSpenders} columns={[
            { key: 'FullName', label: 'User' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
            { key: 'current_plan', label: 'Plan' }, { key: 'balance_tokens', label: 'Balance', render: r => Number(r.balance_tokens).toLocaleString() },
            { key: 'total_spent_tokens', label: 'Spent', render: r => Number(r.total_spent_tokens).toLocaleString() },
          ]} /></div>
        </>
      );
    }
    if (section === 'wallets') return <Table rows={data.wallets} columns={[
      { key: 'FullName', label: 'User' }, { key: 'Email', label: 'Email' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
      { key: 'current_plan', label: 'Plan' }, { key: 'balance_tokens', label: 'Balance', render: r => Number(r.balance_tokens).toLocaleString() },
      { key: 'total_earned_tokens', label: 'Earned', render: r => Number(r.total_earned_tokens).toLocaleString() },
      { key: 'total_spent_tokens', label: 'Spent', render: r => Number(r.total_spent_tokens).toLocaleString() },
      { key: 'actions', label: 'Actions', render: r => <button style={st.primary} onClick={() => {
        const raw = window.prompt('Add/remove tokens. Use negative number to remove.');
        if (!raw) return;
        const reason = window.prompt('Reason for adjustment?');
        if (!reason) return;
        run(async () => { await API.patch(`/admin/wallets/${r.UserID}/adjust`, { amount_tokens: Number(raw), reason }); return 'Wallet adjusted.'; });
      }}>Adjust</button> },
    ]} />;
    if (section === 'token-purchases') return (
      <>
        <div style={st.warning}>Demo payment mode active — purchases are sandbox records only.</div>
        <Table rows={data.purchases} columns={[
          { key: 'FullName', label: 'User' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
          { key: 'plan_name', label: 'Plan' }, { key: 'price_pkr', label: 'PKR', render: r => Number(r.price_pkr).toLocaleString() },
          { key: 'tokens', label: 'Tokens', render: r => Number(r.tokens).toLocaleString() }, { key: 'payment_method_demo', label: 'Method' },
          { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> }, { key: 'demo_transaction_id', label: 'Demo ID' },
          { key: 'created_at', label: 'Date', render: r => new Date(r.created_at).toLocaleString() },
        ]} />
      </>
    );
    if (section === 'token-transactions') return <Table rows={data.transactions} columns={[
      { key: 'FullName', label: 'User' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
      { key: 'type', label: 'Type', render: r => <Badge>{r.type}</Badge> }, { key: 'amount_tokens', label: 'Tokens', render: r => Number(r.amount_tokens).toLocaleString() },
      { key: 'reason', label: 'Reason' }, { key: 'balance_after', label: 'Balance', render: r => Number(r.balance_after).toLocaleString() },
      { key: 'created_at', label: 'Date', render: r => new Date(r.created_at).toLocaleString() },
    ]} />;
    if (section === 'users') return <Table rows={data.users} columns={[
      { key: 'FullName', label: 'Name' }, { key: 'Email', label: 'Email' },
      { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
      { key: 'IsBanned', label: 'Status', render: r => <Badge>{r.IsBanned ? 'banned' : 'active'}</Badge> },
      { key: 'summary', label: 'Profile Summary', render: r => `${r.PostedGigs} gigs, ${r.ApplicationsCount} apps, ${r.ReviewsCount} reviews, ${r.ReportsCount} reports` },
      { key: 'actions', label: 'Actions', render: r => r.Role === 'admin' ? <span style={st.muted}>Protected</span> : <button style={r.IsBanned ? st.greenBtn : st.dangerBtn} onClick={() => window.confirm(`${r.IsBanned ? 'Unban' : 'Ban'} ${r.FullName}?`) && run(async () => { await API.patch(`/admin/users/${r.UserID}/${r.IsBanned ? 'unban' : 'ban'}`); return r.IsBanned ? 'User unbanned.' : 'User banned.'; })}>{r.IsBanned ? 'Unban' : 'Ban'}</button> },
    ]} />;
    if (section === 'gigs') return <Table rows={data.gigs} columns={[
      { key: 'Title', label: 'Title' }, { key: 'ClientName', label: 'Client' },
      { key: 'AssignedStudentName', label: 'Assigned Student', render: r => r.AssignedStudentName || '-' },
      { key: 'Budget', label: 'Budget', render: r => r.Budget ? `PKR ${Number(r.Budget).toLocaleString()}` : 'Negotiable' },
      { key: 'ApplicationsCount', label: 'Apps' }, { key: 'Status', label: 'Status', render: r => <Badge>{r.Status}</Badge> },
      { key: 'actions', label: 'Actions', render: r => <button style={r.Status === 'removed' ? st.greenBtn : st.dangerBtn} onClick={() => window.confirm(`${r.Status === 'removed' ? 'Restore' : 'Remove'} this gig?`) && run(async () => { await API.patch(`/admin/gigs/${r.GigID}/${r.Status === 'removed' ? 'restore' : 'remove'}`); return r.Status === 'removed' ? 'Gig restored.' : 'Gig removed.'; })}>{r.Status === 'removed' ? 'Restore' : 'Remove'}</button> },
    ]} />;
    if (section === 'applications') return <Table rows={data.applications} columns={[
      { key: 'GigTitle', label: 'Gig' }, { key: 'StudentName', label: 'Student' }, { key: 'ClientName', label: 'Client' },
      { key: 'CoverLetter', label: 'Cover Letter', render: r => r.CoverLetter || '-' },
      { key: 'PortfolioURL', label: 'Portfolio', render: r => r.PortfolioURL ? <a style={st.link} href={r.PortfolioURL} target="_blank">Open</a> : '-' },
      { key: 'Status', label: 'Status', render: r => <Badge>{r.Status}</Badge> },
    ]} />;
    if (section === 'reports') return (
      <>
        <div style={st.filters}>
          <select style={st.input} value={status} onChange={e => setStatus(e.target.value)}><option value="">All reports</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select>
        </div>
        <Table rows={data.reports} columns={[
          { key: 'ReporterName', label: 'Reporter' }, { key: 'ReportedUserName', label: 'Reported User', render: r => r.ReportedUserName || '-' },
          { key: 'GigTitle', label: 'Gig', render: r => r.GigTitle || '-' }, { key: 'MessageID', label: 'Message', render: r => r.MessageID || '-' },
          { key: 'Reason', label: 'Reason' }, { key: 'Status', label: 'Status', render: r => <Badge>{r.Status}</Badge> },
          { key: 'actions', label: 'Actions', render: r => (
            <span style={st.actions}>
              {r.ReportedUserID && <button style={st.dangerBtn} onClick={() => window.confirm('Ban reported user?') && run(async () => { await API.patch(`/admin/users/${r.ReportedUserID}/ban`); return 'Reported user banned.'; })}>Ban user</button>}
              {r.ReportedGigID && <button style={st.dangerBtn} onClick={() => window.confirm('Remove reported gig?') && run(async () => { await API.patch(`/admin/gigs/${r.ReportedGigID}/remove`); return 'Reported gig removed.'; })}>Remove gig</button>}
              {r.MessageID && <button style={st.dangerBtn} onClick={() => window.confirm('Hide reported message?') && run(async () => { await API.patch(`/admin/messages/${r.MessageID}/hide`); return 'Reported message hidden.'; })}>Hide msg</button>}
              {r.Status === 'pending' ? <button style={st.greenBtn} onClick={() => run(async () => { await API.patch(`/admin/reports/${r.ReportID}/resolve`); return 'Report resolved.'; })}>Resolve</button> : <span style={st.muted}>Done</span>}
            </span>
          ) },
        ]} />
      </>
    );
    if (section === 'reviews') return <Table rows={data.reviews} columns={[
      { key: 'GigTitle', label: 'Gig' }, { key: 'ReviewerName', label: 'Reviewer' }, { key: 'RevieweeName', label: 'Reviewed' },
      { key: 'Rating', label: 'Rating' }, { key: 'Comment', label: 'Comment' },
      { key: 'IsFlagged', label: 'Status', render: r => <Badge>{r.IsFlagged ? 'hidden' : 'visible'}</Badge> },
      { key: 'actions', label: 'Actions', render: r => <button style={r.IsFlagged ? st.greenBtn : st.dangerBtn} onClick={() => run(async () => { await API.patch(`/admin/reviews/${r.ReviewID}/${r.IsFlagged ? 'restore' : 'hide'}`); return r.IsFlagged ? 'Review restored.' : 'Review hidden.'; })}>{r.IsFlagged ? 'Restore' : 'Hide'}</button> },
    ]} />;
    return null;
  }, [section, data, user, status]);

  if (section === 'messages') return content;

  return (
    <div style={st.root}>
      <aside style={st.sidebar}>
        <div style={st.brand}>Grade &amp; Grind</div>
        <div style={st.adminChip}>Admin · {user?.fullName}</div>
        {sections.map(([key, label]) => (
          <button key={key} style={{ ...st.navItem, ...(section === key ? st.navActive : {}) }} onClick={() => { setSection(key); setStatus(''); setQ(''); }}>{label}</button>
        ))}
        <button style={st.signOut} onClick={signOutAdmin}>Sign out</button>
      </aside>
      <main style={st.main}>
        <header style={st.header}>
          <div>
            <h1 style={st.title}>{sections.find(s => s[0] === section)?.[1]}</h1>
            <p style={st.muted}>Simplified Fiverr/Upwork style platform control center</p>
          </div>
        </header>
        {searchBar}
        {loading ? <div style={st.empty}>Loading...</div> : content}
        {toast && <div style={st.toast}>{toast}</div>}
      </main>
    </div>
  );
}

const st = {
  root: { minHeight: '100vh', background: '#080808', color: '#fff', display: 'grid', gridTemplateColumns: '250px 1fr', fontFamily: "'DM Sans', system-ui, sans-serif" },
  sidebar: { background: '#101010', borderRight: '1px solid #202020', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 },
  brand: { fontWeight: 900, fontSize: '1.05rem', marginBottom: 4 },
  adminChip: { color: '#f59e0b', background: '#1f1607', border: '1px solid #f59e0b22', borderRadius: 10, padding: '9px 10px', fontSize: '0.8rem', marginBottom: 8 },
  navItem: { textAlign: 'left', background: 'transparent', color: '#aaa', border: '1px solid transparent', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 },
  navActive: { background: '#f59e0b', color: '#000' },
  signOut: { marginTop: 'auto', background: '#1a1a1a', border: '1px solid #333', color: '#ddd', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' },
  main: { padding: 24, minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { margin: 0, fontSize: '1.45rem' },
  muted: { color: '#777', fontSize: '0.82rem' },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  input: { background: '#151515', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 9, padding: '10px 12px', outline: 'none' },
  primary: { background: '#f59e0b', color: '#000', border: 0, borderRadius: 9, padding: '10px 16px', fontWeight: 800, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 },
  stat: { background: '#141414', border: '1px solid #202020', borderRadius: 12, padding: 16 },
  statValue: { display: 'block', fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' },
  statLabel: { color: '#888', fontSize: '0.8rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 },
  card: { background: '#111', border: '1px solid #202020', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { margin: '0 0 12px', fontSize: '1rem' },
  tableWrap: { overflowX: 'auto', background: '#111', border: '1px solid #202020', borderRadius: 12 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  th: { textAlign: 'left', color: '#888', fontSize: '0.75rem', padding: '12px 14px', borderBottom: '1px solid #202020', textTransform: 'uppercase' },
  td: { padding: '12px 14px', borderBottom: '1px solid #1b1b1b', color: '#ddd', fontSize: '0.84rem', verticalAlign: 'top' },
  tr: { background: '#111' },
  badge: { borderRadius: 999, padding: '3px 9px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'capitalize' },
  dangerBtn: { background: '#2d1212', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 700 },
  greenBtn: { background: '#052e16', border: '1px solid #14532d', color: '#4ade80', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 700 },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  empty: { color: '#666', padding: 24 },
  toast: { position: 'fixed', right: 24, bottom: 24, background: '#211608', border: '1px solid #f59e0b44', color: '#fbbf24', borderRadius: 10, padding: '12px 16px', fontWeight: 700 },
  warning: { background: '#1c1207', border: '1px solid #78350f', color: '#fbbf24', borderRadius: 10, padding: '11px 13px', marginBottom: 14, fontWeight: 800 },
  link: { color: '#f59e0b' },
};
