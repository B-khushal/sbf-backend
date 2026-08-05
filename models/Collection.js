const prisma = require('../config/prisma');

class CollectionDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.name = data.name || 'Collection';
    this.visibility = data.isActive !== false ? 'published' : 'hidden';
    this.displayPriority = 0;
    this.products = [];
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      bannerImage: this.bannerImage || this.image,
      icon: this.icon,
      displayPriority: this.displayPriority,
      visibility: this.visibility,
      products: this.products,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const colId = this.id || this._id;
    const updated = await prisma.collection.upsert({
      where: { id: colId },
      update: {
        name: this.name,
        slug: this.slug,
        description: this.description,
        image: this.bannerImage || this.image,
        isActive: this.visibility !== 'hidden'
      },
      create: {
        id: colId || `col_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: this.name || 'Collection',
        slug: this.slug || `collection-${Date.now()}`,
        description: this.description || null,
        image: this.bannerImage || this.image || null,
        isActive: this.visibility !== 'hidden'
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
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
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) {
        const docs = res.map(c => new CollectionDocument(c));
        if (resolve) resolve(docs);
        return docs;
      } else if (res) {
        const doc = new CollectionDocument(res);
        if (resolve) resolve(doc);
        return doc;
      } else {
        if (resolve) resolve(null);
        return null;
      }
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }
}

class CollectionModel {
  static find(where = {}) {
    const filter = {};
    if (where.slug) filter.slug = where.slug;
    if (where.visibility === 'published') filter.isActive = true;
    else if (where.visibility === 'hidden') filter.isActive = false;

    const query = prisma.collection.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.slug) filter.slug = where.slug;
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.collection.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.collection.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async countDocuments(where = {}) {
    return await prisma.collection.count({ where });
  }

  static async create(data) {
    const created = await prisma.collection.create({
      data: {
        id: data.id || data._id || `col_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        slug: data.slug || `collection-${Date.now()}`,
        description: data.description || null,
        image: data.bannerImage || data.image || null,
        isActive: data.visibility !== 'hidden'
      }
    });
    return new CollectionDocument(created);
  }
}

module.exports = CollectionModel;
