const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/dbMigrationController');

// Strict Platform Administrator authorization check
const platformAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const allowedRoles = ['platform_admin', 'super_admin', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Platform Administrator authorization required to access Database Migration services.'
    });
  }

  next();
};

// Rate limiter for connection test and migration trigger endpoints
const migrationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 requests per minute
  message: { success: false, message: 'Too many database operations requested. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

// All routes are strictly protected
router.use(protect);
router.use(platformAdminOnly);

// Overview
router.get('/overview', controller.getOverview);

// Connections
router.post('/connections/test', migrationLimiter, controller.testConnection);
router.post('/connections/save', migrationLimiter, controller.saveConnection);
router.get('/connections', controller.getConnections);
router.delete('/connections/:target', controller.clearConnection);

// Inspection & Comparison
router.get('/inspect/:target', controller.inspectDatabase);
router.get('/compare', controller.compareDatabases);

// Preview & Planning
router.post('/preview', controller.previewMigration);

// Migration Lifecycle & Live Stream
router.post('/start', migrationLimiter, controller.startMigration);
router.post('/pause', controller.pauseMigration);
router.post('/resume', controller.resumeMigration);
router.post('/cancel', controller.cancelMigration);
router.get('/status', controller.getStatus);
router.get('/stream', controller.streamProgress);

// Verification & History
router.post('/verify', controller.verifyMigration);
router.get('/history', controller.getHistory);
router.get('/history/:migrationId', controller.getHistoryDetails);
router.get('/history/:migrationId/logs', controller.getMigrationLogs);
router.delete('/history/:migrationId', controller.deleteHistory);

module.exports = router;

