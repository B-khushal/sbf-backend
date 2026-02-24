const Notification = require('../models/Notification');

// Get all notifications for a user or admin
exports.getNotifications = async (req, res) => {
  try {
    const { since, showHistory, sessionId } = req.query;
    
    // Build query based on user role
    let query = {};
    
    if (req.user.role === 'admin') {
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
    
    // Handle visibility based on showHistory flag
    if (showHistory === 'true') {
      // Show all notifications (history view)
    } else {
      // Normal view - hide notifications that were cleared in this session
      // or hide notifications with hiddenUntil date in the future
      const now = new Date();
      query.$and = [
        {
          $or: [
            { hiddenUntil: null },
            { hiddenUntil: { $lte: now } },
            { hiddenFromSession: { $ne: sessionId } }
          ]
        }
      ];
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(showHistory === 'true' ? 100 : 50); // Show more in history mode
    
    // Also include global notifications for admins (real-time backup)
    let allNotifications = notifications.map(notification => ({
      id: notification._id,
      type: notification.type || 'system',
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      isRead: notification.read || false,
      isHidden: notification.hiddenUntil && notification.hiddenUntil > new Date()
    }));
    
    // Add global notifications for admins (for real-time updates) - only in normal view
    if (req.user.role === 'admin' && showHistory !== 'true' && global.latestNotifications) {
      const globalNotifications = global.latestNotifications
        .filter(n => since ? new Date(n.createdAt) > new Date(since) : true)
        .filter(n => !allNotifications.some(existing => existing.id === n.id));
      
      allNotifications = [...globalNotifications, ...allNotifications];
    }
    
    const limitCount = showHistory === 'true' ? 100 : 50;
    
    res.json({ 
      notifications: allNotifications.slice(0, limitCount)
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
    
    if (req.user.role === 'admin') {
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
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    let updateQuery;
    
    if (req.user.role === 'admin') {
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
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
};

// Clear read notifications (hide until login)
exports.clearReadNotifications = async (req, res) => {
  try {
    const { sessionId } = req.body;
    let updateQuery;
    
    if (req.user.role === 'admin') {
      // Admin clears read admin notifications
      updateQuery = {
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ],
        read: true
      };
    } else {
      // Regular users clear their own read notifications
      updateQuery = { userId: req.user._id, read: true };
    }
    
    // Set hiddenUntil to next login (set to far future, will be reset on login)
    // and store the session that cleared them
    const farFuture = new Date('2099-12-31');
    await Notification.updateMany(updateQuery, { 
      hiddenUntil: farFuture,
      hiddenFromSession: sessionId
    });
    
    res.json({ message: 'Read notifications cleared (hidden until next login)' });
  } catch (error) {
    console.error('Error clearing read notifications:', error);
    res.status(500).json({ message: 'Error clearing read notifications' });
  }
};

// Show notifications on login (reset hiddenUntil for new session)
exports.showNotificationsOnLogin = async (req, res) => {
  try {
    const { sessionId } = req.body;
    let updateQuery;
    
    if (req.user.role === 'admin') {
      updateQuery = {
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ],
        hiddenUntil: { $exists: true, $ne: null }
      };
    } else {
      updateQuery = { 
        userId: req.user._id,
        hiddenUntil: { $exists: true, $ne: null }
      };
    }
    
    // Reset hiddenUntil to null for new session, only show new notifications
    // Keep notifications hidden that were cleared in previous sessions
    const loginTime = new Date();
    await Notification.updateMany(updateQuery, { 
      $unset: { hiddenUntil: "", hiddenFromSession: "" }
    });
    
    res.json({ message: 'Notifications visibility reset for new session' });
  } catch (error) {
    console.error('Error resetting notification visibility:', error);
    res.status(500).json({ message: 'Error resetting notification visibility' });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    let notification;
    
    if (req.user.role === 'admin') {
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
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Error deleting notification' });
  }
};

// Create test notification (for admin testing)
exports.createTestNotification = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    
    // Only admin can create test notifications
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const notification = new Notification({
      type: type || 'system',
      title: title || '🧪 Test Notification',
      message: message || 'This is a test notification to verify the system is working correctly.',
      userId: null, // Admin notification
      read: false
    });
    
    await notification.save();
    
    console.log('Test notification created:', notification.title);
    res.status(201).json({
      message: 'Test notification created successfully',
      notification: {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        isRead: notification.read
      }
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ message: 'Error creating test notification' });
  }
};

// Get notification statistics
exports.getNotificationStats = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'admin') {
      query = {
        $or: [
          { type: { $in: ['admin', 'order', 'system'] }, userId: null },
          { type: { $in: ['admin', 'order', 'system'] }, userId: { $exists: false } }
        ]
      };
    } else {
      query = { userId: req.user._id };
    }
    
    const [totalCount, unreadCount, readCount] = await Promise.all([
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false }),
      Notification.countDocuments({ ...query, read: true })
    ]);
    
    res.json({
      total: totalCount,
      unread: unreadCount,
      read: readCount
    });
  } catch (error) {
    console.error('Error fetching notification statistics:', error);
    res.status(500).json({ message: 'Error fetching notification statistics' });
  }
};

// Create order confirmation notification (used internally)
exports.createOrderNotification = async (orderData) => {
  try {
    const currency = orderData.currency || 'INR';
    const currencySymbol = currency === 'INR' ? '₹' : '$';
    
    const notification = new Notification({
      type: 'order',
      title: '🎉 New Order Received!',
      message: `Order ${orderData.orderNumber} has been placed by ${orderData.customerName}. Amount: ${currencySymbol}${orderData.amount}`,
      userId: null, // Admin notification (no specific user)
      read: false,
      metadata: {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        amount: orderData.amount,
        currency: currency
      }
    });
    
    await notification.save();
    console.log('✅ Order notification created for admin:', orderData.orderNumber);
    return notification;
  } catch (error) {
    console.error('❌ Error creating order notification:', error);
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
