const prisma = require('../config/prisma');

class ReviewDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.id = this._id;
    this.productId = data.productId || (data.product ? (data.product.id || data.product._id || data.product) : null);
    this.product = data.product ? (typeof data.product === 'object' ? data.product : data.productId) : data.productId;
    this.userId = data.userId || (data.user ? (data.user.id || data.user._id || data.user) : null);
    this.user = data.user || data.userId;
    this.qualityRating = data.qualityRating || null;
    this.valueRating = data.valueRating || null;
    this.deliveryRating = data.deliveryRating || null;
    this.moderatorNotes = data.moderatorNotes || null;
    this.moderationReason = data.moderationReason || null;
    this.featured = Boolean(data.featured);
    this.pinned = Boolean(data.pinned);
    this.pros = Array.isArray(data.pros) ? data.pros : [];
    this.cons = Array.isArray(data.cons) ? data.cons : [];
    this.officialResponse = data.officialResponse || data.response || null;
  }

  get helpfulnessPercentage() {
    if (!this.totalVotes) return 0;
    return Math.round(((this.helpfulVotes || this.likeCount || 0) / this.totalVotes) * 100);
  }

  get additionalRatingsAverage() {
    const ratings = [this.qualityRating, this.valueRating, this.deliveryRating].filter(
      v => typeof v === 'number'
    );
    if (!ratings.length) return null;
    return Math.round((ratings.reduce((sum, v) => sum + v, 0) / ratings.length) * 10) / 10;
  }

  toObject() {
    const rawImages = Array.isArray(this.images)
      ? this.images.map(img => (typeof img === 'string' ? img : (img.url || ''))).filter(Boolean)
      : [];

    return {
      _id: this._id,
      id: this.id,
      product: this.product,
      productId: this.productId || (this.product ? (this.product.id || this.product._id) : null),
      user: this.user,
      userId: this.userId || (this.user ? (this.user.id || this.user._id) : null),
      name: this.name,
      email: this.email,
      rating: this.rating,
      title: this.title,
      comment: this.comment,
      status: this.status || 'approved',
      orderId: this.orderId,
      images: rawImages,
      imageCount: this.imageCount !== undefined ? this.imageCount : rawImages.length,
      helpfulVotes: this.helpfulVotes || this.likeCount || 0,
      totalVotes: this.totalVotes || 0,
      isVerifiedPurchase: !!this.isVerifiedPurchase,
      likeCount: this.likeCount || 0,
      moderatorNotes: this.moderatorNotes,
      moderationReason: this.moderationReason,
      featured: this.featured,
      pinned: this.pinned,
      qualityRating: this.qualityRating,
      valueRating: this.valueRating,
      deliveryRating: this.deliveryRating,
      pros: this.pros,
      cons: this.cons,
      deviceInfo: this.deviceInfo,
      ipAddress: this.ipAddress,
      source: this.source,
      officialResponse: this.officialResponse,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const revId = this.id || this._id;
    const updated = await prisma.review.upsert({
      where: { id: revId },
      update: {
        rating: this.rating ? parseInt(this.rating) : 5,
        title: this.title || null,
        comment: this.comment || '',
        status: this.status || 'approved',
        orderId: this.orderId || null,
        name: this.name || null,
        email: this.email || null,
        moderatorNotes: this.moderatorNotes || null,
        moderationReason: this.moderationReason || null,
        featured: !!this.featured,
        pinned: !!this.pinned,
        qualityRating: this.qualityRating ? parseInt(this.qualityRating) : null,
        valueRating: this.valueRating ? parseInt(this.valueRating) : null,
        deliveryRating: this.deliveryRating ? parseInt(this.deliveryRating) : null,
        pros: this.pros,
        cons: this.cons,
        deviceInfo: this.deviceInfo || null,
        ipAddress: this.ipAddress || null,
        source: this.source || null,
        officialResponse: this.officialResponse || null
      },
      create: {
        id: revId || `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: this.userId || (typeof this.user === 'string' ? this.user : null),
        productId: this.productId || (typeof this.product === 'string' ? this.product : ''),
        rating: this.rating ? parseInt(this.rating) : 5,
        title: this.title || null,
        comment: this.comment || '',
        status: this.status || 'approved',
        orderId: this.orderId || null,
        name: this.name || null,
        email: this.email || null,
        moderatorNotes: this.moderatorNotes || null,
        moderationReason: this.moderationReason || null,
        featured: !!this.featured,
        pinned: !!this.pinned,
        qualityRating: this.qualityRating ? parseInt(this.qualityRating) : null,
        valueRating: this.valueRating ? parseInt(this.valueRating) : null,
        deliveryRating: this.deliveryRating ? parseInt(this.deliveryRating) : null,
        pros: this.pros,
        cons: this.cons,
        deviceInfo: this.deviceInfo || null,
        ipAddress: this.ipAddress || null,
        source: this.source || null,
        officialResponse: this.officialResponse || null
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    return this;
  }
}

const VALID_REVIEW_SORT_FIELDS = new Set([
  'id', 'userId', 'productId', 'orderId', 'name', 'email', 'rating',
  'status', 'isVerifiedPurchase', 'likeCount', 'featured', 'pinned',
  'qualityRating', 'valueRating', 'deliveryRating', 'createdAt', 'updatedAt'
]);

class QueryChain {
  constructor(where = {}, options = {}) {
    this.where = where;
    this.options = { ...options };
  }
  populate() { return this; }
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
  select() { return this; }
  lean() { return this; }
  exec() { return this.then(res => res); }

  async then(resolve, reject) {
    try {
      const queryArgs = {
        where: this.where,
        include: { user: true, product: true, images: true, replies: true },
      };

      if (this.options.sort) {
        if (typeof this.options.sort === 'object') {
          const orderList = [];
          for (const [key, val] of Object.entries(this.options.sort)) {
            const field = key === 'helpfulVotes' ? 'likeCount' : key;
            if (VALID_REVIEW_SORT_FIELDS.has(field)) {
              orderList.push({ [field]: (val === -1 || val === 'desc') ? 'desc' : 'asc' });
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

      if (this.options.skip !== undefined && this.options.skip !== null) {
        queryArgs.skip = Number(this.options.skip);
      }
      if (this.options.limit !== undefined && this.options.limit !== null) {
        queryArgs.take = Number(this.options.limit);
      }

      const res = await prisma.review.findMany(queryArgs);
      if (Array.isArray(res)) resolve(res.map(r => new ReviewDocument(r)));
      else if (res) resolve(new ReviewDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

const cleanReviewWhere = (where = {}) => {
  const filter = {};
  if (where.id || where._id) filter.id = String(where.id || where._id);
  if (where.productId || where.product) {
    const pVal = where.productId || where.product;
    if (typeof pVal === 'object' && pVal !== null && pVal.$in && Array.isArray(pVal.$in)) {
      filter.productId = { in: pVal.$in.map(String) };
    } else if (typeof pVal === 'object' && pVal !== null && pVal.in && Array.isArray(pVal.in)) {
      filter.productId = { in: pVal.in.map(String) };
    } else {
      filter.productId = String(pVal);
    }
  }
  if (where.userId || where.user) filter.userId = String(where.userId || where.user);
  if (where.status) filter.status = where.status;
  if (where.orderId) {
    if (typeof where.orderId === 'object' && where.orderId.$in && Array.isArray(where.orderId.$in)) {
      filter.orderId = { in: where.orderId.$in.map(String) };
    } else {
      filter.orderId = String(where.orderId);
    }
  }
  if (where.rating !== undefined && where.rating !== null) {
    filter.rating = parseInt(where.rating);
  }
  if (where.isVerifiedPurchase !== undefined && where.isVerifiedPurchase !== null) {
    filter.isVerifiedPurchase = Boolean(where.isVerifiedPurchase);
  }
  if (where.imageCount || where.withImages) {
    filter.images = { some: {} };
  }
  if (where.featured !== undefined) filter.featured = Boolean(where.featured);
  if (where.pinned !== undefined) filter.pinned = Boolean(where.pinned);
  if (Array.isArray(where.$or) && where.$or.length > 0) {
    filter.OR = where.$or.map(cond => cleanReviewWhere(cond));
  }
  return filter;
};

class ReviewModel {
  static find(where = {}) {
    const filter = cleanReviewWhere(where);
    return new QueryChain(filter);
  }

  static findOne(where = {}) {
    const filter = cleanReviewWhere(where);
    const query = prisma.review.findFirst({
      where: filter,
      include: { user: true, product: true, images: true, replies: true }
    });
    return {
      select() { return this; },
      populate() { return this; },
      lean() { return this; },
      exec() { return this.then(res => res); },
      async then(resolve, reject) {
        try {
          const res = await query;
          if (res) resolve(new ReviewDocument(res));
          else resolve(null);
        } catch (err) { reject(err); }
      }
    };
  }

  static findById(id) {
    if (!id) {
      return {
        populate() { return this; },
        select() { return this; },
        lean() { return this; },
        exec() { return Promise.resolve(null); },
        then(resolve) { resolve(null); }
      };
    }
    const query = prisma.review.findUnique({
      where: { id: String(id) },
      include: { user: true, product: true, images: true, replies: true }
    });
    return {
      populate() { return this; },
      select() { return this; },
      lean() { return this; },
      exec() { return this.then(res => res); },
      async then(resolve, reject) {
        try {
          const res = await query;
          if (res) resolve(new ReviewDocument(res));
          else resolve(null);
        } catch (err) { reject(err); }
      }
    };
  }

  static async aggregate(pipeline) {
    const reviews = await prisma.review.findMany();
    return reviews;
  }

  static async getProductReviewStats(productId) {
    const reviews = await prisma.review.findMany({
      where: {
        productId: String(productId),
        status: 'approved'
      },
      include: {
        images: true
      }
    });

    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        verifiedPurchases: 0,
        verifiedPurchasePercentage: 0,
        averageQualityRating: 0,
        averageValueRating: 0,
        averageDeliveryRating: 0,
        imagesCount: 0,
        helpfulVotes: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      };
    }

    const totalReviews = reviews.length;
    const sumRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const verifiedPurchases = reviews.filter(r => r.isVerifiedPurchase).length;
    const imagesCount = reviews.reduce((sum, r) => sum + (r.images?.length || 0), 0);
    const helpfulVotes = reviews.reduce((sum, r) => sum + (r.likeCount || 0), 0);

    const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++;
    });

    return {
      totalReviews,
      averageRating: Math.round((sumRating / totalReviews) * 10) / 10,
      verifiedPurchases,
      verifiedPurchasePercentage: Math.round((verifiedPurchases / totalReviews) * 100 * 10) / 10,
      imagesCount,
      helpfulVotes,
      ratingDistribution: ratingDist
    };
  }

  static async create(data) {
    const created = await prisma.review.create({
      data: {
        id: data.id || data._id || `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: data.userId || (typeof data.user === 'string' ? data.user : (data.user?.id || data.user?._id || null)),
        productId: data.productId || (typeof data.product === 'string' ? data.product : (data.product?.id || data.product?._id || '')),
        rating: parseInt(data.rating || 5),
        title: data.title || null,
        comment: data.comment || '',
        status: data.status || 'approved',
        orderId: data.orderId || null,
        name: data.name || null,
        email: data.email || null,
        isVerifiedPurchase: Boolean(data.isVerifiedPurchase),
        qualityRating: data.qualityRating ? parseInt(data.qualityRating) : null,
        valueRating: data.valueRating ? parseInt(data.valueRating) : null,
        deliveryRating: data.deliveryRating ? parseInt(data.deliveryRating) : null,
        pros: Array.isArray(data.pros) ? data.pros : [],
        cons: Array.isArray(data.cons) ? data.cons : [],
        deviceInfo: data.deviceInfo || null,
        ipAddress: data.ipAddress || null,
        source: data.source || null,
      }
    });
    return new ReviewDocument(created);
  }

  static async findByIdAndUpdate(id, update) {
    const rawData = update.$set ? update.$set : update;
    const { images, imageCount, id: _id, _id: __id, ...dataToUpdate } = rawData;
    try {
      const updated = await prisma.review.update({
        where: { id: String(id) },
        data: dataToUpdate,
        include: { user: true, images: true, replies: true }
      });
      return new ReviewDocument(updated);
    } catch (e) {
      console.error('Review.findByIdAndUpdate error:', e);
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = cleanReviewWhere(where);
    return await prisma.review.count({ where: filter });
  }
}

module.exports = ReviewModel;
