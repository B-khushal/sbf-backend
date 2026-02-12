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
    },
    customizations: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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
    enum: ['order_placed', 'received', 'being_made', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'order_placed'
  },
  trackingHistory: [{
    status: {
      type: String,
      enum: ['order_placed', 'received', 'being_made', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    message: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
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
    this.orderNumber = `${year}${month}${(count + 1).toString().padStart(3, '0')}${day}`;
  }
  
  // Track status changes
  if (this.isModified('status') || this.isNew) {
    const statusMessages = {
      'order_placed': 'Order has been placed successfully',
      'received': 'Order has been received and is being reviewed',
      'being_made': 'Your beautiful arrangement is being prepared',
      'out_for_delivery': 'Order is out for delivery',
      'delivered': 'Order has been delivered successfully',
      'cancelled': 'Order has been cancelled'
    };
    
    this.trackingHistory.push({
      status: this.status,
      message: statusMessages[this.status] || `Status updated to ${this.status}`,
      timestamp: new Date()
    });
  }
  
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
