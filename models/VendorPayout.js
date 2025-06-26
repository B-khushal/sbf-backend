const mongoose = require('mongoose');

const vendorPayoutSchema = new mongoose.Schema({
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Vendor'
    },
    period: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true }
    },
    summary: {
        totalSales: { type: Number, required: true, default: 0 },
        totalOrders: { type: Number, required: true, default: 0 },
        commissionRate: { type: Number, required: true },
        platformCommission: { type: Number, required: true, default: 0 },
        vendorEarnings: { type: Number, required: true, default: 0 },
        processingFees: { type: Number, default: 0 },
        adjustments: { type: Number, default: 0 }, // For refunds, disputes, etc.
        finalAmount: { type: Number, required: true, default: 0 }
    },
    orders: [{
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true
        },
        orderNumber: { type: String, required: true },
        amount: { type: Number, required: true },
        commission: { type: Number, required: true },
        vendorEarning: { type: Number, required: true },
        date: { type: Date, required: true }
    }],
    payoutDetails: {
        method: {
            type: String,
            enum: ['bank_transfer', 'upi', 'paypal', 'stripe'],
            required: true
        },
        accountDetails: {
            accountNumber: String,
            routingNumber: String,
            upiId: String,
            paypalEmail: String,
            stripeAccountId: String
        },
        transactionId: String,
        transactionFee: { type: Number, default: 0 }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: Date,
    notes: String,
    documents: [{
        type: String, // Document type
        url: String,
        uploadDate: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// Index for efficient queries
vendorPayoutSchema.index({ vendor: 1, 'period.startDate': 1 });
vendorPayoutSchema.index({ status: 1 });
vendorPayoutSchema.index({ createdAt: -1 });

// Method to calculate final payout amount
vendorPayoutSchema.methods.calculateFinalAmount = function() {
    const { vendorEarnings, processingFees, adjustments } = this.summary;
    this.summary.finalAmount = vendorEarnings - processingFees + adjustments;
    return this.summary.finalAmount;
};

const VendorPayout = mongoose.model('VendorPayout', vendorPayoutSchema);
module.exports = VendorPayout; 