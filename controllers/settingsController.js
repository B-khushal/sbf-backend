const Settings = require('../models/settings');

// Get all hero slides
exports.getHeroSlides = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // Initialize default settings if none exist
    if (!settings) {
      await Settings.initializeDefaultSettings();
      settings = await Settings.findOne();
    }

    res.json(settings.heroSlides || []);
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({ message: 'Error fetching hero slides' });
  }
};

// Update hero slides
exports.updateHeroSlides = async (req, res) => {
  try {
    const { slides } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.heroSlides = slides;
    await settings.save();

    res.json(settings.heroSlides);
  } catch (error) {
    console.error('Error updating hero slides:', error);
    res.status(500).json({ message: 'Error updating hero slides' });
  }
};

// Get all home sections
exports.getHomeSections = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    // Initialize default settings if none exist
    if (!settings) {
      await Settings.initializeDefaultSettings();
      settings = await Settings.findOne();
    }

    res.json(settings.homeSections);
  } catch (error) {
    console.error('Error fetching home sections:', error);
    res.status(500).json({ message: 'Error fetching home sections' });
  }
};

// Update a specific section
exports.updateHomeSection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const updates = req.body;

    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const sectionIndex = settings.homeSections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Update the section
    settings.homeSections[sectionIndex] = {
      ...settings.homeSections[sectionIndex],
      ...updates
    };

    await settings.save();
    res.json(settings.homeSections[sectionIndex]);
  } catch (error) {
    console.error('Error updating home section:', error);
    res.status(500).json({ message: 'Error updating home section' });
  }
};

// Update all home sections
exports.updateHomeSections = async (req, res) => {
  try {
    const { sections } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.homeSections = sections;
    await settings.save();

    res.json(settings.homeSections);
  } catch (error) {
    console.error('Error updating home sections:', error);
    res.status(500).json({ message: 'Error updating home sections' });
  }
};

// Get all settings at once
exports.getAllSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      await Settings.initializeDefaultSettings();
      settings = await Settings.findOne();
    }

    res.json({
      heroSlides: settings.heroSlides || [],
      homeSections: settings.homeSections || [],
      categories: settings.categories || [],
      headerSettings: settings.headerSettings || {},
      footerSettings: settings.footerSettings || {}
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ message: 'Error fetching all settings' });
  }
};

// Update all settings at once
exports.updateAllSettings = async (req, res) => {
  try {
    const { heroSlides, homeSections, categories, headerSettings, footerSettings } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Validate hero slides before updating
    if (heroSlides) {
      const validSlides = heroSlides.every(slide => 
        slide.id && 
        slide.title && 
        slide.subtitle && 
        slide.image && 
        slide.ctaText && 
        slide.ctaLink && 
        typeof slide.enabled === 'boolean' && 
        typeof slide.order === 'number'
      );
      
      if (!validSlides) {
        return res.status(400).json({ 
          message: 'Invalid hero slides data. All required fields must be provided.',
          requiredFields: ['id', 'title', 'subtitle', 'image', 'ctaText', 'ctaLink', 'enabled', 'order']
        });
      }
      settings.heroSlides = heroSlides;
    }

    if (homeSections) settings.homeSections = homeSections;
    if (categories) settings.categories = categories;
    if (headerSettings) settings.headerSettings = headerSettings;
    if (footerSettings) settings.footerSettings = footerSettings;

    settings.updatedAt = Date.now();
    
    try {
      await settings.save();
    } catch (saveError) {
      console.error('Mongoose validation error:', saveError);
      return res.status(400).json({ 
        message: 'Failed to save settings due to validation errors',
        errors: saveError.errors
      });
    }

    res.json({
      heroSlides: settings.heroSlides,
      homeSections: settings.homeSections,
      categories: settings.categories,
      headerSettings: settings.headerSettings,
      footerSettings: settings.footerSettings
    });
  } catch (error) {
    console.error('Error updating all settings:', error);
    res.status(500).json({ 
      message: 'Error updating all settings',
      error: error.message 
    });
  }
};

