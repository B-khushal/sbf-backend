const prisma = require('../config/prisma');

function cleanAddonWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  if (where.isAvailable !== undefined) {
    clean.isActive = Boolean(where.isAvailable);
  }
  if (where.active !== undefined || where.status !== undefined) {
    if (where.status !== 'all') {
      const isAct = where.active !== undefined ? Boolean(where.active) : (where.status === 'active');
      clean.isActive = isAct;
    }
  }
  if (where.category && where.category !== 'all') {
    clean.category = String(where.category);
  }
  if (where._id || where.id) {
    clean.id = String(where._id || where.id);
  }

  return clean;
}

class AddonProductDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    this.id = data.id || data._id;
    this._id = this.id;
    this.name = data.name || '';
    this.price = data.price ? parseFloat(data.price) : 0;
    this.comparePrice = data.comparePrice ? parseFloat(data.comparePrice) : null;
    this.category = data.category || 'General';
    this.image = data.image || '';
    this.description = data.description || '';
    const isAct = data.isActive !== undefined ? Boolean(data.isActive) : (data.active !== undefined ? Boolean(data.active) : (data.isAvailable !== false && data.status !== 'inactive'));
    this.isAvailable = isAct;
    this.active = isAct;
    this.status = isAct ? 'active' : 'inactive';
    this.displayOrder = data.displayOrder || 0;
  }

  toJSON() {
    return this.toObject();
  }

  toObject() {
    return { ...this };
  }

  async save() {
    const isAct = this.active !== undefined ? Boolean(this.active) : (this.isAvailable !== false);
    const saved = await prisma.addonProduct.upsert({
      where: { id: String(this.id) },
      update: {
        name: this.name,
        price: parseFloat(this.price) || 0,
        category: this.category || 'General',
        image: this.image || '',
        description: this.description || '',
        isActive: isAct
      },
      create: {
        id: String(this.id || `add_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`),
        name: this.name || 'Addon',
        price: parseFloat(this.price) || 0,
        category: this.category || 'General',
        image: this.image || '',
        description: this.description || '',
        isActive: isAct
      }
    });

    Object.assign(this, saved);
    this._id = saved.id;
    this.isAvailable = saved.isActive;
    this.active = saved.isActive;
    this.status = saved.isActive ? 'active' : 'inactive';
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) { this.prismaQuery = prismaQuery; }
  sort() { return this; }
  select() { return this; }
  skip() { return this; }
  limit() { return this; }
  populate() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(a => new AddonProductDocument(a)));
      else if (res) resolve(new AddonProductDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class AddonProductModel {
  static find(where = {}) {
    const filter = cleanAddonWhere(where);
    const query = prisma.addonProduct.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = cleanAddonWhere(where);
    const query = prisma.addonProduct.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.addonProduct.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new AddonProductDocument(data);
    await doc.save();
    return doc;
  }

  static async findByIdAndUpdate(id, updateData) {
    const data = updateData.$set ? updateData.$set : updateData;
    try {
      const existing = await AddonProductModel.findById(id);
      if (!existing) return null;
      Object.assign(existing, data);
      await existing.save();
      return existing;
    } catch (e) { return null; }
  }

  static async findByIdAndDelete(id) {
    try {
      const existing = await AddonProductModel.findById(id);
      if (existing) {
        await prisma.addonProduct.delete({ where: { id: String(id) } });
        return existing;
      }
      return null;
    } catch (e) { return null; }
  }

  static async countDocuments(where = {}) {
    const filter = cleanAddonWhere(where);
    return await prisma.addonProduct.count({ where: filter });
  }

  static populate() { return this; }
}

module.exports = AddonProductModel;
