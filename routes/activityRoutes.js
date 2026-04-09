const express = require('express');
const router = express.Router();
const { optionalProtect } = require('../middleware/authMiddleware');
const { createActivityLog } = require('../controllers/activityLogController');

router.post('/log', optionalProtect, createActivityLog);

module.exports = router;
