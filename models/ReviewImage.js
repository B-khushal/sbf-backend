const prisma = require('../config/prisma');

class ReviewImageDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `rev_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.reviewId = data.reviewId || (data.review ? data.review.id || data.review : null);
    this.review = this.reviewId;
    this.url = data.url || '';
    this.publicId = data.publicId || null;
  }

  async save() {
    const saved = await prisma.reviewImage.upsert({
      where: { id: this.id },
      update: {
        url: this.url,
        publicId: this.publicId
      },
      create: {
        id: this.id,
        reviewId: String(this.reviewId),
        url: this.url,
        publicId: this.publicId
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
      if (Array.isArray(res)) resolve(res.map(d => new ReviewImageDocument(d)));
      else if (res) resolve(new ReviewImageDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ReviewImageModel {
  static find(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    const query = prisma.reviewImage.findMany({ where: filter });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.id || where._id) filter.id = String(where.id || where._id);
    const query = prisma.reviewImage.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.reviewImage.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new ReviewImageDocument(data);
    await doc.save();
    return doc;
  }

  static async countDocuments(where = {}) {
    const filter = {};
    if (where.reviewId || where.review) filter.reviewId = String(where.reviewId || where.review);
    return await prisma.reviewImage.count({ where: filter });
  }
}

module.exports = ReviewImageModel;
