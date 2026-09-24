const prisma = require('../config/prisma');

class SettingDocument {
  constructor(data) {
    if (data.data && typeof data.data === 'object') {
      Object.assign(this, data.data);
    } else {
      Object.assign(this, data);
    }
    this._id = data.id || 'global';
    this.key = data.key || 'global';
  }

  markModified(field) {
    return true;
  }

  async save() {
    const rawData = { ...this };
    delete rawData._id;
    delete rawData.key;

    const updated = await prisma.setting.upsert({
      where: { key: this.key || 'global' },
      update: { data: rawData },
      create: {
        id: this._id || 'set_global',
        key: this.key || 'global',
        data: rawData
      }
    });

    return new SettingDocument(updated);
  }
}

class SettingModel {
  static async findOne(where = {}) {
    const key = where.key || 'global';
    const record = await prisma.setting.findFirst({
      where: { key }
    });

    if (record) {
      return new SettingDocument(record);
    }

    // Default settings document if none exists yet
    return new SettingDocument({
      id: 'set_global',
      key: 'global',
      data: {
        headerSettings: { announcementText: 'Welcome to Spring Blossoms Florist!' },
        footerSettings: { copyrightText: '© 2026 Spring Blossoms Florist' },
        heroSlides: [],
        shopCategories: []
      }
    });
  }

  static async getSettings() {
    return await this.findOne({ key: 'global' });
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    const record = await prisma.setting.upsert({
      where: { key: 'global' },
      update: { data: dataToUpdate },
      create: {
        id: String(id || 'set_global'),
        key: 'global',
        data: dataToUpdate
      }
    });
    return new SettingDocument(record);
  }
}

module.exports = SettingModel;