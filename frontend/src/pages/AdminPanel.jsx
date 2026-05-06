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
  ['payment-overview', 'Payment Overview'],
  ['money-wallets', 'Money Wallets'],
  ['gig-payments', 'Gig Payments'],
  ['money-transactions', 'Money Transactions'],
  ['payment-disputes', 'Disputes'],
  ['withdrawals', 'Withdrawals'],
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

  const searchBar = !['overview', 'messages', 'settings', 'reviews', 'reports', 'wallet-overview', 'token-purchases', 'token-transactions', 'payment-overview', 'gig-payments', 'money-transactions', 'payment-disputes', 'withdrawals'].includes(section) && (
    <div style={st.filters}>
      <input style={st.input} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder={`Search ${section}...`} />
      {(section === 'users' || section === 'wallets' || section === 'money-wallets') && (
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
        <p style={st.muted}>Sandbox wallet and escrow mode is active. Real gateways, invoices, withdrawals to banks, and subscriptions are future scope.</p>
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
    if (section === 'payment-overview') {
      const s = data.summary || {};
      const cards = [
        ['Client Wallets', s.TotalClientWalletBalance], ['Escrow Held', s.TotalEscrowHeld],
        ['Student Earnings', s.TotalStudentEarnings], ['Platform Revenue', s.TotalPlatformRevenue],
        ['Pending Withdrawals', s.PendingWithdrawals], ['Open Disputes', s.OpenDisputes],
      ];
      return <div style={st.statsGrid}>{cards.map(([label, value]) => <div key={label} style={st.stat}><span style={st.statValue}>PKR {Number(value || 0).toLocaleString()}</span><span style={st.statLabel}>{label}</span></div>)}</div>;
    }
    if (section === 'money-wallets') return <Table rows={data.wallets} columns={[
      { key: 'FullName', label: 'User' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
      { key: 'available_balance', label: 'Available', render: r => `PKR ${Number(r.available_balance).toLocaleString()}` },
      { key: 'locked_balance', label: 'Locked', render: r => `PKR ${Number(r.locked_balance).toLocaleString()}` },
      { key: 'pending_balance', label: 'Pending', render: r => `PKR ${Number(r.pending_balance).toLocaleString()}` },
      { key: 'total_earned', label: 'Earned', render: r => `PKR ${Number(r.total_earned).toLocaleString()}` },
      { key: 'total_spent', label: 'Spent', render: r => `PKR ${Number(r.total_spent).toLocaleString()}` },
      { key: 'actions', label: 'Actions', render: r => <button style={st.primary} onClick={() => {
        const raw = window.prompt('Add/remove PKR. Use negative number to remove.');
        if (!raw) return;
        const reason = window.prompt('Reason for adjustment?');
        if (!reason) return;
        run(async () => { await API.patch(`/admin/money-wallets/${r.UserID}/adjust`, { amount: Number(raw), reason }); return 'Money wallet adjusted.'; });
      }}>Adjust</button> },
    ]} />;
    if (section === 'gig-payments') return <Table rows={data.payments} columns={[
      { key: 'GigTitle', label: 'Gig' }, { key: 'ClientName', label: 'Client' }, { key: 'StudentName', label: 'Student', render: r => r.StudentName || '-' },
      { key: 'gig_amount', label: 'Amount', render: r => `PKR ${Number(r.gig_amount).toLocaleString()}` },
      { key: 'escrow_amount', label: 'Escrow', render: r => `PKR ${Number(r.escrow_amount).toLocaleString()}` },
      { key: 'platform_fee', label: 'Fee', render: r => `PKR ${Number(r.platform_fee).toLocaleString()}` },
      { key: 'student_earning', label: 'Student Earned', render: r => `PKR ${Number(r.student_earning).toLocaleString()}` },
      { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> },
    ]} />;
    if (section === 'money-transactions') return <Table rows={data.transactions} columns={[
      { key: 'FullName', label: 'User' }, { key: 'Role', label: 'Role', render: r => <Badge>{r.Role}</Badge> },
      { key: 'type', label: 'Type', render: r => <Badge>{r.type}</Badge> },
      { key: 'amount', label: 'Amount', render: r => `PKR ${Number(r.amount).toLocaleString()}` },
      { key: 'balance_after', label: 'Balance After', render: r => `PKR ${Number(r.balance_after).toLocaleString()}` },
      { key: 'description', label: 'Description' },
      { key: 'created_at', label: 'Date', render: r => new Date(r.created_at).toLocaleString() },
    ]} />;
    if (section === 'payment-disputes') return <Table rows={data.disputes} columns={[
      { key: 'GigTitle', label: 'Gig' }, { key: 'OpenedByName', label: 'Opened By' }, { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> },
      { key: 'actions', label: 'Resolve', render: r => r.status === 'resolved' ? <span style={st.muted}>Resolved</span> : <span style={st.actions}>
        <button style={st.greenBtn} onClick={() => run(async () => { await API.patch(`/admin/payment-disputes/${r.id}/resolve`, { decision: 'release_to_student', note: 'Admin released to student.' }); return 'Dispute resolved.'; })}>Release</button>
        <button style={st.dangerBtn} onClick={() => run(async () => { await API.patch(`/admin/payment-disputes/${r.id}/resolve`, { decision: 'refund_to_client', note: 'Admin refunded client.' }); return 'Dispute resolved.'; })}>Refund</button>
        <button style={st.primary} onClick={() => {
          const pct = window.prompt('Student percentage for split?');
          if (!pct) return;
          run(async () => { await API.patch(`/admin/payment-disputes/${r.id}/resolve`, { decision: 'split', student_percent: Number(pct), note: `Split ${pct}% to student.` }); return 'Dispute resolved.'; });
        }}>Split</button>
      </span> },
    ]} />;
    if (section === 'withdrawals') return <Table rows={data.withdrawals} columns={[
      { key: 'StudentName', label: 'Student' }, { key: 'amount', label: 'Amount', render: r => `PKR ${Number(r.amount).toLocaleString()}` },
      { key: 'method', label: 'Method' }, { key: 'account_number_masked', label: 'Account' },
      { key: 'status', label: 'Status', render: r => <Badge>{r.status}</Badge> },
      { key: 'actions', label: 'Actions', render: r => <span style={st.actions}>
        {r.status === 'pending' && <button style={st.greenBtn} onClick={() => run(async () => { await API.patch(`/admin/withdrawals/${r.id}/process`, { action: 'approve', note: 'Approved.' }); return 'Withdrawal approved.'; })}>Approve</button>}
        {r.status === 'pending' && <button style={st.dangerBtn} onClick={() => run(async () => { await API.patch(`/admin/withdrawals/${r.id}/process`, { action: 'reject', note: 'Rejected.' }); return 'Withdrawal rejected.'; })}>Reject</button>}
        {['pending', 'approved'].includes(r.status) && <button style={st.primary} onClick={() => run(async () => { await API.patch(`/admin/withdrawals/${r.id}/process`, { action: 'paid', note: 'Marked paid in sandbox.' }); return 'Withdrawal marked paid.'; })}>Mark Paid</button>}
      </span> },
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
    <div style={st.root} className="gg-admin-root">
      <style>{`@media (max-width: 920px) { .gg-admin-root { grid-template-columns: 1fr !important; } .gg-admin-sidebar { position: relative !important; height: auto !important; border-right: 0 !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; } .gg-admin-main { padding: 20px 16px 32px !important; } }`}</style>
      <aside style={st.sidebar} className="gg-admin-sidebar">
        <div style={st.brand}>Grade &amp; Grind</div>
        <div style={st.adminChip}>Admin · {user?.fullName}</div>
        {sections.map(([key, label]) => (
          <button key={key} style={{ ...st.navItem, ...(section === key ? st.navActive : {}) }} onClick={() => { setSection(key); setStatus(''); setQ(''); }}>{label}</button>
        ))}
        <button style={st.signOut} onClick={signOutAdmin}>Sign out</button>
      </aside>
      <main style={st.main} className="gg-admin-main">
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
  root: { minHeight: '100vh', background: 'radial-gradient(circle at top left, #111827 0, #070a0f 36%, #050608 100%)', color: '#fff', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', fontFamily: "'DM Sans', system-ui, sans-serif" },
  sidebar: { background: 'rgba(8,11,17,0.96)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '12px 0 40px rgba(0,0,0,0.25)' },
  brand: { fontWeight: 950, fontSize: '1.1rem', marginBottom: 4, letterSpacing: '-0.02em' },
  adminChip: { color: '#f59e0b', background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.24)', borderRadius: 14, padding: '11px 12px', fontSize: '0.82rem', marginBottom: 8 },
  navItem: { textAlign: 'left', background: 'transparent', color: '#9ca3af', border: '1px solid transparent', borderRadius: 11, padding: '10px 12px', cursor: 'pointer', fontWeight: 800 },
  navActive: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f' },
  signOut: { marginTop: 'auto', background: '#1a1a1a', border: '1px solid #333', color: '#ddd', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' },
  main: { padding: 26, minWidth: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { margin: 0, fontSize: '1.65rem', fontWeight: 950, letterSpacing: '-0.04em' },
  muted: { color: '#9ca3af', fontSize: '0.84rem' },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  input: { background: 'rgba(17,24,39,0.72)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 11, padding: '11px 12px', outline: 'none' },
  primary: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 11, padding: '10px 16px', fontWeight: 900, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 },
  stat: { background: 'rgba(17,24,39,0.72)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, boxShadow: '0 14px 40px rgba(0,0,0,0.16)' },
  statValue: { display: 'block', fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' },
  statLabel: { color: '#888', fontSize: '0.8rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 },
  card: { background: 'rgba(17,24,39,0.72)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginBottom: 16 },
  cardTitle: { margin: '0 0 12px', fontSize: '1rem', fontWeight: 900 },
  tableWrap: { overflowX: 'auto', background: 'rgba(17,24,39,0.62)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 760 },
  th: { textAlign: 'left', color: '#9ca3af', fontSize: '0.72rem', padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  td: { padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#e5e7eb', fontSize: '0.84rem', verticalAlign: 'top' },
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
