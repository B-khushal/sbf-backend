const prisma = require('../config/prisma');

class DeliverySettingDocument {
  constructor(data) {
    if (data.settings && typeof data.settings === 'object') {
      Object.assign(this, data.settings);
    } else {
      Object.assign(this, data);
    }
    this._id = data.id || 'deliv_set_default';
  }

  async save() {
    const raw = { ...this };
    delete raw._id;
    const updated = await prisma.deliverySetting.upsert({
      where: { id: this._id || 'deliv_set_default' },
      update: { settings: raw },
      create: {
        id: this._id || 'deliv_set_default',
        settings: raw
      }
    });
    return new DeliverySettingDocument(updated);
  }
}

class DeliverySettingModel {
  static async findOne() {
    const doc = await prisma.deliverySetting.findFirst();
    if (doc) return new DeliverySettingDocument(doc);
    return new DeliverySettingDocument({
      id: 'deliv_set_default',
      settings: {
        defaultDeliveryFee: 150,
        freeDeliveryMinOrder: 999,
        expressDeliveryFee: 250
      }
    });
  }

  static async getSettings() {
    return await this.findOne();
  }

  static async countDocuments(where = {}) {
    return await prisma.deliverySetting.count({ where });
  }
}

module.exports = DeliverySettingModel;
