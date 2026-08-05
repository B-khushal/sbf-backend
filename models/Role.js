const prisma = require('../config/prisma');

class RoleDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.code = data.name;
  }
}

class RoleModel {
  static async findOne(where = {}) {
    if (!where || Object.keys(where).length === 0) {
      const doc = await prisma.role.findFirst();
      return doc ? new RoleDocument(doc) : null;
    }

    const searchStr = where.code || where.name;
    const searchId = where._id || where.id;

    const OR = [];

    if (searchId) {
      OR.push({ id: String(searchId) });
    }

    if (searchStr) {
      OR.push(
        { name: searchStr },
        { name: { equals: searchStr, mode: 'insensitive' } },
        { displayName: { equals: searchStr, mode: 'insensitive' } }
      );
    }

    const filter = OR.length > 0 ? { OR } : where;
    const doc = await prisma.role.findFirst({ where: filter });
    return doc ? new RoleDocument(doc) : null;
  }

  static async find(where = {}) {
    const roles = await prisma.role.findMany({ where });
    return roles.map(r => new RoleDocument(r));
  }

  static async create(data) {
    const roleName = data.code || data.name || 'role';
    const roleDisplayName = data.displayName || data.name || roleName;
    try {
      const created = await prisma.role.create({
        data: {
          id: data.id || data._id || `role_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: roleName,
          displayName: roleDisplayName,
          description: data.description || null,
          permissions: data.permissions ? data.permissions : []
        }
      });
      return new RoleDocument(created);
    } catch (err) {
      if (err.code === 'P2002') {
        const existing = await RoleModel.findOne({ name: roleName, code: roleName });
        if (existing) return existing;
      }
      throw err;
    }
  }

  static async countDocuments(where = {}) {
    return await prisma.role.count({ where });
  }

  static async seedDefaultRoles() {
    return Promise.resolve();
  }
}

module.exports = RoleModel;
