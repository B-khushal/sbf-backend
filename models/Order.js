const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shippingDetails: {
    fullName: String,
    email: String,
    phone: String,
    address: String,
    apartment: String,
    city: String,
    state: String,
    zipCode: String,
    notes: String,
    deliveryDate: Date,
    timeSlot: String
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    finalPrice: {
      type: Number,
      required: true
    }
  }],
  paymentDetails: {
    method: {
      type: String,
      enum: ['credit-card', 'paypal', 'cash', 'razorpay'],
      required: true
    },
    last4: String,
    // Razorpay specific fields
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String
  },
  giftDetails: {
    message: String,
    recipientName: String,
    recipientEmail: String,
    recipientPhone: String,
    recipientAddress: String,
    recipientApartment: String,
    recipientCity: String,
    recipientState: String,
    recipientZipCode: String
  },
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP'],
    default: 'INR'
  },
  currencyRate: {
    type: Number,
    default: 1
  },
  originalCurrency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP'],
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'delivered'],
    default: 'pending'
  },
  stockUpdated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add pre-save hook for order number generation
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    this.orderNumber = `ORD-${year}${month}${day}-${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
