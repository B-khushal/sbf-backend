const mongoose = require("mongoose");

const reviewImageSchema = new mongoose.Schema(
  {
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxLength: 2000,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
      maxLength: 240,
    },
    alt: {
      type: String,
      default: "",
      trim: true,
      maxLength: 160,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

reviewImageSchema.index({ review: 1, sortOrder: 1 });
reviewImageSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("ReviewImage", reviewImageSchema);
