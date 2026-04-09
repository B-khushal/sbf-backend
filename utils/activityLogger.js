const ActivityLog = require('../models/ActivityLog');

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
};

const logActivity = async ({
  req,
  userId = null,
  userName = '',
  email = '',
  actionType,
  url,
  method = 'GET',
  status = 'Success',
  sessionId = '',
  metadata = {},
}) => {
  if (!actionType) {
    return null;
  }

  const requestUser = req?.user;

  const payload = {
    userId: userId || requestUser?._id || null,
    userName: userName || requestUser?.name || '',
    email: email || requestUser?.email || '',
    actionType,
    url: url || req?.originalUrl || req?.url || '',
    method: (method || req?.method || 'GET').toUpperCase(),
    ipAddress: getClientIp(req),
    device: req?.headers['user-agent'] || '',
    status: status === 'Failed' ? 'Failed' : 'Success',
    sessionId: sessionId || req?.headers['x-session-id'] || req?.body?.sessionId || '',
    metadata,
    timestamp: new Date(),
  };

  try {
    return await ActivityLog.create(payload);
  } catch (error) {
    console.error('Activity log write failed:', error.message);
    return null;
  }
};

module.exports = {
  logActivity,
};
