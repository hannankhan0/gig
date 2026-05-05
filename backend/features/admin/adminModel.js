const { sql, poolPromise } = require('../../config/db');

const logAction = async ({ adminID, actionType, targetType, targetID, description }) => {
  const pool = await poolPromise;
  await pool.request()
    .input('adminID', sql.Int, adminID)
    .input('actionType', sql.NVarChar, actionType)
    .input('targetType', sql.NVarChar, targetType)
    .input('targetID', sql.Int, targetID)
    .input('description', sql.NVarChar, description)
    .query(`
      insert into AdminActivityLogs (AdminID, ActionType, TargetType, TargetID, Description)
      values (@adminID, @actionType, @targetType, @targetID, @description)
    `);
};

const getStats = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select
      (select count(*) from Users) as TotalUsers,
      (select count(*) from Users where Role = 'student') as TotalStudents,
      (select count(*) from Users where Role = 'client') as TotalClients,
      (select count(*) from Gigs where Status in ('open', 'in_progress', 'submitted', 'revision', 'paused')) as ActiveGigs,
      (select count(*) from Gigs where Status = 'completed') as CompletedGigs,
      (select count(*) from Applications where Status = 'pending') as PendingApplications,
      (select count(*) from Applications) as TotalApplications,
      (select count(*) from Reports where Status = 'pending') as OpenReports,
      (select count(*) from Users where IsBanned = 1) as BannedUsers
  `);
  return result.recordset[0];
};

const getRecentActivity = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select top 12 l.*, u.FullName as AdminName
    from AdminActivityLogs l
    left join Users u on u.UserID = l.AdminID
    order by l.CreatedAt desc
  `);
  return result.recordset;
};

const listUsers = async ({ role, status, q }) => {
  const pool = await poolPromise;
  const req = pool.request()
    .input('role', sql.NVarChar, role || null)
    .input('q', sql.NVarChar, q ? `%${q}%` : null);
  const statusClause = status === 'banned'
    ? 'and u.IsBanned = 1'
    : status === 'active'
      ? 'and u.IsBanned = 0'
      : '';
  const result = await req.query(`
    select
      u.UserID, u.FullName, u.Email, u.Phone, u.University, u.ProfilePic,
      u.Role, u.IsVerified, u.IsBanned, u.CreatedAt,
      (select count(*) from Gigs g where g.ClientID = u.UserID) as PostedGigs,
      (select count(*) from Applications a where a.StudentID = u.UserID) as ApplicationsCount,
      (select count(*) from Reviews r where r.RevieweeID = u.UserID) as ReviewsCount,
      (select count(*) from Reports r where r.ReportedUserID = u.UserID) as ReportsCount
    from Users u
    where (@role is null or u.Role = @role)
      and (@q is null or u.FullName like @q or u.Email like @q)
      ${statusClause}
    order by u.CreatedAt desc
  `);
  return result.recordset;
};

const setUserBan = async (adminID, userID, banned) => {
  const pool = await poolPromise;
  await pool.request()
    .input('userID', sql.Int, userID)
    .input('banned', sql.Bit, banned ? 1 : 0)
    .query(`update Users set IsBanned = @banned where UserID = @userID and Role <> 'admin'`);
  await logAction({
    adminID,
    actionType: banned ? 'ban_user' : 'unban_user',
    targetType: 'user',
    targetID: userID,
    description: banned ? 'Banned platform user.' : 'Unbanned platform user.',
  });
};

const listGigs = async ({ status, q }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('status', sql.NVarChar, status || null)
    .input('q', sql.NVarChar, q ? `%${q}%` : null)
    .query(`
      select
        g.GigID, g.Title, g.Description, g.Budget, g.Deadline, g.Category,
        g.RequiredSkills, g.Status, g.CreatedAt,
        c.UserID as ClientID, c.FullName as ClientName,
        a.StudentID as AssignedStudentID, s.FullName as AssignedStudentName,
        count(allApps.ApplicationID) as ApplicationsCount,
        conv.ConversationID
      from Gigs g
      join Users c on c.UserID = g.ClientID
      left join Applications a on a.GigID = g.GigID and a.Status = 'accepted'
      left join Users s on s.UserID = a.StudentID
      left join Applications allApps on allApps.GigID = g.GigID
      left join Conversations conv on conv.GigID = g.GigID
      where (@status is null or g.Status = @status)
        and (@q is null or g.Title like @q or c.FullName like @q)
      group by
        g.GigID, g.Title, g.Description, g.Budget, g.Deadline, g.Category,
        g.RequiredSkills, g.Status, g.CreatedAt, c.UserID, c.FullName,
        a.StudentID, s.FullName, conv.ConversationID
      order by g.CreatedAt desc
    `);
  return result.recordset;
};

