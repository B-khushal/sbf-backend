const Category = require('../models/Category');
const Redirect = require('../models/Redirect');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const { search, status, parentId } = req.query;

  let query = {};

  if (status) {
    query.status = status;
  }

  if (parentId) {
    query.parentId = parentId === 'null' ? null : parentId;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const categories = await Category.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .populate('parentId', 'name slug');

  // Dynamically attach product count for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (cat) => {
      const count = await Product.countDocuments({
        $or: [
          { category: cat.name },
          { category: cat.slug },
          { categories: cat.name },
          { categories: cat.slug },
        ],
        hidden: { $ne: true },
        $or: [
          { approvalStatus: 'approved' },
          { approvalStatus: { $exists: false } }
        ]
      });

      return {
        ...cat.toObject(),
        productCount: count,
      };
    })
  );

  res.json(categoriesWithCounts);
});

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id).populate('parentId', 'name slug');

  if (category) {
    res.json(category);
  } else {
    res.status(404);
    throw new Error('Category not found');
  }
});

// @desc    Create new category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, image, seoTitle, seoDescription, status, sortOrder, parentId, showInShop } = req.body;

  // Auto-generate slug from name if not provided
  const categorySlug = slug
    ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  // Check unique slug
  const slugExists = await Category.findOne({ slug: categorySlug });
  if (slugExists) {
    res.status(400);
    throw new Error('A category with this slug already exists.');
  }

  // Generate categoryUrl based on parentId
  let parentSlug = '';
  if (parentId) {
    const parent = await Category.findById(parentId);
    if (parent) {
      parentSlug = parent.slug;
    }
  }

  const categoryUrl = parentId ? `/${parentSlug}/${categorySlug}` : `/${categorySlug}`;

  // Check unique categoryUrl
  const urlExists = await Category.findOne({ categoryUrl });
  if (urlExists) {
    res.status(400);
    throw new Error('A category with this URL already exists.');
  }

  const category = new Category({
    name,
    slug: categorySlug,
    description,
    image,
    seoTitle: seoTitle || name,
    seoDescription: seoDescription || description,
    categoryUrl,
    status: status || 'active',
    sortOrder: sortOrder || 0,
    parentId: parentId || null,
    showInShop: showInShop !== undefined ? showInShop : true,
  });

  const createdCategory = await category.save();
  res.status(201).json(createdCategory);
});

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, image, seoTitle, seoDescription, status, sortOrder, parentId, showInShop } = req.body;

  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const oldName = category.name;
  const oldSlug = category.slug;
  const oldUrl = category.categoryUrl;

  const newSlug = slug
    ? slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : category.slug;

  // Verify unique slug if changed
  if (newSlug !== oldSlug) {
    const slugExists = await Category.findOne({ slug: newSlug });
    if (slugExists) {
      res.status(400);
      throw new Error('A category with this slug already exists.');
    }
  }

  // Generate new categoryUrl
  let parentSlug = '';
  const resolvedParentId = parentId !== undefined ? parentId : category.parentId;
  
  if (resolvedParentId) {
    const parent = await Category.findById(resolvedParentId);
    if (parent) {
      parentSlug = parent.slug;
    }
  }

  const newUrl = resolvedParentId ? `/${parentSlug}/${newSlug}` : `/${newSlug}`;

  // Verify unique URL if changed
  if (newUrl !== oldUrl) {
    const urlExists = await Category.findOne({ categoryUrl: newUrl });
    if (urlExists) {
      res.status(400);
      throw new Error('A category with this URL already exists.');
    }

    // Add Redirect mapping old to new URL
    const existingRedirect = await Redirect.findOne({ fromUrl: oldUrl });
    if (existingRedirect) {
      existingRedirect.toUrl = newUrl;
      await existingRedirect.save();
    } else {
      await Redirect.create({ fromUrl: oldUrl, toUrl: newUrl });
    }
  }

  // Update Category fields
  category.name = name || category.name;
  category.slug = newSlug;
  category.description = description !== undefined ? description : category.description;
  category.image = image !== undefined ? image : category.image;
  category.seoTitle = seoTitle !== undefined ? seoTitle : category.seoTitle;
  category.seoDescription = seoDescription !== undefined ? seoDescription : category.seoDescription;
  category.status = status || category.status;
  category.sortOrder = sortOrder !== undefined ? sortOrder : category.sortOrder;
  category.parentId = resolvedParentId || null;
  category.showInShop = showInShop !== undefined ? showInShop : category.showInShop;
  category.categoryUrl = newUrl;

  const updatedCategory = await category.save();

  // Cascade updates to products if name or slug changed
  if (oldName !== category.name || oldSlug !== category.slug) {
    const productsToUpdate = await Product.find({
      $or: [
        { category: oldName },
        { category: oldSlug },
        { categories: oldName },
        { categories: oldSlug },
      ]
    });

    for (let product of productsToUpdate) {
      let modified = false;
      if (product.category === oldName || product.category === oldSlug) {
        product.category = category.name;
        modified = true;
      }
      if (product.categories && product.categories.length > 0) {
        product.categories = product.categories.map((c) => {
          if (c === oldName || c === oldSlug) {
            modified = true;
            return category.name;
          }
          return c;
        });
        // Remove duplicate category names
        product.categories = [...new Set(product.categories)];
      }
      if (modified) {
        await product.save();
      }
    }
  }

  // Cascade URL updates to children
  if (newSlug !== oldSlug || newUrl !== oldUrl) {
    const children = await Category.find({ parentId: category._id });
    for (let child of children) {
      const oldChildUrl = child.categoryUrl;
      const newChildUrl = `/${category.slug}/${child.slug}`;

      if (newChildUrl !== oldChildUrl) {
        child.categoryUrl = newChildUrl;
        await child.save();

        // Create redirects for child category
        await Redirect.create({ fromUrl: oldChildUrl, toUrl: newChildUrl });
      }
    }
  }

  res.json(updatedCategory);
});

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  const { reassignTo } = req.query;
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error('Category not found');
  }

  const productsReferencing = await Product.find({
    $or: [
      { category: category.name },
      { category: category.slug },
      { categories: category.name },
      { categories: category.slug },
    ]
  });

  if (productsReferencing.length > 0) {
    let reassignName = 'Uncategorized';
    
    if (reassignTo) {
      const reassignCat = await Category.findById(reassignTo);
      if (reassignCat) {
        reassignName = reassignCat.name;
      }
    }

    // Reassign products to target category or Uncategorized
    for (let product of productsReferencing) {
      if (product.category === category.name || product.category === category.slug) {
        product.category = reassignName;
      }
      if (product.categories && product.categories.length > 0) {
        product.categories = product.categories.map((c) => {
          if (c === category.name || c === category.slug) {
            return reassignName;
          }
          return c;
        });
        product.categories = [...new Set(product.categories)];
      }
      await product.save();
    }
  }

  // Delete category redirects
  await Redirect.deleteMany({
    $or: [
      { fromUrl: category.categoryUrl },
      { toUrl: category.categoryUrl }
    ]
  });

  await category.deleteOne();
  res.json({ message: 'Category removed successfully' });
});

