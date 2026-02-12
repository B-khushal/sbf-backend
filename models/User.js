const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'vendor'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    vendorStatus: {
        type: String,
        enum: ['pending', 'approved', 'suspended', 'rejected'],
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    phone: {
        type: String,
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
    },
    // Google OAuth fields
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    photoURL: {
        type: String
    },
    agreedToTerms: {
        type: Boolean,
        default: false,
    },
    // Cart and Wishlist fields
    cart: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        customizations: {
            type: mongoose.Schema.Types.Mixed,
            default: undefined
        },
        customPrice: {
            type: Number,
            default: undefined
        },
        selectedVariant: {
            label: String,
            price: Number,
            stock: Number
        }
    }],
    wishlist: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next();
    }
    
    // Don't hash password if it's already hashed or if it's a random string for OAuth users
    if (this.password && this.password.length < 50) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to update last active timestamp
userSchema.methods.updateLastActive = async function () {
    this.lastActive = new Date();
    await this.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;
