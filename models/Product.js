const prisma = require('../config/prisma');

function cleanProductWhere(where = {}) {
  const clean = {};
  if (!where || typeof where !== 'object') return clean;

  if (where.$or && Array.isArray(where.$or)) {
    const orConditions = where.$or.map(cond => cleanProductWhere(cond)).filter(c => Object.keys(c).length > 0);
    if (orConditions.length > 0) {
      clean.OR = orConditions;
    }
  }

  if (where.slug) clean.slug = where.slug;
  if (where.isAvailable !== undefined) clean.isAvailable = Boolean(where.isAvailable);
  
  if (where.hidden !== undefined) {
    if (typeof where.hidden === 'object' && where.hidden !== null) {
      if (where.hidden.$ne === true || where.hidden.$ne === 'true') {
        clean.isVisible = true;
      } else if (where.hidden.$ne === false || where.hidden.$ne === 'false') {
        clean.isVisible = false;
      }
    } else {
      clean.isVisible = !Boolean(where.hidden);
    }
  } else if (where.isVisible !== undefined) {
    if (typeof where.isVisible === 'object' && where.isVisible !== null) {
      if (where.isVisible.$ne === true || where.isVisible.$ne === 'true') {
        clean.isVisible = false;
      } else if (where.isVisible.$ne === false || where.isVisible.$ne === 'false') {
        clean.isVisible = true;
      }
    } else {
      clean.isVisible = Boolean(where.isVisible);
    }
  }

  if (where.isFeatured !== undefined) clean.isFeatured = Boolean(where.isFeatured);
  if (where.isBestseller !== undefined) clean.isBestseller = Boolean(where.isBestseller);
  
  if (where.isNew !== undefined) {
    clean.isNewArrival = Boolean(where.isNew);
  } else if (where.isNewArrival !== undefined) {
    clean.isNewArrival = Boolean(where.isNewArrival);
  }

  if (where.isValentineProduct !== undefined) {
    clean.isValentineProduct = Boolean(where.isValentineProduct);
  }

  if (where.showInValentineShop !== undefined) {
    clean.showInValentineShop = Boolean(where.showInValentineShop);
  }

  if (where._id || where.id) clean.id = String(where._id || where.id);

  if (where.approvalStatus) {
    if (typeof where.approvalStatus === 'string') {
      clean.approvalStatus = where.approvalStatus;
    } else if (typeof where.approvalStatus === 'object' && where.approvalStatus !== null) {
      if (where.approvalStatus.$in && Array.isArray(where.approvalStatus.$in)) {
        clean.approvalStatus = { in: where.approvalStatus.$in };
      }
      if (where.approvalStatus.$ne) {
        clean.approvalStatus = { not: where.approvalStatus.$ne };
      }
    }
  }

  const vVal = where.vendorId !== undefined ? where.vendorId : where.vendor;
  if (vVal !== undefined) {
    if (typeof vVal === 'string') {
      clean.vendorId = String(vVal);
    } else if (typeof vVal === 'object' && vVal !== null) {
      if (vVal.$ne !== undefined) {
        if (vVal.$ne === null) {
          clean.vendorId = { not: null };
        } else {
          clean.vendorId = { not: String(vVal.$ne) };
        }
      }
    }
  }

  if (where.price && typeof where.price === 'object') {
    clean.price = {};
    if (where.price.$gte !== undefined) clean.price.gte = parseFloat(where.price.$gte);
    if (where.price.$lte !== undefined) clean.price.lte = parseFloat(where.price.$lte);
    if (where.price.$gt !== undefined) clean.price.gt = parseFloat(where.price.$gt);
    if (where.price.$lt !== undefined) clean.price.lt = parseFloat(where.price.$lt);
  }

  const stockVal = where.countInStock !== undefined ? where.countInStock : where.stock;
  if (stockVal !== undefined) {
    if (typeof stockVal === 'object' && stockVal !== null) {
      clean.stock = {};
      if (stockVal.$lt !== undefined) clean.stock.lt = parseInt(stockVal.$lt);
      if (stockVal.$lte !== undefined) clean.stock.lte = parseInt(stockVal.$lte);
      if (stockVal.$gt !== undefined) clean.stock.gt = parseInt(stockVal.$gt);
      if (stockVal.$gte !== undefined) clean.stock.gte = parseInt(stockVal.$gte);
    } else {
      clean.stock = parseInt(stockVal);
    }
  }

  return clean;
}

