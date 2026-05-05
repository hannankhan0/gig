const express = require('express');
const router  = express.Router();
const {
  listOpenGigs, listMatchedGigs, listMyGigs, getGig,
  postGig, editGig, changeGigStatus, removeGig,
  listApplications, myApplications,
  apply, accept, withdraw,
  submitGigWork, completeGig, revisionGig, getWorkDetail,
} = require('./gigController');

// NOTE: specific string routes must come before :id param routes

router.get('/matched',           listMatchedGigs);
router.get('/my',                listMyGigs);
router.get('/applications/mine', myApplications);
router.get('/',                  listOpenGigs);
router.get('/:id',               getGig);

router.post('/',            postGig);
router.put('/:id',          editGig);
router.patch('/:id/status', changeGigStatus);  // pause / resume / cancel
router.delete('/:id',       removeGig);        // permanent delete

router.get('/:id/applications',               listApplications);
router.post('/:id/apply',                     apply);
router.patch('/applications/:appID/accept',   accept);
router.patch('/applications/:appID/withdraw', withdraw);

// ── US-12: Gig Status Management ──────────────────────────────────────────────
router.get('/:id/work',       getWorkDetail);   // both parties — fetch submission info
router.patch('/:id/submit',   submitGigWork);   // student — submit work link
router.patch('/:id/complete', completeGig);     // client  — mark as completed
router.patch('/:id/revision', revisionGig);     // client  — request revision

module.exports = router;