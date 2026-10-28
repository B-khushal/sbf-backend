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

const VALID_IMAGE_SORT_FIELDS = new Set(['id', 'reviewId', 'url', 'publicId', 'createdAt']);

class QueryChain {
  constructor(where = {}, options = {}) {
    this.where = where;
    this.options = { ...options };
  }
  sort(s) {
    this.options.sort = s;
    return this;
  }
  skip(sk) {
    this.options.skip = sk;
    return this;
  }
  limit(l) {
    this.options.limit = l;
    return this;
  }
  lean() { return this; }
  select() { return this; }
  populate() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const queryArgs = { where: this.where };

      if (this.options.sort) {
        if (typeof this.options.sort === 'object') {
          const orderList = [];
          for (const [key, val] of Object.entries(this.options.sort)) {
            if (VALID_IMAGE_SORT_FIELDS.has(key)) {
              orderList.push({ [key]: (val === -1 || val === 'desc') ? 'desc' : 'asc' });
            }
          }
          if (orderList.length > 0) {
            queryArgs.orderBy = orderList.length === 1 ? orderList[0] : orderList;
          } else {
            queryArgs.orderBy = { createdAt: 'desc' };
          }
        }
      } else {
        queryArgs.orderBy = { createdAt: 'desc' };
      }

      if (this.options.limit !== undefined && this.options.limit !== null) {
        queryArgs.take = Number(this.options.limit);
      }
      if (this.options.skip !== undefined && this.options.skip !== null) {
        queryArgs.skip = Number(this.options.skip);
      }

      const res = await prisma.reviewImage.findMany(queryArgs);
      if (Array.isArray(res)) resolve(res.map(d => new ReviewImageDocument(d)));
      else if (res) resolve(new ReviewImageDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ReviewImageModel {
  static cleanWhere(where = {}) {
    const filter = {};
    if (where.id || where._id) {
      filter.id = String(where.id || where._id);
    }
    if (where.reviewId || where.review) {
      const r = where.reviewId || where.review;
      if (typeof r === 'object' && r !== null && r.$in && Array.isArray(r.$in)) {
        filter.reviewId = { in: r.$in.map(String) };
      } else {
        filter.reviewId = String(r);
      }
    }
    if (where.productId || where.product) {
      const prodId = String(where.productId || where.product);
      filter.review = {
        productId: prodId,
        ...(where.status ? { status: String(where.status) } : { status: 'approved' })
      };
    }
    return filter;
  }

  static find(where = {}) {
    const filter = ReviewImageModel.cleanWhere(where);
    return new QueryChain(filter);
  }

  static findOne(where = {}) {
    const filter = ReviewImageModel.cleanWhere(where);
    const query = prisma.reviewImage.findFirst({ where: filter });
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean() { return this; },
      select() { return this; },
      populate() { return this; },
      exec() { return this.then(r => r); },
      async then(resolve, reject) {
        try {
          const res = await query;
          if (res) resolve(new ReviewImageDocument(res));
          else resolve(null);
        } catch (err) { reject(err); }
      }
    };
  }

  static findById(id) {
    if (!id) {
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return this; },
        select() { return this; },
        populate() { return this; },
        exec() { return Promise.resolve(null); },
        then(resolve) { resolve(null); }
      };
    }
    const query = prisma.reviewImage.findUnique({ where: { id: String(id) } });
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean() { return this; },
      select() { return this; },
      populate() { return this; },
      exec() { return this.then(r => r); },
      async then(resolve, reject) {
        try {
          const res = await query;
          if (res) resolve(new ReviewImageDocument(res));
          else resolve(null);
        } catch (err) { reject(err); }
      }
    };
  }

  static async create(data) {
    const doc = new ReviewImageDocument(data);
    await doc.save();
    return doc;
  }

  static async deleteMany(where = {}) {
    const filter = ReviewImageModel.cleanWhere(where);
    return await prisma.reviewImage.deleteMany({ where: filter });
  }

  static async insertMany(images = []) {
    if (!Array.isArray(images) || images.length === 0) return [];
    const createdList = [];
    for (const img of images) {
      const id = img.id || img._id || `rev_img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const reviewId = String(img.reviewId || img.review || '');
      const item = await prisma.reviewImage.create({
        data: {
          id,
          reviewId,
          url: img.url || '',
          publicId: img.publicId || null
        }
      });
      createdList.push(new ReviewImageDocument(item));
    }
    return createdList;
  }

  static async countDocuments(where = {}) {
    const filter = ReviewImageModel.cleanWhere(where);
    return await prisma.reviewImage.count({ where: filter });
  }
}

module.exports = ReviewImageModel;
