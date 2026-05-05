const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/verifyTokens');
const controller = require('./chatController');

router.use(verifyToken);

router.get('/conversations', controller.listConversations);
router.post('/conversations', controller.createConversation);
router.patch('/conversations/:id/accept-request', controller.acceptMessageRequest);
router.get('/conversations/:id/messages', controller.listMessages);
router.post('/conversations/:id/messages', controller.sendMessage);
router.patch('/messages/:id/read', controller.markRead);

module.exports = router;
