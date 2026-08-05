const prisma = require('../config/prisma');

class DeliveryLocationDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  select() { return this; }
  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryLocationDocument(d)));
      else if (res) resolve(new DeliveryLocationDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryLocationModel {
  static find(where = {}) {
    const filter = {};
    if (where.pincode) filter.pincode = String(where.pincode);
    if (where.isAvailable !== undefined) filter.isAvailable = where.isAvailable;
    const query = prisma.deliveryLocation.findMany({ where: filter });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.pincode) filter.pincode = String(where.pincode);
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.deliveryLocation.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async countDocuments(where = {}) {
    return await prisma.deliveryLocation.count({ where });
  }
}

module.exports = DeliveryLocationModel;
