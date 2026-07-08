const Occasion = require('../models/Occasion');
const Product = require('../models/Product');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

// @desc    Get all active occasions (public)
// @route   GET /api/occasions
// @access  Public
const getOccasions = async (req, res) => {
  try {
    const filter = { status: 'active' };
    
    // Support visible on homepage filtering if requested
    if (req.query.homepage === 'true') {
      filter.visibleOnHomepage = true;
    }
    
    const occasions = await Occasion.find(filter).sort({ displayOrder: 1, name: 1 });
    res.json(occasions);
  } catch (error) {
    console.error('Error fetching occasions:', error);
    res.status(500).json({ message: 'Error fetching occasions' });
  }
};

// @desc    Get all occasions (admin only)
// @route   GET /api/occasions/admin
// @access  Private/Admin
const getAdminOccasions = async (req, res) => {
  try {
    const occasions = await Occasion.find({}).sort({ displayOrder: 1, name: 1 });
    res.json(occasions);
  } catch (error) {
    console.error('Error fetching admin occasions:', error);
    res.status(500).json({ message: 'Error fetching occasions' });
  }
};

// @desc    Create new occasion
// @route   POST /api/occasions
// @access  Private/Admin
const createOccasion = async (req, res) => {
  try {
    const { name, slug, icon, banner, thumbnail, accentColor, displayOrder, status, featured, visibleOnHomepage, seoTitle, seoDescription } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const generatedSlug = slug ? slugify(slug) : slugify(name);
    
    const occasionExists = await Occasion.findOne({ slug: generatedSlug });
    if (occasionExists) {
      return res.status(400).json({ message: 'An occasion with this slug already exists' });
    }

    const occasion = await Occasion.create({
      name,
      slug: generatedSlug,
      icon: icon || 'Gift',
      banner: banner || '',
      thumbnail: thumbnail || '',
      accentColor: accentColor || '#D4AF37',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      status: status || 'active',
      featured: featured === true,
      visibleOnHomepage: visibleOnHomepage !== false,
      seoTitle: seoTitle || '',
      seoDescription: seoDescription || ''
    });

    res.status(201).json(occasion);
  } catch (error) {
    console.error('Error creating occasion:', error);
    res.status(500).json({ message: 'Error creating occasion' });
  }
};

// @desc    Update occasion
// @route   PUT /api/occasions/:id
// @access  Private/Admin
const updateOccasion = async (req, res) => {
  try {
    const occasion = await Occasion.findById(req.params.id);
    if (!occasion) {
      return res.status(404).json({ message: 'Occasion not found' });
    }

    const { name, slug, icon, banner, thumbnail, accentColor, displayOrder, status, featured, visibleOnHomepage, seoTitle, seoDescription } = req.body;

    if (name) occasion.name = name;
    if (slug) {
      const generatedSlug = slugify(slug);
      if (generatedSlug !== occasion.slug) {
        const occasionExists = await Occasion.findOne({ slug: generatedSlug });
        if (occasionExists) {
          return res.status(400).json({ message: 'An occasion with this slug already exists' });
        }
        occasion.slug = generatedSlug;
      }
    } else if (name && !slug) {
      // Re-generate slug if name changed but slug wasn't specified
      const generatedSlug = slugify(name);
      if (generatedSlug !== occasion.slug) {
        const occasionExists = await Occasion.findOne({ slug: generatedSlug });
        if (!occasionExists) {
          occasion.slug = generatedSlug;
        }
      }
    }

    if (icon !== undefined) occasion.icon = icon;
    if (banner !== undefined) occasion.banner = banner;
    if (thumbnail !== undefined) occasion.thumbnail = thumbnail;
    if (accentColor !== undefined) occasion.accentColor = accentColor;
    if (displayOrder !== undefined) occasion.displayOrder = typeof displayOrder === 'number' ? displayOrder : 0;
    if (status !== undefined) occasion.status = status;
    if (featured !== undefined) occasion.featured = featured;
    if (visibleOnHomepage !== undefined) occasion.visibleOnHomepage = visibleOnHomepage;
    if (seoTitle !== undefined) occasion.seoTitle = seoTitle;
    if (seoDescription !== undefined) occasion.seoDescription = seoDescription;

    const updatedOccasion = await occasion.save();
    res.json(updatedOccasion);
  } catch (error) {
    console.error('Error updating occasion:', error);
    res.status(500).json({ message: 'Error updating occasion' });
  }
};

// @desc    Delete occasion
// @route   DELETE /api/occasions/:id
// @access  Private/Admin
const deleteOccasion = async (req, res) => {
  try {
    const occasion = await Occasion.findById(req.params.id);
    if (!occasion) {
      return res.status(404).json({ message: 'Occasion not found' });
    }

    // Pull the deleted occasion ID from all associated products
    await Product.updateMany(
      { occasionIds: occasion._id },
      { $pull: { occasionIds: occasion._id } }
    );

    await Occasion.deleteOne({ _id: occasion._id });
    res.json({ message: 'Occasion deleted and removed from associated products' });
  } catch (error) {
    console.error('Error deleting occasion:', error);
    res.status(500).json({ message: 'Error deleting occasion' });
  }
};

module.exports = {
  getOccasions,
  getAdminOccasions,
  createOccasion,
  updateOccasion,
  deleteOccasion
};
