const prisma = require('../config/prisma');

class NewsletterDocument {
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
      if (Array.isArray(res)) resolve(res.map(n => new NewsletterDocument(n)));
      else if (res) resolve(new NewsletterDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class NewsletterModel {
  static find(where = {}) {
    const query = prisma.newsletter.findMany({ where });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.email) filter.email = where.email.toLowerCase();
    const query = prisma.newsletter.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.newsletter.create({
      data: {
        id: data.id || data._id || `news_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        email: data.email.toLowerCase()
      }
    });
    return new NewsletterDocument(created);
  }
}

module.exports = NewsletterModel;