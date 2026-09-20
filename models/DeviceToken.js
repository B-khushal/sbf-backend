const prisma = require('../config/prisma');

class DeviceTokenDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id || `tok_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this._id = this.id;
    this.user = data.user || null;
    this.userId = data.user ? { ...data.user, _id: data.user.id } : (data.userId || null);
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

  async deleteOne() {
    try {
      await prisma.deviceToken.deleteMany({
        where: {
          OR: [
            { id: String(this.id) },
            { token: String(this.token) }
          ]
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async save() {
    let validUserId = (typeof this.userId === 'object' && this.userId !== null) 
      ? (this.userId.id || this.userId._id) 
      : (this.userId || null);

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
  populate() { return this; }
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
    if (where._id || where.id) {
      filter.id = String(where._id || where.id);
    }
    if (where.token) {
      filter.token = String(where.token);
    }
    const query = prisma.deviceToken.findMany({ 
      where: filter, 
      include: { user: { select: { id: true, name: true, email: true, role: true, phone: true } } },
      orderBy: { updatedAt: 'desc' } 
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.token) filter.token = String(where.token);
    if (where._id || where.id) filter.id = String(where._id || where.id);
    if (where.userId) filter.userId = String(where.userId);
    if (where.isActive !== undefined) filter.isActive = Boolean(where.isActive);
    const query = prisma.deviceToken.findFirst({ 
      where: filter,
      include: { user: { select: { id: true, name: true, email: true, role: true, phone: true } } }
    });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const rawId = typeof id === 'object' ? (id._id || id.id) : String(id);
    const query = prisma.deviceToken.findFirst({
      where: {
        OR: [
          { id: rawId },
          { token: rawId }
        ]
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, phone: true } } }
    });
    return new QueryChain(query);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const filterId = typeof id === 'object' ? (id._id || id.id) : String(id);
    const dataToSet = update.$set ? update.$set : update;
    try {
      await prisma.deviceToken.updateMany({
        where: { id: filterId },
        data: dataToSet
      });
      return await this.findById(filterId);
    } catch (e) {
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    const filterId = typeof id === 'object' ? (id._id || id.id) : String(id);
    try {
      const doc = await this.findById(filterId);
      if (doc) {
        await prisma.deviceToken.deleteMany({ where: { id: filterId } });
      }
      return doc;
    } catch (e) {
      return null;
    }
  }

  static async create(data) {
    const doc = new DeviceTokenDocument(data);
    await doc.save();
    return doc;
  }

  static async updateOne(where = {}, update = {}) {
    const filter = {};
    if (where.token) filter.token = where.token;
    if (where._id || where.id) filter.id = String(where._id || where.id);
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

  static async deleteOne(where = {}) {
    const filter = {};
    if (where.token) filter.token = where.token;
    if (where._id || where.id) filter.id = String(where._id || where.id);
    try {
      const deleted = await prisma.deviceToken.deleteMany({ where: filter });
      return { deletedCount: deleted.count };
    } catch (e) {
      return { deletedCount: 0 };
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
    return await this.find({ userId: String(userId), isActive: true });
  }

  static async getActiveTokensForUsers(userIds) {
    const ids = userIds.map(String);
    return await this.find({ userId: { $in: ids }, isActive: true });
  }

  static async deactivateToken(token) {
    return await this.updateOne({ token }, { isActive: false });
  }

  static async getActiveAdminTokens() {
    const adminRoles = [
      'platform_admin',
      'store_owner',
      'store_manager',
      'delivery_manager',
      'support_staff',
      'inventory_staff',
      'finance_staff',
      'admin',
      'super_admin'
    ];
    const User = require('./User');
    const admins = await User.find({ role: { $in: adminRoles } });
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
