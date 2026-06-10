const mongoose = require("mongoose");

const reviewReplySchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },
    parentReply: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReviewReply",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 120,
    },
    authorRole: {
      type: String,
      enum: ["user", "admin", "vendor"],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxLength: 1500,
    },
    isAdminReply: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewReplySchema.index({ review: 1, createdAt: 1 });

module.exports = mongoose.model("ReviewReply", reviewReplySchema);
