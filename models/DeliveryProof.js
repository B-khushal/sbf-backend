const prisma = require('../config/prisma');

class DeliveryProofDocument {
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
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryProofDocument(d)));
      else if (res) resolve(new DeliveryProofDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryProofModel {
  static find(where = {}) {
    const filter = {};
    if (where.assignmentId) filter.assignmentId = String(where.assignmentId);
    const query = prisma.deliveryProof.findMany({ where: filter });
    return new QueryChain(query);
  }
}

module.exports = DeliveryProofModel;
