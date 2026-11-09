const prisma = require('../config/prisma');

const defaultSections = [
  { id: 'hero', name: 'Hero Banner & Countdown', enabled: true, order: 1 },
  { id: 'categories', name: 'Valentine Categories Grid', enabled: true, order: 2 },
  { id: 'gift-finder', name: 'Interactive Gift Finder', enabled: true, order: 3 },
  { id: 'bestsellers', name: 'Valentine Bestsellers', enabled: true, order: 4 },
  { id: 'roses', name: 'Fresh Roses Collection', enabled: true, order: 5 },
  { id: 'bouquets', name: 'Romantic Bouquets', enabled: true, order: 6 },
  { id: 'cakes-combos', name: 'Cakes & Romantic Treats', enabled: true, order: 7 },
  { id: 'combos', name: 'Curated Valentine Combos', enabled: true, order: 8 },
  { id: 'gifts-for-her', name: 'Romantic Gifts For Her', enabled: true, order: 9 },
  { id: 'gifts-for-him', name: 'Special Gifts For Him', enabled: true, order: 10 },
  { id: 'premium', name: 'Luxury & Midnight Specials', enabled: true, order: 11 },
  { id: 'valentine-week', name: "Valentine's Week 7-14 Feb", enabled: true, order: 12 },
  { id: 'budget', name: 'Budget Friendly (Under ₹999)', enabled: true, order: 13 },
  { id: 'reviews', name: 'Real Customer Stories & Ratings', enabled: true, order: 14 },
  { id: 'why-choose', name: 'Why Choose SBFlorist Hyderabad', enabled: true, order: 15 },
  { id: 'faqs', name: 'Valentine FAQs & Delivery Help', enabled: true, order: 16 }
];

class ValentineSettingsDocument {
  constructor(data) {
    if (data.data && typeof data.data === 'object') {
      Object.assign(this, data.data);
    } else {
      Object.assign(this, data);
    }
    this._id = data.id || 'val_set_default';
    this.enabled = this.enabled !== false;
    this.general = this.general || {
      campaignName: "Valentine's Week 2026",
      startDate: new Date('2026-02-07'),
      endDate: new Date('2026-02-15'),
      countdownTargetDate: new Date('2026-02-14')
    };
    this.mobileNavigation = this.mobileNavigation || {
      enableValentineButton: true,
      valentineLabel: "LOVE",
      valentineIcon: "heart"
    };
    this.timeline = this.timeline || [];
    this.giftBuilderItems = this.giftBuilderItems || [];
    this.heroSlides = this.heroSlides || [];
    this.marketing = this.marketing || {};
    this.banners = this.banners || {};
    this.sections = Array.isArray(this.sections) && this.sections.length > 0 ? this.sections : defaultSections;
  }

  markModified() { return true; }
  async populate() { return this; }
  toObject() { return { ...this }; }

  async save() {
    const rawData = { ...this };
    delete rawData._id;
    delete rawData.id;
    
    await prisma.valentineSetting.upsert({
      where: { id: this._id || 'val_set_default' },
      update: {
        enabled: this.enabled,
        data: rawData
      },
      create: {
        id: this._id || 'val_set_default',
        enabled: this.enabled,
        data: rawData
      }
    });

    return this;
  }
}

class ValentineSettingsModel {
  static async getSettings() {
    const doc = await prisma.valentineSetting.findFirst();
    if (doc) return new ValentineSettingsDocument(doc);
    return new ValentineSettingsDocument({
      id: 'val_set_default',
      enabled: true,
      general: {
        campaignName: "Valentine's Week 2026",
        startDate: new Date('2026-02-07'),
        endDate: new Date('2026-02-15'),
        countdownTargetDate: new Date('2026-02-14')
      },
      mobileNavigation: {
        enableValentineButton: true,
        valentineLabel: "LOVE",
        valentineIcon: "heart"
      },
      sections: defaultSections
    });
  }

  static async findOne(where = {}) {
    return await this.getSettings();
  }

  static async populate() {
    return true;
  }
}

module.exports = ValentineSettingsModel;
