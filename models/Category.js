const prisma = require('../config/prisma');

function cleanCategoryWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  if (where.status === 'active' || where.isActive === true) clean.isActive = true;
  else if (where.status === 'inactive' || where.isActive === false) clean.isActive = false;

  if (where.parentId !== undefined) {
    clean.parentId = where.parentId ? String(where.parentId) : null;
  }
  if (where.slug) clean.slug = where.slug;
  if (where.showInShop !== undefined) clean.isFeatured = Boolean(where.showInShop);

  if (where._id || where.id) {
    const idVal = where._id || where.id;
    if (typeof idVal === 'object' && idVal.$ne) {
      clean.id = { not: String(idVal.$ne) };
    } else if (typeof idVal === 'string') {
      clean.id = String(idVal);
    }
  }

  if (where.categoryUrl) {
    const cleanUrl = where.categoryUrl;
    const slugPart = cleanUrl.replace(/^\/+|\/+$/g, '');
    clean.OR = [
      { categoryUrl: cleanUrl },
      { slug: slugPart }
    ];
  }

  return clean;
}

class CategoryDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.status = data.isActive !== false ? 'active' : 'inactive';
    this.sortOrder = data.displayOrder || 0;
    this.categoryUrl = data.categoryUrl || (data.slug ? `/${data.slug}` : '');
    this.showInShop = data.isFeatured !== undefined ? Boolean(data.isFeatured) : (data.showInShop !== undefined ? Boolean(data.showInShop) : false);
    this.isFeatured = this.showInShop;
    this.seoTitle = data.metaTitle || data.name || '';
    this.seoDescription = data.metaDescription || data.description || '';
  }

  toJSON() {
    return this.toObject();
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      image: this.image,
      icon: this.icon,
      banner: this.banner,
      parentId: this.parentId,
      sortOrder: this.sortOrder,
      displayOrder: this.displayOrder,
      categoryUrl: this.categoryUrl,
      showInShop: this.showInShop,
      isFeatured: this.isFeatured,
      status: this.status,
      isActive: this.status !== 'inactive',
      seoTitle: this.seoTitle,
      seoDescription: this.seoDescription,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const catId = this.id || this._id;
    const isAct = this.status !== 'inactive';
    const computedUrl = this.categoryUrl || (this.slug ? `/${this.slug}` : '');
    
    const updated = await prisma.category.upsert({
      where: { id: catId },
      update: {
        name: this.name,
        slug: this.slug,
        description: this.description,
        image: this.image,
        icon: this.icon,
        banner: this.banner,
        categoryUrl: computedUrl,
        displayOrder: this.displayOrder || this.sortOrder || 0,
        isActive: isAct,
        isFeatured: this.showInShop === true,
        metaTitle: this.seoTitle || this.name,
        metaDescription: this.seoDescription || this.description
      },
      create: {
        id: catId || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: this.name || 'Category',
        slug: this.slug || `category-${Date.now()}`,
        description: this.description || null,
        image: this.image || null,
        icon: this.icon || null,
        banner: this.banner || null,
        categoryUrl: computedUrl,
        displayOrder: this.displayOrder || this.sortOrder || 0,
        isActive: isAct,
        isFeatured: this.showInShop === true,
        metaTitle: this.seoTitle || this.name,
        metaDescription: this.seoDescription || this.description
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    this.categoryUrl = updated.categoryUrl || computedUrl;
    this.showInShop = updated.isFeatured;
    this.isFeatured = updated.isFeatured;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) {
    this.prismaQuery = prismaQuery;
  }
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
      if (Array.isArray(res)) resolve(res.map(c => new CategoryDocument(c)));
      else if (res) resolve(new CategoryDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class CategoryModel {
  static find(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);

    const query = prisma.category.findMany({
      where: prismaWhere,
      orderBy: { displayOrder: 'asc' },
      include: { subCategories: true }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);

    const query = prisma.category.findFirst({
      where: prismaWhere,
      include: { subCategories: true }
    });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.category.findUnique({
      where: { id: String(id) },
      include: { subCategories: true }
    });
    return new QueryChain(query);
  }

  static async create(data) {
    const computedUrl = data.categoryUrl || (data.slug ? `/${data.slug}` : '');
    const created = await prisma.category.create({
      data: {
        id: data.id || data._id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        slug: data.slug || `cat-${Date.now()}`,
        description: data.description || null,
        image: data.image || null,
        icon: data.icon || null,
        banner: data.banner || null,
        categoryUrl: computedUrl,
        displayOrder: data.sortOrder || data.displayOrder || 0,
        isActive: data.status !== 'inactive',
        isFeatured: data.showInShop === true,
        metaTitle: data.seoTitle || data.name,
        metaDescription: data.seoDescription || data.description
      }
    });
    return new CategoryDocument(created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.category.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new CategoryDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.category.delete({ where: { id: String(id) } });
      return new CategoryDocument(deleted);
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);
    return await prisma.category.count({ where: prismaWhere });
  }

  static populate() { return this; }
}

module.exports = CategoryModel;
