const DeviceToken = require('../models/DeviceToken');
const { sendPushNotification, getFirebaseStatus } = require('../services/fcmService');

// @desc    Register or update a device token
// @route   POST /api/device-tokens/register
// @access  Private
const registerDeviceToken = async (req, res) => {
  try {
    // Accept both 'platform' and 'deviceType' for compatibility
    const { token, platform, deviceType, deviceId, deviceInfo } = req.body;
    const userId = req.user._id;

    // Use platform OR deviceType (mobile app sends 'platform')
    const type = platform || deviceType;

    console.log('📱 Registering device token for user:', userId);
    console.log('   Device type:', type);
    console.log('   Device ID:', deviceId);
    console.log('   Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'MISSING');

    // Validate required fields
    if (!token || !type) {
      return res.status(400).json({ 
        message: 'Token and deviceType/platform are required',
        success: false,
        received: { token: !!token, deviceType: !!type }
      });
    }

    // Validate deviceType
    if (!['android', 'ios'].includes(type)) {
      return res.status(400).json({ 
        message: 'Device type must be either "android" or "ios"',
        success: false
      });
    }

    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ 
        message: 'Invalid token format',
        success: false
      });
    }

    // Build device info object
    const deviceInfoData = {
      ...(deviceInfo || {}),
      ...(deviceId && { deviceId })
    };

    // Register or update device token
    const result = await DeviceToken.findOrCreate(
      userId,
      token,
      type,
      deviceInfoData
    );

    console.log('✅ Device token registered successfully');
    console.log('   Created:', result.created);
    console.log('   Token ID:', result.deviceToken._id);

    res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created ? 'Device token registered successfully' : 'Device token updated successfully',
      data: {
        id: result.deviceToken._id,
        deviceType: result.deviceToken.deviceType,
        isActive: result.deviceToken.isActive,
        createdAt: result.deviceToken.createdAt,
        lastUsed: result.deviceToken.lastUsed
      }
    });
  } catch (error) {
    console.error('❌ Error registering device token:', error.message);
    
    // Handle duplicate token error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This device token is already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register device token',
      error: error.message
    });
  }
};

// @desc    Get all device tokens for the logged-in user
// @route   GET /api/device-tokens
// @access  Private
const getUserDeviceTokens = async (req, res) => {
  try {
    const userId = req.user._id;
    const { includeInactive } = req.query;

    console.log('📱 Fetching device tokens for user:', userId);

    // Build query
    const query = { userId };
    if (!includeInactive || includeInactive === 'false') {
      query.isActive = true;
    }

    // Find device tokens
    const deviceTokens = await DeviceToken.find(query)
      .select('-token') // Don't expose the actual token in the response
      .sort({ lastUsed: -1 });

    console.log(`✅ Found ${deviceTokens.length} device token(s)`);

    res.json({
      success: true,
      count: deviceTokens.length,
      data: deviceTokens.map(token => ({
        id: token._id,
        deviceType: token.deviceType,
        deviceInfo: token.deviceInfo,
        isActive: token.isActive,
        lastUsed: token.lastUsed,
        createdAt: token.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching device tokens:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device tokens',
      error: error.message
    });
  }
};

// @desc    Delete a device token
// @route   DELETE /api/device-tokens/:id
// @access  Private
const deleteDeviceToken = async (req, res) => {
  try {
    const tokenId = req.params.id;
    const userId = req.user._id;

    console.log('🗑️  Deleting device token:', tokenId);

    // Find the token and verify ownership
    const deviceToken = await DeviceToken.findOne({
      _id: tokenId,
      userId: userId
    });

    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found or you do not have permission to delete it'
      });
    }

    // Delete the token
    await deviceToken.deleteOne();

    console.log('✅ Device token deleted successfully');

    res.json({
      success: true,
      message: 'Device token deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting device token:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete device token',
      error: error.message
    });
  }
};

// @desc    Deactivate a device token (soft delete)
// @route   PUT /api/device-tokens/:id/deactivate
// @access  Private
const deactivateDeviceToken = async (req, res) => {
  try {
    const tokenId = req.params.id;
    const userId = req.user._id;

    console.log('⏸️  Deactivating device token:', tokenId);

    // Find the token and verify ownership
    const deviceToken = await DeviceToken.findOne({
      _id: tokenId,
      userId: userId
    });

    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found or you do not have permission to deactivate it'
      });
    }

    // Deactivate the token
    deviceToken.isActive = false;
    await deviceToken.save();

    console.log('✅ Device token deactivated successfully');

    res.json({
      success: true,
      message: 'Device token deactivated successfully',
      data: {
        id: deviceToken._id,
        isActive: deviceToken.isActive
      }
    });
  } catch (error) {
    console.error('❌ Error deactivating device token:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate device token',
      error: error.message
    });
  }
};

