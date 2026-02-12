const express = require('express');
const router = express.Router();
const {
  getAllHolidays,
  getHolidaysForYear,
  getHolidaysForDateRange,
  checkHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  toggleHolidayStatus,
  getHolidayStats
} = require('../controllers/holidayController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes (for frontend date picker)
router.get('/year/:year', getHolidaysForYear);
router.get('/range', getHolidaysForDateRange);
router.get('/check/:date', checkHoliday);

// Protected routes (admin only)
router.get('/', protect, admin, getAllHolidays);
router.get('/stats', protect, admin, getHolidayStats);
router.post('/', protect, admin, createHoliday);
router.put('/:id', protect, admin, updateHoliday);
router.delete('/:id', protect, admin, deleteHoliday);
router.patch('/:id/toggle', protect, admin, toggleHolidayStatus);

module.exports = router; 