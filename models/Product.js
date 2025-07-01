const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    category: {
      type: String,
      required: true,
    },
    categories: [
      {
        type: String,
      },
    ],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    countInStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    details: {
      type: Map,
      of: String,
      default: new Map(),
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tags: [
      {
        type: String,
      },
    ],
    seoTitle: String,
    seoDescription: String,
    seoKeywords: [String],
  },
  {
    timestamps: true,
  }
);

// ⚡ PERFORMANCE: Database indexes for fast queries
productSchema.index({ hidden: 1, featured: 1, createdAt: -1 }); // Featured products
productSchema.index({ hidden: 1, isNew: 1, createdAt: -1 }); // New products
productSchema.index({ hidden: 1, category: 1, createdAt: -1 }); // Category filtering
productSchema.index({ hidden: 1, categories: 1, createdAt: -1 }); // Multi-category search
productSchema.index({ title: 'text', description: 'text' }); // Text search
productSchema.index({ countInStock: 1 }); // Low stock queries
productSchema.index({ createdAt: -1 }); // General sorting

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
