const chatModel = require('./chatModel');
const { sql, poolPromise } = require('../../config/db');

const canView = (conversation, user) => (
  user.role === 'admin' ||
  Number(conversation.StudentID) === Number(user.id) ||
  Number(conversation.ClientID) === Number(user.id)
);

const listConversations = async (req, res) => {
  try {
    const conversations = await chatModel.listConversations(req.user);
    res.json({ conversations });
  } catch (err) {
    console.error('listConversations error:', err.message);
    res.status(500).json({ error: 'could not fetch conversations.' });
  }
};

const createConversation = async (req, res) => {
  try {
    if (!['student', 'client'].includes(req.user.role)) {
      return res.status(403).json({ error: 'only students and clients can start conversations.' });
    }

    const { studentID, clientID, gigID } = req.body;
    const parsedStudentID = Number(studentID);
    const parsedClientID = Number(clientID);
    const parsedGigID = gigID ? Number(gigID) : null;

    if (!parsedStudentID || !parsedClientID) {
      return res.status(400).json({ error: 'studentID and clientID are required.' });
    }
    if (req.user.role === 'student' && req.user.id !== parsedStudentID) {
      return res.status(403).json({ error: 'students can only create their own conversations.' });
    }
    if (req.user.role === 'client' && req.user.id !== parsedClientID) {
      return res.status(403).json({ error: 'clients can only create their own conversations.' });
    }

    const pool = await poolPromise;
    const check = await pool.request()
      .input('studentID', sql.Int, parsedStudentID)
      .input('clientID', sql.Int, parsedClientID)
      .query(`
        select
          (select Role from Users where UserID = @studentID) as StudentRole,
          (select Role from Users where UserID = @clientID) as ClientRole
      `);
    const roles = check.recordset[0];
    if (roles.StudentRole !== 'student' || roles.ClientRole !== 'client') {
      return res.status(400).json({ error: 'conversation must be between a student and a client.' });
    }

    const conversationID = await chatModel.createOrGetConversation({
      studentID: parsedStudentID,
      clientID: parsedClientID,
      gigID: parsedGigID,
    });
    res.status(201).json({ conversationID });
  } catch (err) {
    console.error('createConversation error:', err.message);
    res.status(500).json({ error: 'could not create conversation.' });
  }
};

const listMessages = async (req, res) => {
  try {
    const conversationID = Number(req.params.id);
    const conversation = await chatModel.getConversationByID(conversationID);
    if (!conversation) return res.status(404).json({ error: 'conversation not found.' });
    if (!canView(conversation, req.user)) return res.status(403).json({ error: 'not authorized.' });

    const messages = await chatModel.listMessages(conversationID, req.user);
    res.json({ conversation, messages });
  } catch (err) {
    console.error('listMessages error:', err.message);
    res.status(500).json({ error: 'could not fetch messages.' });
  }
};

const sendMessage = async (req, res) => {
  try {
    if (!['student', 'client'].includes(req.user.role)) {
      return res.status(403).json({ error: 'admin cannot send chat messages.' });
    }
    const conversationID = Number(req.params.id);
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required.' });
    if (message.trim().length > 2000) return res.status(400).json({ error: 'message is too long.' });

    const conversation = await chatModel.getConversationByID(conversationID);
    if (!conversation) return res.status(404).json({ error: 'conversation not found.' });
    if (!canView(conversation, req.user)) return res.status(403).json({ error: 'not authorized.' });
    if ((conversation.ConversationStatus || 'active') === 'request' && req.user.role === 'client') {
      return res.status(403).json({ error: 'accept this message request before replying.' });
    }

    const receiverID = Number(conversation.StudentID) === Number(req.user.id)
      ? conversation.ClientID
      : conversation.StudentID;

    const messageID = await chatModel.createMessage({
      conversationID,
      senderID: req.user.id,
      receiverID,
      body: message.trim(),
    });
    res.status(201).json({ messageID });
  } catch (err) {
    console.error('sendMessage error:', err.message);
    res.status(500).json({ error: 'could not send message.' });
  }
};

const acceptMessageRequest = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'only the client can accept a message request.' });
    }

    const conversationID = Number(req.params.id);
    const conversation = await chatModel.getConversationByID(conversationID);
    if (!conversation) return res.status(404).json({ error: 'conversation not found.' });
    if (Number(conversation.ClientID) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'not authorized.' });
    }
    if ((conversation.ConversationStatus || 'active') === 'active') {
      return res.json({ message: 'message request already accepted.' });
    }

    const rows = await chatModel.acceptMessageRequest(conversationID, req.user.id);
    if (!rows) return res.status(404).json({ error: 'message request not found.' });
    res.json({ message: 'message request accepted.' });
  } catch (err) {
    console.error('acceptMessageRequest error:', err.message);
    res.status(500).json({ error: 'could not accept message request.' });
  }
};

const markRead = async (req, res) => {
  try {
    const rows = await chatModel.markMessageRead(Number(req.params.id), req.user.id);
    if (!rows) return res.status(404).json({ error: 'message not found for this user.' });
    res.json({ message: 'message marked as read.' });
  } catch (err) {
    console.error('markRead error:', err.message);
    res.status(500).json({ error: 'could not mark message read.' });
  }
};

module.exports = {
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  acceptMessageRequest,
  markRead,
};
