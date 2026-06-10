const mongoose = require("mongoose");

const reviewLikeSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reactionType: {
      type: String,
      enum: ["helpful"],
      default: "helpful",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewLikeSchema.index({ review: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("ReviewLike", reviewLikeSchema);
