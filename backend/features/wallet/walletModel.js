const { sql, poolPromise } = require('../../config/db');

const FREE_TOKENS = 10000;

const tokenError = (requiredTokens, currentBalance = 0) => {
  const err = new Error('Insufficient tokens. Please buy a token plan.');
  err.status = 402;
  err.code = 'INSUFFICIENT_TOKENS';
  err.requiredTokens = requiredTokens;
  err.currentBalance = currentBalance;
  return err;
};

const monthlyPlanError = () => {
  const err = new Error('You have already purchased this plan this month. You can buy another plan or wait until next month.');
  err.status = 409;
  err.code = 'PLAN_ALREADY_PURCHASED_THIS_MONTH';
  return err;
};

const transactionID = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `GNG-PAY-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
};

const ensureWallet = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .input('tokens', sql.Int, FREE_TOKENS)
    .query(`
      declare @walletID int;

      select @walletID = id from user_wallets where user_id = @userID;

      if @walletID is null
      begin
        insert into user_wallets (user_id, balance_tokens, current_plan, total_earned_tokens, total_spent_tokens)
        values (@userID, @tokens, 'Free Trial', @tokens, 0);
        set @walletID = scope_identity();

        insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason)
        values (@userID, @walletID, 'credit', @tokens, @tokens, 'free_trial_signup_bonus');
      end

      select * from user_wallets where id = @walletID;
    `);
  return result.recordset[0];
};

const getWalletSummary = async (userID) => ensureWallet(userID);

const getPlans = async (userID = null) => {
  const pool = await poolPromise;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
    select
      p.id, p.name, p.price_pkr, p.tokens, p.is_active, p.created_at,
      cast(case when p.name <> 'Free Trial' and exists (
        select 1 from token_purchases tp
        where tp.user_id = @userID
          and tp.plan_id = p.id
          and tp.status in ('paid_sandbox', 'paid_demo', 'paid')
          and tp.created_at >= datefromparts(year(getdate()), month(getdate()), 1)
          and tp.created_at < dateadd(month, 1, datefromparts(year(getdate()), month(getdate()), 1))
      ) then 1 else 0 end as bit) as alreadyPurchasedThisMonth
    from token_plans
    p
    where p.is_active = 1
    order by price_pkr asc, tokens asc
  `);
  return result.recordset.map((plan) => ({
    ...plan,
    canPurchase: plan.name !== 'Free Trial' && !plan.alreadyPurchasedThisMonth,
    availableAgainAt: plan.alreadyPurchasedThisMonth ? nextMonth.toISOString().slice(0, 10) : null,
  }));
};

const getTransactions = async (userID) => {
  const wallet = await ensureWallet(userID);
  const pool = await poolPromise;
  const result = await pool.request()
    .input('walletID', sql.Int, wallet.id)
    .query(`
      select top 100 id, type, amount_tokens, balance_after, reason, reference_type, reference_id, created_at
      from token_transactions
      where wallet_id = @walletID
      order by created_at desc, id desc
    `);
  return result.recordset;
};

const getPurchases = async (userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .query(`
      select top 100 id, plan_name, price_pkr, tokens, status, demo_transaction_id, payment_method_demo, created_at, paid_at
      from token_purchases
      where user_id = @userID
      order by created_at desc, id desc
    `);
  return result.recordset;
};

const getPlanByID = async (planID, userID = null) => {
  const plans = await getPlans(userID);
  return plans.find(plan => Number(plan.id) === Number(planID)) || null;
};

const assertSufficientTokens = async (userID, amount) => {
  const wallet = await ensureWallet(userID);
  if (Number(wallet.balance_tokens) < Number(amount)) {
    throw tokenError(amount, wallet.balance_tokens);
  }
  return wallet;
};

