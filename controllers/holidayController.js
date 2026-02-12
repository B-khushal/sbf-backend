const Holiday = require('../models/Holiday');

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private/Admin
const getAllHolidays = async (req, res) => {
  try {
    const { year, category, type, isActive } = req.query;
    
    let query = {};
    
    if (year) {
      query.year = parseInt(year);
    }
    
    if (category) {
      query.category = category;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const holidays = await Holiday.find(query)
      .populate('createdBy', 'name email')
      .sort({ year: 1, month: 1, day: 1 });
    
    res.json({
      success: true,
      data: holidays,
      count: holidays.length
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch holidays',
      error: error.message
    });
  }
};

// @desc    Get holidays for a specific year
// @route   GET /api/holidays/year/:year
// @access  Public
const getHolidaysForYear = async (req, res) => {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);
    
    if (isNaN(yearNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year parameter'
      });
    }
    
    const holidays = await Holiday.getHolidaysForYear(yearNum);
    
    res.json({
      success: true,
      data: holidays,
      year: yearNum,
      count: holidays.length
    });
  } catch (error) {
    console.error('Error fetching holidays for year:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch holidays for year',
      error: error.message
    });
  }
};

// @desc    Get holidays for date range
// @route   GET /api/holidays/range
// @access  Public
const getHolidaysForDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    const holidays = await Holiday.getHolidaysForDateRange(start, end);
    
    res.json({
      success: true,
      data: holidays,
      startDate: start,
      endDate: end,
      count: holidays.length
    });
  } catch (error) {
    console.error('Error fetching holidays for date range:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch holidays for date range',
      error: error.message
    });
  }
};

// @desc    Check if a specific date is a holiday
// @route   GET /api/holidays/check/:date
// @access  Public
const checkHoliday = async (req, res) => {
  try {
    const { date } = req.params;
    const checkDate = new Date(date);
    
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    const holiday = await Holiday.isHoliday(checkDate);
    
    res.json({
      success: true,
      isHoliday: !!holiday,
      holiday: holiday || null
    });
  } catch (error) {
    console.error('Error checking holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to check holiday',
      error: error.message
    });
  }
};

// @desc    Create a new holiday
// @route   POST /api/holidays
// @access  Private/Admin
const createHoliday = async (req, res) => {
  try {
    const {
      name,
      date,
      reason,
      type = 'store',
      category = 'other',
      isActive = true,
      recurring = false,
      recurringYears = []
    } = req.body;
    
    // Validate required fields
    if (!name || !date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Name, date, and reason are required fields'
      });
    }
    
    // Validate date
    const holidayDate = new Date(date);
    if (isNaN(holidayDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    // Check if holiday already exists for this date
    const existingHoliday = await Holiday.isHoliday(holidayDate);
    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        message: 'A holiday already exists for this date'
      });
    }
    
    const holiday = new Holiday({
      name,
      date: holidayDate,
      reason,
      type,
      category,
      isActive,
      recurring,
      recurringYears,
      createdBy: req.user.id
    });
    
    await holiday.save();
    
    const populatedHoliday = await Holiday.findById(holiday._id)
      .populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: populatedHoliday
    });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to create holiday',
      error: error.message
    });
  }
};

// @desc    Update a holiday
// @route   PUT /api/holidays/:id
// @access  Private/Admin
const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.year;
    delete updateData.month;
    delete updateData.day;
    
    // If date is being updated, validate it
    if (updateData.date) {
      const newDate = new Date(updateData.date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      // Check if another holiday exists for this date (excluding current holiday)
      const existingHoliday = await Holiday.findOne({
        year: newDate.getFullYear(),
        month: newDate.getMonth() + 1,
        day: newDate.getDate(),
        isActive: true,
        _id: { $ne: id }
      });
      
      if (existingHoliday) {
        return res.status(400).json({
          success: false,
          message: 'Another holiday already exists for this date'
        });
      }
    }
    
    const holiday = await Holiday.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to update holiday',
      error: error.message
    });
  }
};

// @desc    Delete a holiday
// @route   DELETE /api/holidays/:id
// @access  Private/Admin
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    
    const holiday = await Holiday.findByIdAndDelete(id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Holiday deleted successfully',
      data: holiday
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to delete holiday',
      error: error.message
    });
  }
};

// @desc    Toggle holiday active status
// @route   PATCH /api/holidays/:id/toggle
// @access  Private/Admin
const toggleHolidayStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const holiday = await Holiday.findById(id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    holiday.isActive = !holiday.isActive;
    holiday.updatedAt = new Date();
    
    await holiday.save();
    
    const populatedHoliday = await Holiday.findById(id)
      .populate('createdBy', 'name email');
    
    res.json({
      success: true,
      message: `Holiday ${holiday.isActive ? 'activated' : 'deactivated'} successfully`,
      data: populatedHoliday
    });
  } catch (error) {
    console.error('Error toggling holiday status:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to toggle holiday status',
      error: error.message
    });
  }
};

// @desc    Get holiday statistics
// @route   GET /api/holidays/stats
// @access  Private/Admin
const getHolidayStats = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    
    const totalHolidays = await Holiday.countDocuments({ year: currentYear });
    const activeHolidays = await Holiday.countDocuments({ year: currentYear, isActive: true });
    const inactiveHolidays = await Holiday.countDocuments({ year: currentYear, isActive: false });
    
    const categoryStats = await Holiday.aggregate([
      { $match: { year: currentYear } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const typeStats = await Holiday.aggregate([
      { $match: { year: currentYear } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        year: currentYear,
        total: totalHolidays,
        active: activeHolidays,
        inactive: inactiveHolidays,
        categoryStats,
        typeStats
      }
    });
  } catch (error) {
    console.error('Error fetching holiday stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error: Failed to fetch holiday statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllHolidays,
  getHolidaysForYear,
  getHolidaysForDateRange,
  checkHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  toggleHolidayStatus,
  getHolidayStats
}; 