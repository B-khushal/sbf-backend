const SocialFeedPost = require('../models/SocialFeedPost');
const asyncHandler = require('express-async-handler');

// Helper to validate Instagram URLs
const validateInstagramUrl = (url) => {
  if (!url) return false;
  try {
    const cleanUrl = url.trim().toLowerCase();
    // Prepend protocol if missing to parse correctly
    const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
    
    // Check hostname is instagram.com
    if (!parsed.hostname.includes('instagram.com')) {
      return false;
    }
    
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const validTypes = ['p', 'reel', 'tv', 'reels'];
    
    // Check if path contains a valid Instagram post type followed by a shortcode
    const typeIndex = pathParts.findIndex(part => validTypes.includes(part));
    return typeIndex !== -1 && typeIndex + 1 < pathParts.length;
  } catch (e) {
    return false;
  }
};

// @desc    Get all social feed posts
// @route   GET /api/social-feed
// @access  Public
const getSocialFeedPosts = asyncHandler(async (req, res) => {
  const { active } = req.query;
  
  let query = {};
  if (active === 'true') {
    query.isActive = true;
  }

  const posts = await SocialFeedPost.find(query).sort({ displayOrder: 1, createdAt: -1 });
  res.json(posts);
});

// @desc    Create a new social feed post
// @route   POST /api/social-feed
// @access  Private/Admin
const createSocialFeedPost = asyncHandler(async (req, res) => {
  const { embedUrl, isActive } = req.body;

  if (!embedUrl) {
    res.status(400);
    throw new Error('Instagram Embed URL is required');
  }

  if (!validateInstagramUrl(embedUrl)) {
    res.status(400);
    throw new Error('Invalid Instagram URL. Accepted formats: instagram.com/p/*, instagram.com/reel/*, instagram.com/tv/*');
  }

  // Find next display order
  const count = await SocialFeedPost.countDocuments();

  const post = new SocialFeedPost({
    embedUrl: embedUrl.trim(),
    isActive: isActive !== undefined ? isActive : true,
    displayOrder: count,
  });

  const createdPost = await post.save();
  res.status(201).json(createdPost);
});

// @desc    Update a social feed post
// @route   PUT /api/social-feed/:id
// @access  Private/Admin
const updateSocialFeedPost = asyncHandler(async (req, res) => {
  const { embedUrl, isActive } = req.body;
  
  const post = await SocialFeedPost.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error('Social feed post not found');
  }

  if (embedUrl !== undefined) {
    if (!validateInstagramUrl(embedUrl)) {
      res.status(400);
      throw new Error('Invalid Instagram URL. Accepted formats: instagram.com/p/*, instagram.com/reel/*, instagram.com/tv/*');
    }
    post.embedUrl = embedUrl.trim();
  }

  if (isActive !== undefined) {
    post.isActive = isActive;
  }

  const updatedPost = await post.save();
  res.json(updatedPost);
});

// @desc    Delete a social feed post
// @route   DELETE /api/social-feed/:id
// @access  Private/Admin
const deleteSocialFeedPost = asyncHandler(async (req, res) => {
  const post = await SocialFeedPost.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error('Social feed post not found');
  }

  await post.deleteOne();

  // Re-sequence displayOrder for all remaining posts
  const posts = await SocialFeedPost.find().sort({ displayOrder: 1 });
  for (let i = 0; i < posts.length; i++) {
    posts[i].displayOrder = i;
    await posts[i].save();
  }

  res.json({ message: 'Social feed post removed successfully' });
});

// @desc    Reorder social feed posts
// @route   PATCH /api/social-feed/reorder
// @access  Private/Admin
const reorderSocialFeedPosts = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids)) {
    res.status(400);
    throw new Error('Invalid IDs array provided');
  }

  // Perform bulk update of displayOrder
  for (let i = 0; i < ids.length; i++) {
    await SocialFeedPost.findByIdAndUpdate(ids[i], { displayOrder: i });
  }

  const updatedPosts = await SocialFeedPost.find().sort({ displayOrder: 1 });
  res.json(updatedPosts);
});

module.exports = {
  getSocialFeedPosts,
  createSocialFeedPost,
  updateSocialFeedPost,
  deleteSocialFeedPost,
  reorderSocialFeedPosts,
};
