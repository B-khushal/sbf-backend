const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  // Handle both user object and user ID
  const payload = {
    id: user._id || user.id,
    role: user.role,
    email: user.email
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;