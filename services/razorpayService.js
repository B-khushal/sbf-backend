const Razorpay = require('razorpay');
const crypto = require('crypto');

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️ Razorpay credentials not found in environment variables. Using test credentials.');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_fHh9TCMdV85Zvj',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET'
});

const createOrder = async (amount, currency = 'INR') => {
  try {
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
    if (error.error) {
      throw new Error(`Razorpay API Error: ${error.error.description || error.error.message}`);
    }
    throw error;
  }
};

const verifyPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  try {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing required payment verification parameters');
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET';
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
  verifyPayment
}; 