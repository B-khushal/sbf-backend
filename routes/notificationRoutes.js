const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearReadNotifications,
  deleteNotification,
  createTestNotification,
  showNotificationsOnLogin,
  getNotificationStats
} = require('../controllers/notificationController');
const { testEmailService, sendTestEmail, getEmailConfig } = require('../services/emailNotificationService');

// All routes are protected and require authentication
router.use(protect);

// Get all notifications for a user
router.get('/', getNotifications);

// Mark a notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Clear read notifications
router.delete('/read', clearReadNotifications);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Delete a specific notification
router.delete('/:id', deleteNotification);

// Show notifications on login (reset hidden notifications)
router.post('/show-on-login', showNotificationsOnLogin);

// Admin-only routes
router.use(admin);

// DANGER: Clear ALL notifications (admin only)
router.delete('/admin/clear-all', async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    
    // Count notifications before deletion
    const countBefore = await Notification.countDocuments({});
    console.log(`🗑️ Admin ${req.user.email} is clearing ${countBefore} notifications`);
    
    // Delete all notifications
    const result = await Notification.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} notifications`);
    
    res.json({
      message: 'All notifications cleared successfully',
      deletedCount: result.deletedCount,
      countBefore: countBefore
    });
  } catch (error) {
    console.error('❌ Error clearing all notifications:', error);
    res.status(500).json({ 
      message: 'Error clearing all notifications',
      error: error.message 
    });
  }
});

// Create test notification (admin only)
router.post('/test', createTestNotification);

// Email service test routes (admin only)
router.get('/test-email', testEmailService);
router.post('/send-test-email', sendTestEmail);
router.get('/email-config', getEmailConfig);

// Debug endpoint to check user status
router.get('/debug/user', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      isAdmin: req.user.isAdmin,
      createdAt: req.user.createdAt
    },
    isAdminByRole: req.user.role === 'admin',
    isAdminByProperty: req.user.isAdmin,
    middleware: {
      adminCheckPasses: req.user.role === 'admin'
    }
  });
});

// Temporary endpoint to promote current user to admin (for testing)
router.post('/debug/make-admin', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Update current user to admin
    await User.findByIdAndUpdate(req.user._id, { role: 'admin' });
    
    // Refresh user data
    const updatedUser = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      message: 'User promoted to admin successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error promoting user to admin',
      error: error.message
    });
  }
});

module.exports = router; 