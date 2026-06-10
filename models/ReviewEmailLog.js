const mongoose = require("mongoose");

const reviewEmailLogSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 120,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxLength: 160,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxLength: 160,
    },
    reviewUrl: {
      type: String,
      required: true,
      trim: true,
      maxLength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    templateKey: {
      type: String,
      default: "review-request-v1",
      trim: true,
      maxLength: 120,
    },
    messageId: {
      type: String,
      default: "",
      trim: true,
      maxLength: 240,
    },
    errorMessage: {
      type: String,
      default: "",
      maxLength: 1200,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

reviewEmailLogSchema.index({ order: 1, product: 1, createdAt: -1 });
reviewEmailLogSchema.index({ customerEmail: 1, createdAt: -1 });

module.exports = mongoose.model("ReviewEmailLog", reviewEmailLogSchema);
