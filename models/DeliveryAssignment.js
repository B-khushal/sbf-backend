const prisma = require('../config/prisma');

class DeliveryAssignmentDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  select() { return this; }
  populate() { return this; }
  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(d => new DeliveryAssignmentDocument(d)));
      else if (res) resolve(new DeliveryAssignmentDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeliveryAssignmentModel {
  static find(where = {}) {
    const filter = {};
    if (where.status) filter.status = where.status;
    if (where.deliveryPartnerId) filter.partnerId = String(where.deliveryPartnerId);
    const query = prisma.deliveryAssignment.findMany({ where: filter });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.deliveryAssignment.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async countDocuments(where = {}) {
    return await prisma.deliveryAssignment.count({ where });
  }
}

module.exports = DeliveryAssignmentModel;