function sanitizeProductDataForPrisma(data = {}) {
  const cleanData = {};

  if (data.name !== undefined || data.title !== undefined) {
    cleanData.name = String(data.name || data.title || 'Product');
  }
  if (data.slug !== undefined) cleanData.slug = String(data.slug);
  if (data.sku !== undefined) cleanData.sku = data.sku ? String(data.sku) : null;
  if (data.description !== undefined) cleanData.description = String(data.description || '');
  if (data.shortDescription !== undefined) cleanData.shortDescription = data.shortDescription ? String(data.shortDescription) : null;

  if (data.price !== undefined) cleanData.price = parseFloat(data.price || 0);
  if (data.comparePrice !== undefined) cleanData.comparePrice = data.comparePrice ? parseFloat(data.comparePrice) : null;
  if (data.costPrice !== undefined) cleanData.costPrice = data.costPrice ? parseFloat(data.costPrice) : null;

  if (data.stock !== undefined || data.countInStock !== undefined) {
    cleanData.stock = parseInt(data.stock !== undefined ? data.stock : data.countInStock || 0);
  }

  if (data.isAvailable !== undefined) cleanData.isAvailable = Boolean(data.isAvailable);

  if (data.hidden !== undefined) {
    cleanData.isVisible = !Boolean(data.hidden);
  } else if (data.isVisible !== undefined) {
    cleanData.isVisible = Boolean(data.isVisible);
  }

  if (data.isFeatured !== undefined) cleanData.isFeatured = Boolean(data.isFeatured);
  if (data.isBestseller !== undefined) cleanData.isBestseller = Boolean(data.isBestseller);

  if (data.isNew !== undefined) {
    cleanData.isNewArrival = Boolean(data.isNew);
  } else if (data.isNewArrival !== undefined) {
    cleanData.isNewArrival = Boolean(data.isNewArrival);
  }

  if (data.rating !== undefined) cleanData.rating = parseFloat(data.rating || 0);
  if (data.reviewCount !== undefined) cleanData.reviewCount = parseInt(data.reviewCount || 0);
  if (data.vendorId !== undefined) cleanData.vendorId = data.vendorId ? String(data.vendorId) : null;

  // Personalization & Customization
  if (data.personalizationEnabled !== undefined) cleanData.personalizationEnabled = Boolean(data.personalizationEnabled);
  if (data.personalizationType !== undefined) cleanData.personalizationType = data.personalizationType;
  if (data.fieldLabel !== undefined) cleanData.fieldLabel = data.fieldLabel;
  if (data.placeholder !== undefined) cleanData.placeholder = data.placeholder;
  if (data.minCharacters !== undefined) cleanData.minCharacters = data.minCharacters ? parseInt(data.minCharacters) : null;
  if (data.maxCharacters !== undefined) cleanData.maxCharacters = data.maxCharacters ? parseInt(data.maxCharacters) : null;
  if (data.allowedCharacters !== undefined) cleanData.allowedCharacters = data.allowedCharacters;
  if (data.personalizationRequired !== undefined) cleanData.personalizationRequired = Boolean(data.personalizationRequired);
  if (data.textTransform !== undefined) cleanData.textTransform = data.textTransform;
  if (data.helperText !== undefined) cleanData.helperText = data.helperText;
  if (data.pricePerCharacter !== undefined) cleanData.pricePerCharacter = data.pricePerCharacter ? parseFloat(data.pricePerCharacter) : null;
  if (data.baseIncludedCharacters !== undefined) cleanData.baseIncludedCharacters = data.baseIncludedCharacters ? parseInt(data.baseIncludedCharacters) : null;
  if (data.maxExtraPrice !== undefined) cleanData.maxExtraPrice = data.maxExtraPrice ? parseFloat(data.maxExtraPrice) : null;
  if (data.customizationOptions !== undefined) cleanData.customizationOptions = data.customizationOptions;

  // Category Attributes
  if (data.cakeAttributes !== undefined) cleanData.cakeAttributes = data.cakeAttributes;
  if (data.plantAttributes !== undefined) cleanData.plantAttributes = data.plantAttributes;
  if (data.chocolateAttributes !== undefined) cleanData.chocolateAttributes = data.chocolateAttributes;
  if (data.hamperAttributes !== undefined) cleanData.hamperAttributes = data.hamperAttributes;
  if (data.comboAttributes !== undefined) cleanData.comboAttributes = data.comboAttributes;

  // Dynamic Date-wise
  if (data.dateWiseStock !== undefined) cleanData.dateWiseStock = data.dateWiseStock;
  if (data.dateWisePricing !== undefined) cleanData.dateWisePricing = data.dateWisePricing;
  if (data.dateWiseOffers !== undefined) cleanData.dateWiseOffers = data.dateWiseOffers;
  if (data.dateWiseDeliveryCharges !== undefined) cleanData.dateWiseDeliveryCharges = data.dateWiseDeliveryCharges;

  // Display, SEO & Metadata
  if (data.displayOrders !== undefined) cleanData.displayOrders = data.displayOrders;
  if (data.seoSettings !== undefined) cleanData.seoSettings = data.seoSettings;
  if (data.relatedProducts !== undefined) cleanData.relatedProducts = data.relatedProducts;
  if (data.crossSellProducts !== undefined) cleanData.crossSellProducts = data.crossSellProducts;
  if (data.upsellProducts !== undefined) cleanData.upsellProducts = data.upsellProducts;
  if (data.videos !== undefined) cleanData.videos = data.videos;
  if (data.collections !== undefined) cleanData.collections = data.collections;
  if (data.versionHistory !== undefined) cleanData.versionHistory = data.versionHistory;
  if (data.careInstructions !== undefined) {
    if (Array.isArray(data.careInstructions)) {
      cleanData.careInstructions = data.careInstructions.filter(Boolean).join('\n') || null;
    } else if (typeof data.careInstructions === 'object' && data.careInstructions !== null) {
      cleanData.careInstructions = JSON.stringify(data.careInstructions);
    } else {
      cleanData.careInstructions = data.careInstructions ? String(data.careInstructions) : null;
    }
  }
  if (data.approvalStatus !== undefined) cleanData.approvalStatus = data.approvalStatus;
  if (data.rejectionReason !== undefined) cleanData.rejectionReason = data.rejectionReason;

  // Valentine Attributes
  if (data.isValentineProduct !== undefined) cleanData.isValentineProduct = Boolean(data.isValentineProduct);
  if (data.showInValentineShop !== undefined) cleanData.showInValentineShop = Boolean(data.showInValentineShop);
  if (data.valentineCategories !== undefined) cleanData.valentineCategories = data.valentineCategories;
  if (data.valentineSections !== undefined) cleanData.valentineSections = data.valentineSections;
  if (data.valentineBadge !== undefined) cleanData.valentineBadge = data.valentineBadge;
  if (data.enableValentinePricing !== undefined) cleanData.enableValentinePricing = Boolean(data.enableValentinePricing);

  let detailsObj = {};
  if (data.details && typeof data.details === 'object') {
    detailsObj = Array.isArray(data.details) ? { items: data.details } : { ...data.details };
  }
  if (data.sameDay !== undefined) detailsObj.sameDay = Boolean(data.sameDay);
  if (data.categories !== undefined) detailsObj.categories = data.categories;
  if (data.careInstructions !== undefined) detailsObj.careInstructions = data.careInstructions;
  if (data.displayOrders !== undefined) detailsObj.displayOrders = data.displayOrders;
  if (data.seasonalCampaigns !== undefined) detailsObj.seasonalCampaigns = data.seasonalCampaigns;
  if (data.campaignSettings !== undefined) detailsObj.campaignSettings = data.campaignSettings;
  if (Object.keys(detailsObj).length > 0) {
    cleanData.details = detailsObj;
  }

  return cleanData;
}