const setGigRemoved = async (adminID, gigID, removed) => {
  const pool = await poolPromise;
  await pool.request()
    .input('gigID', sql.Int, gigID)
    .input('status', sql.NVarChar, removed ? 'removed' : 'open')
    .query(`update Gigs set Status = @status where GigID = @gigID`);
  await logAction({
    adminID,
    actionType: removed ? 'remove_gig' : 'restore_gig',
    targetType: 'gig',
    targetID: gigID,
    description: removed ? 'Removed gig from platform listings.' : 'Restored gig to open status.',
  });
};

const listApplications = async ({ status, q }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('status', sql.NVarChar, status || null)
    .input('q', sql.NVarChar, q ? `%${q}%` : null)
    .query(`
      select
        a.ApplicationID, a.GigID, a.StudentID, a.CoverLetter, a.MatchScore,
        a.Status, a.AppliedAt,
        g.Title as GigTitle, g.ClientID,
        student.FullName as StudentName,
        client.FullName as ClientName,
        sp.PortfolioURL
      from Applications a
      join Gigs g on g.GigID = a.GigID
      join Users student on student.UserID = a.StudentID
      join Users client on client.UserID = g.ClientID
      left join StudentProfiles sp on sp.UserID = a.StudentID
      where (@status is null or a.Status = @status)
        and (@q is null or g.Title like @q or student.FullName like @q or client.FullName like @q)
      order by a.AppliedAt desc
    `);
  return result.recordset;
};

const listReports = async ({ status }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('status', sql.NVarChar, status || null)
    .query(`
      select
        r.ReportID, r.ReporterID, r.ReportedUserID, r.ReportedGigID, r.MessageID,
        r.Reason, r.Status, r.CreatedAt, r.ResolvedAt,
        reporter.FullName as ReporterName,
        reported.FullName as ReportedUserName,
        g.Title as GigTitle
      from Reports r
      join Users reporter on reporter.UserID = r.ReporterID
      left join Users reported on reported.UserID = r.ReportedUserID
      left join Gigs g on g.GigID = r.ReportedGigID
      where (@status is null or r.Status = @status)
      order by r.CreatedAt desc
    `);
  return result.recordset;
};

const resolveReport = async (adminID, reportID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('reportID', sql.Int, reportID)
    .query(`update Reports set Status = 'resolved', ResolvedAt = getdate() where ReportID = @reportID`);
  await logAction({
    adminID,
    actionType: 'resolve_report',
    targetType: 'report',
    targetID: reportID,
    description: 'Marked report as resolved.',
  });
};

const listReviews = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select
      r.ReviewID, r.GigID, r.ReviewerID, r.RevieweeID, r.Rating, r.Comment,
      r.CreatedAt, r.IsFlagged,
      reviewer.FullName as ReviewerName,
      reviewee.FullName as RevieweeName,
      g.Title as GigTitle
    from Reviews r
    join Users reviewer on reviewer.UserID = r.ReviewerID
    join Users reviewee on reviewee.UserID = r.RevieweeID
    join Gigs g on g.GigID = r.GigID
    order by r.CreatedAt desc
  `);
  return result.recordset;
};

const setReviewHidden = async (adminID, reviewID, hidden) => {
  const pool = await poolPromise;
  await pool.request()
    .input('reviewID', sql.Int, reviewID)
    .input('hidden', sql.Bit, hidden ? 1 : 0)
    .query(`update Reviews set IsFlagged = @hidden where ReviewID = @reviewID`);
  await logAction({
    adminID,
    actionType: hidden ? 'hide_review' : 'restore_review',
    targetType: 'review',
    targetID: reviewID,
    description: hidden ? 'Hidden review from public profile.' : 'Restored review visibility.',
  });
};

const hideMessage = async (adminID, messageID) => {
  const pool = await poolPromise;
  await pool.request()
    .input('messageID', sql.Int, messageID)
    .query(`update Messages set IsHidden = 1 where MessageID = @messageID`);
  await logAction({
    adminID,
    actionType: 'hide_message',
    targetType: 'message',
    targetID: messageID,
    description: 'Hidden abusive chat message.',
  });
};

const createReport = async ({ reporterID, reportedUserID, gigID, messageID, reason }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('reporterID', sql.Int, reporterID)
    .input('reportedUserID', sql.Int, reportedUserID || null)
    .input('gigID', sql.Int, gigID || null)
    .input('messageID', sql.Int, messageID || null)
    .input('reason', sql.NVarChar, reason)
    .query(`
      insert into Reports (ReporterID, ReportedUserID, ReportedGigID, MessageID, Reason)
      output inserted.ReportID
      values (@reporterID, @reportedUserID, @gigID, @messageID, @reason)
    `);
  return result.recordset[0].ReportID;
};

const getWalletOverview = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select
      (select coalesce(sum(total_earned_tokens), 0) from user_wallets) as TotalTokensIssued,
      (select coalesce(sum(total_spent_tokens), 0) from user_wallets) as TotalTokensSpent,
      (select coalesce(sum(price_pkr), 0) from token_purchases where status = 'paid_demo') as TotalDemoRevenuePKR,
      (select count(*) from user_wallets where balance_tokens <= 1000) as LowBalanceUsers
  `);
  const top = await pool.request().query(`
    select top 8 u.UserID, u.FullName, u.Role, w.balance_tokens, w.current_plan, w.total_spent_tokens
    from user_wallets w
    join Users u on u.UserID = w.user_id
    order by w.total_spent_tokens desc
  `);
  return { summary: result.recordset[0], topSpenders: top.recordset };
};

