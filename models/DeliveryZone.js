const prisma = require('../config/prisma');

class DeliveryZoneDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class DeliveryZoneModel {
  static async countDocuments(where = {}) {
    return await prisma.deliveryZone.count({ where });
  }

  static async create(data) {
    const created = await prisma.deliveryZone.create({
      data: {
        id: data.id || data._id || `dz_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name || 'Zone',
        code: data.code || null,
        pincodes: data.pincodes ? data.pincodes : [],
        deliveryFee: parseFloat(data.baseDeliveryCharge || data.deliveryFee || 0),
        isActive: data.isActive !== false
      }
    });
    return new DeliveryZoneDocument(created);
  }

  static async find(where = {}) {
    const zones = await prisma.deliveryZone.findMany({ where });
    return zones.map(z => new DeliveryZoneDocument(z));
  }
}

module.exports = DeliveryZoneModel;
