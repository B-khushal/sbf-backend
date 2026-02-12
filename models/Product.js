const mongoose = require("mongoose");

const addonOptionSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['flower', 'chocolate'],
    required: true,
  }
});

const priceVariantSchema = mongoose.Schema({
  label: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    default: 0,
  }
});

const comboItemVariantSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
});

const comboItemSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  image: {
    type: String,
    default: "",
  },
  price: {
    type: Number,
    required: true,
    default: 0,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  notes: {
    type: String,
    default: "",
  },
  customizationOptions: {
    allowMessage: {
      type: Boolean,
      default: false,
    },
    messageLabel: {
      type: String,
      default: "Message",
    },
    allowColorChoice: {
      type: Boolean,
      default: false,
    },
    colorOptions: {
      type: [String],
      default: [],
    },
    allowSizeChoice: {
      type: Boolean,
      default: false,
    },
    sizeOptions: {
      type: [String],
      default: [],
    },
    allowQuantity: {
      type: Boolean,
      default: false,
    },
    maxQuantity: {
      type: Number,
      default: 1,
    },
    allowPhotoUpload: {
      type: Boolean,
      default: false,
    },
    allowCustomText: {
      type: Boolean,
      default: false,
    },
    customTextLabel: {
      type: String,
      default: "Custom Text",
    },
    allowAddons: {
      type: Boolean,
      default: false,
    },
    addonOptions: {
      type: [String],
      default: [],
    },
    // Pricing variants for size/type selection
    variants: {
      type: [comboItemVariantSchema],
      default: [],
    },
    allowVariants: {
      type: Boolean,
      default: false,
    },
    variantLabel: {
      type: String,
      default: "Size",
    },
  },
});

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
    hasPriceVariants: {
      type: Boolean,
      default: false,
    },
    priceVariants: {
      type: [priceVariantSchema],
      default: [],
    },
    selectedVariant: {
      type: priceVariantSchema,
      default: null,
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
      allowNumberInput: {
        type: Boolean,
        default: false,
      },
      numberInputLabel: {
        type: String,
        default: "Enter number",
      },
      allowMessageCard: {
        type: Boolean,
        default: false,
      },
      messageCardPrice: {
        type: Number,
        default: 0,
      },
      addons: {
        flowers: [addonOptionSchema],
        chocolates: [addonOptionSchema],
      },
      previewImage: {
        type: String,
        default: "",
      },
    },
    // Combo-specific fields
    comboItems: {
      type: [comboItemSchema],
      default: [],
    },
    comboName: {
      type: String,
      default: "",
    },
    comboDescription: {
      type: String,
      default: "",
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
