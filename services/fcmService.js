const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Check if Firebase credentials are available
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  Firebase credentials not found in environment variables');
      console.warn('⚠️  FCM notifications will be disabled');
      console.warn('⚠️  Please set: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return;
    }

    // Initialize Firebase Admin with credentials from environment variables
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        // Replace escaped newlines in private key
        privateKey: privateKey.replace(/\\n/g, '\n')
      })
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('📱 FCM notifications enabled');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    console.warn('⚠️  FCM notifications will be disabled');
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Check if Firebase is properly initialized
 * @returns {Object} - Status object with initialization details
 */
const getFirebaseStatus = () => {
  const hasCredentials = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );

  return {
    initialized: firebaseInitialized,
    hasCredentials: hasCredentials,
    projectId: process.env.FIREBASE_PROJECT_ID || 'Not configured',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 
      process.env.FIREBASE_CLIENT_EMAIL.substring(0, 10) + '...' : 
      'Not configured',
    timestamp: new Date().toISOString()
  };
};

/**
 * Check if Firebase is properly initialized
 * @returns {boolean}
 */
const isFirebaseInitialized = () => {
  return firebaseInitialized;
};

/**
 * Send push notification to a single device
 * @param {string} token - Device FCM token
 * @param {Object} notification - Notification payload {title, body}
 * @param {Object} data - Data payload (optional)
 * @param {Object} options - Additional options (optional)
 * @returns {Promise<Object>} - Result with success status
 */
const sendPushNotification = async (token, notification, data = {}, options = {}) => {
  if (!firebaseInitialized) {
    console.warn('⚠️  Firebase not initialized, skipping push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    // Validate inputs
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid device token');
    }

    if (!notification || !notification.title || !notification.body) {
      throw new Error('Notification must include title and body');
    }

    // Build message payload - Data-only message format
    // App handles notification display from data payload
    // FCM requires all data values to be strings
    const dataPayload = Object.keys(data).reduce((acc, key) => {
      acc[key] = String(data[key]);
      return acc;
    }, {});

    const message = {
      token: token,
      data: {
        title: String(notification.title),
        body: String(notification.body),
        ...dataPayload
      },
      // Android-specific configuration
      android: {
        priority: 'high'
      },
      // iOS-specific configuration
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: options.sound || 'default',
            badge: options.badge || 1,
            contentAvailable: true,
            ...(options.category && { category: options.category })
          }
        },
        headers: {
          'apns-priority': '10', // High priority
          'apns-push-type': 'alert'
        }
      }
    };

    // Send the message
    const response = await admin.messaging().send(message);
    
    console.log('✅ Push notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending push notification:', error.message);
    
    // Check for invalid token errors
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.log('🗑️  Invalid token detected:', token);
      return { success: false, error: error.message, invalidToken: true, token: token };
    }
    
    return { success: false, error: error.message, invalidToken: false };
  }
};

/**
 * Send push notification to multiple devices
 * @param {Array<string>} tokens - Array of device FCM tokens
 * @param {Object} notification - Notification payload {title, body}
 * @param {Object} data - Data payload (optional)
 * @param {Object} options - Additional options (optional)
 * @returns {Promise<Object>} - Result with success count and failed tokens
 */
const sendMulticastNotification = async (tokens, notification, data = {}, options = {}) => {
  if (!firebaseInitialized) {
    console.warn('⚠️  Firebase not initialized, skipping multicast notification');
    return { success: false, error: 'Firebase not initialized', invalidTokens: [] };
  }

  try {
    // Validate inputs
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new Error('Tokens must be a non-empty array');
    }

    if (!notification || !notification.title || !notification.body) {
      throw new Error('Notification must include title and body');
    }

    // Filter out invalid tokens
    const validTokens = tokens.filter(token => token && typeof token === 'string');
    
    if (validTokens.length === 0) {
      throw new Error('No valid tokens provided');
    }

    console.log(`📤 Sending multicast notification to ${validTokens.length} devices`);

    // Build message payload - Data-only message format
    // App handles notification display from data payload
    const message = {
      tokens: validTokens,
      data: {
        title: notification.title,
        body: notification.body,
        ...data,
        // Ensure all data values are strings (FCM requirement)
        ...Object.keys(data).reduce((acc, key) => {
          if (key !== 'title' && key !== 'body') {
            acc[key] = String(data[key]);
          }
          return acc;
        }, {})
      },
      // Android-specific configuration
      android: {
        priority: 'high'
      },
      // iOS-specific configuration
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: options.sound || 'default',
            badge: options.badge || 1,
            contentAvailable: true,
            ...(options.category && { category: options.category })
          }
        },
        headers: {
          'apns-priority': '10', // High priority
          'apns-push-type': 'alert'
        }
      }
    };

    // Send the multicast message
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log('✅ Multicast notification sent');
    console.log(`   Success: ${response.successCount}/${validTokens.length}`);
    console.log(`   Failures: ${response.failureCount}`);

    // Collect invalid tokens for cleanup
    const invalidTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          console.error(`❌ Failed to send to token[${idx}]:`, error.message);
          
          // Check if token is invalid
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(validTokens[idx]);
            console.log(`🗑️  Invalid token detected: ${validTokens[idx]}`);
          }
        }
      });
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: invalidTokens,
      totalTokens: validTokens.length
    };
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error.message);
    return { success: false, error: error.message, invalidTokens: [] };
  }
};