const listWallets = async ({ role, q }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('role', sql.NVarChar, role || null)
    .input('q', sql.NVarChar, q ? `%${q}%` : null)
    .query(`
      select
        u.UserID, u.FullName, u.Email, u.Role,
        w.id as WalletID, w.balance_tokens, w.current_plan, w.total_earned_tokens, w.total_spent_tokens, w.updated_at
      from Users u
      join user_wallets w on w.user_id = u.UserID
      where u.Role in ('student', 'client')
        and (@role is null or u.Role = @role)
        and (@q is null or u.FullName like @q or u.Email like @q)
      order by w.balance_tokens asc, u.FullName asc
    `);
  return result.recordset;
};

const listTokenPurchases = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select top 200 p.*, u.FullName, u.Email, u.Role
    from token_purchases p
    join Users u on u.UserID = p.user_id
    order by p.created_at desc, p.id desc
  `);
  return result.recordset;
};

const listTokenTransactions = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    select top 300 t.*, u.FullName, u.Email, u.Role
    from token_transactions t
    join Users u on u.UserID = t.user_id
    order by t.created_at desc, t.id desc
  `);
  return result.recordset;
};

const adjustWallet = async (adminID, userID, amount, reason) => {
  const pool = await poolPromise;
  const txn = new sql.Transaction(pool);
  await txn.begin();
  try {
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
    const nextBalance = Number(wallet.balance_tokens) + Number(amount);
    if (nextBalance < 0) throw { status: 400, message: 'wallet balance cannot go below 0.' };

    await txn.request()
      .input('walletID', sql.Int, wallet.id)
      .input('userID', sql.Int, userID)
      .input('amount', sql.Int, Math.abs(Number(amount)))
      .input('signedAmount', sql.Int, Number(amount))
      .input('balanceAfter', sql.Int, nextBalance)
      .input('reason', sql.NVarChar, reason)
      .query(`
        update user_wallets
        set balance_tokens = @balanceAfter,
            total_earned_tokens = case when @signedAmount > 0 then total_earned_tokens + @signedAmount else total_earned_tokens end,
            total_spent_tokens = case when @signedAmount < 0 then total_spent_tokens + abs(@signedAmount) else total_spent_tokens end,
            updated_at = getdate()
        where id = @walletID;

        insert into token_transactions (user_id, wallet_id, type, amount_tokens, balance_after, reason, reference_type, reference_id)
        values (@userID, @walletID, 'adjustment', @amount, @balanceAfter, @reason, 'admin_adjustment', @walletID);
      `);

    await txn.commit();
    await logAction({
      adminID,
      actionType: 'adjust_tokens',
      targetType: 'wallet',
      targetID: wallet.id,
      description: `Adjusted wallet by ${amount} tokens. Reason: ${reason}`,
    });
  } catch (err) {
    await txn.rollback();
    throw err;
  }
};

module.exports = {
  logAction,
  getStats,
  getRecentActivity,
  listUsers,
  setUserBan,
  listGigs,
  setGigRemoved,
  listApplications,
  listReports,
  resolveReport,
  listReviews,
  setReviewHidden,
  hideMessage,
  createReport,
  getWalletOverview,
  listWallets,
  listTokenPurchases,
  listTokenTransactions,
  adjustWallet,
};
