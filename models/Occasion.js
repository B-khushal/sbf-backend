const prisma = require('../config/prisma');

class OccasionDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.status = data.isActive !== false ? 'active' : 'inactive';
    this.featured = data.isFeatured === true;
    this.visibleOnHomepage = data.visibleOnHomepage !== false;
    this.accentColor = data.accentColor || '#D4AF37';
    this.icon = data.icon || 'Gift';
    this.banner = data.banner || '';
    this.thumbnail = data.thumbnail || data.image || '';
    this.displayOrder = typeof data.displayOrder === 'number' ? data.displayOrder : 0;
    this.seoTitle = data.metaTitle || '';
    this.seoDescription = data.metaDescription || '';
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
      thumbnail: this.thumbnail,
      icon: this.icon,
      banner: this.banner,
      accentColor: this.accentColor,
      displayOrder: this.displayOrder,
      status: this.status,
      isActive: this.status !== 'inactive',
      featured: this.featured,
      isFeatured: this.featured,
      visibleOnHomepage: this.visibleOnHomepage,
      seoTitle: this.seoTitle,
      seoDescription: this.seoDescription,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const occId = this.id || this._id;
    const isAct = this.status !== 'inactive';
    const updated = await prisma.occasion.upsert({
      where: { id: occId },
      update: {
        name: this.name,
        slug: this.slug,
        description: this.description,
        image: this.image,
        thumbnail: this.thumbnail,
        icon: this.icon,
        banner: this.banner,
        accentColor: this.accentColor,
        displayOrder: this.displayOrder || 0,
        isActive: isAct,
        isFeatured: this.featured === true,
        visibleOnHomepage: this.visibleOnHomepage !== false,
        metaTitle: this.seoTitle,
        metaDescription: this.seoDescription
      },
      create: {
        id: occId || `occ_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: this.name || 'Occasion',
        slug: this.slug || `occasion-${Date.now()}`,
        description: this.description || null,
        image: this.image || null,
        thumbnail: this.thumbnail || null,
        icon: this.icon || 'Gift',
        banner: this.banner || null,
        accentColor: this.accentColor || '#D4AF37',
        displayOrder: this.displayOrder || 0,
        isActive: isAct,
        isFeatured: this.featured === true,
        visibleOnHomepage: this.visibleOnHomepage !== false,
        metaTitle: this.seoTitle,
        metaDescription: this.seoDescription
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
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
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) resolve(res.map(o => new OccasionDocument(o)));
      else if (res) resolve(new OccasionDocument(res));
      else resolve(null);
    } catch (err) { reject(err); }
  }
}

class OccasionModel {
  static async seedDefaultOccasions() {
    try {
      const count = await prisma.occasion.count();
      if (count > 0) return;

      const defaults = [
        { name: 'Birthday', slug: 'birthday', icon: 'Cake', accentColor: '#D4AF37', displayOrder: 0, featured: true, visibleOnHomepage: true },
        { name: 'Anniversary', slug: 'anniversary', icon: 'Gift', accentColor: '#db2777', displayOrder: 1, featured: true, visibleOnHomepage: true },
        { name: 'Love & Romance', slug: 'love-romance', icon: 'Heart', accentColor: '#e11d48', displayOrder: 2, featured: true, visibleOnHomepage: true },
        { name: 'Wedding', slug: 'wedding', icon: 'Sparkles', accentColor: '#fbbf24', displayOrder: 3, featured: false, visibleOnHomepage: true },
        { name: 'Congratulations', slug: 'congratulations', icon: 'PartyPopper', accentColor: '#10b981', displayOrder: 4, featured: false, visibleOnHomepage: true },
        { name: 'Thank You', slug: 'thank-you', icon: 'HeartHandshake', accentColor: '#6366f1', displayOrder: 5, featured: false, visibleOnHomepage: true },
        { name: 'Get Well Soon', slug: 'get-well-soon', icon: 'Activity', accentColor: '#3b82f6', displayOrder: 6, featured: false, visibleOnHomepage: true },
        { name: 'Baby Shower', slug: 'baby-shower', icon: 'Baby', accentColor: '#f43f5e', displayOrder: 7, featured: false, visibleOnHomepage: true },
        { name: 'Housewarming', slug: 'housewarming', icon: 'Home', accentColor: '#0f766e', displayOrder: 8, featured: false, visibleOnHomepage: true },
        { name: 'Sympathy', slug: 'sympathy', icon: 'Heart', accentColor: '#6b7280', displayOrder: 9, featured: false, visibleOnHomepage: true },
        { name: "Women's Day", slug: 'womens-day', icon: 'Smile', accentColor: '#ec4899', displayOrder: 10, featured: false, visibleOnHomepage: false },
        { name: "Father's Day", slug: 'fathers-day', icon: 'Award', accentColor: '#1d4ed8', displayOrder: 11, featured: false, visibleOnHomepage: false },
        { name: "Mother's Day", slug: 'mothers-day', icon: 'Award', accentColor: '#be185d', displayOrder: 12, featured: false, visibleOnHomepage: false },
        { name: 'Friendship Day', slug: 'friendship-day', icon: 'Smile', accentColor: '#eab308', displayOrder: 13, featured: false, visibleOnHomepage: false },
        { name: "Teacher's Day", slug: 'teachers-day', icon: 'Award', accentColor: '#c2410c', displayOrder: 14, featured: false, visibleOnHomepage: false },
        { name: "Valentine's Day", slug: 'valentines-day', icon: 'Heart', accentColor: '#dc2626', displayOrder: 15, featured: true, visibleOnHomepage: false },
        { name: 'Diwali', slug: 'diwali', icon: 'Flame', accentColor: '#f97316', displayOrder: 16, featured: true, visibleOnHomepage: false },
        { name: 'Christmas', slug: 'christmas', icon: 'TreePine', accentColor: '#15803d', displayOrder: 17, featured: true, visibleOnHomepage: false },
        { name: 'New Year', slug: 'new-year', icon: 'PartyPopper', accentColor: '#a21caf', displayOrder: 18, featured: true, visibleOnHomepage: false }
      ];

      for (const item of defaults) {
        await prisma.occasion.create({
          data: {
            id: `occ_${item.slug}`,
            name: item.name,
            slug: item.slug,
            icon: item.icon,
            accentColor: item.accentColor,
            displayOrder: item.displayOrder,
            isFeatured: item.featured,
            visibleOnHomepage: item.visibleOnHomepage,
            isActive: true
          }
        });
      }
      console.log('✅ Default occasions seeded successfully in PostgreSQL!');
    } catch (e) {
      console.error('Error seeding default occasions:', e);
    }
  }

  static find(where = {}) {
    const filter = {};
    if (where.isActive !== undefined) filter.isActive = where.isActive;
    if (where.status === 'active') filter.isActive = true;
    if (where.status === 'inactive') filter.isActive = false;
    if (where.visibleOnHomepage !== undefined) filter.visibleOnHomepage = Boolean(where.visibleOnHomepage);
    if (where.featured !== undefined) filter.isFeatured = Boolean(where.featured);
    if (where.slug) filter.slug = where.slug;

    const query = prisma.occasion.findMany({
      where: filter,
      orderBy: { displayOrder: 'asc' }
    });
    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const filter = {};
    if (where.slug) filter.slug = where.slug;
    if (where._id || where.id) filter.id = String(where._id || where.id);

    const query = prisma.occasion.findFirst({ where: filter });
    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.occasion.findUnique({ where: { id: String(id) } });
    return new QueryChain(query);
  }

  static async create(data) {
    const created = await prisma.occasion.create({
      data: {
        id: data.id || data._id || `occ_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        slug: data.slug || `occ-${Date.now()}`,
        description: data.description || null,
        image: data.image || null,
        thumbnail: data.thumbnail || null,
        icon: data.icon || 'Gift',
        banner: data.banner || null,
        accentColor: data.accentColor || '#D4AF37',
        displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
        isActive: data.status !== 'inactive' && data.isActive !== false,
        isFeatured: data.featured === true,
        visibleOnHomepage: data.visibleOnHomepage !== false
      }
    });
    return new OccasionDocument(created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.occasion.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new OccasionDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async deleteMany(where = {}) {
    try {
      return await prisma.occasion.deleteMany({ where });
    } catch (e) {
      return { count: 0 };
    }
  }

  static async countDocuments(where = {}) {
    return await prisma.occasion.count({ where });
  }
}

module.exports = OccasionModel;
