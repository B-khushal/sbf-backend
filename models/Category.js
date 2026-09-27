const prisma = require('../config/prisma');

function cleanCategoryWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  const orList = [];
  if (where.$or && Array.isArray(where.$or)) {
    where.$or.forEach(cond => {
      const condClean = {};
      if (cond.name) {
        condClean.name = typeof cond.name === 'object' && cond.name.$regex
          ? { contains: cond.name.$regex, mode: 'insensitive' }
          : cond.name;
      }
      if (cond.slug) {
        condClean.slug = typeof cond.slug === 'object' && cond.slug.$regex
          ? { contains: cond.slug.$regex, mode: 'insensitive' }
          : cond.slug;
      }
      if (cond.description) {
        condClean.description = typeof cond.description === 'object' && cond.description.$regex
          ? { contains: cond.description.$regex, mode: 'insensitive' }
          : cond.description;
      }
      if (cond.categoryUrl) {
        condClean.categoryUrl = cond.categoryUrl;
      }
      if (Object.keys(condClean).length > 0) {
        orList.push(condClean);
      }
    });
  }

  if (where.status === 'active' || where.isActive === true) clean.isActive = true;
  else if (where.status === 'inactive' || where.isActive === false) clean.isActive = false;

  if (where.parentId !== undefined) {
    if (where.parentId === null || where.parentId === 'null' || where.parentId === '') {
      clean.parentId = null;
    } else {
      clean.parentId = typeof where.parentId === 'object' ? (where.parentId.id || where.parentId._id) : String(where.parentId);
    }
  }

  if (where.slug) clean.slug = where.slug;
  if (where.showInShop !== undefined) clean.isFeatured = Boolean(where.showInShop);

  if (where._id || where.id) {
    const idVal = where._id || where.id;
    if (typeof idVal === 'object' && idVal !== null) {
      if (idVal.$ne) {
        clean.id = { not: String(idVal.$ne) };
      } else if (idVal.$in && Array.isArray(idVal.$in)) {
        clean.id = { in: idVal.$in.map(String) };
      }
    } else if (typeof idVal === 'string') {
      clean.id = String(idVal);
    }
  }

  if (where.categoryUrl) {
    const cleanUrl = where.categoryUrl;
    const slugPart = cleanUrl.replace(/^\/+|\/+$/g, '');
    if (where.exactUrlOnly) {
      clean.categoryUrl = cleanUrl;
    } else if (orList.length === 0) {
      clean.OR = [
        { categoryUrl: cleanUrl },
        { slug: slugPart }
      ];
    } else {
      clean.categoryUrl = cleanUrl;
    }
  } else if (orList.length > 0) {
    clean.OR = orList;
  }

  return clean;
}

class CategoryDocument {
  constructor(data = {}) {
    Object.assign(this, data);
    const catId = data.id || data._id;
    this.id = catId;
    this._id = catId;
    this.name = data.name || '';
    this.slug = data.slug || '';
    this.description = data.description || '';
    this.image = data.image || '';
    this.icon = data.icon || '';
    this.banner = data.banner || '';
    this.status = data.status || (data.isActive !== false ? 'active' : 'inactive');
    this.isActive = this.status !== 'inactive';
    this.sortOrder = typeof data.sortOrder === 'number' ? data.sortOrder : (typeof data.displayOrder === 'number' ? data.displayOrder : 0);
    this.displayOrder = this.sortOrder;
    this.categoryUrl = data.categoryUrl || (data.slug ? `/${data.slug}` : '');
    this.showInShop = data.showInShop !== undefined ? Boolean(data.showInShop) : (data.isFeatured !== undefined ? Boolean(data.isFeatured) : true);
    this.isFeatured = this.showInShop;
    this.seoTitle = data.seoTitle || data.metaTitle || data.name || '';
    this.seoDescription = data.seoDescription || data.metaDescription || data.description || '';

    if (data.parent && typeof data.parent === 'object') {
      this.parentId = {
        _id: data.parent.id,
        id: data.parent.id,
        name: data.parent.name,
        slug: data.parent.slug
      };
    } else if (data.parentId && typeof data.parentId === 'object') {
      this.parentId = data.parentId;
    } else if (data.parentId && data.parentId !== 'null' && String(data.parentId).trim() !== '') {
      this.parentId = String(data.parentId).trim();
    } else {
      this.parentId = null;
    }
  }

  toJSON() {
    return this.toObject();
  }