/**
 * Send order notification to all admin devices
 * @param {Object} orderData - Order details {orderId, orderNumber, customerName, totalAmount}
 * @returns {Promise<Object>} - Result with notification status
 */
const sendOrderNotificationToAdmins = async (orderData) => {
  if (!firebaseInitialized) {
    console.warn('⚠️  Firebase not initialized, skipping admin notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    console.log('📱 Sending order notification to admins:', orderData.orderNumber);

    // Import models (avoiding circular dependency issues)
    const User = require('../models/User');
    const DeviceToken = require('../models/DeviceToken');

    // Find all admin users
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id name email');
    
    if (!admins || admins.length === 0) {
      console.warn('⚠️  No admin users found');
      return { success: false, error: 'No admin users found' };
    }

    console.log(`👥 Found ${admins.length} admin user(s)`);

    // Get admin user IDs
    const adminIds = admins.map(admin => admin._id);

    // Find all active device tokens for admins
    const deviceTokens = await DeviceToken.find({
      userId: { $in: adminIds },
      isActive: true
    });

    if (!deviceTokens || deviceTokens.length === 0) {
      console.warn('⚠️  No active device tokens found for admins');
      return { success: false, error: 'No admin device tokens found' };
    }

    console.log(`📱 Found ${deviceTokens.length} active device token(s)`);

    // Extract token strings
    const tokens = deviceTokens.map(dt => dt.token);

    // Prepare notification payload
    const notification = {
      title: 'New Order Received!',
      body: `Order #${orderData.orderNumber} from ${orderData.customerName || 'Customer'} - ₹${orderData.totalAmount || 0}`
    };

    // Prepare data payload for deep linking (matches app's expected format)
    const data = {
      orderId: String(orderData.orderId),
      orderNumber: String(orderData.orderNumber),
      customerName: String(orderData.customerName || 'Customer'),
      amount: String(orderData.totalAmount || 0),
      type: 'NEW_ORDER'
    };

    // Send multicast notification
    const result = await sendMulticastNotification(tokens, notification, data, {
      sound: 'default'
    });

    // Clean up invalid tokens
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      console.log(`🗑️  Cleaning up ${result.invalidTokens.length} invalid token(s)`);
      
      try {
        await DeviceToken.updateMany(
          { token: { $in: result.invalidTokens } },
          { $set: { isActive: false } }
        );
        console.log('✅ Invalid tokens marked as inactive');
      } catch (cleanupError) {
        console.error('❌ Error cleaning up invalid tokens:', cleanupError.message);
      }
    }

    // Update lastUsed for successfully sent tokens
    if (result.successCount > 0) {
      try {
        const successfulTokens = tokens.filter(token => !result.invalidTokens.includes(token));
        await DeviceToken.updateMany(
          { token: { $in: successfulTokens } },
          { $set: { lastUsed: new Date() } }
        );
      } catch (updateError) {
        console.error('❌ Error updating token lastUsed:', updateError.message);
      }
    }

    console.log('✅ Order notification process completed');
    console.log(`   Sent to: ${result.successCount}/${result.totalTokens} devices`);
    
    return {
      success: result.success,
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalTokens: result.totalTokens,
      invalidTokensRemoved: result.invalidTokens.length
    };
  } catch (error) {
    console.error('❌ Error sending order notification to admins:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  isFirebaseInitialized,
  getFirebaseStatus,
  sendPushNotification,
  sendMulticastNotification,
  sendOrderNotificationToAdmins
};
