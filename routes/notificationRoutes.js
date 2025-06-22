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

// Get all notifications
router.get('/', getNotifications);

// Mark a notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Clear read notifications
router.delete('/read', clearReadNotifications);

// Show notifications on login
router.post('/show-on-login', showNotificationsOnLogin);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Delete a notification
router.delete('/:id', deleteNotification);

// Create test notification (admin only)
router.post('/test', admin, createTestNotification);

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

// Test email service
router.get('/test-email', admin, async (req, res) => {
  try {
    const testResult = await testEmailService();
    
    res.json({
      success: true,
      message: 'Email service test completed',
      result: testResult
    });
  } catch (error) {
    console.error('Error testing email service:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing email service',
      error: error.message
    });
  }
});

// Test sending email with sample data
router.post('/test-send', admin, async (req, res) => {
  try {
    const { email } = req.body;
    const testEmail = email || 'test@example.com';
    
    const result = await sendTestEmail(testEmail);
    
    res.json({
      success: true,
      message: 'Test email sent',
      result,
      sentTo: testEmail
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
});

// Get email configuration status
router.get('/config', admin, (req, res) => {
  const config = getEmailConfig();

  res.json({
    success: true,
    configuration: {
      email: config
    }
  });
});

module.exports = router; 