const mongoose = require("mongoose");

const reviewSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxLength: 1000,
    },
    // Enhanced features
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    images: [{
      type: String,
    }],
    pros: [{
      type: String,
      trim: true,
      maxLength: 200,
    }],
    cons: [{
      type: String,
      trim: true,
      maxLength: 200,
    }],
    // Review quality metrics
    helpfulVotes: {
      type: Number,
      default: 0,
    },
    totalVotes: {
      type: Number,
      default: 0,
    },
    // Users who voted on this review
    votedUsers: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      vote: {
        type: String,
        enum: ['helpful', 'not_helpful'],
      }
    }],
    // Review status and moderation
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'approved', // Auto-approve for now
    },
    moderatorNotes: {
      type: String,
      default: "",
    },
    // Additional product-specific ratings
    qualityRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    valueRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    // Review metadata
    deviceInfo: {
      type: String,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    // Response from vendor/admin
    response: {
      text: {
        type: String,
        default: "",
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      respondedAt: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ user: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ isVerifiedPurchase: 1 });
reviewSchema.index({ helpfulVotes: -1 });

// Virtual for helpfulness percentage
reviewSchema.virtual('helpfulnessPercentage').get(function() {
  if (this.totalVotes === 0) return 0;
  return Math.round((this.helpfulVotes / this.totalVotes) * 100);
});

// Virtual for average additional ratings
reviewSchema.virtual('additionalRatingsAverage').get(function() {
  const ratings = [this.qualityRating, this.valueRating, this.deliveryRating].filter(r => r !== null);
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
});

// Pre-save middleware to validate review uniqueness per user per product
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existingReview = await this.constructor.findOne({
      user: this.user,
      product: this.product,
    });
    
    if (existingReview) {
      const error = new Error('You have already reviewed this product');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Static method to get review statistics for a product
reviewSchema.statics.getProductReviewStats = async function(productId) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: {
          $push: '$rating'
        },
        verifiedPurchases: {
          $sum: { $cond: ['$isVerifiedPurchase', 1, 0] }
        },
        averageQualityRating: { $avg: '$qualityRating' },
        averageValueRating: { $avg: '$valueRating' },
        averageDeliveryRating: { $avg: '$deliveryRating' },
      }
    },
    {
      $project: {
        _id: 0,
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 1] },
        verifiedPurchases: 1,
        verifiedPurchasePercentage: {
          $round: [{ $multiply: [{ $divide: ['$verifiedPurchases', '$totalReviews'] }, 100] }, 1]
        },
        averageQualityRating: { $round: ['$averageQualityRating', 1] },
        averageValueRating: { $round: ['$averageValueRating', 1] },
        averageDeliveryRating: { $round: ['$averageDeliveryRating', 1] },
        ratingDistribution: {
          5: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 5] } } } },
          4: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 4] } } } },
          3: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 3] } } } },
          2: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 2] } } } },
          1: { $size: { $filter: { input: '$ratingDistribution', cond: { $eq: ['$$this', 1] } } } },
        }
      }
    }
  ]);

  return stats[0] || {
    totalReviews: 0,
    averageRating: 0,
    verifiedPurchases: 0,
    verifiedPurchasePercentage: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  };
};

// Static method to get helpful reviews
reviewSchema.statics.getHelpfulReviews = async function(productId, limit = 3) {
  return this.find({ 
    product: productId, 
    status: 'approved',
    totalVotes: { $gte: 5 }, // Only reviews with at least 5 votes
  })
  .sort({ helpfulVotes: -1, createdAt: -1 })
  .limit(limit)
  .populate('user', 'name')
  .lean();
};

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review; 