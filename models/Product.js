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
    // Customization fields
    isCustomizable: {
      type: Boolean,
      default: false,
    },
    customizationOptions: {
      allowPhotoUpload: {
        type: Boolean,
        default: false,
      },
      allowCustomNumber: {
        type: Boolean,
        default: false,
      },
      customNumberLabel: {
        type: String,
        default: "Number",
      },
      allowFlowerAddons: {
        type: Boolean,
        default: false,
      },
      flowerAddons: [{
        name: String,
        price: Number,
        description: String,
        image: String,
      }],
      allowChocolateAddons: {
        type: Boolean,
        default: false,
      },
      chocolateAddons: [{
        name: String,
        price: Number,
        description: String,
        image: String,
      }],
      allowMessageCard: {
        type: Boolean,
        default: false,
      },
      messageCardPrice: {
        type: Number,
        default: 0,
      },
      baseLayoutImage: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

// Virtual for getting reviews from Review model
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  options: { sort: { createdAt: -1 } }
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
