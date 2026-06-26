const Role = require('../models/Role');

// Role-based check
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (req.user.role === 'platform_admin' || req.user.role === 'admin' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: Insufficient role permissions' });
  };
};

// Permission-based check
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Platform Admin and legacy Admin have full access to everything
    if (req.user.role === 'platform_admin' || req.user.role === 'admin') {
      return next();
    }

    // Check if user has permission
    if (req.user.permissions && req.user.permissions.includes(requiredPermission)) {
      return next();
    }

    return res.status(403).json({ message: `Forbidden: Missing required permission: ${requiredPermission}` });
  };
};

module.exports = {
  requireRole,
  requirePermission
};
