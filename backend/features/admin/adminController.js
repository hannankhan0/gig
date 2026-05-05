const adminModel = require('./adminModel');
const chatModel = require('../chat/chatModel');

const ok = (res, data) => res.json(data);

const stats = async (req, res) => {
  try {
    const [summary, activity, users, gigs, reports] = await Promise.all([
      adminModel.getStats(),
      adminModel.getRecentActivity(),
      adminModel.listUsers({}),
      adminModel.listGigs({}),
      adminModel.listReports({ status: 'pending' }),
    ]);
    ok(res, {
      stats: summary,
      activity,
      recentUsers: users.slice(0, 6),
      recentGigs: gigs.slice(0, 6),
      recentReports: reports.slice(0, 6),
    });
  } catch (err) {
    console.error('admin stats error:', err.message);
    res.status(500).json({ error: 'could not load admin stats.' });
  }
};

const users = async (req, res) => {
  try {
    ok(res, { users: await adminModel.listUsers(req.query) });
  } catch (err) {
    console.error('admin users error:', err.message);
    res.status(500).json({ error: 'could not load users.' });
  }
};

const ban = async (req, res) => {
  try {
    await adminModel.setUserBan(req.user.id, Number(req.params.id), true);
    ok(res, { message: 'user banned.' });
  } catch (err) {
    console.error('ban user error:', err.message);
    res.status(500).json({ error: 'could not ban user.' });
  }
};

const unban = async (req, res) => {
  try {
    await adminModel.setUserBan(req.user.id, Number(req.params.id), false);
    ok(res, { message: 'user unbanned.' });
  } catch (err) {
    console.error('unban user error:', err.message);
    res.status(500).json({ error: 'could not unban user.' });
  }
};

const gigs = async (req, res) => {
  try {
    ok(res, { gigs: await adminModel.listGigs(req.query) });
  } catch (err) {
    console.error('admin gigs error:', err.message);
    res.status(500).json({ error: 'could not load gigs.' });
  }
};

const removeGig = async (req, res) => {
  try {
    await adminModel.setGigRemoved(req.user.id, Number(req.params.id), true);
    ok(res, { message: 'gig removed.' });
  } catch (err) {
    console.error('remove gig error:', err.message);
    res.status(500).json({ error: 'could not remove gig.' });
  }
};

const restoreGig = async (req, res) => {
  try {
    await adminModel.setGigRemoved(req.user.id, Number(req.params.id), false);
    ok(res, { message: 'gig restored.' });
  } catch (err) {
    console.error('restore gig error:', err.message);
    res.status(500).json({ error: 'could not restore gig.' });
  }
};

const applications = async (req, res) => {
  try {
    ok(res, { applications: await adminModel.listApplications(req.query) });
  } catch (err) {
    console.error('admin applications error:', err.message);
    res.status(500).json({ error: 'could not load applications.' });
  }
};

const conversations = async (req, res) => {
  try {
    ok(res, { conversations: await chatModel.listConversations(req.user) });
  } catch (err) {
    console.error('admin conversations error:', err.message);
    res.status(500).json({ error: 'could not load conversations.' });
  }
};

const messages = async (req, res) => {
  try {
    ok(res, { messages: await chatModel.listMessages(Number(req.params.id)) });
  } catch (err) {
    console.error('admin messages error:', err.message);
    res.status(500).json({ error: 'could not load messages.' });
  }
};

const hideMessage = async (req, res) => {
  try {
    await adminModel.hideMessage(req.user.id, Number(req.params.id));
    ok(res, { message: 'message hidden.' });
  } catch (err) {
    console.error('hide message error:', err.message);
    res.status(500).json({ error: 'could not hide message.' });
  }
};

const reports = async (req, res) => {
  try {
    ok(res, { reports: await adminModel.listReports(req.query) });
  } catch (err) {
    console.error('admin reports error:', err.message);
    res.status(500).json({ error: 'could not load reports.' });
  }
};

const resolveReport = async (req, res) => {
  try {
    await adminModel.resolveReport(req.user.id, Number(req.params.id));
    ok(res, { message: 'report resolved.' });
  } catch (err) {
    console.error('resolve report error:', err.message);
    res.status(500).json({ error: 'could not resolve report.' });
  }
};

const reviews = async (req, res) => {
  try {
    ok(res, { reviews: await adminModel.listReviews() });
  } catch (err) {
    console.error('admin reviews error:', err.message);
    res.status(500).json({ error: 'could not load reviews.' });
  }
};

const hideReview = async (req, res) => {
  try {
    await adminModel.setReviewHidden(req.user.id, Number(req.params.id), true);
    ok(res, { message: 'review hidden.' });
  } catch (err) {
    console.error('hide review error:', err.message);
    res.status(500).json({ error: 'could not hide review.' });
  }
};

const restoreReview = async (req, res) => {
  try {
    await adminModel.setReviewHidden(req.user.id, Number(req.params.id), false);
    ok(res, { message: 'review restored.' });
  } catch (err) {
    console.error('restore review error:', err.message);
    res.status(500).json({ error: 'could not restore review.' });
  }
};

const createReport = async (req, res) => {
  try {
    const { reportedUserID, gigID, messageID, reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'reason is required.' });
    const reportID = await adminModel.createReport({
      reporterID: req.user.id,
      reportedUserID: reportedUserID ? Number(reportedUserID) : null,
      gigID: gigID ? Number(gigID) : null,
      messageID: messageID ? Number(messageID) : null,
      reason: reason.trim(),
    });
    res.status(201).json({ reportID });
  } catch (err) {
    console.error('create report error:', err.message);
    res.status(500).json({ error: 'could not create report.' });
  }
};

module.exports = {
  stats,
  users,
  ban,
  unban,
  gigs,
  removeGig,
  restoreGig,
  applications,
  conversations,
  messages,
  hideMessage,
  reports,
  resolveReport,
  reviews,
  hideReview,
  restoreReview,
  createReport,
};
