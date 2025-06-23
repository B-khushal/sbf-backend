const Razorpay = require('razorpay');
const crypto = require('crypto');

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️ Razorpay credentials not found in environment variables. Using test credentials.');
}

// Get Razorpay credentials
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_OH8BIkxm62f30M';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'vf7ObUNADVIxzpMaTBNOFbsV';

// Validate key format
const isValidRazorpayKey = (key) => {
  return key && key.startsWith('rzp_') && key.length > 10 && key !== 'YOUR_KEY_SECRET';
};

if (!isValidRazorpayKey(RAZORPAY_KEY_ID)) {
  console.error('❌ Invalid Razorpay Key ID format:', RAZORPAY_KEY_ID);
}

if (!isValidRazorpayKey(RAZORPAY_KEY_SECRET)) {
  console.error('❌ Invalid Razorpay Key Secret format. Please set a valid key.');
}

console.log('🔧 Razorpay Configuration:', {
  keyId: RAZORPAY_KEY_ID,
  keyIdValid: isValidRazorpayKey(RAZORPAY_KEY_ID),
  keySecretValid: isValidRazorpayKey(RAZORPAY_KEY_SECRET),
  environment: process.env.NODE_ENV || 'development'
});

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

const createOrder = async (amount, currency = 'INR') => {
  try {
    // Validate Razorpay instance
    if (!isValidRazorpayKey(RAZORPAY_KEY_ID) || !isValidRazorpayKey(RAZORPAY_KEY_SECRET)) {
      throw new Error('Invalid Razorpay credentials. Please check your API keys.');
    }

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount provided');
    }

    // Ensure amount is in paise (smallest currency unit)
    const amountInPaise = Math.round(amount);

    console.log('Creating Razorpay order with:', { amountInPaise, currency });
    
    const options = {
      amount: amountInPaise,
      currency: currency,
      receipt: `order_${Date.now()}`,
    };

    console.log('Razorpay options:', options);
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created successfully:', order);
    
    return order;
  } catch (error) {
    console.error('Detailed error in createOrder:', error);
    
    // Handle specific Razorpay API errors
    if (error.error) {
      const errorCode = error.error.code;
      const errorDescription = error.error.description || error.error.message;
      
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

    if (!isValidRazorpayKey(RAZORPAY_KEY_SECRET)) {
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

module.exports = {
  createOrder,
  verifyPayment,
  isValidRazorpayKey,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET
}; 