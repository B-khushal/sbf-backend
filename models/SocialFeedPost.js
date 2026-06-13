const mongoose = require('mongoose');

const socialFeedPostSchema = new mongoose.Schema(
  {
    embedUrl: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'social_feed_posts',
  }
);

const SocialFeedPost = mongoose.model('SocialFeedPost', socialFeedPostSchema);
module.exports = SocialFeedPost;
