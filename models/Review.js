const prisma = require('../config/prisma');

class ReviewDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.id = this._id;
    this.product = data.productId || (data.product ? data.product.id || data.product : null);
    this.user = data.userId || (data.user ? data.user.id || data.user : null);
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
    return {
      _id: this._id,
      id: this.id,
      product: this.product,
      productId: this.productId || this.product,
      user: this.user,
      userId: this.userId || this.user,
      name: this.name,
      email: this.email,
      rating: this.rating,
      title: this.title,
      comment: this.comment,
      status: this.status || 'approved',
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

class QueryChain {
  constructor(prismaQuery) {
    this.prismaQuery = prismaQuery;
  }
  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  exec() { return this.then(res => res); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(r => new ReviewDocument(r)));
      else if (res) resolve(new ReviewDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

const cleanReviewWhere = (where = {}) => {
  const filter = {};
  if (where.id || where._id) filter.id = String(where.id || where._id);
  if (where.productId || where.product) filter.productId = String(where.productId || where.product);
  if (where.userId || where.user) filter.userId = String(where.userId || where.user);
  if (where.status) filter.status = where.status;
  return filter;
};

class ReviewModel {
  static find(where = {}) {
    const filter = cleanReviewWhere(where);

    const query = prisma.review.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: { user: true, images: true, replies: true }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = cleanReviewWhere(where);

    const query = prisma.review.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.review.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
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

    const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++;
    });

    return {
      totalReviews,
      averageRating: Math.round((sumRating / totalReviews) * 10) / 10,
      verifiedPurchases,
      verifiedPurchasePercentage: Math.round((verifiedPurchases / totalReviews) * 100 * 10) / 10,
      ratingDistribution: ratingDist
    };
  }

  static async create(data) {
    const created = await prisma.review.create({
      data: {
        id: data.id || data._id || `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: data.userId || (typeof data.user === 'string' ? data.user : null),
        productId: data.productId || (typeof data.product === 'string' ? data.product : ''),
        rating: parseInt(data.rating || 5),
        title: data.title || null,
        comment: data.comment || '',
        status: data.status || 'approved'
      }
    });
    return new ReviewDocument(created);
  }

  static async findByIdAndUpdate(id, update) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.review.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new ReviewDocument(updated);
    } catch (e) { return null; }
  }

  static async countDocuments(where = {}) {
    const filter = cleanReviewWhere(where);
    return await prisma.review.count({ where: filter });
  }
}

module.exports = ReviewModel;
