const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminLogs } = require('../controllers/activityLogController');

router.get('/logs', protect, admin, getAdminLogs);

module.exports = router;
