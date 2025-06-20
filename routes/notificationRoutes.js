const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearReadNotifications,
  deleteNotification
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

// Delete a notification
router.delete('/:id', deleteNotification);

// Test email service
router.get('/test', admin, async (req, res) => {
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