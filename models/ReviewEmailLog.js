const prisma = require('../config/prisma');

class ReviewEmailLogDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `relog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.orderId = data.orderId || data.order || null;
    this.email = data.email || data.customerEmail || '';
    this.status = data.status || 'pending';
    this.sentAt = data.sentAt ? new Date(data.sentAt) : new Date();
  }

  async save() {
    const saved = await prisma.reviewEmailLog.upsert({
      where: { id: this.id },
      update: {
        orderId: this.orderId,
        email: this.email,
        status: this.status
      },
      create: {
        id: this.id,
        orderId: this.orderId,
        email: this.email,
        status: this.status
      }
    });
    Object.assign(this, saved);
    this._id = saved.id;
    return this;
  }

  toObject() { return { ...this }; }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  exec() { return this.then(r => r); }
  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(d => new ReviewEmailLogDocument(d)));
      else if (res) resolve(new ReviewEmailLogDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ReviewEmailLogModel {
  static find(where = {}) {
    const filter = {};
    if (where.email) filter.email = where.email;
    if (where.status) filter.status = where.status;
    const query = prisma.reviewEmailLog.findMany({ where: filter, orderBy: { sentAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.id || where._id) filter.id = String(where.id || where._id);
    if (where.orderId) filter.orderId = String(where.orderId);
    const query = prisma.reviewEmailLog.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.reviewEmailLog.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new ReviewEmailLogDocument(data);
    await doc.save();
    return doc;
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.status) filter.status = where.status;
    return await prisma.reviewEmailLog.count({ where: filter });
  }
}

module.exports = ReviewEmailLogModel;
