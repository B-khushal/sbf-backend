const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    title: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    discount: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      required: true,
    },
    categories: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: {
      type: Number,
      required: true,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    details: {
      type: [String],
      default: []
    },
    careInstructions: {
      type: [String],
      default: []
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

// ⚡ PERFORMANCE: Database indexes for fast queries
productSchema.index({ hidden: 1, isFeatured: 1, createdAt: -1 }); // Featured products
productSchema.index({ hidden: 1, isNew: 1, createdAt: -1 }); // New products
productSchema.index({ hidden: 1, rating: -1, numReviews: -1 }); // Top products
productSchema.index({ hidden: 1, category: 1, createdAt: -1 }); // Category filtering
productSchema.index({ hidden: 1, categories: 1, createdAt: -1 }); // Multi-category search
productSchema.index({ title: 'text', description: 'text' }); // Text search
productSchema.index({ countInStock: 1 }); // Low stock queries
productSchema.index({ createdAt: -1 }); // General sorting

// Virtual for getting reviews from Review model
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  options: { sort: { createdAt: -1 } }
});

// Enable virtuals in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
