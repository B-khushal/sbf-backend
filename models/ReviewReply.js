const prisma = require('../config/prisma');

class ReviewReplyDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `rev_rpl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.reviewId = data.reviewId || (data.review ? data.review.id || data.review : null);
    this.userId = data.userId || (data.user ? data.user.id || data.user : null);
    this.replyText = data.replyText || data.message || '';
    this.isOfficial = data.isOfficial !== undefined ? Boolean(data.isOfficial) : Boolean(data.isAdminReply);
  }

  async save() {
    const saved = await prisma.reviewReply.upsert({
      where: { id: this.id },
      update: {
        replyText: this.replyText,
        isOfficial: this.isOfficial
      },
      create: {
        id: this.id,
        reviewId: String(this.reviewId),
        userId: this.userId ? String(this.userId) : null,
        replyText: this.replyText,
        isOfficial: this.isOfficial
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
      if (Array.isArray(res)) resolve(res.map(d => new ReviewReplyDocument(d)));
      else if (res) resolve(new ReviewReplyDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ReviewReplyModel {
  static find(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    const query = prisma.reviewReply.findMany({ where: filter, orderBy: { createdAt: 'asc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.id || where._id) filter.id = String(where.id || where._id);
    const query = prisma.reviewReply.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.reviewReply.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new ReviewReplyDocument(data);
    await doc.save();
    return doc;
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    return await prisma.reviewReply.count({ where: filter });
  }
}

module.exports = ReviewReplyModel;
