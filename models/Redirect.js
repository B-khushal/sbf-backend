const prisma = require('../config/prisma');

class RedirectDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.fromUrl = data.sourceUrl || data.fromUrl;
    this.toUrl = data.targetUrl || data.toUrl;
  }

  async save() {
    const redId = this.id || this._id;
    const from = this.fromUrl || this.sourceUrl;
    const to = this.toUrl || this.targetUrl;

    const existing = await prisma.redirect.findFirst({ where: { sourceUrl: from } });
    if (existing) {
      const updated = await prisma.redirect.update({
        where: { id: existing.id },
        data: { targetUrl: to }
      });
      Object.assign(this, updated);
      this._id = updated.id;
      return this;
    }

    const created = await prisma.redirect.create({
      data: {
        id: redId || `red_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sourceUrl: from,
        targetUrl: to
      }
    });

    Object.assign(this, created);
    this._id = created.id;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(r => new RedirectDocument(r)));
      else if (res) resolve(new RedirectDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class RedirectModel {
  static findOne(where = {}) {
    const filter = {};
    if (where.fromUrl || where.sourceUrl) filter.sourceUrl = where.fromUrl || where.sourceUrl;
    if (where.toUrl || where.targetUrl) filter.targetUrl = where.toUrl || where.targetUrl;
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.redirect.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async create(data) {
    const from = data.fromUrl || data.sourceUrl;
    const to = data.toUrl || data.targetUrl;

    const created = await prisma.redirect.create({
      data: {
        id: data.id || data._id || `red_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        sourceUrl: from,
        targetUrl: to
      }
    });
    return new RedirectDocument(created);
  }
}

module.exports = RedirectModel;
