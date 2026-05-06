import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../api/axios';

const steps = [
  'Verifying payment details...',
  'Authorizing transaction...',
  'Crediting tokens to wallet...',
  'Finalizing receipt...',
];

export default function CheckoutPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [method, setMethod] = useState('card');
  const [otpStage, setOtpStage] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    card: '',
    expiry: '',
    cvv: '',
    email: '',
    mobile: '',
    holder: '',
    otp: '',
  });

  useEffect(() => {
    API.get(`/token-plans/${planId}`)
      .then(res => {
        setPlan(res.data.plan);
        setWallet(res.data.wallet);
      })
      .catch(err => setError(err.response?.data?.error || 'Could not load checkout.'));
  }, [planId]);

  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 650);
    return () => clearInterval(timer);
  }, [processing]);

  const set = (key, value) => {
    if (key === 'card') value = value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    if (key === 'expiry') {
      const raw = value.replace(/\D/g, '').slice(0, 4);
      value = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
    }
    if (key === 'cvv') value = value.replace(/\D/g, '').slice(0, 4);
    if (key === 'mobile') value = value.replace(/\D/g, '').slice(0, 11);
    if (key === 'otp') value = value.replace(/\D/g, '').slice(0, 6);
    setForm(f => ({ ...f, [key]: value }));
  };

  const cardDigits = form.card.replace(/\D/g, '');
  const email = method === 'card' ? form.email : form.email;
  const validCard = form.name.trim() && cardDigits.length === 16 && /^\d{2}\/\d{2}$/.test(form.expiry) && form.cvv.length >= 3 && /@/.test(form.email);
  const validJazz = form.mobile.length === 11 && form.holder.trim().length >= 3 && /@/.test(form.email);
  const validOtp = form.otp.length === 6;
  const canPay = method === 'card' ? validCard : (otpStage ? validOtp : validJazz);

  const afterBalance = useMemo(() => Number(wallet?.balance_tokens || 0) + Number(plan?.tokens || 0), [wallet, plan]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canPay || processing || !plan) return;
    if (method === 'jazzcash' && !otpStage) {
      setOtpStage(true);
      return;
    }

    setProcessing(true);
    setStep(0);
    setError('');
    setTimeout(async () => {
      try {
        const masked = method === 'card'
          ? `Card ending ${cardDigits.slice(-4)}`
          : `JazzCash ending ${form.mobile.slice(-4)}`;
        const res = await API.post('/token-purchases/checkout', {
          plan_id: plan.id,
          payment_method: method,
          masked_method_label: masked,
          receipt_email: email,
        });
        setSuccess(res.data);
        setWallet(res.data.wallet);
      } catch (err) {
        const data = err.response?.data;
        setError(data?.code === 'PLAN_ALREADY_PURCHASED_THIS_MONTH'
          ? 'You already purchased this plan this month. Please choose another plan or wait until next month.'
          : data?.error || data?.message || 'Payment could not be completed.');
      } finally {
        setProcessing(false);
      }
    }, 2700);
  };

  if (!plan || !wallet) return <><CheckoutStyles /><div style={st.root}><div className="checkout-shell" style={st.shell}><div style={st.loading}>{error || 'Loading secure checkout...'}</div></div></div></>;

  if (success) {
    return (
      <>
      <CheckoutStyles />
      <div style={st.root}>
        <div style={st.successCard}>
          <div style={st.successMark}>OK</div>
          <h1 style={st.successTitle}>Payment Successful</h1>
          <p style={st.muted}>{Number(success.purchase.tokens).toLocaleString()} tokens were added to your wallet.</p>
          <div style={st.receipt}>
            <Row label="Plan" value={success.purchase.plan_name} />
            <Row label="Amount" value={`PKR ${Number(success.purchase.price_pkr).toLocaleString()}`} />
            <Row label="New Balance" value={`${Number(success.wallet.balance_tokens).toLocaleString()} tokens`} />
            <Row label="Transaction ID" value={success.transactionId} />
            <Row label="Payment Method" value={success.purchase.payment_method_demo} />
          </div>
          <div style={st.actions}>
            <button style={st.secondary} onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
            <button style={st.primary} onClick={() => navigate('/billing')}>View Wallet</button>
          </div>
          <p style={st.footer}>Sandbox checkout for current iteration.</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <CheckoutStyles />
    <div style={st.root}>
      <div className="checkout-shell" style={st.shell}>
        <section style={st.summary}>
          <div style={st.brand}>Grade &amp; Grind</div>
          <h1 style={st.heading}>Secure Checkout</h1>
          <p style={st.muted}>Complete your token plan purchase and continue using premium actions.</p>
          <div style={st.order}>
            <Row label="Selected Plan" value={plan.name} />
            <Row label="Tokens" value={Number(plan.tokens).toLocaleString()} />
            <Row label="Price" value={`PKR ${Number(plan.price_pkr).toLocaleString()}`} />
            <Row label="Current Balance" value={`${Number(wallet.balance_tokens).toLocaleString()} tokens`} />
            <Row label="Balance After" value={`${Number(afterBalance).toLocaleString()} tokens`} />
            <Row label="Order Reference" value={`GNG-${Date.now().toString().slice(-8)}`} />
          </div>
          {plan.alreadyPurchasedThisMonth && (
            <div style={st.error}>You have already purchased this plan this month. It will be available again next month.</div>
          )}
          <div style={st.trust}>
            <span>Secure payment</span><span>Instant token credit</span><span>Protected checkout</span>
          </div>
          <div style={st.badges}><span>VISA</span><span>Mastercard</span><span>JazzCash</span></div>
        </section>

        <section style={st.formPane}>
          {processing ? (
            <div style={st.processing}>
              <div style={st.spinner} />
              <h2>Processing Payment</h2>
              <p>{steps[step]}</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div style={st.methodTabs}>
                <button type="button" style={{ ...st.method, ...(method === 'card' ? st.methodActive : {}) }} onClick={() => { setMethod('card'); setOtpStage(false); }}>Debit / Credit Card</button>
                <button type="button" style={{ ...st.method, ...(method === 'jazzcash' ? st.methodActive : {}) }} onClick={() => setMethod('jazzcash')}>JazzCash</button>
              </div>

              {method === 'card' ? (
                <div style={st.fields}>
                  <Input label="Name on Card" value={form.name} onChange={v => set('name', v)} placeholder="Sadeem Arshad" />
                  <Input label="Card Number" value={form.card} onChange={v => set('card', v)} placeholder="4242 4242 4242 4242" />
                  <div style={st.twoFields}>
                    <Input label="Expiry Date" value={form.expiry} onChange={v => set('expiry', v)} placeholder="MM/YY" />
                    <Input label="CVV" value={form.cvv} onChange={v => set('cvv', v)} placeholder="123" />
                  </div>
                  <Input label="Email for Receipt" value={form.email} onChange={v => set('email', v)} placeholder="you@example.com" />
                </div>
              ) : otpStage ? (
                <div style={st.fields}>
                  <p style={st.muted}>Enter the verification code sent to your mobile.</p>
                  <Input label="6-digit OTP" value={form.otp} onChange={v => set('otp', v)} placeholder="123456" />
                </div>
              ) : (
                <div style={st.fields}>
                  <Input label="Mobile Number" value={form.mobile} onChange={v => set('mobile', v)} placeholder="03001234567" />
                  <Input label="Account Holder Name" value={form.holder} onChange={v => set('holder', v)} placeholder="Ahmed Khan" />
                  <Input label="Email for Receipt" value={form.email} onChange={v => set('email', v)} placeholder="you@example.com" />
                </div>
              )}

              {error && <div style={st.error}>{error}</div>}
              <button disabled={!canPay || plan.alreadyPurchasedThisMonth} style={{ ...st.pay, opacity: canPay && !plan.alreadyPurchasedThisMonth ? 1 : 0.55 }}>
                {method === 'jazzcash' && !otpStage ? 'Continue' : `Pay PKR ${Number(plan.price_pkr).toLocaleString()}`}
              </button>
              <p style={st.footer}>Sandbox checkout for current iteration.</p>
            </form>
          )}
        </section>
      </div>
    </div>
    </>
  );
}

