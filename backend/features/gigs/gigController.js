// features/gigs/gigController.js

const {
  getAllOpenGigs, getMatchedGigs, getGigByID, getGigsByClient,
  createGig, updateGig, updateGigStatus, deleteGig,
  getApplicationsByGig, getApplicationsByStudent,
  computeMatchScore, applyToGig, hasApplied,
  acceptApplication, withdrawApplication,
  submitWork, markComplete, requestRevision, getGigWorkDetail,
} = require('./gigModel');

const { findUserByEmail } = require('../auth/authModel');
const { admin }           = require('../../config/firebase');

const VALID_CATEGORIES = ['Development', 'Design', 'Writing', 'Data', 'Marketing', 'Video', 'Other'];

// ─── HELPER ───────────────────────────────────────────────────────────────────
const getVerifiedUser = async (req) => {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.split(' ')[1];
  if (!token) throw { status: 401, message: 'firebase token required.' };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    throw { status: 401, message: 'invalid or expired token.' };
  }

  if (!decoded.email_verified) {
    throw { status: 403, message: 'please verify your email first.' };
  }

  const user = await findUserByEmail(decoded.email);
  if (!user)         throw { status: 404, message: 'user not found.' };
  if (user.IsBanned) throw { status: 403, message: 'account suspended.' };
  return user;
};

// ─── GET /api/gigs ─────────────────────────────────────────────────────────────
const listOpenGigs = async (req, res) => {
  try {
    const gigs = await getAllOpenGigs();
    res.json({ gigs });
  } catch (err) {
    console.error('listOpenGigs error:', err.message);
    res.status(500).json({ error: 'could not fetch gigs.' });
  }
};

// ─── GET /api/gigs/matched ─────────────────────────────────────────────────────
const listMatchedGigs = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'student') return res.status(403).json({ error: 'students only.' });
    const gigs = await getMatchedGigs(user.UserID);
    res.json({ gigs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('listMatchedGigs error:', err.message);
    res.status(500).json({ error: 'could not fetch matched gigs.' });
  }
};

// ─── GET /api/gigs/my ──────────────────────────────────────────────────────────
const listMyGigs = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });
    const gigs = await getGigsByClient(user.UserID);
    res.json({ gigs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('listMyGigs error:', err.message);
    res.status(500).json({ error: 'could not fetch your gigs.' });
  }
};

// ─── GET /api/gigs/:id ─────────────────────────────────────────────────────────
const getGig = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'invalid gig id.' });
    const gig = await getGigByID(id);
    if (!gig) return res.status(404).json({ error: 'gig not found.' });
    res.json({ gig });
  } catch (err) {
    console.error('getGig error:', err.message);
    res.status(500).json({ error: 'could not fetch gig.' });
  }
};

// ─── POST /api/gigs ────────────────────────────────────────────────────────────
const postGig = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const { title, description, budget, deadline, category, requiredSkills } = req.body;

    if (!title || title.trim().length < 5) {
      return res.status(400).json({ error: 'title must be at least 5 characters.' });
    }
    if (!deadline) {
      return res.status(400).json({ error: 'deadline is required.' });
    }
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      return res.status(400).json({ error: 'deadline must be a future date.' });
    }
    if (budget !== undefined && budget !== '' && (isNaN(budget) || parseFloat(budget) < 0)) {
      return res.status(400).json({ error: 'budget must be a positive number.' });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
    }

    const gigID = await createGig({
      clientID:       user.UserID,
      title:          title.trim(),
      description:    description?.trim() || null,
      budget:         budget ? parseFloat(budget) : null,
      deadline,
      category:       category || null,
      requiredSkills: requiredSkills?.trim() || null,
    });

    res.status(201).json({ message: 'gig posted successfully.', gigID });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('postGig error:', err.message);
    res.status(500).json({ error: 'could not post gig.' });
  }
};

// ─── PUT /api/gigs/:id ─────────────────────────────────────────────────────────
const editGig = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const { title, description, budget, deadline, category, requiredSkills } = req.body;

    if (!title || title.trim().length < 5) {
      return res.status(400).json({ error: 'title must be at least 5 characters.' });
    }
    if (deadline) {
      const d = new Date(deadline);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return res.status(400).json({ error: 'deadline must be a future date.' });
      }
    }
    if (budget !== undefined && budget !== '' && (isNaN(budget) || parseFloat(budget) < 0)) {
      return res.status(400).json({ error: 'budget must be a positive number.' });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
    }

    const rows = await updateGig(gigID, user.UserID, {
      title: title.trim(), description, budget, deadline, category, requiredSkills,
    });

    if (!rows) return res.status(404).json({ error: 'gig not found, not yours, or cannot be edited.' });
    res.json({ message: 'gig updated.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('editGig error:', err.message);
    res.status(500).json({ error: 'could not update gig.' });
  }
};

