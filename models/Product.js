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
  },
  image: {
    type: String,
    default: "",
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

const productVideoSchema = mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['upload', 'youtube', 'vimeo', 'cloudinary', 'custom'],
    default: 'upload',
  },
  publicId: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  duration: {
    type: Number,
    default: 0,
  },
  thumbnailUrl: {
    type: String,
    default: '',
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 0,
  }
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
    videos: {
      type: [productVideoSchema],
      default: []
    },
    personalizationEnabled: {
      type: Boolean,
      default: false
    },
    personalizationType: {
      type: String,
      enum: ['name', 'word', 'text', 'letter-bouquet', 'custom-message'],
      default: 'name'
    },
    fieldLabel: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    minCharacters: {
      type: Number,
      default: 1
    },
    maxCharacters: {
      type: Number,
      default: 10
    },
    allowedCharacters: {
      alphabets: { type: Boolean, default: true },
      numbers: { type: Boolean, default: false },
      spaces: { type: Boolean, default: true },
      hyphen: { type: Boolean, default: false },
      ampersand: { type: Boolean, default: false },
      period: { type: Boolean, default: false },
      emoji: { type: Boolean, default: false }
    },
    personalizationRequired: {
      type: Boolean,
      default: false
    },
    textTransform: {
      type: String,
      enum: ['original', 'uppercase', 'lowercase', 'titlecase'],
      default: 'original'
    },
    helperText: {
      type: String,
      default: ''
    },
    pricePerCharacter: {
      type: Number,
      default: 0
    },
    baseIncludedCharacters: {
      type: Number,
      default: 0
    },
    maxExtraPrice: {
      type: Number,
      default: 0
    },
    originalImages: [
      {
        type: String,
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
    subcategory: {
      type: String,
      default: '',
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
      alias: "isNewArrival",
    },
    hidden: {
      type: Boolean,
      default: false,
    },
    sameDay: {
      type: Boolean,
      default: true,
    },
    // Approval status for vendor products
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved', // Admin products are auto-approved
    },
    rejectionReason: {
      type: String,
      default: '',
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
      useSameFlowerImage: {
        type: Boolean,
        default: false,
      },
      flowerGroupImage: {
        type: String,
        default: "",
      },
      useSameChocolateImage: {
        type: Boolean,
        default: false,
      },
      chocolateGroupImage: {
        type: String,
        default: "",
      },
    },
    // Valentine-specific fields
    productType: {
      type: String,
      enum: ['regular', 'valentine'],
      default: 'regular'
    },
    isValentineProduct: {
      type: Boolean,
      default: false
    },
    showInValentineShop: {
      type: Boolean,
      default: false
    },
    valentineCategories: {
      type: [String],
      default: []
    },
    valentineSections: {
      type: [String],
      default: []
    },
    availableDates: {
      type: [String],
      default: []
    },
    valentineBadge: {
      type: String,
      default: ''
    },
    featureInValentineHero: {
      type: Boolean,
      default: false
    },
    enableValentinePricing: {
      type: Boolean,
      default: false
    },
    dateWiseStock: {
      type: Map,
      of: Number,
      default: {}
    },
    dateWisePricing: {
      type: Map,
      of: Number,
      default: {}
    },
    dateWiseOffers: {
      type: Map,
      of: String,
      default: {}
    },
    dateWiseDeliveryCharges: {
      type: Map,
      of: Number,
      default: {}
    },
    valentineDate: {
      type: String,
      default: null,
      enum: [null, 'rose-day', 'propose-day', 'chocolate-day', 'teddy-day', 'promise-day', 'hug-day', 'valentines-day', 'celebration-day']
    },
    isValentineExclusive: {
      type: Boolean,
      default: false,
    },
    valentineCategory: {
      type: String,
      default: '',
    },
    valentineSeoTitle: {
      type: String,
      default: ''
    },
    valentineSeoDescription: {
      type: String,
      default: ''
    },
    valentineSlug: {
      type: String,
      default: ''
    },
    // Seasonal Campaign fields
    seasonalCampaigns: {
      type: [String],
      default: []
    },
    campaignSettings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
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
    displayOrders: {
      featured: {
        type: Number,
        default: 0
      },
      shop: {
        type: Number,
        default: 0
      },
      newArrivals: {
        type: Number,
        default: 0
      },
      recommended: {
        type: Number,
        default: 0
      },
      occasions: {
        valentine: { type: Number, default: 0 },
        mothersDay: { type: Number, default: 0 },
        fathersDay: { type: Number, default: 0 },
        friendshipDay: { type: Number, default: 0 },
        rakhi: { type: Number, default: 0 },
        diwali: { type: Number, default: 0 },
        newYear: { type: Number, default: 0 }
      },
      categories: {
        type: Map,
        of: Number,
        default: {}
      }
    },
    isRecommended: {
      type: Boolean,
      default: false
    },
    occasionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Occasion"
      }
    ],
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