function CheckoutStyles() {
  return <style>{`
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 780px) {
      .checkout-shell { grid-template-columns: 1fr !important; }
    }
  `}</style>;
}

function Row({ label, value }) {
  return <div style={st.row}><span>{label}</span><strong>{value}</strong></div>;
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label style={st.inputWrap}>
      <span>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={st.input} />
    </label>
  );
}

const st = {
  root: { minHeight: '100vh', background: 'radial-gradient(circle at top left, #2b1a05 0, #070a0f 36%, #050608 100%)', color: '#fff', display: 'grid', placeItems: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" },
  shell: { width: 'min(1060px, 100%)', background: 'rgba(17,24,39,0.82)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 26, boxShadow: '0 28px 100px rgba(0,0,0,0.58)', display: 'grid', gridTemplateColumns: '1fr 1.05fr', overflow: 'hidden', backdropFilter: 'blur(18px)' },
  summary: { padding: 36, background: 'linear-gradient(145deg, rgba(245,158,11,0.12), rgba(8,10,15,0.96))' },
  formPane: { padding: 36, background: 'rgba(10,12,18,0.98)' },
  brand: { color: '#f59e0b', fontWeight: 950, marginBottom: 28, letterSpacing: '-0.02em' },
  heading: { margin: 0, fontSize: 'clamp(1.8rem,4vw,2.35rem)', fontWeight: 950, letterSpacing: '-0.05em' },
  muted: { color: '#9ca3af', lineHeight: 1.58 },
  order: { background: 'rgba(7,10,15,0.76)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 18, marginTop: 22 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 20, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#aab0bd' },
  trust: { display: 'grid', gap: 8, color: '#ddd', marginTop: 20, fontWeight: 800 },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 },
  methodTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 },
  method: { background: 'rgba(17,24,39,0.72)', color: '#aab0bd', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '13px 10px', cursor: 'pointer', fontWeight: 900 },
  methodActive: { color: '#070a0f', background: 'linear-gradient(135deg,#f59e0b,#facc15)', borderColor: '#f59e0b' },
  fields: { display: 'grid', gap: 14 },
  twoFields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  inputWrap: { display: 'grid', gap: 7, color: '#aaa', fontSize: '0.82rem', fontWeight: 800 },
  input: { background: 'rgba(7,10,15,0.82)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 13, padding: '13px 13px', outline: 'none', fontSize: '0.95rem' },
  pay: { width: '100%', background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 14, padding: '15px 18px', marginTop: 20, cursor: 'pointer', fontWeight: 950, fontSize: '1rem', boxShadow: '0 16px 34px rgba(245,158,11,0.2)' },
  error: { color: '#fca5a5', background: '#2d1212', border: '1px solid #7f1d1d', borderRadius: 10, padding: 12, marginTop: 14 },
  processing: { minHeight: 380, display: 'grid', placeItems: 'center', textAlign: 'center' },
  spinner: { width: 46, height: 46, borderRadius: '50%', border: '3px solid #333', borderTopColor: '#f59e0b', animation: 'spin 0.8s linear infinite' },
  successCard: { width: 'min(560px, 100%)', background: 'rgba(17,24,39,0.88)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 26, padding: 36, textAlign: 'center', boxShadow: '0 28px 100px rgba(0,0,0,0.58)' },
  successMark: { width: 62, height: 62, borderRadius: '50%', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: '1rem', fontWeight: 950 },
  successTitle: { margin: 0 },
  receipt: { textAlign: 'left', background: '#0b0b0b', border: '1px solid #252525', borderRadius: 16, padding: '6px 16px', marginTop: 20 },
  actions: { display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 22 },
  primary: { background: 'linear-gradient(135deg,#f59e0b,#facc15)', color: '#070a0f', border: 0, borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontWeight: 950 },
  secondary: { background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontWeight: 850 },
  footer: { color: '#7b8190', fontSize: '0.76rem', marginTop: 16 },
  loading: { padding: 40, color: '#aaa' },
  '@media': {},
};
