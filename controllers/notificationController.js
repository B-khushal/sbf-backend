const Notification = require('../models/Notification');

// Get all notifications for a user or admin
exports.getNotifications = async (req, res) => {
  try {
    const { since } = req.query;
    
    // Build query based on user role
    let query = {};
    
    if (req.user.isAdmin) {
      // Admin gets all admin notifications (no userId filter for admin notifications)
      query = { 
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ]
      };
    } else {
      // Regular users get their own notifications
      query = { userId: req.user._id };
    }
    
    // If 'since' parameter is provided, filter by date
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 notifications
    
    res.json({ 
      notifications: notifications.map(notification => ({
        id: notification._id,
        type: notification.type || 'system',
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        isRead: notification.read || false
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    let notification;
    
    if (req.user.isAdmin) {
      // Admin can mark any admin notification as read
      notification = await Notification.findById(req.params.id);
    } else {
      // Regular users can only mark their own notifications as read
      notification = await Notification.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
    }

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    let updateQuery;
    
    if (req.user.isAdmin) {
      // Admin marks all admin notifications as read
      updateQuery = { 
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ],
        read: false 
      };
    } else {
      // Regular users mark their own notifications as read
      updateQuery = { userId: req.user._id, read: false };
    }
    
    await Notification.updateMany(updateQuery, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
};

// Clear read notifications
exports.clearReadNotifications = async (req, res) => {
  try {
    let deleteQuery;
    
    if (req.user.isAdmin) {
      // Admin clears read admin notifications
      deleteQuery = {
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ],
        read: true
      };
    } else {
      // Regular users clear their own read notifications
      deleteQuery = { userId: req.user._id, read: true };
    }
    
    await Notification.deleteMany(deleteQuery);
    res.json({ message: 'Read notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing read notifications' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    let notification;
    
    if (req.user.isAdmin) {
      // Admin can delete any admin notification
      notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ]
      });
    } else {
      // Regular users can only delete their own notifications
      notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        userId: req.user._id
      });
    }

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
};

// Test notification endpoint for debugging
exports.createTestNotification = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const testNotification = new Notification({
      type: 'order',
      title: '🧪 Test Notification',
      message: `Test notification created at ${new Date().toLocaleString()}. This is to verify the notification system is working properly.`,
      userId: null, // Admin notification
      read: false,
      metadata: {
        test: true,
        createdBy: req.user._id,
        timestamp: new Date().toISOString()
      }
    });
    
    await testNotification.save();
    console.log('Test notification created successfully:', testNotification._id);
    
    res.status(201).json({
      success: true,
      message: 'Test notification created successfully',
      notification: {
        id: testNotification._id,
        type: testNotification.type,
        title: testNotification.title,
        message: testNotification.message,
        createdAt: testNotification.createdAt,
        isRead: testNotification.read
      }
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating test notification',
      error: error.message 
    });
  }
};

// Create order confirmation notification (used internally)
exports.createOrderNotification = async (orderData) => {
  try {
    const notification = new Notification({
      type: 'order',
      title: '🎉 New Order Received!',
      message: `Order ${orderData.orderNumber} has been placed by ${orderData.customerName}. Amount: $${orderData.amount}`,
      userId: null, // Admin notification (no specific user)
      read: false,
      metadata: {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        amount: orderData.amount
      }
    });
    
    await notification.save();
    console.log('Order notification created for admin:', orderData.orderNumber);
    return notification;
  } catch (error) {
    console.error('Error creating order notification:', error);
    throw error;
  }
};

// Create admin notification (used internally)
exports.createAdminNotification = async (data) => {
  try {
    const notification = new Notification({
      type: data.type || 'admin',
      title: data.title,
      message: data.message,
      userId: null, // Admin notifications don't have specific user
      read: false,
      metadata: data.metadata || {}
    });
    
    await notification.save();
    console.log('Admin notification created:', notification.title);
    return notification;
  } catch (error) {
    console.error('Error creating admin notification:', error);
    throw error;
  }
}; 