const checkAndDeductTokens = async (userID, amount, reason, referenceType = null, referenceID = null) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('userID', sql.Int, userID)
    .input('amount', sql.Int, amount)
    .input('reason', sql.NVarChar, reason)
    .input('referenceType', sql.NVarChar, referenceType)
    .input('referenceID', sql.Int, referenceID)
    .query(`
      declare @walletID int;
      declare @balance int;
      declare @after int;

      select @walletID = id, @balance = balance_tokens
      from user_wallets with (updlock, rowlock)
      where user_id = @userID;

      if @walletID is null
      begin
        insert into user_wallets (user_id, balance_tokens, current_plan, total_earned_tokens, total_spent_tokens)
        values (@userID, 10000, 'Free Trial', 10000, 0);
        set @walletID = scope_identity();
        set @balance = 10000;
        insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason)
        values (@userID, @walletID, 'credit', 10000, 10000, 'free_trial_signup_bonus');
      end

      if @balance < @amount
      begin
        select cast(0 as bit) as success, @balance as balance_after;
        return;
      end

      set @after = @balance - @amount;

      update user_wallets
      set balance_tokens = @after,
          total_spent_tokens = total_spent_tokens + @amount,
          updated_at = getdate()
      where id = @walletID;

      insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason, reference_type, reference_id)
      values (@userID, @walletID, 'debit', @amount, @after, @reason, @referenceType, @referenceID);

      select cast(1 as bit) as success, @after as balance_after;
    `);
  const row = result.recordset[0];
  if (!row?.success) throw tokenError(amount, row?.balance_after || 0);
  return row.balance_after;
};

