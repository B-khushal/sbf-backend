const prisma = require('../config/prisma');

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
      }
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
