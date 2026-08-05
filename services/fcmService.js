require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized || admin.apps.length > 0) {
    firebaseInitialized = true;
    return;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  Firebase credentials not found in environment variables');
      console.warn('⚠️  FCM notifications will be disabled');
      console.warn('⚠️  Please set: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return;
    }

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey
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
      notification: {
        title: String(notification.title),
        body: String(notification.body)
      },
      data: {
        title: String(notification.title),
        body: String(notification.body),
        ...dataPayload
      },
      android: {
        priority: 'high',
        notification: {
          sound: options.sound || 'default',
          channelId: 'orders_channel'
        }
      },
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
          'apns-priority': '10',
          'apns-push-type': 'alert'
        }
      },
      webpush: {
        notification: {
          title: String(notification.title),
          body: String(notification.body),
          requireInteraction: true
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
      notification: {
        title: String(notification.title),
        body: String(notification.body)
      },
      data: {
        title: String(notification.title),
        body: String(notification.body),
        ...data,
        ...Object.keys(data).reduce((acc, key) => {
          if (key !== 'title' && key !== 'body') {
            acc[key] = String(data[key]);
          }
          return acc;
        }, {})
      },
      android: {
        priority: 'high',
        notification: {
          sound: options.sound || 'default',
          channelId: 'orders_channel'
        }
      },
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
          'apns-priority': '10',
          'apns-push-type': 'alert'
        }
      },
      webpush: {
        notification: {
          title: String(notification.title),
          body: String(notification.body),
          requireInteraction: true
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
      title: '🎉 New Order Received!',
      body: `Order #${orderData.orderNumber} - ₹${orderData.totalAmount || 0}`
    };

    // Prepare data payload for deep linking (matches app's expected format)
    const data = {
      type: 'NEW_ORDER',
      orderId: String(orderData.orderId),
      orderNumber: String(orderData.orderNumber),
      customerName: String(orderData.customerName || 'Customer'),
      amount: String(orderData.totalAmount || 0)
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

/**
 * Send notification to ALL admin devices (sends individually for better control)
 * This automatically sends to every registered admin device
 * @param {Object} data - Notification data {title, body, orderId, orderNumber, customerName, amount, type}
 * @returns {Promise<Object>} - Result with sent/failed counts
 */
const sendToAllAdmins = async (data) => {
  if (!firebaseInitialized) {
    console.warn('⚠️  Firebase not initialized, skipping notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const DeviceToken = require('../models/DeviceToken');
    
    // Get ALL active admin tokens
    const adminTokens = await DeviceToken.getActiveAdminTokens();
    
    if (adminTokens.length === 0) {
      console.log('⚠️  No admin devices registered');
      return { success: true, total: 0, sent: 0, failed: 0 };
    }
    
    console.log(`📱 Sending to ${adminTokens.length} admin device(s)...`);
    
    // Send to EACH device individually
    const results = [];
    for (const tokenDoc of adminTokens) {
      const notifTitle = data.title || '🎉 New Order Received!';
      const notifBody = data.body || `Order #${data.orderNumber} placed`;

      const message = {
        token: tokenDoc.token,
        notification: {
          title: notifTitle,
          body: notifBody
        },
        data: {
          title: String(notifTitle),
          body: String(notifBody),
          orderId: String(data.orderId || ''),
          orderNumber: String(data.orderNumber || ''),
          customerName: String(data.customerName || ''),
          amount: String(data.amount || ''),
          type: String(data.type || 'NEW_ORDER')
        },
        android: {
          priority: 'high',
          ttl: 3600 * 1000,
          notification: {
            sound: 'default',
            channelId: 'orders_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notifTitle,
                body: notifBody
              },
              sound: 'default',
              badge: 1,
              contentAvailable: true
            }
          }
        },
        webpush: {
          notification: {
            title: notifTitle,
            body: notifBody,
            requireInteraction: true
          }
        }
      };
      
      try {
        const response = await admin.messaging().send(message);
        results.push({ success: true, messageId: response });
        console.log(`✅ Sent to device: ${tokenDoc.token.substring(0, 20)}...`);
        
        // Update last used timestamp
        await tokenDoc.updateLastUsed();
      } catch (error) {
        console.error(`❌ Failed to send to device:`, error.message);
        results.push({ success: false, error: error.message });
        
        // Remove invalid tokens
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          tokenDoc.isActive = false;
          await tokenDoc.save();
          console.log(`🗑️  Invalid token deactivated: ${tokenDoc.token.substring(0, 20)}...`);
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`✅ Notification sent: ${successCount}/${adminTokens.length} successful, ${failedCount} failed`);
    
    return {
      success: true,
      total: adminTokens.length,
      sent: successCount,
      failed: failedCount
    };
    
  } catch (error) {
    console.error('❌ Error sending to admins:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  isFirebaseInitialized,
  getFirebaseStatus,
  sendPushNotification,
  sendMulticastNotification,
  sendOrderNotificationToAdmins,
  sendToAllAdmins
};
