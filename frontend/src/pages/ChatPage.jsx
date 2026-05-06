/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const initials = (name = '') => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'GG';
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const day = (value) => value ? new Date(value).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }) : '';

export default function ChatPage({ adminMode = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedFromUrl = params.get('conversation');
  const [conversations, setConversations] = useState([]);
  const [activeID, setActiveID] = useState(selectedFromUrl ? Number(selectedFromUrl) : null);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState('applicants');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const isAdmin = adminMode || user?.role === 'admin';

  const loadConversations = async () => {
    try {
      const url = isAdmin ? '/admin/conversations' : '/conversations';
      const res = await API.get(url);
      const rows = res.data.conversations || [];
      setConversations(rows);
      if (!activeID && rows[0]) setActiveID(rows[0].ConversationID);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (id) => {
    if (!id) return;
    setMessageLoading(true);
    try {
      const url = isAdmin ? `/admin/conversations/${id}/messages` : `/conversations/${id}/messages`;
      const res = await API.get(url);
      setMessages(res.data.messages || []);
      setConversation(res.data.conversation || conversations.find(c => c.ConversationID === id));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load messages.');
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, [isAdmin]);
  useEffect(() => { loadMessages(activeID); }, [activeID, isAdmin]);
  useEffect(() => {
    if (!isAdmin) {
      const tick = setInterval(() => {
        loadConversations();
        if (activeID) loadMessages(activeID);
      }, 7000);
      return () => clearInterval(tick);
    }
  }, [activeID, isAdmin]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return conversations.filter(c =>
      (isAdmin || (bucket === 'applicants'
        ? c.ApplicationStatus !== 'accepted'
        : c.ApplicationStatus === 'accepted' || (!c.ApplicationStatus && c.ConversationStatus !== 'request')
      )) &&
      (!q ||
        c.OtherName?.toLowerCase().includes(q) ||
        c.StudentName?.toLowerCase().includes(q) ||
        c.ClientName?.toLowerCase().includes(q) ||
        c.GigTitle?.toLowerCase().includes(q))
    );
  }, [conversations, query, bucket, isAdmin]);

  const active = conversations.find(c => c.ConversationID === activeID) || conversation;
  const activeIsRequest = active?.ConversationStatus === 'request';
  const activeIsClientRequest = !isAdmin && user?.role === 'client' && activeIsRequest;
  const peerName = isAdmin
    ? `${active?.StudentName || 'Student'} and ${active?.ClientName || 'Client'}`
    : active?.OtherName;

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || !activeID || isAdmin) return;
    try {
      await API.post(`/conversations/${activeID}/messages`, { message: body.trim() });
      setBody('');
      await Promise.all([loadMessages(activeID), loadConversations()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send message.');
    }
  };

  const acceptRequest = async () => {
    if (!activeID) return;
    try {
      await API.patch(`/conversations/${activeID}/accept-request`);
      await Promise.all([loadMessages(activeID), loadConversations()]);
      setBucket('applicants');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept message request.');
    }
  };

  const reportMessage = async (message) => {
    const reason = window.prompt('Reason for reporting this message?');
    if (!reason?.trim()) return;
    await API.post('/admin/reports', {
      messageID: message.MessageID,
      reportedUserID: message.SenderID,
      gigID: active?.GigID,
      reason: reason.trim(),
    });
    setError('Report submitted for admin review.');
  };

  const flagConversation = async () => {
    const reason = window.prompt('Reason for flagging this conversation?');
    if (!reason?.trim()) return;
    await API.post('/admin/reports', { gigID: active?.GigID, reason: reason.trim() });
    setError('Conversation flagged as a report.');
  };

  const hideMessage = async (message) => {
    if (!window.confirm('Hide this message from the conversation?')) return;
    await API.patch(`/admin/messages/${message.MessageID}/hide`);
    await loadMessages(activeID);
  };

  return (
    <div style={st.root} className="gg-chat-root">
      <style>{`@media (max-width: 860px) { .gg-chat-root { grid-template-columns: 1fr !important; height: auto !important; min-height: 100vh !important; } .gg-chat-sidebar { min-height: auto !important; border-right: 0 !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; } .gg-chat-main { min-height: 560px !important; } }`}</style>
      <aside style={st.sidebar} className="gg-chat-sidebar">
        <div style={st.sideTop}>
          <button style={st.backBtn} onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}>Back</button>
          <div>
            <h1 style={st.title}>{isAdmin ? 'Chat Moderation' : 'Messages'}</h1>
            <p style={st.sub}>{isAdmin ? 'Read-only student-client conversations' : 'Client-student project chat'}</p>
          </div>
        </div>
        <input style={st.search} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations..." />
        {!isAdmin && (
          <div style={st.tabs}>
            <button style={{ ...st.tab, ...(bucket === 'applicants' ? st.tabActive : {}) }} onClick={() => setBucket('applicants')}>
              Applicants
            </button>
            <button style={{ ...st.tab, ...(bucket === 'projects' ? st.tabActive : {}) }} onClick={() => setBucket('projects')}>
              Project Team
            </button>
          </div>
        )}
        {loading ? <div style={st.empty}>Loading conversations...</div> : filtered.length === 0 ? (
          <div style={st.empty}>No conversations found.</div>
        ) : filtered.map(c => (
          <button key={c.ConversationID} style={{ ...st.conv, ...(activeID === c.ConversationID ? st.convActive : {}) }} onClick={() => setActiveID(c.ConversationID)}>
            <span style={st.avatar}>{initials(isAdmin ? c.StudentName : c.OtherName)}</span>
            <span style={st.convBody}>
              <span style={st.convTop}>
                <strong style={st.convName}>{isAdmin ? `${c.StudentName} / ${c.ClientName}` : c.OtherName}</strong>
                <small style={st.muted}>{day(c.LatestMessageAt || c.UpdatedAt)}</small>
              </span>
              <span style={st.roleRow}>
                <span style={st.badge}>
                  {isAdmin ? 'moderation' : c.ConversationStatus === 'request' ? 'message request' : c.ApplicationStatus === 'accepted' ? 'project team' : 'applicant chat'}
                </span>
                {c.UnreadCount > 0 && <span style={st.dot}>{c.UnreadCount}</span>}
              </span>
              <span style={st.preview}>
                {c.LatestMessage || (c.ConversationStatus === 'request' && user?.role === 'client' ? 'New applicant message request' : c.GigTitle || 'No messages yet')}
              </span>
            </span>
          </button>
        ))}
      </aside>

      <main style={st.chat} className="gg-chat-main">
        {!activeID ? (
          <div style={st.center}>Select a conversation to start.</div>
        ) : (
          <>
            <header style={st.chatHeader}>
              <div style={st.avatarLarge}>{initials(peerName)}</div>
              <div>
                <h2 style={st.chatName}>{peerName}</h2>
                <p style={st.sub}>{active?.GigTitle ? `Linked gig: ${active.GigTitle}` : 'General conversation'} · {isAdmin ? 'Read-only' : 'Online status unavailable'}</p>
              </div>
              {activeIsClientRequest && <button style={st.acceptRequestBtn} onClick={acceptRequest}>Accept Request</button>}
              {isAdmin && <button style={st.flagBtn} onClick={flagConversation}>Flag</button>}
            </header>

            {error && <div style={st.notice}>{error}</div>}

            <div ref={listRef} style={st.messages}>
              {messageLoading ? <div style={st.center}>Loading messages...</div> : activeIsClientRequest ? (
                <div style={st.requestPanel}>
                  <h3 style={st.requestTitle}>Message request from {active?.StudentName || 'applicant'}</h3>
                  <p style={st.requestText}>
                    This applicant sent an application message. Accept the request to reveal the message and continue the chat.
                  </p>
                  <button style={st.acceptRequestBtn} onClick={acceptRequest}>Accept Message Request</button>
                </div>
              ) : messages.length === 0 ? (
                <div style={st.center}>{activeIsRequest ? 'Waiting for the client to accept this message request.' : 'No messages yet.'}</div>
              ) : messages.map(m => {
                const mine = Number(m.SenderID) === Number(user?.id);
                return (
                  <div key={m.MessageID} style={{ ...st.row, justifyContent: mine && !isAdmin ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...st.bubble, ...(mine && !isAdmin ? st.mine : st.theirs) }}>
                      {(isAdmin || !mine) && <div style={st.sender}>{m.SenderName} · {m.SenderRole}</div>}
                      <div style={st.text}>{m.Body}</div>
                      <div style={st.msgFooter}>
                        <span>{time(m.SentAt)}</span>
                        {!isAdmin && <button style={st.reportBtn} onClick={() => reportMessage(m)}>Report</button>}
                        {isAdmin && <button style={st.reportBtn} onClick={() => hideMessage(m)}>Hide</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form style={st.form} onSubmit={send}>
              <input
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={isAdmin || activeIsClientRequest}
                placeholder={isAdmin ? 'Admin moderation is read-only' : activeIsClientRequest ? 'Accept the request before replying' : 'Type a message...'}
                style={st.input}
                maxLength={2000}
              />
              <button disabled={isAdmin || activeIsClientRequest || !body.trim()} style={st.send}>Send</button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

const st = {
  root: { minHeight: '100vh', background: '#070a0f', color: '#fff', display: 'grid', gridTemplateColumns: '360px 1fr', fontFamily: "'DM Sans', system-ui, sans-serif" },
  sidebar: { borderRight: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,12,18,0.96)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, boxShadow: '12px 0 40px rgba(0,0,0,0.22)' },
  sideTop: { display: 'flex', gap: 12, alignItems: 'center' },
  backBtn: { background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontWeight: 800 },
  title: { margin: 0, fontSize: '1.3rem', fontWeight: 950, letterSpacing: '-0.03em' },
  sub: { margin: '3px 0 0', color: '#9ca3af', fontSize: '0.82rem' },
  search: { background: 'rgba(17,24,39,0.72)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '12px 13px', outline: 'none' },
  tabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  tab: { background: '#151515', color: '#888', border: '1px solid #252525', borderRadius: 9, padding: '9px 8px', cursor: 'pointer', fontWeight: 800, fontSize: '0.76rem' },
  tabActive: { background: '#1f1607', color: '#f59e0b', borderColor: '#f59e0b55' },
  conv: { display: 'flex', gap: 11, width: '100%', textAlign: 'left', background: 'rgba(17,24,39,0.62)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 13, cursor: 'pointer', color: '#fff', transition: 'border-color 0.15s, transform 0.15s' },
  convActive: { borderColor: 'rgba(245,158,11,0.65)', background: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(17,24,39,0.74))' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', display: 'grid', placeItems: 'center', fontWeight: 900, flexShrink: 0 },
  convBody: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  convTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  convName: { fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  muted: { color: '#666' },
  roleRow: { display: 'flex', justifyContent: 'space-between' },
  badge: { color: '#f59e0b', background: '#1f1607', border: '1px solid #f59e0b22', borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', textTransform: 'capitalize' },
  dot: { minWidth: 18, height: 18, borderRadius: 999, background: '#f59e0b', color: '#000', display: 'grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 800 },
  preview: { color: '#777', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chat: { display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 },
  chatHeader: { minHeight: 78, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,12,18,0.94)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px' },
  avatarLarge: { width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.32)', color: '#f59e0b', display: 'grid', placeItems: 'center', fontWeight: 950 },
  chatName: { margin: 0, fontSize: '1rem' },
  acceptRequestBtn: { marginLeft: 'auto', background: '#f59e0b', border: 0, color: '#000', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 900 },
  flagBtn: { marginLeft: 'auto', background: '#1c1207', border: '1px solid #78350f', color: '#fbbf24', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 },
  notice: { margin: '12px 24px 0', background: '#211608', border: '1px solid #f59e0b33', color: '#fbbf24', borderRadius: 10, padding: '10px 12px', fontSize: '0.82rem' },
  messages: { flex: 1, overflowY: 'auto', padding: 24, background: 'radial-gradient(circle at top right, rgba(245,158,11,0.05), transparent 38%), #070a0f' },
  center: { color: '#666', padding: 30, textAlign: 'center' },
  requestPanel: { margin: '48px auto', maxWidth: 460, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: 22, textAlign: 'center' },
  requestTitle: { margin: '0 0 8px', fontSize: '1rem' },
  requestText: { margin: '0 0 16px', color: '#888', lineHeight: 1.5, fontSize: '0.86rem' },
  empty: { color: '#666', padding: 18, fontSize: '0.85rem' },
  row: { display: 'flex', marginBottom: 12 },
  bubble: { maxWidth: '68%', borderRadius: 18, padding: '11px 13px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 28px rgba(0,0,0,0.18)' },
  mine: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#111', borderBottomRightRadius: 5 },
  theirs: { background: 'rgba(17,24,39,0.82)', color: '#e5e5e5', borderBottomLeftRadius: 5 },
  sender: { color: '#f59e0b', fontSize: '0.72rem', fontWeight: 800, marginBottom: 5, textTransform: 'capitalize' },
  text: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, fontSize: '0.9rem' },
  msgFooter: { marginTop: 7, display: 'flex', justifyContent: 'space-between', gap: 10, color: '#777', fontSize: '0.72rem' },
  reportBtn: { background: 'transparent', border: 0, color: '#777', cursor: 'pointer', padding: 0, fontSize: '0.72rem' },
  form: { display: 'flex', gap: 10, padding: 18, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,12,18,0.96)' },
  input: { flex: 1, background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 12, padding: '13px 14px', outline: 'none' },
  send: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 12, padding: '0 20px', fontWeight: 950, cursor: 'pointer' },
};
