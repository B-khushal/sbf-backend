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

    const Category = require('../models/Category');
    const dbCategories = await Category.find({ status: 'active' }).sort({ sortOrder: 1, name: 1 });
    
    // Map dbCategories to the settings category structure
    const formattedCategories = dbCategories.map(cat => ({
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      link: cat.categoryUrl || `/${cat.slug}`,
      enabled: cat.status === 'active',
      order: cat.sortOrder || 0,
      priority: cat.sortOrder || 0,
      parentId: cat.parentId ? cat.parentId.toString() : null,
      showInShop: cat.showInShop !== false
    }));

    // Filter parents for homepage categories section
    const parentCategories = formattedCategories.filter(cat => !cat.parentId);

    res.json({
      heroSlides: settings.heroSlides || [],
      mobileBanners: settings.mobileBanners || [],
      promoBanners: settings.promoBanners || [],
      homeSections: settings.homeSections || [],
      categories: parentCategories,
      shopCategories: formattedCategories,
      headerSettings: settings.headerSettings || {},
      footerSettings: settings.footerSettings || {},
      notificationsSettings: settings.notificationsSettings || {},
      globalSettings: settings.globalSettings || {},
      deliverySettings: settings.deliverySettings || {},
      themeSettings: settings.themeSettings || {},
      productDisplaySettings: settings.productDisplaySettings || {},
      imageProtectionSettings: settings.imageProtectionSettings || {
        enableWatermark: true,
        watermarkText: "sbflorist.in",
        watermarkOpacity: 20,
        watermarkPosition: "Center + Bottom Right",
        watermarkSize: 30,
        watermarkRotation: -45,
        repeatingPattern: false
      },
      draftSettings: settings.draftSettings || null,
      history: settings.history || []
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ message: 'Error fetching all settings' });
  }
};

