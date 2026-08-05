const prisma = require('../config/prisma');

class DeliveryEarningDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryEarningDocument(d)));
      else if (res) resolve(new DeliveryEarningDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryEarningModel {
  static find(where = {}) {
    const filter = {};
    if (where.partnerId) filter.partnerId = String(where.partnerId);
    const query = prisma.deliveryEarning.findMany({ where: filter });
    return new QueryChain(query);
  }
}

module.exports = DeliveryEarningModel;
