const prisma = require('../config/prisma');

function cleanActivityLogWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  if (where.actionType || where.action) {
    clean.action = String(where.actionType || where.action);
  }
  if (where.module) clean.module = String(where.module);
  if (where.userId || where.user) clean.userId = String(where.userId || where.user);

  const dateFilter = where.timestamp || where.createdAt;
  if (dateFilter && typeof dateFilter === 'object') {
    clean.createdAt = {};
    if (dateFilter.$gte) clean.createdAt.gte = new Date(dateFilter.$gte);
    if (dateFilter.$lte) clean.createdAt.lte = new Date(dateFilter.$lte);
  }

  return clean;
}

class ActivityLogDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.actionType = data.action;
    this.timestamp = data.createdAt;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  populate() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(l => new ActivityLogDocument(l)));
      else if (res) resolve(new ActivityLogDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class ActivityLogModel {
  static find(where = {}) {
    const prismaWhere = cleanActivityLogWhere(where);
    const query = prisma.activityLog.findMany({
      where: prismaWhere,
      orderBy: { createdAt: 'desc' }
    });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.activityLog.create({
      data: {
        id: data.id || data._id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: data.userId || (typeof data.user === 'string' ? data.user : null),
        action: data.actionType || data.action || 'system_event',
        module: data.module || null,
        details: data.details ? data.details : {},
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null
      }
    });
    return new ActivityLogDocument(created);
  }

  static async countDocuments(where = {}) {
    const prismaWhere = cleanActivityLogWhere(where);
    return await prisma.activityLog.count({ where: prismaWhere });
  }

  static async aggregate(pipeline) {
    const logs = await prisma.activityLog.findMany();
    if (pipeline && Array.isArray(pipeline)) {
      const groupStage = pipeline.find(p => p.$group);
      if (groupStage && groupStage.$group) {
        const idField = groupStage.$group._id;
        const countMap = {};
        logs.forEach(l => {
          const key = idField === '$actionType' || idField === '$action' ? l.action : (idField === '$module' ? (l.module || 'system') : 'other');
          countMap[key] = (countMap[key] || 0) + 1;
        });
        return Object.keys(countMap).map(k => ({ _id: k, count: countMap[k] }));
      }
    }
    return [{ _id: null, count: logs.length }];
  }

  static populate() { return this; }
}

module.exports = ActivityLogModel;