// Update all settings at once
exports.updateAllSettings = async (req, res) => {
  try {
    const { 
      heroSlides, 
      mobileBanners,
      promoBanners,
      homeSections, 
      categories, 
      shopCategories, 
      headerSettings, 
      footerSettings,
      notificationsSettings,
      globalSettings,
      deliverySettings,
      themeSettings,
      productDisplaySettings,
      imageProtectionSettings,
      isDraft = false
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Sync Categories to the Category database collection
    const mongoose = require('mongoose');
    const Category = require('../models/Category');

    const categoriesToSync = [];
    if (categories && Array.isArray(categories)) {
      categoriesToSync.push(...categories);
    }
    if (shopCategories && Array.isArray(shopCategories)) {
      categoriesToSync.push(...shopCategories);
    }

    // Deduplicate categories by ID or slug to avoid double-processing
    const uniqueCategories = [];
    const seenIds = new Set();
    for (const cat of categoriesToSync) {
      if (cat && cat.id && !seenIds.has(cat.id)) {
        seenIds.add(cat.id);
        uniqueCategories.push(cat);
      }
    }

    for (const cat of uniqueCategories) {
      const isMongoId = mongoose.Types.ObjectId.isValid(cat.id);
      const slugVal = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const urlVal = cat.link || `/${slugVal}`;
      const updateFields = {
        name: cat.name,
        slug: slugVal,
        description: cat.description || '',
        image: cat.image || '',
        categoryUrl: urlVal,
        status: cat.enabled ? 'active' : 'inactive',
        sortOrder: cat.priority !== undefined ? cat.priority : (cat.order || 0),
        parentId: cat.parentId && mongoose.Types.ObjectId.isValid(cat.parentId) ? cat.parentId : null,
        showInShop: cat.showInShop !== undefined ? cat.showInShop : cat.enabled
      };

      try {
        if (isMongoId) {
          await Category.findByIdAndUpdate(cat.id, updateFields, { new: true });
        } else {
          // If it is a new category, check if slug or URL exists to prevent duplicate key errors
          const existingCat = await Category.findOne({ $or: [{ slug: slugVal }, { categoryUrl: urlVal }] });
          if (!existingCat) {
            await Category.create(updateFields);
          }
        }
      } catch (catErr) {
        console.error(`Failed to sync category ${cat.name}:`, catErr.message);
      }
    }

    // Capture the payload for updating
    const updateData = {};
    if (heroSlides) updateData.heroSlides = heroSlides;
    if (mobileBanners) updateData.mobileBanners = mobileBanners;
    if (promoBanners) updateData.promoBanners = promoBanners;
    if (homeSections) updateData.homeSections = homeSections;
    if (categories) updateData.categories = categories;
    if (shopCategories) updateData.shopCategories = shopCategories;
    if (headerSettings) updateData.headerSettings = headerSettings;
    if (footerSettings) updateData.footerSettings = footerSettings;
    if (notificationsSettings) updateData.notificationsSettings = notificationsSettings;
    if (globalSettings) updateData.globalSettings = globalSettings;
    if (deliverySettings) updateData.deliverySettings = deliverySettings;
    if (themeSettings) updateData.themeSettings = themeSettings;
    if (productDisplaySettings) updateData.productDisplaySettings = productDisplaySettings;
    if (imageProtectionSettings) updateData.imageProtectionSettings = imageProtectionSettings;

    if (isDraft) {
      // Save draft settings
      settings.draftSettings = {
        ...(settings.draftSettings || {}),
        ...updateData,
        updatedAt: new Date()
      };
    } else {
      // Publish settings: save history first
      const previousState = {
        heroSlides: settings.heroSlides || [],
        mobileBanners: settings.mobileBanners || [],
        promoBanners: settings.promoBanners || [],
        homeSections: settings.homeSections || [],
        categories: settings.categories || [],
        shopCategories: settings.shopCategories || [],
        headerSettings: settings.headerSettings || {},
        footerSettings: settings.footerSettings || {},
        notificationsSettings: settings.notificationsSettings || {},
        globalSettings: settings.globalSettings || {},
        deliverySettings: settings.deliverySettings || {},
        themeSettings: settings.themeSettings || {},
        productDisplaySettings: settings.productDisplaySettings || {},
        imageProtectionSettings: settings.imageProtectionSettings || {},
        publishedAt: settings.updatedAt || new Date()
      };

      // Limit history to last 15 versions
      settings.history = [previousState, ...(settings.history || [])].slice(0, 15);

      // Apply changes to live settings
      if (heroSlides) settings.heroSlides = heroSlides;
      if (mobileBanners) settings.mobileBanners = mobileBanners;
      if (promoBanners) settings.promoBanners = promoBanners;
      if (homeSections) settings.homeSections = homeSections;
      if (categories) settings.categories = categories;
      if (shopCategories) settings.shopCategories = shopCategories;
      if (headerSettings) settings.headerSettings = headerSettings;
      if (footerSettings) settings.footerSettings = footerSettings;
      if (notificationsSettings) settings.notificationsSettings = notificationsSettings;
      if (globalSettings) settings.globalSettings = globalSettings;
      if (deliverySettings) settings.deliverySettings = deliverySettings;
      if (themeSettings) settings.themeSettings = themeSettings;
      if (productDisplaySettings) settings.productDisplaySettings = productDisplaySettings;
      if (imageProtectionSettings) settings.imageProtectionSettings = imageProtectionSettings;

      // Clear draftSettings since we published it
      settings.draftSettings = null;
    }

    settings.updatedAt = Date.now();
    await settings.save();

    res.json({
      success: true,
      heroSlides: settings.heroSlides,
      mobileBanners: settings.mobileBanners,
      promoBanners: settings.promoBanners,
      homeSections: settings.homeSections,
      categories: settings.categories,
      shopCategories: settings.shopCategories,
      headerSettings: settings.headerSettings,
      footerSettings: settings.footerSettings,
      notificationsSettings: settings.notificationsSettings,
      globalSettings: settings.globalSettings,
      deliverySettings: settings.deliverySettings,
      themeSettings: settings.themeSettings,
      productDisplaySettings: settings.productDisplaySettings,
      imageProtectionSettings: settings.imageProtectionSettings,
      draftSettings: settings.draftSettings,
      history: settings.history
    });
  } catch (error) {
    console.error('Error updating all settings:', error);
    res.status(500).json({ 
      message: 'Error updating all settings',
      error: error.message 
    });
  }
};

// Categories management
exports.getCategories = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings || !settings.categories) {
      // Return empty categories array
      return res.json([]);
    }

    res.json(settings.categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

exports.updateCategories = async (req, res) => {
  try {
    const { categories } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.categories = categories;
    await settings.save();

    res.json(settings.categories);
  } catch (error) {
    console.error('Error updating categories:', error);
    res.status(500).json({ message: 'Error updating categories' });
  }
};

// Shop Categories management
exports.getShopCategories = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings || !settings.shopCategories) {
      // Return empty categories array
      return res.json([]);
    }

    res.json(settings.shopCategories);
  } catch (error) {
    console.error('Error fetching shop categories:', error);
    res.status(500).json({ message: 'Error fetching shop categories' });
  }
};

