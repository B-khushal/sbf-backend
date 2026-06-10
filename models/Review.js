const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxLength: 160,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
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
      maxLength: 1500,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "spam"],
      default: "pending",
      index: true,
    },
    moderatorNotes: {
      type: String,
      default: "",
      maxLength: 800,
    },
    moderationReason: {
      type: String,
      default: "",
      maxLength: 240,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredAt: {
      type: Date,
      default: null,
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    images: {
      type: [String],
      default: [],
    },
    imageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pros: {
      type: [String],
      default: [],
    },
    cons: {
      type: [String],
      default: [],
    },
    helpfulVotes: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    deviceInfo: {
      type: String,
      default: "",
      maxLength: 500,
    },
    ipAddress: {
      type: String,
      default: "",
      maxLength: 120,
    },
    source: {
      type: String,
      enum: ["product_page", "product_reviews_page", "order_history", "review_email"],
      default: "product_page",
    },
    editedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
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
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ product: 1, status: 1, pinned: -1, featured: -1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
reviewSchema.index({ orderId: 1, product: 1, user: 1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ helpfulVotes: -1, createdAt: -1 });

reviewSchema.virtual("helpfulnessPercentage").get(function helpfulnessPercentage() {
  if (!this.totalVotes) {
    return 0;
  }

  return Math.round((this.helpfulVotes / this.totalVotes) * 100);
});

reviewSchema.virtual("additionalRatingsAverage").get(function additionalRatingsAverage() {
  const ratings = [this.qualityRating, this.valueRating, this.deliveryRating].filter(
    (value) => typeof value === "number"
  );

  if (!ratings.length) {
    return null;
  }

  return Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10;
});

reviewSchema.statics.getProductReviewStats = async function getProductReviewStats(productId) {
  const stats = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating" },
        verifiedPurchases: {
          $sum: {
            $cond: [{ $eq: ["$isVerifiedPurchase", true] }, 1, 0],
          },
        },
        averageQualityRating: { $avg: "$qualityRating" },
        averageValueRating: { $avg: "$valueRating" },
        averageDeliveryRating: { $avg: "$deliveryRating" },
        imagesCount: { $sum: "$imageCount" },
        helpfulVotes: { $sum: "$helpfulVotes" },
        ratings: { $push: "$rating" },
      },
    },
    {
      $project: {
        _id: 0,
        totalReviews: 1,
        averageRating: { $round: ["$averageRating", 1] },
        verifiedPurchases: 1,
        verifiedPurchasePercentage: {
          $cond: [
            { $gt: ["$totalReviews", 0] },
            {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: ["$verifiedPurchases", "$totalReviews"],
                    },
                    100,
                  ],
                },
                1,
              ],
            },
            0,
          ],
        },
        averageQualityRating: { $round: ["$averageQualityRating", 1] },
        averageValueRating: { $round: ["$averageValueRating", 1] },
        averageDeliveryRating: { $round: ["$averageDeliveryRating", 1] },
        imagesCount: 1,
        helpfulVotes: 1,
        ratingDistribution: {
          5: {
            $size: {
              $filter: {
                input: "$ratings",
                cond: { $eq: ["$$this", 5] },
              },
            },
          },
          4: {
            $size: {
              $filter: {
                input: "$ratings",
                cond: { $eq: ["$$this", 4] },
              },
            },
          },
          3: {
            $size: {
              $filter: {
                input: "$ratings",
                cond: { $eq: ["$$this", 3] },
              },
            },
          },
          2: {
            $size: {
              $filter: {
                input: "$ratings",
                cond: { $eq: ["$$this", 2] },
              },
            },
          },
          1: {
            $size: {
              $filter: {
                input: "$ratings",
                cond: { $eq: ["$$this", 1] },
              },
            },
          },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      verifiedPurchases: 0,
      verifiedPurchasePercentage: 0,
      averageQualityRating: null,
      averageValueRating: null,
      averageDeliveryRating: null,
      imagesCount: 0,
      helpfulVotes: 0,
      ratingDistribution: {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      },
    }
  );
};

reviewSchema.set("toJSON", { virtuals: true });
reviewSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Review", reviewSchema);
