const mongoose = require('mongoose');

const homepageVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
      trim: true,
    },
    ctaText: {
      type: String,
      default: '',
      trim: true,
    },
    ctaLink: {
      type: String,
      default: '',
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true,
  }
);

// Indexing displayOrder and isActive for faster query performance
homepageVideoSchema.index({ displayOrder: 1, isActive: 1, deletedAt: 1 });

const HomepageVideo = mongoose.model('HomepageVideo', homepageVideoSchema);
module.exports = HomepageVideo;