class ProductDocument {
  constructor(data) {
    Object.assign(this, data);
    const prodId = String(data.id || data._id || '');
    this._id = prodId;
    this.id = prodId;
    this.title = data.title || data.name || 'Flower Product';
    this.name = data.name || data.title || 'Flower Product';
    this.countInStock = data.stock !== undefined ? parseInt(data.stock) : (data.countInStock || 10);
    this.stock = this.countInStock;

    if (data.hidden !== undefined) {
      this.isVisible = !Boolean(data.hidden);
      this.hidden = Boolean(data.hidden);
    } else {
      this.isVisible = data.isVisible !== false;
      this.hidden = !this.isVisible;
    }

    if (data.isNew !== undefined) {
      this.isNewArrival = Boolean(data.isNew);
      this.isNew = Boolean(data.isNew);
    } else {
      this.isNewArrival = Boolean(data.isNewArrival);
      this.isNew = this.isNewArrival;
    }

    const detailsObj = (data.details && typeof data.details === 'object') ? data.details : {};
    this.sameDay = detailsObj.sameDay !== false;
    this.isSameDay = this.sameDay;
    this.displayOrders = data.displayOrders || detailsObj.displayOrders || {};
    this.seasonalCampaigns = data.seasonalCampaigns || detailsObj.seasonalCampaigns || [];
    this.campaignSettings = data.campaignSettings || detailsObj.campaignSettings || {};

    if (Array.isArray(data.categories)) {
      this.categories = data.categories.map(c => {
        if (typeof c === 'string') return c;
        if (c.category && typeof c.category === 'object') return c.category.name || c.category.slug || '';
        if (c.name) return c.name;
        if (c.slug) return c.slug;
        return c.categoryId || '';
      }).filter(Boolean);
      this.category = this.categories[0] || 'flowers';
    } else if (typeof data.category === 'string') {
      this.category = data.category;
      this.categories = [data.category];
    } else {
      this.category = 'flowers';
      this.categories = ['flowers'];
    }

    this.subcategory = data.subcategory || detailsObj.subcategory || '';
    this.tags = data.tags || detailsObj.tags || [];

    if (Array.isArray(data.occasions)) {
      this.occasions = data.occasions.map(o => {
        if (typeof o === 'string') return o;
        if (o.occasion && typeof o.occasion === 'object') return o.occasion.name || o.occasion.slug || '';
        if (o.name) return o.name;
        if (o.slug) return o.slug;
        return o.occasionId || '';
      }).filter(Boolean);
    } else {
      this.occasions = [];
    }

    if (data.images) {
      this.images = data.images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else {
      this.images = [];
    }

    if (data.priceVariants) {
      this.priceVariants = data.priceVariants.map(v => ({
        _id: String(v.id || v._id || ''),
        id: String(v.id || v._id || ''),
        label: v.name || v.size,
        price: parseFloat(v.price),
        stock: v.stock || 0
      }));
    }
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id,
      name: this.name,
      title: this.title,
      slug: this.slug,
      description: this.description,
      price: parseFloat(this.price || 0),
      countInStock: this.countInStock,
      stock: this.stock,
      category: this.category,
      subcategory: this.subcategory,
      categories: this.categories,
      occasions: this.occasions,
      tags: this.tags,
      images: this.images,
      priceVariants: this.priceVariants,
      rating: parseFloat(this.rating || 0),
      reviewCount: parseInt(this.reviewCount || 0),
      isAvailable: this.isAvailable !== false,
      isVisible: this.isVisible,
      hidden: this.hidden,
      isFeatured: !!this.isFeatured,
      isBestseller: !!this.isBestseller,
      isNewArrival: !!this.isNewArrival,
      isNew: !!this.isNewArrival,
      sameDay: this.sameDay,
      isSameDay: this.sameDay,
      personalizationEnabled: !!this.personalizationEnabled,
      personalizationType: this.personalizationType,
      fieldLabel: this.fieldLabel,
      placeholder: this.placeholder,
      minCharacters: this.minCharacters,
      maxCharacters: this.maxCharacters,
      allowedCharacters: this.allowedCharacters,
      personalizationRequired: !!this.personalizationRequired,
      textTransform: this.textTransform,
      helperText: this.helperText,
      pricePerCharacter: this.pricePerCharacter ? parseFloat(this.pricePerCharacter) : undefined,
      baseIncludedCharacters: this.baseIncludedCharacters,
      maxExtraPrice: this.maxExtraPrice ? parseFloat(this.maxExtraPrice) : undefined,
      customizationOptions: this.customizationOptions,
      cakeAttributes: this.cakeAttributes,
      plantAttributes: this.plantAttributes,
      chocolateAttributes: this.chocolateAttributes,
      hamperAttributes: this.hamperAttributes,
      comboAttributes: this.comboAttributes,
      dateWiseStock: this.dateWiseStock,
      dateWisePricing: this.dateWisePricing,
      dateWiseOffers: this.dateWiseOffers,
      dateWiseDeliveryCharges: this.dateWiseDeliveryCharges,
      displayOrders: this.displayOrders,
      seoSettings: this.seoSettings,
      relatedProducts: this.relatedProducts,
      crossSellProducts: this.crossSellProducts,
      upsellProducts: this.upsellProducts,
      videos: this.videos,
      collections: this.collections,
      versionHistory: this.versionHistory,
      careInstructions: this.careInstructions,
      approvalStatus: this.approvalStatus,
      rejectionReason: this.rejectionReason,
      isValentineProduct: !!this.isValentineProduct,
      showInValentineShop: !!this.showInValentineShop,
      valentineCategories: this.valentineCategories,
      valentineSections: this.valentineSections,
      valentineBadge: this.valentineBadge,
      enableValentinePricing: !!this.enableValentinePricing,
      seasonalCampaigns: this.seasonalCampaigns,
      campaignSettings: this.campaignSettings,
      details: this.details,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    const productId = (this.id && String(this.id).trim().length > 0)
      ? String(this.id)
      : ((this._id && String(this._id).trim().length > 0)
        ? String(this._id)
        : `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);

    this.id = productId;
    this._id = productId;

    if (!this.slug) {
      const baseSlug = (this.name || this.title || 'product')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      this.slug = `${baseSlug || 'product'}-${Date.now()}`;
    }

    const cleanData = sanitizeProductDataForPrisma(this);

    const updated = await prisma.product.upsert({
      where: { id: productId },
      update: cleanData,
      create: {
        id: productId,
        slug: this.slug,
        name: this.name || this.title || 'Product',
        ...cleanData
      }
    });

    Object.assign(this, updated);
    this._id = updated.id;
    this.id = updated.id;
    this.hidden = !updated.isVisible;
    this.isNew = updated.isNewArrival;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery, filterOptions = null) {
    this.prismaQuery = prismaQuery;
    this.filterOptions = filterOptions;
  }

  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  lean() { return this; }
  distinct() { return this; }
  exec() { return this.then(res => res); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) {
        let docs = res.map(p => new ProductDocument(p));

        if (this.filterOptions && this.filterOptions.seasonalCampaigns) {
          const targetCampaign = String(this.filterOptions.seasonalCampaigns).toLowerCase().trim();
          docs = docs.filter(doc => {
            const details = doc.details || {};
            const campList = Array.isArray(doc.seasonalCampaigns)
              ? doc.seasonalCampaigns
              : (Array.isArray(details.seasonalCampaigns) ? details.seasonalCampaigns : []);
            
            const campSettings = doc.campaignSettings || details.campaignSettings || {};

            const inArray = campList.some(c => String(c).toLowerCase().trim() === targetCampaign);
            const inSettings = Boolean(campSettings[targetCampaign] || campSettings[this.filterOptions.seasonalCampaigns]);

            return inArray || inSettings;
          });
        }

        resolve(docs);
      } else if (res) {
        resolve(new ProductDocument(res));
      } else {
        resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  }
}

class ProductModel extends ProductDocument {
  constructor(data) {
    super(data);
  }
  static findOne(where = {}) {
    const prismaWhere = cleanProductWhere(where);
    const promise = prisma.product.findFirst({
      where: prismaWhere,
      include: {
        images: true,
        priceVariants: true,
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } }
      }
    });
    return new QueryChain(promise);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const promise = prisma.product.findUnique({
      where: { id: String(id) },
      include: {
        images: true,
        priceVariants: true,
        categories: { include: { category: true } }
      }
    });
    return new QueryChain(promise);
  }

  static find(where = {}) {
    const prismaWhere = cleanProductWhere(where);
    const promise = prisma.product.findMany({
      where: prismaWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
        priceVariants: true,
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } }
      }
    });
    return new QueryChain(promise, where);
  }

  static async aggregate(pipeline) {
    const products = await prisma.product.findMany({
      include: { categories: { include: { category: true } } }
    });
    return products.map(p => ({
      _id: p.name,
      name: p.name,
      categories: p.categories.map(c => c.category?.name).filter(Boolean)
    }));
  }

  static async create(data) {
    const productId = data.id || data._id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const cleanData = sanitizeProductDataForPrisma(data);

    const created = await prisma.product.create({
      data: {
        id: productId,
        slug: data.slug || `prod-${Date.now()}`,
        name: data.name || data.title || 'Product',
        ...cleanData
      }
    });
    return new ProductDocument(created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    const cleanData = sanitizeProductDataForPrisma(dataToUpdate);
    try {
      const updated = await prisma.product.update({
        where: { id: String(id) },
        data: cleanData
      });
      return new ProductDocument(updated);
    } catch (e) {
      console.error('Product findByIdAndUpdate error:', e);
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    try {
      const deleted = await prisma.product.delete({
        where: { id: String(id) }
      });
      return new ProductDocument(deleted);
    } catch (e) {
      console.error('Product findByIdAndDelete error:', e);
      return null;
    }
  }

  static async countDocuments(where = {}) {
    if (where && where.seasonalCampaigns) {
      const prods = await this.find(where);
      return prods.length;
    }
    const prismaWhere = cleanProductWhere(where);
    return await prisma.product.count({ where: prismaWhere });
  }

  static async distinct(field, where = {}) {
    const prismaWhere = cleanProductWhere(where);
    const products = await prisma.product.findMany({ where: prismaWhere });
    const set = new Set();
    products.forEach(p => {
      if (p[field]) set.add(p[field]);
    });
    return Array.from(set);
  }

  static async deleteMany(where = {}) {
    let ids = [];
    if (where._id && where._id.$in) ids = where._id.$in.map(String);
    else if (where.id && where.id.$in) ids = where.id.$in.map(String);

    if (ids.length > 0) {
      const deleted = await prisma.product.deleteMany({
        where: { id: { in: ids } }
      });
      return { deletedCount: deleted.count };
    } else {
      const deleted = await prisma.product.deleteMany({});
      return { deletedCount: deleted.count };
    }
  }

  static async updateMany(where = {}, update = {}) {
    let ids = [];
    if (where._id && where._id.$in) ids = where._id.$in.map(String);
    else if (where.id && where.id.$in) ids = where.id.$in.map(String);

    const cleanData = sanitizeProductDataForPrisma(update);

    if (ids.length > 0) {
      const updated = await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: cleanData
      });
      return { modifiedCount: updated.count };
    } else {
      const updated = await prisma.product.updateMany({
        data: cleanData
      });
      return { modifiedCount: updated.count };
    }
  }

  static populate() {
    return this;
  }
}

module.exports = ProductModel;
