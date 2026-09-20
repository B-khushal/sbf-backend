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

    const notifTitle = (notification && notification.title) || data.title || '🎉 New Order Received!';
    const notifBody = (notification && notification.body) || data.body || 'Order received';

    // Build data payload - all values must be strings
    const orderIdStr = String(data.orderId || data.orderNumber || `ORD-${Date.now()}`);
    const orderNumberStr = String(data.orderNumber || orderIdStr);
    const customerNameStr = String(data.customerName || 'Customer');
    const amountStr = String(data.amount || '0');
    const typeStr = String(data.type || 'NEW_ORDER');

    const dataPayload = {
      title: String(notifTitle),
      body: String(notifBody),
      orderId: orderIdStr,
      orderNumber: orderNumberStr,
      customerName: customerNameStr,
      amount: amountStr,
      type: typeStr,
      ...Object.keys(data || {}).reduce((acc, key) => {
        if (data[key] !== undefined && data[key] !== null) {
          acc[key] = String(data[key]);
        }
        return acc;
      }, {})
    };

    const deviceType = (options.deviceType || options.platform || 'android').toLowerCase();

    let message;
    if (deviceType === 'web' || deviceType === 'ios') {
      message = {
        token: token,
        notification: {
          title: String(notifTitle),
          body: String(notifBody)
        },
        data: dataPayload,
        apns: {
          payload: {
            aps: {
              alert: {
                title: String(notifTitle),
                body: String(notifBody)
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
            title: String(notifTitle),
            body: String(notifBody),
            requireInteraction: true
          }
        }
      };
    } else {
      // ANDROID APP (D:\SBF-APP):
      // DATA-ONLY message. Do NOT include top-level 'notification' or 'android.notification'.
      // This ensures MyFirebaseMessagingService.onMessageReceived() in the Android app handles
      // the notification in ALL states (foreground, background, killed, lock screen) to trigger
      // R.raw.order_recive sound (3x), max volume boost, 3-cycle vibration, and local storage.
      message = {
        token: token,
        data: dataPayload,
        android: {
          priority: 'high',
          ttl: 3600 * 1000
        }
      };
    }

    // Send the message
    const response = await admin.messaging().send(message);
    
    console.log(`✅ Push notification sent successfully to ${deviceType} (${deviceType === 'android' ? 'data-only' : 'standard'}):`, response);
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

    const notifTitle = (notification && notification.title) || data.title || '🎉 New Order Received!';
    const notifBody = (notification && notification.body) || data.body || 'Order received';

    // Filter out invalid tokens
    const validTokens = tokens.filter(token => token && typeof token === 'string');
    
    if (validTokens.length === 0) {
      throw new Error('No valid tokens provided');
    }

    const orderIdStr = String(data.orderId || data.orderNumber || `ORD-${Date.now()}`);
    const orderNumberStr = String(data.orderNumber || orderIdStr);
    const customerNameStr = String(data.customerName || 'Customer');
    const amountStr = String(data.amount || '0');
    const typeStr = String(data.type || 'NEW_ORDER');

    const dataPayload = {
      title: String(notifTitle),
      body: String(notifBody),
      orderId: orderIdStr,
      orderNumber: orderNumberStr,
      customerName: customerNameStr,
      amount: amountStr,
      type: typeStr,
      ...Object.keys(data || {}).reduce((acc, key) => {
        if (data[key] !== undefined && data[key] !== null) {
          acc[key] = String(data[key]);
        }
        return acc;
      }, {})
    };

    console.log(`📤 Sending data-only multicast notification to ${validTokens.length} devices`);

    // Build data-only message payload for Android app
    const message = {
      tokens: validTokens,
      data: dataPayload,
      android: {
        priority: 'high',
        ttl: 3600 * 1000
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
    // Delegate to sendToAllAdmins which sends data-only push to Android devices
    return await sendToAllAdmins({
      title: '🎉 New Order Received!',
      body: `Order #${orderData.orderNumber} - ₹${orderData.totalAmount || 0}`,
      orderId: String(orderData.orderId || orderData._id || orderData.id || `ORD-${orderData.orderNumber}`),
      orderNumber: String(orderData.orderNumber),
      customerName: String(orderData.customerName || 'Customer'),
      amount: String(orderData.totalAmount || 0),
      type: 'NEW_ORDER'
    });
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
      const devType = (tokenDoc.deviceType || 'android').toLowerCase();

      const orderIdStr = String(data.orderId || data.orderNumber || `ORD-${Date.now()}`);
      const orderNumberStr = String(data.orderNumber || orderIdStr);
      const customerNameStr = String(data.customerName || 'Customer');
      const amountStr = String(data.amount || '0');
      const typeStr = String(data.type || 'NEW_ORDER');

      const dataPayload = {
        title: String(notifTitle),
        body: String(notifBody),
        orderId: orderIdStr,
        orderNumber: orderNumberStr,
        customerName: customerNameStr,
        amount: amountStr,
        type: typeStr,
        ...Object.keys(data || {}).reduce((acc, k) => {
          if (data[k] !== undefined && data[k] !== null) {
            acc[k] = String(data[k]);
          }
          return acc;
        }, {})
      };

      let message;
      if (devType === 'web' || devType === 'ios') {
        message = {
          token: tokenDoc.token,
          notification: {
            title: notifTitle,
            body: notifBody
          },
          data: dataPayload,
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
      } else {
        // ANDROID APP (D:\SBF-APP):
        // DATA-ONLY message. Do NOT include 'notification' or 'android.notification'.
        // This ensures MyFirebaseMessagingService.onMessageReceived() triggers in ALL states
        // (foreground, background, killed, locked) to run the custom notification,
        // 3-cycle MediaPlayer sound using R.raw.order_recive, max volume, 3x vibration, and local store.
        message = {
          token: tokenDoc.token,
          data: dataPayload,
          android: {
            priority: 'high',
            ttl: 3600 * 1000
          }
        };
      }
      
      const recipientInfo = {
        deviceId: tokenDoc.id || tokenDoc._id,
        userName: tokenDoc.user?.name || (typeof tokenDoc.userId === 'object' ? tokenDoc.userId?.name : null) || 'Admin',
        userEmail: tokenDoc.user?.email || (typeof tokenDoc.userId === 'object' ? tokenDoc.userId?.email : null) || '',
        userRole: tokenDoc.user?.role || (typeof tokenDoc.userId === 'object' ? tokenDoc.userId?.role : null) || 'admin',
        deviceType: tokenDoc.deviceType || 'android',
        tokenPreview: tokenDoc.token ? `${tokenDoc.token.substring(0, 10)}...${tokenDoc.token.slice(-6)}` : ''
      };

      try {
        const response = await admin.messaging().send(message);
        results.push({
          ...recipientInfo,
          success: true,
          messageId: response
        });
        console.log(`✅ Sent to device: ${tokenDoc.token.substring(0, 20)}...`);
        
        // Update last used timestamp
        await tokenDoc.updateLastUsed();
      } catch (error) {
        console.error(`❌ Failed to send to device:`, error.message);
        results.push({
          ...recipientInfo,
          success: false,
          error: error.message
        });
        
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
      failed: failedCount,
      recipients: results
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
