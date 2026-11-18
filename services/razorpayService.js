const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');

// Ensure environment variables are loaded
if (!process.env.RAZORPAY_KEY_ID) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ Razorpay credentials not found in environment variables! Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.');
}

// Get Razorpay credentials with detailed logging
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Debug logging for production
console.log('🔍 Environment Variables Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAZORPAY_KEY_ID from env:', process.env.RAZORPAY_KEY_ID ? 'SET' : 'NOT SET');
console.log('RAZORPAY_KEY_SECRET from env:', process.env.RAZORPAY_KEY_SECRET ? 'SET' : 'NOT SET');
console.log('Using Key ID:', RAZORPAY_KEY_ID);
console.log('Using Key Secret (first 4 chars):', RAZORPAY_KEY_SECRET ? RAZORPAY_KEY_SECRET.substring(0, 4) + '***' : 'NONE');

// Check if using live mode safely
const isLiveMode = () => {
  return !!(RAZORPAY_KEY_ID && typeof RAZORPAY_KEY_ID === 'string' && RAZORPAY_KEY_ID.startsWith('rzp_live_'));
};

// Validate key formats - separate validation for ID and Secret
const isValidRazorpayKeyId = (keyId) => {
  return typeof keyId === 'string' && keyId.startsWith('rzp_') && keyId.length > 10 && keyId !== 'YOUR_KEY_ID' && keyId !== 'rzp_live_YOUR_LIVE_KEY_ID';
};

const isValidRazorpayKeySecret = (keySecret) => {
  // Razorpay secrets are alphanumeric strings, typically 24 characters
  return typeof keySecret === 'string' && /^[A-Za-z0-9]{20,}$/.test(keySecret) && keySecret !== 'YOUR_KEY_SECRET' && keySecret !== 'YOUR_LIVE_KEY_SECRET';
};

if (!isValidRazorpayKeyId(RAZORPAY_KEY_ID)) {
  console.error('❌ Invalid Razorpay Key ID format:', RAZORPAY_KEY_ID);
}

if (!isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET)) {
  console.error('❌ Invalid Razorpay Key Secret format. Please set a valid key.');
}

const isLive = isLiveMode();

console.log('🔧 Razorpay Configuration:', {
  keyId: RAZORPAY_KEY_ID,
  keyIdValid: isValidRazorpayKeyId(RAZORPAY_KEY_ID),
  keySecretValid: isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET),
  isLive,
  mode: isLive ? 'LIVE' : 'TEST',
  environment: process.env.NODE_ENV || 'development'
});

// Important live mode warning
if (isLive) {
  console.log('🔴 LIVE MODE ACTIVE: Real payments will be processed!');
  console.log('🚨 Ensure you are in production environment for live transactions');
}

// Log validation results
if (isValidRazorpayKeyId(RAZORPAY_KEY_ID) && isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET)) {
  console.log('✅ Razorpay configuration is valid');
  console.log('✅ Razorpay service initialized successfully');
} else {
  console.log('❌ Razorpay configuration has errors - payment processing may fail');
}

let razorpay = null;
if (isValidRazorpayKeyId(RAZORPAY_KEY_ID) && isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET)) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
}

const createOrder = async (amount, currency = 'INR', customNotes = {}) => {
  try {
    // Validate Razorpay instance
    if (!isValidRazorpayKeyId(RAZORPAY_KEY_ID) || !isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET)) {
      throw new Error('Invalid Razorpay credentials. Please check your API keys.');
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount provided');
    }

    // Log the incoming amount for debugging
    console.log('💰 Incoming amount:', amount, typeof amount);

    // Ensure amount is a number
    const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(amountValue)) {
      throw new Error('Invalid amount format');
    }

    // Ensure amount is in paise (smallest currency unit)
    const amountInPaise = Math.round(amountValue);

    console.log('Creating Razorpay order with:', { 
      amount: amountInPaise,
      originalAmount: amount,
      currency,
      keyId: RAZORPAY_KEY_ID.substring(0, 10) + '...',
      isLive: isLiveMode()
    });
    
    // Clean and truncate custom notes to comply with Razorpay limits (max 15 key-value pairs, max 256 chars each)
    const cleanNotes = {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      originalAmount: amount
    };
    if (customNotes && typeof customNotes === 'object') {
      Object.keys(customNotes).forEach(k => {
        if (customNotes[k] !== undefined && customNotes[k] !== null) {
          cleanNotes[k] = String(customNotes[k]).substring(0, 250);
        }
      });
    }

    const options = {
      amount: amountInPaise,
      currency: currency,
      receipt: `order_${Date.now()}`,
      notes: cleanNotes
    };

    console.log('Razorpay options:', {
      ...options,
      amount: options.amount,
      currency: options.currency
    });
    
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created successfully:', {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    });
    
    return order;
  } catch (error) {
    console.error('Detailed error in createOrder:', error);
    
    // Handle specific Razorpay API errors
    if (error.error) {
      const errorCode = error.error.code;
      const errorDescription = error.error.description || error.error.message;
      
      console.error('Razorpay API Error Details:', {
        code: errorCode,
        description: errorDescription,
        error: error.error
      });
      
      if (errorCode === 'BAD_REQUEST_ERROR') {
        if (errorDescription.includes('key_id')) {
          throw new Error('Invalid Razorpay Key ID. Please check your API credentials.');
        } else if (errorDescription.includes('key_secret')) {
          throw new Error('Invalid Razorpay Key Secret. Please check your API credentials.');
        }
      }
      
      throw new Error(`Razorpay API Error (${errorCode}): ${errorDescription}`);
    }
    
    throw error;
  }
};

const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  try {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing required payment verification parameters');
    }

    if (!isValidRazorpayKeySecret(RAZORPAY_KEY_SECRET)) {
      throw new Error('Invalid Razorpay Key Secret for payment verification');
    }

    const secret = RAZORPAY_KEY_SECRET;
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', secret)
      .update(sign.toString())
      .digest('hex');

    const isValid = razorpay_signature === expectedSign;
    console.log('Payment verification result:', isValid);
    
    return isValid;
  } catch (error) {
    console.error('Detailed error in verifyPayment:', error);
    throw error;
  }
};

const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature || !rawBody) return false;
  const candidates = [
    process.env.RAZORPAY_WEBHOOK_SECRET,
    process.env.RAZORPAY_KEY_SECRET
  ].filter(Boolean);

  const rawBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

  for (const secret of candidates) {
    try {
      const expected = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expBuffer = Buffer.from(expected, 'utf8');
      if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(expBuffer, sigBuffer)) {
        return true;
      }
    } catch (e) {
      console.warn('Webhook signature check candidate error:', e.message);
    }
  }
  return false;
};

const fetchPayment = async (paymentId) => {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (error) {
    console.error('Error fetching Razorpay payment:', error);
    throw error;
  }
};

const fetchOrder = async (orderId) => {
  try {
    return await razorpay.orders.fetch(orderId);
  } catch (error) {
    console.error('Error fetching Razorpay order:', error);
    throw error;
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  verifyWebhookSignature,
  fetchPayment,
  fetchOrder,
  razorpay,
  isValidRazorpayKeyId,
  isValidRazorpayKeySecret,
  isLiveMode,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET
}; 