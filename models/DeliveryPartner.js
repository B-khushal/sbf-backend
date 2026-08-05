const prisma = require('../config/prisma');

class DeliveryPartnerDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.status = data.status || (data.isActive !== false ? 'online' : 'offline');
    this.isAvailable = this.status === 'online' || data.isActive !== false;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      name: this.name,
      phone: this.phone,
      email: this.email,
      status: this.status,
      isAvailable: this.isAvailable,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryPartnerDocument(d)));
      else if (res) resolve(new DeliveryPartnerDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryPartnerModel {
  static find(where = {}) {
    const filter = {};
    if (where.status) filter.status = String(where.status);
    if (where.isActive !== undefined) filter.isActive = where.isActive;

    const query = prisma.deliveryPartner.findMany({ where: filter });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.userId) filter.userId = String(where.userId);
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.deliveryPartner.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.deliveryPartner.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.status) filter.status = String(where.status);
    return await prisma.deliveryPartner.count({ where: filter });
  }

  static populate() { return this; }
}

module.exports = DeliveryPartnerModel;