// @desc    Get all admin device tokens (for admin panel to list devices)
// @route   GET /api/device-tokens/admin-devices
// @access  Private (requires authentication)
const getAdminDeviceTokens = async (req, res) => {
  try {
    console.log('📱 Fetching all admin device tokens...');

    // Get all active device tokens with populated user info
    const tokens = await DeviceToken.find({ isActive: true })
      .populate('userId', 'name email role')
      .sort({ lastUsed: -1 });

    // Filter admin users only
    const adminTokens = tokens.filter(t => 
      t.userId && (t.userId.role === 'admin' || t.userId.role === 'super_admin')
    );

    console.log(`✅ Found ${adminTokens.length} admin device(s)`);

    res.json({
      success: true,
      count: adminTokens.length,
      data: adminTokens.map(token => ({
        id: token._id,
        deviceType: token.deviceType,
        deviceInfo: token.deviceInfo,
        lastUsed: token.lastUsed,
        createdAt: token.createdAt,
        user: {
          name: token.userId?.name || 'Unknown',
          email: token.userId?.email || 'Unknown'
        }
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching admin devices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin devices',
      error: error.message
    });
  }
};

// @desc    Send test notification to specific device by ID
// @route   POST /api/device-tokens/test-by-id
// @access  Private (requires authentication)
const testPushNotificationById = async (req, res) => {
  try {
    const { deviceId, title, body, data } = req.body;

    console.log('🧪 Testing push notification by device ID...');
    console.log('📋 Request details:', { 
      deviceId, 
      title, 
      body, 
      data,
      userId: req.user._id,
      userRole: req.user.role
    });

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required'
      });
    }

    // Find device token
    const deviceToken = await DeviceToken.findById(deviceId);
    
    if (!deviceToken) {
      console.log('❌ Device token not found:', deviceId);
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    if (!deviceToken.isActive) {
      console.log('❌ Device token is inactive:', deviceId);
      return res.status(400).json({
        success: false,
        message: 'Device token is inactive'
      });
    }

    console.log('📱 Sending test notification to device:', deviceId);
    console.log('🔑 FCM Token (first 20 chars):', deviceToken.token.substring(0, 20) + '...');

    // Prepare notification
    const notification = {
      title: title || '🧪 Test Notification',
      body: body || 'This is a test push notification from SBF Florist Admin Panel'
    };

    const testData = {
      type: 'TEST',
      timestamp: new Date().toISOString(),
      source: 'admin_panel',
      ...(data || {})
    };

    console.log('📤 Sending notification with payload:', { notification, testData });

    const result = await sendPushNotification(deviceToken.token, notification, testData);

    console.log('📥 FCM Response:', result);

    if (result.success) {
      // Update last used
      await deviceToken.updateLastUsed();
      
      console.log('✅ Test notification sent successfully');
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          messageId: result.messageId,
          deviceType: deviceToken.deviceType,
          sentAt: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ Failed to send test notification:', result.error);
      console.error('🔍 Error details:', { 
        invalidToken: result.invalidToken, 
        error: result.error 
      });
      
      // Handle invalid token
      if (result.invalidToken) {
        deviceToken.isActive = false;
        await deviceToken.save();
        console.log('🗑️  Invalid token deactivated');
        
        return res.status(400).json({
          success: false,
          message: 'Device token is no longer valid and has been deactivated',
          error: result.error
        });
      }

      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error testing push notification:', error.message);
    console.error('🔍 Full error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test push notification',
      error: error.message
    });
  }
};
        await deviceToken.save();
        console.log('🗑️  Invalid token deactivated');
      }

      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error testing push notification:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to test push notification',
      error: error.message
    });
  }
};

// @desc    Test push notification (for testing with raw token - backward compatibility)
// @route   POST /api/device-tokens/test
// @access  Public (No auth required for testing)
const testPushNotification = async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    console.log('🧪 Testing push notification...');

    // Validate token
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required in request body'
      });
    }

    console.log('📱 Sending test notification to token:', token.substring(0, 20) + '...');

    // Prepare notification
    const notification = {
      title: title || '🧪 Test Notification',
      body: body || 'This is a test push notification from SBF Florist'
    };

    const testData = {
      type: 'TEST',
      timestamp: new Date().toISOString(),
      ...(data || {})
    };

    const result = await sendPushNotification(token, notification, testData);

    if (result.success) {
      console.log('✅ Test notification sent successfully');
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          messageId: result.messageId
        }
      });
    } else {
      console.error('❌ Failed to send test notification:', result.error);
      
      // Handle invalid token
      if (result.invalidToken) {
        await DeviceToken.deactivateToken(token);
        console.log('🗑️  Invalid token deactivated');
      }

      res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error testing push notification:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to test push notification',
      error: error.message
    });
  }
};

// @desc    Clean up old inactive tokens (Admin only)
// @route   POST /api/device-tokens/cleanup
// @access  Private/Admin
const cleanupOldTokens = async (req, res) => {
  try {
    console.log('🗑️  Starting cleanup of old inactive tokens');

    const result = await DeviceToken.cleanupOldTokens();

    console.log(`✅ Cleanup completed: ${result.deletedCount} tokens removed`);

    res.json({
      success: true,
      message: 'Old inactive tokens cleaned up successfully',
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ Error cleaning up old tokens:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up old tokens',
      error: error.message
    });
  }
};

// @desc    Check FCM service status
// @route   GET /api/device-tokens/fcm-status
// @access  Private (admin only recommended)
const checkFCMStatus = async (req, res) => {
  try {
    const status = getFirebaseStatus();
    
    console.log('🔍 FCM Status check:', status);
    
    res.json({
      success: true,
      fcm: status,
      message: status.initialized ? 
        'FCM service is running and ready' : 
        'FCM service is not initialized - check Firebase credentials'
    });
  } catch (error) {
    console.error('❌ Error checking FCM status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check FCM status',
      error: error.message
    });
  }
};

module.exports = {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  deactivateDeviceToken,
  testPushNotification,
  testPushNotificationById,
  getAdminDeviceTokens,
  cleanupOldTokens,
  checkFCMStatus
};