// @desc    Bulk delete categories
// @route   POST /api/categories/bulk-delete
// @access  Private/Admin
const bulkDelete = asyncHandler(async (req, res) => {
  const { ids, reassignTo } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('No categories selected for deletion');
  }

  let reassignName = 'Uncategorized';
  if (reassignTo) {
    const reassignCat = await Category.findById(reassignTo);
    if (reassignCat) {
      reassignName = reassignCat.name;
    }
  }

  const categories = await Category.find({ _id: { $in: ids } });
  const categoryNamesAndSlugs = categories.flatMap(c => [c.name, c.slug]);
  const categoryUrls = categories.map(c => c.categoryUrl);

  // Reassign all matching products
  await Product.updateMany(
    { category: { $in: categoryNamesAndSlugs } },
    { $set: { category: reassignName } }
  );

  const productsWithArray = await Product.find({ categories: { $in: categoryNamesAndSlugs } });
  for (let product of productsWithArray) {
    product.categories = product.categories.map((c) => 
      categoryNamesAndSlugs.includes(c) ? reassignName : c
    );
    product.categories = [...new Set(product.categories)];
    await product.save();
  }

  // Delete redirects
  await Redirect.deleteMany({
    $or: [
      { fromUrl: { $in: categoryUrls } },
      { toUrl: { $in: categoryUrls } }
    ]
  });

  await Category.deleteMany({ _id: { $in: ids } });
  res.json({ message: 'Selected categories deleted successfully' });
});

// @desc    Bulk update status
// @route   POST /api/categories/bulk-status-update
// @access  Private/Admin
const bulkStatusUpdate = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('No categories selected');
  }

  if (!['active', 'inactive'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status value');
  }

  await Category.updateMany(
    { _id: { $in: ids } },
    { $set: { status } }
  );

  res.json({ message: 'Selected categories status updated successfully' });
});

// @desc    Bulk update showInShop
// @route   POST /api/categories/bulk-show-in-shop
// @access  Private/Admin
const bulkShowInShopUpdate = asyncHandler(async (req, res) => {
  const { ids, showInShop } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('No categories selected');
  }

  if (typeof showInShop !== 'boolean') {
    res.status(400);
    throw new Error('Invalid showInShop value (must be boolean)');
  }

  await Category.updateMany(
    { _id: { $in: ids } },
    { $set: { showInShop } }
  );

  res.json({ message: 'Selected categories shop visibility updated successfully' });
});

// @desc    Resolve a URL path to a category or redirect
// @route   GET /api/categories/resolve
// @access  Public
const resolveCategoryUrl = asyncHandler(async (req, res) => {
  const { url } = req.query;

  if (!url) {
    res.status(400);
    throw new Error('URL query parameter is required');
  }

  // Check Category
  const category = await Category.findOne({ categoryUrl: url, status: 'active' });
  if (category) {
    return res.json({ category });
  }

  // Check Redirect
  const redirect = await Redirect.findOne({ fromUrl: url });
  if (redirect) {
    return res.json({ redirect: true, to: redirect.toUrl });
  }

  res.status(404).json({ message: 'URL not found' });
});

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkDelete,
  bulkStatusUpdate,
  bulkShowInShopUpdate,
  resolveCategoryUrl,
};