  toObject() {
    return {
      _id: this._id || this.id,
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
    let catId = this.id || this._id;
    if (!catId) {
      catId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      this.id = catId;
      this._id = catId;
    }
    const isAct = this.status !== 'inactive';
    const computedUrl = this.categoryUrl || (this.slug ? `/${this.slug}` : '');

    let resolvedParentId = null;
    if (this.parentId) {
      if (typeof this.parentId === 'object' && this.parentId !== null) {
        resolvedParentId = this.parentId.id || this.parentId._id || null;
      } else if (typeof this.parentId === 'string' && this.parentId !== 'null' && this.parentId.trim() !== '') {
        resolvedParentId = this.parentId.trim();
      }
    }

    const updated = await prisma.category.upsert({
      where: { id: catId },
      update: {
        name: this.name,
        slug: this.slug,
        description: this.description || null,
        image: this.image || null,
        icon: this.icon || null,
        banner: this.banner || null,
        categoryUrl: computedUrl,
        parentId: resolvedParentId,
        displayOrder: typeof this.displayOrder === 'number' ? this.displayOrder : (typeof this.sortOrder === 'number' ? this.sortOrder : 0),
        isActive: isAct,
        isFeatured: this.showInShop === true || this.isFeatured === true,
        metaTitle: this.seoTitle || this.name || null,
        metaDescription: this.seoDescription || this.description || null
      },
      create: {
        id: catId,
        name: this.name || 'Category',
        slug: this.slug || `category-${Date.now()}`,
        description: this.description || null,
        image: this.image || null,
        icon: this.icon || null,
        banner: this.banner || null,
        categoryUrl: computedUrl,
        parentId: resolvedParentId,
        displayOrder: typeof this.displayOrder === 'number' ? this.displayOrder : (typeof this.sortOrder === 'number' ? this.sortOrder : 0),
        isActive: isAct,
        isFeatured: this.showInShop === true || this.isFeatured === true,
        metaTitle: this.seoTitle || this.name || null,
        metaDescription: this.seoDescription || this.description || null
      },
      include: {
        parent: true,
        subCategories: true
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    this.id = updated.id;
    this.categoryUrl = updated.categoryUrl || computedUrl;
    this.showInShop = updated.isFeatured;
    this.isFeatured = updated.isFeatured;
    this.status = updated.isActive ? 'active' : 'inactive';
    this.isActive = updated.isActive;
    this.sortOrder = updated.displayOrder;
    this.displayOrder = updated.displayOrder;
    this.seoTitle = updated.metaTitle || this.name;
    this.seoDescription = updated.metaDescription || this.description;
    this.parentId = updated.parent
      ? { _id: updated.parent.id, id: updated.parent.id, name: updated.parent.name, slug: updated.parent.slug }
      : (updated.parentId || null);
    return this;
  }

  async deleteOne() {
    const catId = this.id || this._id;
    if (catId) {
      await prisma.category.delete({ where: { id: String(catId) } });
    }
    return this;
  }

  async remove() {
    return this.deleteOne();
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

class CategoryModel extends CategoryDocument {
  constructor(data) {
    super(data);
  }

  static find(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);

    const query = prisma.category.findMany({
      where: prismaWhere,
      orderBy: { displayOrder: 'asc' },
      include: { parent: true, subCategories: true }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);

    const query = prisma.category.findFirst({
      where: prismaWhere,
      include: { parent: true, subCategories: true }
    });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.category.findUnique({
      where: { id: String(id) },
      include: { parent: true, subCategories: true }
    });
    return new QueryChain(query);
  }

  static async create(data) {
    const doc = new CategoryModel(data);
    return await doc.save();
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.category.update({
        where: { id: String(id) },
        data: dataToUpdate,
        include: { parent: true, subCategories: true }
      });
      return new CategoryDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.category.delete({
        where: { id: String(id) },
        include: { parent: true, subCategories: true }
      });
      return new CategoryDocument(deleted);
    } catch (e) {
      return null;
    }
  }

  static async deleteMany(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);
    return await prisma.category.deleteMany({
      where: prismaWhere
    });
  }

  static async updateMany(where = {}, update = {}) {
    const prismaWhere = cleanCategoryWhere(where);
    const data = {};
    const set = update.$set ? update.$set : update;
    if (set.status !== undefined) {
      data.isActive = set.status === 'active';
    }
    if (set.isActive !== undefined) {
      data.isActive = Boolean(set.isActive);
    }
    if (set.showInShop !== undefined) {
      data.isFeatured = Boolean(set.showInShop);
    }
    if (set.isFeatured !== undefined) {
      data.isFeatured = Boolean(set.isFeatured);
    }
    return await prisma.category.updateMany({
      where: prismaWhere,
      data
    });
  }

  static async countDocuments(where = {}) {
    const prismaWhere = cleanCategoryWhere(where);
    return await prisma.category.count({ where: prismaWhere });
  }

  static populate() { return this; }
}

module.exports = CategoryModel;
