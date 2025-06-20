const Settings = require('../models/settings');

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

// Categories management
exports.getCategories = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings || !settings.categories) {
      // Return default categories
      const defaultCategories = [
        {
          id: 'bouquets',
          name: 'Bouquets',
          description: 'Handcrafted floral arrangements',
          image: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&q=85&w=800&auto=format&fit=crop',
          link: '/shop/bouquets',
          enabled: true,
          order: 0,
        },
        {
          id: 'plants',
          name: 'Plants',
          description: 'Indoor and outdoor greenery',
          image: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?ixlib=rb-4.0.3&q=85&w=800&auto=format&fit=crop',
          link: '/shop/plants',
          enabled: true,
          order: 1,
        },
        {
          id: 'gifts',
          name: 'Gifts',
          description: 'Thoughtful presents for any occasion',
          image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?ixlib=rb-4.0.3&q=85&w=800&auto=format&fit=crop',
          link: '/shop/gifts',
          enabled: true,
          order: 2,
        },
        {
          id: 'baskets',
          name: 'Baskets',
          description: 'Thoughtful presents for any occasion',
          image: '/images/d3.jpg',
          link: '/shop/baskets',
          enabled: true,
          order: 3,
        },
        {
          id: 'birthday',
          name: 'Birthday',
          description: 'Perfect floral gifts',
          image: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?ixlib=rb-4.0.3&q=85&w=800&auto=format&fit=crop',
          link: '/shop/birthday',
          enabled: true,
          order: 4,
        },
        {
          id: 'anniversary',
          name: 'Anniversary',
          description: 'Romantic arrangements',
          image: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?ixlib=rb-4.0.3&q=85&w=800&auto=format&fit=crop',
          link: '/shop/anniversary',
          enabled: true,
          order: 5,
        },
      ];
      return res.json(defaultCategories);
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