import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import API from '../api/axios';

export default function ChatPanel({ bookingId, currentUserId, title, onClose }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const listRef = useRef(null);

  const socketUrl = useMemo(() => {
    const apiBase = API.defaults.baseURL || 'http://localhost:5000/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      try {
        const res = await API.get(`/chat/bookings/${bookingId}/messages`);
        if (isMounted) setMessages(res.data || []);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load messages');
      }
    }

    loadMessages();

    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_booking', bookingId, (ack) => {
        if (!ack?.ok) setError(ack?.error || 'Could not join chat');
      });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setError('Chat connection failed'));
    socket.on('message:new', (message) => {
      if (Number(message.BookingID) === Number(bookingId)) {
        setMessages(prev => prev.some(m => m.MessageID === message.MessageID) ? prev : [...prev, message]);
      }
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [bookingId, socketUrl]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('send_message', { bookingID: bookingId, body: text }, (ack) => {
      if (!ack?.ok) {
        setError(ack?.error || 'Message failed');
        return;
      }
      setBody('');
      setError('');
    });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel} className="animate-scale-in">
        <div style={styles.header}>
          <div>
            <p style={styles.kicker}>{connected ? 'Live chat' : 'Connecting...'}</p>
            <h2 style={styles.title}>{title || `Booking #${bookingId}`}</h2>
          </div>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div ref={listRef} style={styles.messages}>
          {messages.length === 0 ? (
            <div style={styles.empty}>No messages yet. Start the conversation.</div>
          ) : messages.map(message => {
            const mine = Number(message.SenderID) === Number(currentUserId);
            return (
              <div key={message.MessageID} style={{ ...styles.row, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...styles.bubble, ...(mine ? styles.mine : styles.theirs) }}>
                  {!mine && <p style={styles.sender}>{message.SenderName}</p>}
                  <p style={styles.text}>{message.Body}</p>
                  <p style={styles.time}>
                    {new Date(message.SentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={send} style={styles.form}>
          <input
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Type a message..."
            maxLength={2000}
            style={styles.input}
          />
          <button type="submit" disabled={!body.trim()} style={styles.send}>Send</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.48)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  panel: {
    width: 'min(440px, 100vw)',
    background: '#ffffff',
    boxShadow: '-18px 0 60px rgba(15, 23, 42, 0.18)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '1.25rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  kicker: {
    margin: 0,
    color: '#059669',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 800,
  },
  title: { margin: '0.2rem 0 0', fontSize: '1.1rem', color: '#111827' },
  close: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    background: '#f9fafb',
    cursor: 'pointer',
    fontSize: '1.35rem',
    lineHeight: 1,
  },
  error: {
    margin: '0.75rem 1rem 0',
    padding: '0.75rem',
    color: '#b91c1c',
    background: '#fee2e2',
    borderRadius: 8,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    background: '#f8fafc',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '3rem 1rem',
  },
  row: {
    display: 'flex',
    marginBottom: '0.75rem',
  },
  bubble: {
    maxWidth: '78%',
    padding: '0.75rem 0.9rem',
    borderRadius: 14,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
  },
  mine: {
    background: '#059669',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  theirs: {
    background: '#fff',
    color: '#111827',
    borderBottomLeftRadius: 4,
  },
  sender: {
    margin: '0 0 0.25rem',
    fontSize: '0.76rem',
    color: '#059669',
    fontWeight: 800,
  },
  text: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  time: {
    margin: '0.35rem 0 0',
    fontSize: '0.7rem',
    opacity: 0.7,
    textAlign: 'right',
  },
  form: {
    padding: '1rem',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '0.75rem',
  },
  input: {
    flex: 1,
    padding: '0.8rem 0.9rem',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    outline: 'none',
  },
  send: {
    padding: '0.8rem 1.1rem',
    border: 'none',
    borderRadius: 10,
    background: '#059669',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
