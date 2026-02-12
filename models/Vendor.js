const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        unique: true
    },
    storeName: {
        type: String,
        required: true,
        unique: true
    },
    storeDescription: {
        type: String,
        required: true
    },
    storeLogo: {
        type: String
    },
    storeBanner: {
        type: String
    },
    storeAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, required: true }
    },
    contactInfo: {
        phone: { type: String, required: true },
        email: { type: String, required: true },
        website: { type: String }
    },
    businessInfo: {
        registrationNumber: { type: String },
        taxId: { type: String },
        businessType: {
            type: String,
            enum: ['individual', 'partnership', 'llc', 'corporation'],
            default: 'individual'
        }
    },
    bankDetails: {
        accountNumber: { type: String },
        routingNumber: { type: String },
        accountHolderName: { type: String },
        bankName: { type: String },
        // UPI details for Indian vendors
        upiId: { type: String }
    },
    commission: {
        rate: { type: Number, default: 10 }, // Default 10% commission
        type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'suspended', 'rejected'],
        default: 'pending'
    },
    verification: {
        isVerified: { type: Boolean, default: false },
        documentsSubmitted: { type: Boolean, default: false },
        verificationDate: { type: Date },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    subscription: {
        plan: {
            type: String,
            enum: ['basic', 'premium', 'enterprise'],
            default: 'basic'
        },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date },
        isActive: { type: Boolean, default: true }
    },
    storeSettings: {
        isStoreOpen: { type: Boolean, default: true },
        processingTime: { type: Number, default: 1 }, // Days
        shippingPolicy: { type: String },
        returnPolicy: { type: String },
        termsAndConditions: { type: String },
        acceptsReturns: { type: Boolean, default: true },
        returnWindow: { type: Number, default: 30 } // Days
    },
    salesSettings: {
        autoApproveOrders: { type: Boolean, default: true },
        allowBackorders: { type: Boolean, default: false },
        lowStockThreshold: { type: Number, default: 5 },
        notifyLowStock: { type: Boolean, default: true }
    },
    analytics: {
        totalProducts: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalCommissionPaid: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 }
    },
    socialMedia: {
        facebook: { type: String },
        instagram: { type: String },
        twitter: { type: String },
        youtube: { type: String }
    },
    documents: [{
        type: {
            type: String,
            enum: ['business_license', 'tax_certificate', 'identity_proof', 'address_proof', 'bank_statement'],
            required: true
        },
        url: { type: String, required: true },
        fileName: { type: String, required: true },
        uploadDate: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    }],
    notes: [{
        note: { type: String, required: true },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        addedAt: { type: Date, default: Date.now },
        type: {
            type: String,
            enum: ['general', 'warning', 'important'],
            default: 'general'
        }
    }]
}, {
    timestamps: true
});

// Index for efficient queries
vendorSchema.index({ user: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ storeName: 1 });
vendorSchema.index({ 'verification.isVerified': 1 });

// Virtual for full address
vendorSchema.virtual('fullAddress').get(function() {
    const { street, city, state, zipCode, country } = this.storeAddress;
    return `${street}, ${city}, ${state} ${zipCode}, ${country}`;
});

// Method to calculate earnings
vendorSchema.methods.calculateEarnings = function(totalSales) {
    if (this.commission.type === 'percentage') {
        const vendorEarnings = totalSales * (1 - this.commission.rate / 100);
        const platformCommission = totalSales * (this.commission.rate / 100);
        return { vendorEarnings, platformCommission };
    } else {
        const platformCommission = this.commission.rate;
        const vendorEarnings = Math.max(0, totalSales - platformCommission);
        return { vendorEarnings, platformCommission };
    }
};

// Method to update analytics
vendorSchema.methods.updateAnalytics = async function(updateData) {
    Object.keys(updateData).forEach(key => {
        if (this.analytics[key] !== undefined) {
            this.analytics[key] = updateData[key];
        }
    });
    await this.save();
};

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor; 