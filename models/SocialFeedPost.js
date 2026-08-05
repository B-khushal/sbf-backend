const prisma = require('../config/prisma');

class SocialFeedPostDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(p => new SocialFeedPostDocument(p)));
      else if (res) resolve(new SocialFeedPostDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class SocialFeedPostModel {
  static find(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = where.isActive;

    const query = prisma.socialFeedPost.findMany({ where: filter, orderBy: { displayOrder: 'asc' } });
    return new QueryChain(query);
  }

  static async countDocuments(where = {}) {
    return await prisma.socialFeedPost.count({ where });
  }
}

module.exports = SocialFeedPostModel;