const createDemoPurchase = async ({ userID, planID, paymentMethodDemo, simulateFailure = false }) => {
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);
  await txn.begin();
  try {
    const planResult = await txn.request()
      .input('planID', sql.Int, planID)
      .query(`select id, name, price_pkr, tokens from token_plans where id = @planID and is_active = 1`);
    const plan = planResult.recordset[0];
    if (!plan || plan.name === 'Free Trial') {
      throw { status: 400, message: 'select a paid active token plan.' };
    }

    const walletResult = await txn.request()
      .input('userID', sql.Int, userID)
      .query(`
        if not exists (select 1 from user_wallets where user_id = @userID)
        begin
          insert into user_wallets (user_id, balance_tokens, current_plan, total_earned_tokens, total_spent_tokens)
          values (@userID, 10000, 'Free Trial', 10000, 0);
          insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason)
          values (@userID, scope_identity(), 'credit', 10000, 10000, 'free_trial_signup_bonus');
        end
        select * from user_wallets where user_id = @userID;
      `);
    const wallet = walletResult.recordset[0];
    const demoTxn = `DEMO-TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const status = simulateFailure ? 'failed_demo' : 'paid_demo';

    const purchaseResult = await txn.request()
      .input('userID', sql.Int, userID)
      .input('planID', sql.Int, plan.id)
      .input('planName', sql.NVarChar, plan.name)
      .input('price', sql.Int, plan.price_pkr)
      .input('tokens', sql.Int, plan.tokens)
      .input('status', sql.NVarChar, status)
      .input('demoTxn', sql.NVarChar, demoTxn)
      .input('method', sql.NVarChar, paymentMethodDemo || 'Demo Card')
      .query(`
        insert into token_purchases (user_id, plan_id, plan_name, price_pkr, tokens, status, demo_transaction_id, payment_method_demo, paid_at)
        output inserted.*
        values (@userID, @planID, @planName, @price, @tokens, @status, @demoTxn, @method, case when @status = 'paid_demo' then getdate() else null end)
      `);
    const purchase = purchaseResult.recordset[0];

    if (!simulateFailure) {
      const balanceAfter = Number(wallet.balance_tokens) + Number(plan.tokens);
      await txn.request()
        .input('walletID', sql.Int, wallet.id)
        .input('userID', sql.Int, userID)
        .input('planName', sql.NVarChar, plan.name)
        .input('tokens', sql.Int, plan.tokens)
        .input('balanceAfter', sql.Int, balanceAfter)
        .input('purchaseID', sql.Int, purchase.id)
        .query(`
          update user_wallets
          set balance_tokens = @balanceAfter,
              current_plan = @planName,
              total_earned_tokens = total_earned_tokens + @tokens,
              updated_at = getdate()
          where id = @walletID;

          insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason, reference_type, reference_id)
          values (@userID, @walletID, 'credit', @tokens, @balanceAfter, 'plan_purchase_demo', 'token_purchase', @purchaseID);
        `);
    }

    await txn.commit();
    return {
      purchase,
      wallet: await getWalletSummary(userID),
    };
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

const createCheckoutPurchase = async ({ userID, planID, paymentMethod, maskedMethodLabel, receiptEmail }) => {
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);
  await txn.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const planResult = await txn.request()
      .input('planID', sql.Int, planID)
      .query(`select id, name, price_pkr, tokens from token_plans where id = @planID and is_active = 1`);
    const plan = planResult.recordset[0];
    if (!plan || plan.name === 'Free Trial') {
      throw { status: 400, message: 'select a paid active token plan.' };
    }

    const duplicate = await txn.request()
      .input('userID', sql.Int, userID)
      .input('planID', sql.Int, plan.id)
      .query(`
        select top 1 id
        from token_purchases with (updlock, holdlock)
        where user_id = @userID
          and plan_id = @planID
          and status in ('paid_sandbox', 'paid_demo', 'paid')
          and created_at >= datefromparts(year(getdate()), month(getdate()), 1)
          and created_at < dateadd(month, 1, datefromparts(year(getdate()), month(getdate()), 1))
      `);
    if (duplicate.recordset[0]) throw monthlyPlanError();

    const walletResult = await txn.request()
      .input('userID', sql.Int, userID)
      .query(`
        if not exists (select 1 from user_wallets where user_id = @userID)
        begin
          insert into user_wallets (user_id, balance_tokens, current_plan, total_earned_tokens, total_spent_tokens)
          values (@userID, 10000, 'Free Trial', 10000, 0);
          insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason)
          values (@userID, scope_identity(), 'credit', 10000, 10000, 'free_trial_signup_bonus');
        end
        select * from user_wallets with (updlock, rowlock) where user_id = @userID;
      `);
    const wallet = walletResult.recordset[0];
    const payID = transactionID();
    const methodLabel = maskedMethodLabel || (paymentMethod === 'jazzcash' ? 'JazzCash' : 'Card');

    const purchaseResult = await txn.request()
      .input('userID', sql.Int, userID)
      .input('planID', sql.Int, plan.id)
      .input('planName', sql.NVarChar, plan.name)
      .input('price', sql.Int, plan.price_pkr)
      .input('tokens', sql.Int, plan.tokens)
      .input('status', sql.NVarChar, 'paid_sandbox')
      .input('demoTxn', sql.NVarChar, payID)
      .input('method', sql.NVarChar, methodLabel)
      .query(`
        insert into token_purchases (user_id, plan_id, plan_name, price_pkr, tokens, status, demo_transaction_id, payment_method_demo, paid_at)
        output inserted.*
        values (@userID, @planID, @planName, @price, @tokens, @status, @demoTxn, @method, getdate())
      `);
    const purchase = purchaseResult.recordset[0];
    const balanceAfter = Number(wallet.balance_tokens) + Number(plan.tokens);

    const currentPlanResult = await txn.request()
      .input('userID', sql.Int, userID)
      .query(`
        select top 1 plan_name
        from token_purchases
        where user_id = @userID
          and status in ('paid_sandbox', 'paid_demo', 'paid')
          and created_at >= datefromparts(year(getdate()), month(getdate()), 1)
          and created_at < dateadd(month, 1, datefromparts(year(getdate()), month(getdate()), 1))
        order by case plan_name when 'Max' then 4 when 'Pro' then 3 when 'Plus' then 2 else 1 end desc
      `);
    const currentPlan = currentPlanResult.recordset[0]?.plan_name || plan.name;

    await txn.request()
      .input('walletID', sql.Int, wallet.id)
      .input('userID', sql.Int, userID)
      .input('currentPlan', sql.NVarChar, currentPlan)
      .input('tokens', sql.Int, plan.tokens)
      .input('balanceAfter', sql.Int, balanceAfter)
      .input('purchaseID', sql.Int, purchase.id)
      .query(`
        update user_wallets
        set balance_tokens = @balanceAfter,
            current_plan = @currentPlan,
            total_earned_tokens = total_earned_tokens + @tokens,
            updated_at = getdate()
        where id = @walletID;

        insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason, reference_type, reference_id)
        values (@userID, @walletID, 'credit', @tokens, @balanceAfter, 'plan_purchase_sandbox', 'token_purchase', @purchaseID);
      `);

    await txn.commit();
    return { success: true, purchase, transactionId: payID, wallet: await getWalletSummary(userID), receiptEmail };
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

module.exports = {
  FREE_TOKENS,
  ensureWallet,
  getWalletSummary,
  getPlans,
  getPlanByID,
  getTransactions,
  getPurchases,
  assertSufficientTokens,
  checkAndDeductTokens,
  createDemoPurchase,
  createCheckoutPurchase,
};
