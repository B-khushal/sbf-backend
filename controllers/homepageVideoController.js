const HomepageVideo = require('../models/HomepageVideo');
const expressAsyncHandler = require('express-async-handler');

// @desc    Get all homepage videos (Admin only)
// @route   GET /api/homepage-videos
// @access  Private/Admin
exports.getVideos = expressAsyncHandler(async (req, res) => {
  const showDeleted = req.query.showDeleted === 'true';
  
  let query = { deletedAt: null };
  if (showDeleted) {
    query = { deletedAt: { $ne: null } };
  }

  const videos = await HomepageVideo.find(query).sort({ displayOrder: 1, createdAt: -1 });
  res.status(200).json(videos);
});

// @desc    Get active homepage videos (Public)
// @route   GET /api/homepage-videos/active
// @access  Public
exports.getActiveVideos = expressAsyncHandler(async (req, res) => {
  const videos = await HomepageVideo.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1 });
  res.status(200).json(videos);
});

// @desc    Create a homepage video
// @route   POST /api/homepage-videos
// @access  Private/Admin
exports.createVideo = expressAsyncHandler(async (req, res) => {
  const { title, description, videoUrl, thumbnailUrl, ctaText, ctaLink, displayOrder, isActive, isFeatured } = req.body;

  if (!title || !videoUrl || !thumbnailUrl) {
    res.status(400);
    throw new Error('Title, video URL, and thumbnail URL are required.');
  }

  // Find max displayOrder to append if displayOrder is not provided
  let finalDisplayOrder = displayOrder;
  if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
    const lastVideo = await HomepageVideo.findOne({ deletedAt: null }).sort({ displayOrder: -1 });
    finalDisplayOrder = lastVideo ? lastVideo.displayOrder + 1 : 0;
  }

  const video = await HomepageVideo.create({
    title,
    description,
    videoUrl,
    thumbnailUrl,
    ctaText,
    ctaLink,
    displayOrder: finalDisplayOrder,
    isActive: isActive !== undefined ? isActive : true,
    isFeatured: isFeatured !== undefined ? isFeatured : false,
  });

  res.status(201).json(video);
});

// @desc    Update a homepage video
// @route   PUT /api/homepage-videos/:id
// @access  Private/Admin
exports.updateVideo = expressAsyncHandler(async (req, res) => {
  const video = await HomepageVideo.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  // If restoring via PUT, set deletedAt to null
  if (req.body.restore === true) {
    video.deletedAt = null;
  }

  const fieldsToUpdate = [
    'title',
    'description',
    'videoUrl',
    'thumbnailUrl',
    'ctaText',
    'ctaLink',
    'displayOrder',
    'isActive',
    'isFeatured'
  ];

  fieldsToUpdate.forEach((field) => {
    if (req.body[field] !== undefined) {
      video[field] = req.body[field];
    }
  });

  const updatedVideo = await video.save();
  res.status(200).json(updatedVideo);
});

// @desc    Soft delete a homepage video
// @route   DELETE /api/homepage-videos/:id
// @access  Private/Admin
exports.deleteVideo = expressAsyncHandler(async (req, res) => {
  const video = await HomepageVideo.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  video.deletedAt = new Date();
  await video.save();

  res.status(200).json({ message: 'Video soft deleted successfully', id: video._id });
});

// @desc    Restore a soft-deleted homepage video
// @route   PATCH /api/homepage-videos/:id/restore
// @access  Private/Admin
exports.restoreVideo = expressAsyncHandler(async (req, res) => {
  const video = await HomepageVideo.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  video.deletedAt = null;
  const restoredVideo = await video.save();

  res.status(200).json({ message: 'Video restored successfully', video: restoredVideo });
});

// @desc    Reorder homepage videos
// @route   PATCH /api/homepage-videos/reorder
// @access  Private/Admin
exports.reorderVideos = expressAsyncHandler(async (req, res) => {
  const { order } = req.body;

  if (!order || !Array.isArray(order)) {
    res.status(400);
    throw new Error('An array of video orders is required.');
  }

  const bulkOps = order.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { displayOrder: item.displayOrder },
    },
  }));

  if (bulkOps.length > 0) {
    await HomepageVideo.bulkWrite(bulkOps);
  }

  res.status(200).json({ message: 'Homepage videos reordered successfully' });
});

// @desc    Update/Toggle active status of a video
// @route   PATCH /api/homepage-videos/status OR PATCH /api/homepage-videos/:id/status
// @access  Private/Admin
exports.updateStatus = expressAsyncHandler(async (req, res) => {
  const id = req.params.id || req.body.id;
  const isActive = req.body.isActive;

  if (!id) {
    res.status(400);
    throw new Error('Video ID is required.');
  }

  const video = await HomepageVideo.findById(id);

  if (!video) {
    res.status(404);
    throw new Error('Video not found');
  }

  video.isActive = isActive !== undefined ? isActive : !video.isActive;
  const updatedVideo = await video.save();

  res.status(200).json(updatedVideo);
});
