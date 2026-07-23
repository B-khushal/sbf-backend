const Collection = require('../models/Collection');
const asyncHandler = require('express-async-handler');

// @desc    Get all collections
// @route   GET /api/collections
// @access  Public
const getCollections = asyncHandler(async (req, res) => {
  const collections = await Collection.find({}).sort({ displayPriority: 1, createdAt: -1 });
  res.json({ collections });
});

// @desc    Get single collection by ID or slug
// @route   GET /api/collections/:idOrSlug
// @access  Public
const getCollectionByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const isObjectId = idOrSlug.match(/^[0-9a-fA-F]{24}$/);
  
  const collection = isObjectId
    ? await Collection.findById(idOrSlug).populate('products')
    : await Collection.findOne({ slug: idOrSlug }).populate('products');

  if (!collection) {
    res.status(404);
    throw new Error('Collection not found');
  }

  res.json({ collection });
});

// @desc    Create new collection
// @route   POST /api/collections
// @access  Private/Admin
const createCollection = asyncHandler(async (req, res) => {
  const { name, slug, description, bannerImage, icon, displayPriority, visibility, scheduleDate, products, seoTitle, seoDescription } = req.body;

  const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const existingCollection = await Collection.findOne({ slug: generatedSlug });
  if (existingCollection) {
    res.status(400);
    throw new Error('Collection with this slug already exists');
  }

  const collection = new Collection({
    name,
    slug: generatedSlug,
    description: description || '',
    bannerImage: bannerImage || '',
    icon: icon || '',
    displayPriority: displayPriority || 0,
    visibility: visibility || 'published',
    scheduleDate: scheduleDate || null,
    products: products || [],
    seoTitle: seoTitle || '',
    seoDescription: seoDescription || '',
  });

  const createdCollection = await collection.save();
  res.status(201).json({ collection: createdCollection });
});

// @desc    Update collection
// @route   PUT /api/collections/:id
// @access  Private/Admin
const updateCollection = asyncHandler(async (req, res) => {
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    res.status(404);
    throw new Error('Collection not found');
  }

  const { name, slug, description, bannerImage, icon, displayPriority, visibility, scheduleDate, products, seoTitle, seoDescription } = req.body;

  if (name) collection.name = name;
  if (slug) collection.slug = slug;
  if (description !== undefined) collection.description = description;
  if (bannerImage !== undefined) collection.bannerImage = bannerImage;
  if (icon !== undefined) collection.icon = icon;
  if (displayPriority !== undefined) collection.displayPriority = displayPriority;
  if (visibility) collection.visibility = visibility;
  if (scheduleDate !== undefined) collection.scheduleDate = scheduleDate;
  if (products) collection.products = products;
  if (seoTitle !== undefined) collection.seoTitle = seoTitle;
  if (seoDescription !== undefined) collection.seoDescription = seoDescription;

  const updatedCollection = await collection.save();
  res.json({ collection: updatedCollection });
});

// @desc    Delete collection
// @route   DELETE /api/collections/:id
// @access  Private/Admin
const deleteCollection = asyncHandler(async (req, res) => {
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    res.status(404);
    throw new Error('Collection not found');
  }

  await collection.deleteOne();
  res.json({ message: 'Collection removed' });
});

module.exports = {
  getCollections,
  getCollectionByIdOrSlug,
  createCollection,
  updateCollection,
  deleteCollection,
};
