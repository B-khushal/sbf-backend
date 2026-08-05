const prisma = require('../config/prisma');

class NotificationDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.read = this.isRead || false;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      userId: this.userId,
      title: this.title,
      message: this.message,
      type: this.type,
      link: this.link,
      isRead: this.isRead,
      read: this.isRead,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const id = this.id || this._id;
    const updated = await prisma.notification.upsert({
      where: { id },
      update: {
        isRead: this.read !== undefined ? !!this.read : !!this.isRead,
        title: this.title,
        message: this.message
      },
      create: {
        id: id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: this.userId || (typeof this.user === 'string' ? this.user : null),
        title: this.title || 'Notification',
        message: this.message || '',
        type: this.type || 'info',
        link: this.link || null,
        isRead: this.read !== undefined ? !!this.read : !!this.isRead
      }
    });
    Object.assign(this, updated);
    this._id = updated.id;
    this.read = updated.isRead;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(n => new NotificationDocument(n)));
      else if (res) resolve(new NotificationDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class NotificationModel {
  static find(where = {}) {
    const filter = {};

    if (where.userId !== undefined || where.user !== undefined) {
      const uId = where.userId !== undefined ? where.userId : where.user;
      filter.userId = uId ? String(uId) : null;
    }

    if (where.type) {
      if (typeof where.type === 'object' && where.type.$in) {
        filter.type = { in: where.type.$in };
      } else {
        filter.type = String(where.type);
      }
    }

    if (where.createdAt) {
      if (typeof where.createdAt === 'object' && where.createdAt.$gt) {
        filter.createdAt = { gt: new Date(where.createdAt.$gt) };
      } else if (where.createdAt instanceof Date || typeof where.createdAt === 'string') {
        filter.createdAt = { gt: new Date(where.createdAt) };
      }
    }

    const query = prisma.notification.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' }
    });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.notification.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where._id || where.id) filter.id = String(where._id || where.id);
    if (where.userId) filter.userId = String(where.userId);

    const query = prisma.notification.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.notification.create({
      data: {
        id: data.id || data._id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: data.userId || (typeof data.user === 'string' ? data.user : null),
        title: data.title || 'Notification',
        message: data.message || '',
        type: data.type || 'info',
        link: data.link || null,
        isRead: !!(data.isRead || data.read)
      }
    });
    return new NotificationDocument(created);
  }

  static async updateMany(where = {}, update = {}) {
    const filter = {};
    if (where.userId || where.user) filter.userId = String(where.userId || where.user);
    const isRead = update.read !== undefined ? !!update.read : (update.isRead !== undefined ? !!update.isRead : true);
    return await prisma.notification.updateMany({ where: filter, data: { isRead } });
  }

  static async countDocuments(where = {}) {
    return await prisma.notification.count({ where });
  }
}

module.exports = NotificationModel;
