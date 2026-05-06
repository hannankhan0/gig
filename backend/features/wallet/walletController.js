const walletModel = require('./walletModel');

const cleanTokenError = (res, err) => {
  if (err.code === 'INSUFFICIENT_TOKENS') {
    return res.status(402).json({
      success: false,
      code: err.code,
      message: err.message,
      requiredTokens: err.requiredTokens,
      currentBalance: err.currentBalance,
    });
  }
  if (err.status) return res.status(err.status).json({ error: err.message });
  return null;
};

const wallet = async (req, res) => {
  try {
    res.json({ wallet: await walletModel.getWalletSummary(req.user.id) });
  } catch (err) {
    console.error('wallet error:', err.message);
    res.status(500).json({ error: 'could not load wallet.' });
  }
};

const plans = async (req, res) => {
  try {
    res.json({ plans: await walletModel.getPlans(req.user?.id || null) });
  } catch (err) {
    console.error('plans error:', err.message);
    res.status(500).json({ error: 'could not load token plans.' });
  }
};

const planDetail = async (req, res) => {
  try {
    const plan = await walletModel.getPlanByID(Number(req.params.planId), req.user.id);
    if (!plan) return res.status(404).json({ error: 'plan not found.' });
    res.json({ plan, wallet: await walletModel.getWalletSummary(req.user.id) });
  } catch (err) {
    console.error('planDetail error:', err.message);
    res.status(500).json({ error: 'could not load plan.' });
  }
};

const transactions = async (req, res) => {
  try {
    res.json({ transactions: await walletModel.getTransactions(req.user.id) });
  } catch (err) {
    console.error('transactions error:', err.message);
    res.status(500).json({ error: 'could not load token transactions.' });
  }
};

const purchases = async (req, res) => {
  try {
    res.json({ purchases: await walletModel.getPurchases(req.user.id) });
  } catch (err) {
    console.error('purchases error:', err.message);
    res.status(500).json({ error: 'could not load token purchases.' });
  }
};

const demoPurchase = async (req, res) => {
  try {
    if (!['student', 'client'].includes(req.user.role)) {
      return res.status(403).json({ error: 'token purchases are for students and clients only.' });
    }
    const { plan_id, payment_method_demo, simulate_failure } = req.body;
    const planID = Number(plan_id);
    if (!planID) return res.status(400).json({ error: 'plan_id is required.' });

    const result = simulate_failure
      ? await walletModel.createDemoPurchase({
        userID: req.user.id,
        planID,
        paymentMethodDemo: payment_method_demo,
        simulateFailure: true,
      })
      : await walletModel.createCheckoutPurchase({
        userID: req.user.id,
        planID,
        paymentMethod: 'card',
        maskedMethodLabel: payment_method_demo || 'Card',
      });
    res.status(201).json(result);
  } catch (err) {
    if (cleanTokenError(res, err)) return;
    console.error('demoPurchase error:', err.message || err.message);
    res.status(err.status || 500).json({ error: err.message || 'could not complete demo purchase.' });
  }
};

const checkoutPurchase = async (req, res) => {
  try {
    if (!['student', 'client'].includes(req.user.role)) {
      return res.status(403).json({ error: 'token purchases are for students and clients only.' });
    }
    const { plan_id, payment_method, masked_method_label, receipt_email } = req.body;
    const planID = Number(plan_id);
    if (!planID) return res.status(400).json({ error: 'plan_id is required.' });
    if (!['card', 'jazzcash'].includes(payment_method)) {
      return res.status(400).json({ error: 'payment_method must be card or jazzcash.' });
    }

    const result = await walletModel.createCheckoutPurchase({
      userID: req.user.id,
      planID,
      paymentMethod: payment_method,
      maskedMethodLabel: masked_method_label,
      receiptEmail: receipt_email,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'PLAN_ALREADY_PURCHASED_THIS_MONTH') {
      return res.status(409).json({ success: false, code: err.code, message: err.message });
    }
    if (cleanTokenError(res, err)) return;
    console.error('checkoutPurchase error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'could not complete checkout.' });
  }
};

module.exports = { wallet, plans, planDetail, transactions, purchases, demoPurchase, checkoutPurchase };
