const mongoose = require("mongoose");

const collectionSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    bannerImage: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "",
    },
    displayPriority: {
      type: Number,
      default: 0,
    },
    visibility: {
      type: String,
      enum: ["published", "hidden", "scheduled"],
      default: "published",
    },
    scheduleDate: {
      type: Date,
      default: null,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    seoTitle: {
      type: String,
      default: "",
    },
    seoDescription: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Collection = mongoose.model("Collection", collectionSchema);

module.exports = Collection;
