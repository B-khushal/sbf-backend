const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole, requirePermission } = require('../middleware/rbacMiddleware');

// Staff CRUD
router.get('/', protect, requirePermission('staff:view'), staffController.getStaff);
router.post('/', protect, requirePermission('staff:create'), staffController.createStaff);
router.put('/:id', protect, requirePermission('staff:edit'), staffController.updateStaff);
router.delete('/:id', protect, requirePermission('staff:delete'), staffController.deleteStaff);

// Roles & Permissions management
router.get('/roles', protect, staffController.getRoles);
router.post('/roles', protect, requireRole(['platform_admin', 'store_owner']), staffController.createRole);
router.put('/roles/:id', protect, requireRole(['platform_admin', 'store_owner']), staffController.updateRole);
router.get('/permissions', protect, staffController.getPermissions);
router.get('/stores', protect, staffController.getStores);


// Logs & Session tracking
router.get('/activity-logs', protect, requirePermission('settings:view'), staffController.getActivityLogs);
router.get('/login-history', protect, requirePermission('staff:view'), staffController.getLoginHistory);
router.post('/auth/revoke-session', protect, requirePermission('staff:edit'), staffController.revokeSession);
router.post('/auth/refresh', staffController.refreshToken);

// Delivery partner document verification details
router.get('/delivery-partners/:id/docs', protect, requirePermission('delivery:manage_partners'), staffController.getPartnerDocs);
router.put('/delivery-partners/:id/verify-docs', protect, requirePermission('delivery:manage_partners'), staffController.verifyPartnerDocs);

module.exports = router;
