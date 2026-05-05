const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/verifyTokens');
const { roleGuard } = require('../../middleware/roleGuard');
const controller = require('./adminController');

router.post('/reports', verifyToken, controller.createReport);

router.use(verifyToken, roleGuard('admin'));

router.get('/stats', controller.stats);
router.get('/users', controller.users);
router.patch('/users/:id/ban', controller.ban);
router.patch('/users/:id/unban', controller.unban);
router.get('/gigs', controller.gigs);
router.patch('/gigs/:id/remove', controller.removeGig);
router.patch('/gigs/:id/restore', controller.restoreGig);
router.get('/applications', controller.applications);
router.get('/conversations', controller.conversations);
router.get('/conversations/:id/messages', controller.messages);
router.patch('/messages/:id/hide', controller.hideMessage);
router.get('/reports', controller.reports);
router.patch('/reports/:id/resolve', controller.resolveReport);
router.get('/reviews', controller.reviews);
router.patch('/reviews/:id/hide', controller.hideReview);
router.patch('/reviews/:id/restore', controller.restoreReview);

module.exports = router;
