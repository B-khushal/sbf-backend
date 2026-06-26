const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - authentication
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Check if session has been revoked
      const session = req.user.login_history.find(s => s.token === token);
      if (session && session.status === 'revoked') {
        return res.status(401).json({ message: 'Not authorized, session has been revoked' });
      }

      // Compile permissions by merging role and custom permissions
      let mergedPermissions = [...(req.user.permissions || [])];
      if (req.user.role) {
        try {
          const Role = require('../models/Role');
          const roleDoc = await Role.findOne({ code: req.user.role });
          if (roleDoc && roleDoc.permissions) {
            mergedPermissions = [...new Set([...mergedPermissions, ...roleDoc.permissions])];
          }
        } catch (roleError) {
          console.error('Error loading role permissions in auth middleware:', roleError);
        }
      }
      req.user.permissions = mergedPermissions;

      next();
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Admin-only middleware
const admin = (req, res, next) => {
  const allowedAdminRoles = ['platform_admin', 'store_owner', 'store_manager', 'delivery_manager', 'support_staff', 'inventory_staff', 'finance_staff', 'admin'];
  if (req.user && allowedAdminRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

// Admin or Vendor middleware
const adminOrVendor = (req, res, next) => {
  const allowedAdminRoles = ['platform_admin', 'store_owner', 'store_manager', 'delivery_manager', 'support_staff', 'inventory_staff', 'finance_staff', 'admin'];
  if (req.user && (allowedAdminRoles.includes(req.user.role) || req.user.role === 'vendor')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized. Admin or vendor access required.' });
  }
};

// Optional authentication middleware - attaches user if token is valid but never blocks request.
const optionalProtect = async (req, res, next) => {
  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // Intentionally ignore invalid token for optional auth routes.
  }

  next();
};

module.exports = { protect, admin, adminOrVendor, optionalProtect };