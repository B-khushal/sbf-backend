const prisma = require('../config/prisma');

class DeviceTokenDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `tok_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.userId = data.userId || (data.user ? data.user.id || data.user : null);
    this.token = data.token || '';
    this.deviceType = data.deviceType || 'android';
    this.deviceInfo = data.deviceInfo || {};
    this.isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    this.lastUsed = data.lastUsed ? new Date(data.lastUsed) : new Date();
  }

  async deactivate() {
    this.isActive = false;
    return this.save();
  }

  async updateLastUsed() {
    this.lastUsed = new Date();
    return this.save();
  }

  async save() {
    let validUserId = this.userId || null;
    if (validUserId) {
      try {
        const userExists = await prisma.user.findUnique({ where: { id: String(validUserId) }, select: { id: true } });
        if (!userExists) validUserId = null;
      } catch (e) {
        validUserId = null;
      }
    }
    const saved = await prisma.deviceToken.upsert({
      where: { token: this.token },
      update: {
        userId: validUserId,
        deviceType: this.deviceType,
        isActive: this.isActive,
        updatedAt: new Date()
      },
      create: {
        id: String(this.id),
        userId: validUserId,
        token: this.token,
        deviceType: this.deviceType,
        isActive: this.isActive
      }
    });
    Object.assign(this, saved);
    this.id = saved.id;
    this._id = saved.id;
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
      if (Array.isArray(res)) resolve(res.map(d => new DeviceTokenDocument(d)));
      else if (res) resolve(new DeviceTokenDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class DeviceTokenModel {
  static find(where = {}) {
    const filter = {};
    if (where.userId) {
      if (typeof where.userId === 'object' && where.userId.$in) {
        filter.userId = { in: where.userId.$in.map(String) };
      } else {
        filter.userId = String(where.userId);
      }
    }
    if (where.isActive !== undefined) {
      filter.isActive = Boolean(where.isActive);
    }
    const query = prisma.deviceToken.findMany({ where: filter, orderBy: { updatedAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.token) filter.token = where.token;
    if (where._id || where.id) filter.id = String(where._id || where.id);
    const query = prisma.deviceToken.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new DeviceTokenDocument(data);
    await doc.save();
    return doc;
  }

  static async updateOne(where = {}, update = {}) {
    const filter = {};
    if (where.token) filter.token = where.token;
    const dataToSet = update.$set ? update.$set : update;
    try {
      const updated = await prisma.deviceToken.updateMany({
        where: filter,
        data: dataToSet
      });
      return updated;
    } catch (e) {
      return { modifiedCount: 0 };
    }
  }

  static async deleteMany(where = {}) {
    try {
      const deleted = await prisma.deviceToken.deleteMany({ where });
      return { deletedCount: deleted.count };
    } catch (e) {
      return { deletedCount: 0 };
    }
  }

  static async cleanupOldTokens() {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const result = await prisma.deviceToken.deleteMany({
      where: { updatedAt: { lt: ninetyDaysAgo } }
    });
    return { deletedCount: result.count };
  }

  static async findOrCreate(userId, token, deviceType, deviceInfo = {}) {
    let deviceToken = await this.findOne({ token });
    if (deviceToken) {
      deviceToken.userId = String(userId);
      deviceToken.deviceType = deviceType;
      deviceToken.deviceInfo = { ...deviceToken.deviceInfo, ...deviceInfo };
      deviceToken.isActive = true;
      await deviceToken.save();
      return { deviceToken, created: false };
    } else {
      deviceToken = await this.create({
        userId: String(userId),
        token,
        deviceType,
        deviceInfo,
        isActive: true
      });
      return { deviceToken, created: true };
    }
  }

  static async getActiveTokensForUser(userId) {
    return await this.find({ userId: String(userId) });
  }

  static async getActiveTokensForUsers(userIds) {
    const ids = userIds.map(String);
    return await this.find({ userId: { $in: ids } });
  }

  static async deactivateToken(token) {
    return await this.updateOne({ token }, { isActive: false });
  }

  static async getActiveAdminTokens() {
    const User = require('./User');
    const admins = await User.find({ role: 'admin', status: 'active' });
    const adminIds = (admins || []).map(a => String(a._id || a.id));

    if (adminIds.length > 0) {
      const adminTokens = await this.getActiveTokensForUsers(adminIds);
      if (adminTokens && adminTokens.length > 0) return adminTokens;
    }

    const allActive = await this.find({ isActive: true });
    return allActive || [];
  }
}

module.exports = DeviceTokenModel;