exports.updateShopCategories = async (req, res) => {
  try {
    const { shopCategories } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    settings.shopCategories = shopCategories;
    await settings.save();

    res.json(settings.shopCategories);
  } catch (error) {
    console.error('Error updating shop categories:', error);
    res.status(500).json({ message: 'Error updating shop categories' });
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
          phone: "+91 9949683222",
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

// Get sample invoice PDF
exports.getSamplePdf = async (req, res) => {
  try {
    const { generateInvoiceHTML, generateInvoicePDF } = require('../services/emailNotificationService');
    
    const sampleOrderData = {
        order: {
            _id: 'sample_id_123',
            orderNumber: 'SBF-SAMPLE-2026',
            totalAmount: 1449,
            currency: 'INR',
            createdAt: new Date(),
            subtotal: 1299,
            deliveryFee: 200,
            promoCode: {
                code: 'WELCOME50',
                discount: 50
            },
            shippingDetails: {
                fullName: 'Khushal Prasad',
                address: 'Door No. 12-2-786/A & B, Najam Centre',
                apartment: 'Pillar No. 32, Rethi Bowli, Mehdipatnam',
                city: 'Hyderabad',
                state: 'Telangana',
                zipCode: '500028',
                phone: '+919949683222',
                deliveryDate: new Date(),
                timeSlot: '10:00 AM - 2:00 PM',
                deliveryOption: 'gift',
                receiverFirstName: 'Jane',
                receiverLastName: 'Doe',
                receiverPhone: '+919949683222',
                receiverAddress: 'Door No. 12-2-786/A & B, Najam Centre',
                receiverCity: 'Hyderabad',
                receiverState: 'Telangana',
                receiverZipCode: '500028',
                giftMessage: 'Hope these beautiful flowers brighten your day!'
            },
            items: [
                {
                    product: { title: 'Premium Red Roses Bouquet' },
                    quantity: 1,
                    price: 799,
                    finalPrice: 699
                },
                {
                    product: { title: 'Assorted Chocolate Truffles' },
                    quantity: 1,
                    price: 600,
                    finalPrice: 600
                }
            ],
            paymentDetails: {
                method: 'razorpay',
                paymentId: 'pay_sample123',
                status: 'Completed'
            }
        },
        customer: {
            name: 'Khushal Prasad',
            email: '2006sbf@gmail.com',
            phone: '+919949683222'
        }
    };

    const html = generateInvoiceHTML(sampleOrderData);
    const pdfBuffer = await generateInvoicePDF(html, 'SBF-SAMPLE-2026');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_invoice.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating sample PDF:', error);
    res.status(500).json({ message: 'Error generating sample PDF', error: error.message });
  }
};

// Restore settings to a historical version
exports.restoreSettingsVersion = async (req, res) => {
  try {
    const { versionIndex } = req.body;

    let settings = await Settings.findOne();
    if (!settings || !settings.history || settings.history.length === 0) {
      return res.status(404).json({ message: 'No history found' });
    }

    if (versionIndex < 0 || versionIndex >= settings.history.length) {
      return res.status(400).json({ message: 'Invalid version index' });
    }

    const targetVersion = settings.history[versionIndex];

    // Restore keys
    if (targetVersion.heroSlides) settings.heroSlides = targetVersion.heroSlides;
    if (targetVersion.mobileBanners) settings.mobileBanners = targetVersion.mobileBanners;
    if (targetVersion.promoBanners) settings.promoBanners = targetVersion.promoBanners;
    if (targetVersion.homeSections) settings.homeSections = targetVersion.homeSections;
    if (targetVersion.categories) settings.categories = targetVersion.categories;
    if (targetVersion.shopCategories) settings.shopCategories = targetVersion.shopCategories;
    if (targetVersion.headerSettings) settings.headerSettings = targetVersion.headerSettings;
    if (targetVersion.footerSettings) settings.footerSettings = targetVersion.footerSettings;
    if (targetVersion.notificationsSettings) settings.notificationsSettings = targetVersion.notificationsSettings;
    if (targetVersion.globalSettings) settings.globalSettings = targetVersion.globalSettings;
    if (targetVersion.deliverySettings) settings.deliverySettings = targetVersion.deliverySettings;
    if (targetVersion.themeSettings) settings.themeSettings = targetVersion.themeSettings;
    if (targetVersion.productDisplaySettings) settings.productDisplaySettings = targetVersion.productDisplaySettings;
    if (targetVersion.imageProtectionSettings) settings.imageProtectionSettings = targetVersion.imageProtectionSettings;

    settings.draftSettings = null; // Clear draft
    settings.updatedAt = Date.now();
    await settings.save();

    res.json({
      success: true,
      message: 'Version restored successfully',
      settings
    });
  } catch (error) {
    console.error('Error restoring settings version:', error);
    res.status(500).json({ message: 'Error restoring settings version', error: error.message });
  }
};

// Discard draft settings
exports.discardDraft = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    settings.draftSettings = null;
    await settings.save();

    res.json({
      success: true,
      message: 'Draft discarded successfully',
      draftSettings: null
    });
  } catch (error) {
    console.error('Error discarding draft settings:', error);
    res.status(500).json({ message: 'Error discarding draft settings', error: error.message });
  }
}; 

