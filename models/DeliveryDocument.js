const prisma = require('../config/prisma');

class DeliveryDocumentDocument {
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
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryDocumentDocument(d)));
      else if (res) resolve(new DeliveryDocumentDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryDocumentModel {
  static find(where = {}) {
    const filter = {};
    if (where.partnerId) filter.partnerId = String(where.partnerId);
    const query = prisma.deliveryDocument.findMany({ where: filter });
    return new QueryChain(query);
  }
}

module.exports = DeliveryDocumentModel;
