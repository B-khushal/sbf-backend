const prisma = require('../config/prisma');

class VendorPayoutDocument {
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
      if (Array.isArray(res)) resolve(res.map(v => new VendorPayoutDocument(v)));
      else if (res) resolve(new VendorPayoutDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class VendorPayoutModel {
  static find(where = {}) {
    const filter = {};
    if (where.vendorId) filter.vendorId = String(where.vendorId);
    if (where.status) filter.status = where.status;
    const query = prisma.vendorPayout.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.vendorPayout.findFirst({ where: filter });
    return new QueryChain(query);
  }
}

module.exports = VendorPayoutModel;