const prisma = require('../config/prisma');

class ReviewLikeDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `rev_lk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.reviewId = data.reviewId || (data.review ? data.review.id || data.review : null);
    this.userId = data.userId || (data.user ? data.user.id || data.user : null);
    this.review = this.reviewId;
    this.user = this.userId;
  }

  async save() {
    const saved = await prisma.reviewLike.upsert({
      where: {
        reviewId_userId: {
          reviewId: String(this.reviewId),
          userId: String(this.userId)
        }
      },
      update: {},
      create: {
        id: this.id,
        reviewId: String(this.reviewId),
        userId: String(this.userId)
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
      if (Array.isArray(res)) resolve(res.map(d => new ReviewLikeDocument(d)));
      else if (res) resolve(new ReviewLikeDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ReviewLikeModel {
  static find(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    if (where.userId || where.user) filter.userId = String(where.userId || where.user);
    const query = prisma.reviewLike.findMany({ where: filter });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.reviewId && where.userId) {
      filter.reviewId = String(where.reviewId);
      filter.userId = String(where.userId);
    }
    if (where.id || where._id) filter.id = String(where.id || where._id);
    const query = prisma.reviewLike.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.reviewLike.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new ReviewLikeDocument(data);
    await doc.save();
    return doc;
  }

  static async findOneAndDelete(where = {}) {
    const filter = {};
    if (where.reviewId && where.userId) {
      filter.reviewId = String(where.reviewId);
      filter.userId = String(where.userId);
    }
    try {
      const item = await prisma.reviewLike.findFirst({ where: filter });
      if (item) {
        await prisma.reviewLike.delete({ where: { id: item.id } });
        return new ReviewLikeDocument(item);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    return await prisma.reviewLike.count({ where: filter });
  }
}

module.exports = ReviewLikeModel;
