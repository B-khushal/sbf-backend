const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminLogs } = require('../controllers/activityLogController');
const { exportProductCatalog } = require('../controllers/productController');

router.get('/logs', protect, admin, getAdminLogs);
router.get('/products/export', protect, admin, exportProductCatalog);

module.exports = router;

