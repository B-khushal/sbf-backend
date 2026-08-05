const prisma = require('../config/prisma');

class StoreDocument {
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
      if (Array.isArray(res)) resolve(res.map(s => new StoreDocument(s)));
      else if (res) resolve(new StoreDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class StoreModel {
  static find(where = {}) {
    const query = prisma.store.findMany({ where });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.code) filter.code = where.code;
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.store.findFirst({ where: filter });
    return new QueryChain(query);
  }
}

module.exports = StoreModel;
