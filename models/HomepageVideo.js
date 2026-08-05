const prisma = require('../config/prisma');

class HomepageVideoDocument {
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
      if (Array.isArray(res)) resolve(res.map(v => new HomepageVideoDocument(v)));
      else if (res) resolve(new HomepageVideoDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class HomepageVideoModel {
  static async countDocuments(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = where.isActive;

    return await prisma.homepageVideo.count({ where: filter });
  }

  static find(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = where.isActive;

    const query = prisma.homepageVideo.findMany({ where: filter, orderBy: { displayOrder: 'asc' } });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.homepageVideo.create({
      data: {
        id: data.id || data._id || `vid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        videoUrl: data.videoUrl || data.url || '',
        thumbnailUrl: data.thumbnailUrl || null,
        title: data.title || null,
        displayOrder: parseInt(data.displayOrder || 0),
        isActive: data.isActive !== false
      }
    });
    return new HomepageVideoDocument(created);
  }
}

module.exports = HomepageVideoModel;
