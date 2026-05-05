const { sql, poolPromise } = require('../../config/db');

const conversationSelect = `
  select
    c.ConversationID, c.GigID, c.StudentID, c.ClientID, c.CreatedAt, c.UpdatedAt,
    coalesce(c.ConversationStatus, 'active') as ConversationStatus,
    c.RequestAcceptedAt,
    a.Status as ApplicationStatus,
    s.FullName as StudentName, s.ProfilePic as StudentPic,
    cl.FullName as ClientName, cl.ProfilePic as ClientPic,
    g.Title as GigTitle,
    lm.MessageID as LatestMessageID,
    case
      when coalesce(c.ConversationStatus, 'active') = 'request'
       and c.ClientID = @currentUserID
       and @currentUserRole <> 'admin'
      then null
      else lm.Body
    end as LatestMessage,
    lm.SentAt as LatestMessageAt,
    lm.SenderID as LatestSenderID,
    coalesce(unread.UnreadCount, 0) as UnreadCount
  from Conversations c
  join Users s on s.UserID = c.StudentID
  join Users cl on cl.UserID = c.ClientID
  left join Gigs g on g.GigID = c.GigID
  left join Applications a on a.GigID = c.GigID and a.StudentID = c.StudentID
  outer apply (
    select top 1 MessageID, Body, SentAt, SenderID
    from Messages m
    where m.ConversationID = c.ConversationID and coalesce(m.IsHidden, 0) = 0
    order by m.SentAt desc
  ) lm
  outer apply (
    select count(*) as UnreadCount
    from Messages m
    where m.ConversationID = c.ConversationID
      and m.ReceiverID = @currentUserID
      and m.IsRead = 0
      and coalesce(m.IsHidden, 0) = 0
  ) unread
`;

const normalizeConversation = (row, currentUserID) => {
  const isStudent = Number(row.StudentID) === Number(currentUserID);
  const otherName = isStudent ? row.ClientName : row.StudentName;
  const otherPic = isStudent ? row.ClientPic : row.StudentPic;
  const otherRole = isStudent ? 'client' : 'student';
  return { ...row, OtherName: otherName, OtherPic: otherPic, OtherRole: otherRole };
};

const listConversations = async (user) => {
  const pool = await poolPromise;
  const req = pool.request()
    .input('currentUserID', sql.Int, user.id)
    .input('currentUserRole', sql.NVarChar, user.role);
  const where = user.role === 'admin'
    ? ''
    : 'where c.StudentID = @currentUserID or c.ClientID = @currentUserID';
  const result = await req.query(`${conversationSelect} ${where} order by c.UpdatedAt desc`);
  return result.recordset.map(row => normalizeConversation(row, user.id));
};

const getConversationByID = async (conversationID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('conversationID', sql.Int, conversationID)
    .query(`
      select c.*, g.Title as GigTitle
      from Conversations c
      left join Gigs g on g.GigID = c.GigID
      where c.ConversationID = @conversationID
    `);
  return result.recordset[0] || null;
};

const createOrGetConversation = async ({ studentID, clientID, gigID, status = 'active' }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('studentID', sql.Int, studentID)
    .input('clientID', sql.Int, clientID)
    .input('gigID', sql.Int, gigID || null)
    .input('status', sql.NVarChar, status)
    .query(`
      declare @ConversationID int;

      select top 1 @ConversationID = ConversationID
      from Conversations
      where StudentID = @studentID
        and ClientID = @clientID
        and (
          (@gigID is null and GigID is null)
          or GigID = @gigID
        );

      if @ConversationID is null
      begin
        insert into Conversations (GigID, StudentID, ClientID, ConversationStatus)
        values (@gigID, @studentID, @clientID, @status);
        set @ConversationID = scope_identity();
      end
      else if @status = 'active'
      begin
        update Conversations
        set ConversationStatus = 'active',
            RequestAcceptedAt = coalesce(RequestAcceptedAt, getdate()),
            UpdatedAt = getdate()
        where ConversationID = @ConversationID;
      end

      select @ConversationID as ConversationID;
    `);
  return result.recordset[0].ConversationID;
};

const listMessages = async (conversationID, user = null) => {
  const pool = await poolPromise;
  const conversation = user ? await getConversationByID(conversationID) : null;
  if (
    conversation &&
    user.role === 'client' &&
    Number(conversation.ClientID) === Number(user.id) &&
    (conversation.ConversationStatus || 'active') === 'request'
  ) {
    return [];
  }

  const result = await pool.request()
    .input('conversationID', sql.Int, conversationID)
    .query(`
      select
        m.MessageID, m.ConversationID, m.SenderID, m.ReceiverID,
        m.Body, m.IsRead, m.SentAt, coalesce(m.IsHidden, 0) as IsHidden,
        sender.FullName as SenderName, sender.Role as SenderRole,
        receiver.FullName as ReceiverName, receiver.Role as ReceiverRole
      from Messages m
      join Users sender on sender.UserID = m.SenderID
      join Users receiver on receiver.UserID = m.ReceiverID
      where m.ConversationID = @conversationID and coalesce(m.IsHidden, 0) = 0
      order by m.SentAt asc
    `);
  return result.recordset;
};

const createMessage = async ({ conversationID, senderID, receiverID, body }) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('conversationID', sql.Int, conversationID)
    .input('senderID', sql.Int, senderID)
    .input('receiverID', sql.Int, receiverID)
    .input('body', sql.NVarChar, body)
    .query(`
      insert into Messages (ConversationID, SenderID, ReceiverID, Body)
      output inserted.MessageID
      values (@conversationID, @senderID, @receiverID, @body);

      update Conversations set UpdatedAt = getdate() where ConversationID = @conversationID;
    `);
  return result.recordset[0].MessageID;
};

const acceptMessageRequest = async (conversationID, clientID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('conversationID', sql.Int, conversationID)
    .input('clientID', sql.Int, clientID)
    .query(`
      update Conversations
      set ConversationStatus = 'active',
          RequestAcceptedAt = coalesce(RequestAcceptedAt, getdate()),
          UpdatedAt = getdate()
      where ConversationID = @conversationID
        and ClientID = @clientID
        and coalesce(ConversationStatus, 'active') = 'request'
    `);
  return result.rowsAffected[0];
};

const markMessageRead = async (messageID, userID) => {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('messageID', sql.Int, messageID)
    .input('userID', sql.Int, userID)
    .query(`
      update Messages
      set IsRead = 1
      where MessageID = @messageID and ReceiverID = @userID
    `);
  return result.rowsAffected[0];
};

module.exports = {
  listConversations,
  getConversationByID,
  createOrGetConversation,
  listMessages,
  createMessage,
  acceptMessageRequest,
  markMessageRead,
};