// Get all categories with subcategories
exports.getCategories = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Organize categories into hierarchy
    const categories = settings.categories || [];
    const mainCategories = categories.filter(cat => !cat.parentCategory);
    const subCategories = categories.filter(cat => cat.parentCategory);

    // Attach subcategories to their parent categories
    const categoriesWithSubs = mainCategories.map(mainCat => ({
      ...mainCat.toObject(),
      subcategories: subCategories
        .filter(subCat => subCat.parentCategory?.toString() === mainCat._id?.toString())
        .sort((a, b) => a.order - b.order)
    }));

    // Sort main categories by order
    categoriesWithSubs.sort((a, b) => a.order - b.order);

    res.json(categoriesWithSubs);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update categories (including subcategories)
exports.updateCategories = async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) {
      return res.status(400).json({ message: 'Categories must be an array' });
    }

    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Flatten categories and subcategories into a single array
    const flattenedCategories = categories.reduce((acc, cat) => {
      const category = { ...cat };
      const subcategories = category.subcategories || [];
      delete category.subcategories;
      
      return [...acc, category, ...subcategories];
    }, []);

    // Validate categories
    for (const category of flattenedCategories) {
      if (!category.name || !category.slug) {
        return res.status(400).json({
          message: 'All categories must have a name and slug',
          category
        });
      }

      // Check for duplicate slugs
      const duplicateSlug = flattenedCategories.find(
        c => c.slug === category.slug && c._id !== category._id
      );
      if (duplicateSlug) {
        return res.status(400).json({
          message: 'Duplicate category slug found',
          slug: category.slug
        });
      }
    }

    // Update settings with flattened categories
    settings.categories = flattenedCategories;
    await settings.save();

    // Return categories in hierarchical format
    const mainCategories = flattenedCategories.filter(cat => !cat.parentCategory);
    const subCategories = flattenedCategories.filter(cat => cat.parentCategory);

    const categoriesWithSubs = mainCategories.map(mainCat => ({
      ...mainCat,
      subcategories: subCategories
        .filter(subCat => subCat.parentCategory?.toString() === mainCat._id?.toString())
        .sort((a, b) => a.order - b.order)
    }));

    categoriesWithSubs.sort((a, b) => a.order - b.order);

    res.json(categoriesWithSubs);
  } catch (error) {
    console.error('Error updating categories:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add new category
exports.addCategory = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const { name, slug, description, order, isActive, parentCategory, image } = req.body;

    // Basic validation
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    // Check if slug is unique
    const existingCategory = settings.categories.find(cat => cat.slug === slug);
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this slug already exists' });
    }

    // Create new category
    const newCategory = {
      name,
      slug,
      description,
      order: order || settings.categories.length,
      isActive: isActive !== undefined ? isActive : true,
      parentCategory,
      image
    };

    settings.categories.push(newCategory);
    await settings.save();
    res.status(201).json(settings.categories[settings.categories.length - 1]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const { categoryId } = req.params;
    const categoryIndex = settings.categories.findIndex(cat => cat._id.toString() === categoryId);

    if (categoryIndex === -1) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Basic validation for required fields if they're being updated
    if (req.body.name === '') {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    if (req.body.slug === '') {
      return res.status(400).json({ message: 'Slug cannot be empty' });
    }

    // Check slug uniqueness if it's being updated
    if (req.body.slug && req.body.slug !== settings.categories[categoryIndex].slug) {
      const existingCategory = settings.categories.find(
        cat => cat.slug === req.body.slug && cat._id.toString() !== categoryId
      );
      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this slug already exists' });
      }
    }

    Object.assign(settings.categories[categoryIndex], req.body);
    await settings.save();
    res.json(settings.categories[categoryIndex]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const { categoryId } = req.params;
    const categoryIndex = settings.categories.findIndex(cat => cat._id.toString() === categoryId);

    if (categoryIndex === -1) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has children
    const hasChildren = settings.categories.some(cat => 
      cat.parentCategory && cat.parentCategory.toString() === categoryId
    );
    if (hasChildren) {
      return res.status(400).json({ message: 'Cannot delete category with subcategories' });
    }

    settings.categories.splice(categoryIndex, 1);
    await settings.save();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Reorder categories
exports.reorderCategories = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const { categoryIds } = req.body;
    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ message: 'categoryIds must be an array' });
    }

    // Update order for each category
    categoryIds.forEach((id, index) => {
      const category = settings.categories.find(cat => cat._id.toString() === id);
      if (category) {
        category.order = index;
      }
    });

    await settings.save();
    res.json(settings.categories);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Header settings management
