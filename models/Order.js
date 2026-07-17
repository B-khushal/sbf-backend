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
    required: false
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
    cardMessage: {
      type: String,
      maxlength: [150, 'Card message cannot exceed 150 characters']
    },
    deliverySpecialInstructions: {
      type: String,
      maxlength: [250, 'Delivery special instructions cannot exceed 250 characters']
    },
    deliveryDate: Date,
    timeSlot: String,
    latitude: {
      type: Number,
      default: 17.3912
    },
    longitude: {
      type: Number,
      default: 78.4326
    },
    deliveryRequired: {
      type: Boolean,
      default: true
    },
    // Mappls location fields
    formattedAddress: String,
    country: String,
    pincode: String,
    landmark: String,
    houseNo: String,
    floor: String,
    deliveryInstructions: String,
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'items.productModel',
      required: true
    },
    productModel: {
      type: String,
      required: true,
      enum: ['Product', 'AddonProduct'],
      default: 'Product'
    },
    title: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      default: ''
    },
    images: {
      type: [String],
      default: []
    },
    selectedVariant: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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
    },
    customization: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    characterCount: {
      type: Number,
      default: 0
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
    recipientZipCode: String,
    greetingCard: String,
    surpriseDelivery: Boolean,
    anonymousGift: Boolean,
    // Mappls location fields
    latitude: Number,
    longitude: Number,
    formattedAddress: String,
    country: String,
    pincode: String,
    landmark: String,
    houseNo: String,
    floor: String,
    deliveryInstructions: String,
  },
  totalAmount: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  },
  deliveryCharge: {
    type: Number,
    required: true,
    default: 150
  },
  discount: {
    type: Number,
    default: 0
  },
  finalTotal: {
    type: Number,
    required: true
  },
  isFirstOrderFreeDelivery: {
    type: Boolean,
    default: false
  },
  promoCode: {
    code: {
      type: String,
      uppercase: true,
      trim: true
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    promoCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode'
    }
  },
  currency: {
    type: String,
    enum: ['INR', 'USD', 'AED', 'EUR', 'GBP'],
    default: 'INR'
  },
  currencyRate: {
    type: Number,
    default: 1
  },
  originalCurrency: {
    type: String,
    enum: ['INR', 'USD', 'AED', 'EUR', 'GBP'],
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
  },
  isTestOrder: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'shippingDetails.phone': 1 });
orderSchema.index({ 'shippingDetails.fullName': 1 });
orderSchema.index({ 'shippingDetails.email': 1 });
orderSchema.index({ 'shippingDetails.deliveryDate': 1 });

// Add pre-save hook for order number generation
orderSchema.pre('save', async function(next) {
  // Set isTestOrder flag automatically if placeholder/test customer details are found
  try {
    const { checkIsPlaceholderCustomer } = require('../utils/testCustomerHelper');
    const check = checkIsPlaceholderCustomer(this);
    if (check.isPlaceholder) {
      this.isTestOrder = true;
    }
  } catch (err) {
    console.error('Error checking placeholder customer in pre-save hook:', err);
  }

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