// ─── PATCH /api/gigs/:id/status ────────────────────────────────────────────────
// pause   : open       -> paused     (reversible, hides from students)
// resume  : paused     -> open       (makes visible again)
// cancel  : open/paused/in_progress -> cancelled (permanent close)
const changeGigStatus = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const { status } = req.body;
    const allowed = ['paused', 'open', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}.` });
    }

    // verify the gig belongs to this client
    const gig = await getGigByID(gigID);
    if (!gig)                         return res.status(404).json({ error: 'gig not found.' });
    if (gig.ClientID !== user.UserID) return res.status(403).json({ error: 'not your gig.' });

    // prevent invalid transitions
    if (status === 'paused'    && gig.Status !== 'open')    return res.status(400).json({ error: 'only open gigs can be paused.' });
    if (status === 'open'      && gig.Status !== 'paused')  return res.status(400).json({ error: 'only paused gigs can be resumed.' });
    if (status === 'cancelled' && ['completed', 'cancelled'].includes(gig.Status)) {
      return res.status(400).json({ error: 'this gig cannot be closed.' });
    }

    const rows = await updateGigStatus(gigID, user.UserID, status);
    if (!rows) return res.status(404).json({ error: 'could not update gig status.' });

    const messages = {
      paused:    'gig paused. it is now hidden from students.',
      open:      'gig resumed. students can apply again.',
      cancelled: 'gig closed permanently.',
    };

    res.json({ message: messages[status] });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('changeGigStatus error:', err.message);
    res.status(500).json({ error: 'could not update gig status.' });
  }
};

// ─── DELETE /api/gigs/:id ──────────────────────────────────────────────────────
// hard delete — only allowed on open or paused gigs with no accepted applicant
const removeGig = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const gig = await getGigByID(gigID);
    if (!gig)                         return res.status(404).json({ error: 'gig not found.' });
    if (gig.ClientID !== user.UserID) return res.status(403).json({ error: 'not your gig.' });

    if (!['open', 'paused'].includes(gig.Status)) {
      return res.status(400).json({ error: 'only open or paused gigs can be permanently deleted.' });
    }

    const deleted = await deleteGig(gigID, user.UserID);
    if (!deleted) return res.status(400).json({ error: 'cannot delete a gig that already has an accepted applicant.' });

    res.json({ message: 'gig permanently deleted.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('removeGig error:', err.message);
    res.status(500).json({ error: 'could not delete gig.' });
  }
};

// ─── GET /api/gigs/:id/applications ───────────────────────────────────────────
const listApplications = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const gig = await getGigByID(gigID);
    if (!gig)                         return res.status(404).json({ error: 'gig not found.' });
    if (gig.ClientID !== user.UserID) return res.status(403).json({ error: 'not your gig.' });

    const applications = await getApplicationsByGig(gigID);
    res.json({ applications });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('listApplications error:', err.message);
    res.status(500).json({ error: 'could not fetch applications.' });
  }
};

// ─── GET /api/gigs/applications/mine ──────────────────────────────────────────
const myApplications = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'student') return res.status(403).json({ error: 'students only.' });
    const applications = await getApplicationsByStudent(user.UserID);
    res.json({ applications });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('myApplications error:', err.message);
    res.status(500).json({ error: 'could not fetch your applications.' });
  }
};

// ─── POST /api/gigs/:id/apply ─────────────────────────────────────────────────
const apply = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'student') return res.status(403).json({ error: 'students only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const gig = await getGigByID(gigID);
    if (!gig)                  return res.status(404).json({ error: 'gig not found.' });
    if (gig.Status !== 'open') return res.status(400).json({ error: 'this gig is no longer accepting applications.' });

    const alreadyApplied = await hasApplied(gigID, user.UserID);
    if (alreadyApplied) return res.status(409).json({ error: 'you already applied to this gig.' });

    const { coverLetter, applicationMessage } = req.body;
    const matchScore = await computeMatchScore(gigID, user.UserID);

    const applied = await applyToGig({
      gigID,
      studentID:   user.UserID,
      coverLetter: coverLetter || null,
      applicationMessage: applicationMessage || coverLetter || null,
      matchScore,
    });

    res.status(201).json({
      message: 'application submitted and message request created.',
      applicationID: applied.ApplicationID,
      conversationID: applied.ConversationID,
      matchScore,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('apply error:', err.message);
    res.status(500).json({ error: 'could not submit application.' });
  }
};

// ─── PATCH /api/gigs/applications/:appID/accept ───────────────────────────────
const accept = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const { gigID } = req.body;
    if (!gigID) return res.status(400).json({ error: 'gigID is required.' });

    const gig = await getGigByID(parseInt(gigID));
    if (!gig)                         return res.status(404).json({ error: 'gig not found.' });
    if (gig.ClientID !== user.UserID) return res.status(403).json({ error: 'not your gig.' });
    if (gig.Status !== 'open')        return res.status(400).json({ error: 'gig is no longer open.' });

    await acceptApplication(parseInt(req.params.appID), parseInt(gigID));
    res.json({ message: 'application accepted. gig is now in progress.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('accept error:', err.message);
    res.status(500).json({ error: 'could not accept application.' });
  }
};

// ─── PATCH /api/gigs/applications/:appID/withdraw ─────────────────────────────
const withdraw = async (req, res) => {
  try {
    const user = await getVerifiedUser(req);
    if (user.Role !== 'student') return res.status(403).json({ error: 'students only.' });
    await withdrawApplication(parseInt(req.params.appID), user.UserID);
    res.json({ message: 'application withdrawn.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('withdraw error:', err.message);
    res.status(500).json({ error: 'could not withdraw application.' });
  }
};

// ─── PATCH /api/gigs/:id/submit ───────────────────────────────────────────────
// Student submits work — moves gig from in_progress / revision -> submitted
const submitGigWork = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'student') return res.status(403).json({ error: 'students only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const { submissionURL, submissionNote } = req.body;
    await submitWork(gigID, user.UserID, { submissionURL, submissionNote });
    res.json({ message: 'work submitted successfully. awaiting client review.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('submitGigWork error:', err.message);
    res.status(500).json({ error: 'could not submit work.' });
  }
};

// ─── PATCH /api/gigs/:id/complete ─────────────────────────────────────────────
// Client marks gig as completed — submitted -> completed, sets CompletedAt
const completeGig = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    await markComplete(gigID, user.UserID);
    res.json({ message: 'gig marked as completed. both parties can now leave a review.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('completeGig error:', err.message);
    res.status(500).json({ error: 'could not complete gig.' });
  }
};

// ─── PATCH /api/gigs/:id/revision ─────────────────────────────────────────────
// Client requests a revision — submitted -> revision, stores feedback note
const revisionGig = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    if (user.Role !== 'client') return res.status(403).json({ error: 'clients only.' });

    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const { revisionNote } = req.body;
    await requestRevision(gigID, user.UserID, revisionNote);
    res.json({ message: 'revision requested. student has been notified.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('revisionGig error:', err.message);
    res.status(500).json({ error: 'could not request revision.' });
  }
};

// ─── GET /api/gigs/:id/work ───────────────────────────────────────────────────
// Both student and client — fetch submission details for a gig
const getWorkDetail = async (req, res) => {
  try {
    const user  = await getVerifiedUser(req);
    const gigID = parseInt(req.params.id);
    if (isNaN(gigID)) return res.status(400).json({ error: 'invalid gig id.' });

    const detail = await getGigWorkDetail(gigID);
    if (!detail) return res.status(404).json({ error: 'gig not found or no accepted applicant.' });

    // only the client who owns it or the assigned student can view
    const gig = await getGigByID(gigID);
    const isClient  = user.Role === 'client'  && gig.ClientID  === user.UserID;
    const isStudent = user.Role === 'student' && detail.StudentID === user.UserID;
    if (!isClient && !isStudent) return res.status(403).json({ error: 'not authorized.' });

    res.json({ detail });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('getWorkDetail error:', err.message);
    res.status(500).json({ error: 'could not fetch work detail.' });
  }
};

module.exports = {
  listOpenGigs, listMatchedGigs, listMyGigs, getGig,
  postGig, editGig, changeGigStatus, removeGig,
  listApplications, myApplications,
  apply, accept, withdraw,
  submitGigWork, completeGig, revisionGig, getWorkDetail,
};