// Get WhatsApp widget settings
exports.getWhatsAppWidgetSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      await Settings.initializeDefaultSettings();
      settings = await Settings.findOne();
    }
    
    const defaults = {
      enabled: true,
      phoneNumber: '9949683222',
      position: 'right',
      message: "Hello! I'm interested in your flower arrangements.",
      showHoverCard: true,
      showFloatingAnimation: true,
      businessName: 'Spring Blossoms Florist',
      widgetTitle: 'WhatsApp Us',
      widgetSubtitle: 'Need help choosing flowers?',
      widgetSize: 'medium',
      iconStyle: 'circle',
      borderRadius: 12,
      shadowIntensity: 'medium',
      welcomeText: 'Chat with our floral experts.',
      ctaButtonText: 'Chat Now',
      onlineStatusText: 'Online',
      businessHoursMessage: 'Typically replies within minutes'
    };

    const whatsappFloating = settings.notificationsSettings?.whatsappFloating || {};
    res.json({ ...defaults, ...whatsappFloating });
  } catch (error) {
    console.error('Error fetching WhatsApp settings:', error);
    res.status(500).json({ message: 'Error fetching WhatsApp settings' });
  }
};

// Update WhatsApp widget settings
exports.updateWhatsAppWidgetSettings = async (req, res) => {
  try {
    const updates = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (!settings.notificationsSettings) {
      settings.notificationsSettings = {};
    }

    // Merge updates into whatsappFloating
    settings.notificationsSettings.whatsappFloating = {
      ...(settings.notificationsSettings.whatsappFloating || {}),
      ...updates
    };

    settings.markModified('notificationsSettings');
    await settings.save();

    res.json(settings.notificationsSettings.whatsappFloating);
  } catch (error) {
    console.error('Error updating WhatsApp settings:', error);
    res.status(500).json({ message: 'Error updating WhatsApp settings' });
  }
}; 