exports.getHeaderSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings || !settings.headerSettings) {
      // Return default header settings
      const defaultHeader = {
        logo: "/images/logosbf.png",
        navigationItems: [
          { id: "shop", label: "Shop", href: "/shop", enabled: true, order: 0 },
          { id: "about", label: "About", href: "/about", enabled: true, order: 1 },
          { id: "contact", label: "Contact", href: "/contact", enabled: true, order: 2 },
        ],
        searchPlaceholder: "Search for flowers...",
        showWishlist: true,
        showCart: true,
        showCurrencyConverter: true,
      };
      return res.json(defaultHeader);
    }

    res.json(settings.headerSettings);
  } catch (error) {
    console.error('Error fetching header settings:', error);
    res.status(500).json({ message: 'Error fetching header settings' });
  }
};

exports.updateHeaderSettings = async (req, res) => {
  try {
    const headerSettings = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.headerSettings = headerSettings;
    await settings.save();

    res.json(settings.headerSettings);
  } catch (error) {
    console.error('Error updating header settings:', error);
    res.status(500).json({ message: 'Error updating header settings' });
  }
};

// Footer settings management
exports.getFooterSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings || !settings.footerSettings) {
      // Return default footer settings
      const defaultFooter = {
        companyName: "Spring Blossoms Florist",
        description: "Curated floral arrangements and botanical gifts for every occasion, crafted with care and delivered with love.",
        socialLinks: [
          { platform: "Instagram", url: "https://www.instagram.com/sbf_india", enabled: true },
          { platform: "Facebook", url: "#", enabled: true },
          { platform: "Twitter", url: "#", enabled: true },
        ],
        contactInfo: {
          email: "2006sbf@gmail.com",
          phone: "+91 9849589710",
          address: "Door No. 12-2-786/A & B, Najam Centre, Pillar No. 32,Rethi Bowli, Mehdipatnam, Hyderabad, Telangana 500028"
        },
        links: [
          {
            section: "Shop",
            items: [
              { label: "Bouquets", href: "/shop/bouquets", enabled: true },
              { label: "Seasonal", href: "/shop/seasonal", enabled: true },
              { label: "Sale", href: "/shop/sale", enabled: true },
            ]
          },
          {
            section: "Company",
            items: [
              { label: "About Us", href: "/about", enabled: true },
              { label: "Blog", href: "/blog", enabled: true },
              { label: "Contact", href: "/contact", enabled: true },
            ]
          }
        ],
        copyright: `© ${new Date().getFullYear()} Spring Blossoms Florist. All rights reserved.`,
        showMap: true,
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3807.3484898316306!2d78.43144207424317!3d17.395055702585967!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb971c17e5196b%3A0x78305a92a4153749!2sSpring%20Blossoms%20Florist!5e0!3m2!1sen!2sin!4v1744469050804!5m2!1sen!2sin"
      };
      return res.json(defaultFooter);
    }

    res.json(settings.footerSettings);
  } catch (error) {
    console.error('Error fetching footer settings:', error);
    res.status(500).json({ message: 'Error fetching footer settings' });
  }
};

exports.updateFooterSettings = async (req, res) => {
  try {
    const footerSettings = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.footerSettings = footerSettings;
    await settings.save();

    res.json(settings.footerSettings);
  } catch (error) {
    console.error('Error updating footer settings:', error);
    res.status(500).json({ message: 'Error updating footer settings' });
  }
};

// Reorder sections
exports.reorderHomeSections = async (req, res) => {
  try {
    const { sections } = req.body;
    
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update sections with new order
    settings.homeSections = sections.map((section, index) => ({
      ...section,
      order: index
    }));

    await settings.save();
    res.json(settings.homeSections);
  } catch (error) {
    console.error('Error reordering home sections:', error);
    res.status(500).json({ message: 'Error reordering home sections' });
  }
};

// Update section content
exports.updateSectionContent = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { title, subtitle } = req.body;

    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    const sectionIndex = settings.homeSections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Update section content
    settings.homeSections[sectionIndex] = {
      ...settings.homeSections[sectionIndex],
      title,
      subtitle
    };

    await settings.save();
    res.json(settings.homeSections[sectionIndex]);
  } catch (error) {
    console.error('Error updating section content:', error);
    res.status(500).json({ message: 'Error updating section content' });
  }
};

// Get all settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}; 