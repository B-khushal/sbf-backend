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
  if (data.category !== undefined) detailsObj.category = String(data.category);
  if (data.categories !== undefined) detailsObj.categories = Array.isArray(data.categories) ? data.categories : [data.categories];
  if (data.subcategory !== undefined) detailsObj.subcategory = String(data.subcategory);
  if (data.images !== undefined && Array.isArray(data.images)) {
    detailsObj.images = data.images.map(img => typeof img === 'string' ? img : (img?.url || img));
  }
  if (data.originalImages !== undefined) detailsObj.originalImages = data.originalImages;
  if (data.details && data.details.originalImages !== undefined) detailsObj.originalImages = data.details.originalImages;
  if (data.careInstructions !== undefined) detailsObj.careInstructions = data.careInstructions;
  if (data.displayOrders !== undefined) detailsObj.displayOrders = data.displayOrders;
  if (data.seasonalCampaigns !== undefined) detailsObj.seasonalCampaigns = data.seasonalCampaigns;
  if (data.campaignSettings !== undefined) detailsObj.campaignSettings = data.campaignSettings;
  if (Object.keys(detailsObj).length > 0) {
    cleanData.details = detailsObj;
  }

  return cleanData;
}

async function syncProductRelations(productId, productData) {
  if (!productId) return;

  // 1. Sync Images
  const rawImages = productData.images !== undefined
    ? productData.images
    : (productData.details && productData.details.images ? productData.details.images : null);

  if (Array.isArray(rawImages)) {
    try {
      await prisma.productImage.deleteMany({ where: { productId } });
      const validImages = rawImages
        .map((img, i) => {
          const url = typeof img === 'string' ? img : (img && img.url ? img.url : '');
          if (!url || typeof url !== 'string' || !url.trim()) return null;
          return {
            id: `img_${productId}_${i}_${Date.now()}`,
            productId,
            url: url.trim(),
            displayOrder: i,
            isPrimary: i === 0,
            alt: typeof img === 'object' && img.alt ? img.alt : null,
            publicId: typeof img === 'object' && img.publicId ? img.publicId : null,
          };
        })
        .filter(Boolean);

      if (validImages.length > 0) {
        await prisma.productImage.createMany({
          data: validImages
        });
      }
    } catch (imgErr) {
      console.error('Error syncing productImage relations for product', productId, imgErr);
    }
  }

  // 2. Sync Categories
  const categoryTokens = new Set();
  if (productData.category && typeof productData.category === 'string') {
    categoryTokens.add(productData.category.trim());
  }
  if (productData.subcategory && typeof productData.subcategory === 'string') {
    categoryTokens.add(productData.subcategory.trim());
  }
  if (Array.isArray(productData.categories)) {
    productData.categories.forEach(c => {
      const val = typeof c === 'string' ? c : (c?.slug || c?.name || c?.categoryId || '');
      if (val) categoryTokens.add(String(val).trim());
    });
  }
  if (productData.details && Array.isArray(productData.details.categories)) {
    productData.details.categories.forEach(c => {
      if (c && typeof c === 'string') categoryTokens.add(c.trim());
    });
  }
  if (productData.details && productData.details.subcategory && typeof productData.details.subcategory === 'string') {
    categoryTokens.add(productData.details.subcategory.trim());
  }
  if (productData.details && productData.details.category && typeof productData.details.category === 'string') {
    categoryTokens.add(productData.details.category.trim());
  }

  if (categoryTokens.size > 0) {
    try {
      const allCategories = await prisma.category.findMany();
      const catMap = new Map();
      allCategories.forEach(cat => {
        catMap.set(cat.id.toLowerCase(), cat.id);
        catMap.set(cat.slug.toLowerCase(), cat.id);
        catMap.set(cat.name.toLowerCase(), cat.id);
      });

      const matchedCatIds = new Set();
      for (const token of categoryTokens) {
        const lower = token.toLowerCase();
        let catId = catMap.get(lower);
        if (!catId) {
          const normalized = lower.replace(/\s+/g, '-');
          catId = catMap.get(normalized);
        }
        if (catId) {
          matchedCatIds.add(catId);
        }
      }

      if (matchedCatIds.size > 0) {
        await prisma.productCategory.deleteMany({ where: { productId } });
        const catData = Array.from(matchedCatIds).map(categoryId => ({
          productId,
          categoryId
        }));
        await prisma.productCategory.createMany({
          data: catData,
          skipDuplicates: true
        });
      }
    } catch (catErr) {
      console.error('Error syncing productCategory relations for product', productId, catErr);
    }
  }

  // 3. Sync Price Variants
  const rawVariants = Array.isArray(productData.priceVariants) ? productData.priceVariants : null;
  if (rawVariants !== null) {
    try {
      await prisma.productVariant.deleteMany({ where: { productId } });
      if (rawVariants.length > 0) {
        const variantData = rawVariants.map((v, i) => ({
          id: (v.id && String(v.id).trim().length > 0) ? String(v.id) : `var_${productId}_${i}_${Date.now()}`,
          productId,
          name: String(v.label || v.name || v.size || 'Standard'),
          size: String(v.size || v.label || v.name || 'Standard'),
          price: parseFloat(v.price || 0),
          stock: parseInt(v.stock || 0),
          isDefault: i === 0
        }));
        await prisma.productVariant.createMany({
          data: variantData
        });
      }
    } catch (varErr) {
      console.error('Error syncing productVariant relations for product', productId, varErr);
    }
  }

  // 4. Sync Occasions
  const rawOccasions = Array.isArray(productData.occasionIds)
    ? productData.occasionIds
    : (Array.isArray(productData.occasions) ? productData.occasions : null);
  if (rawOccasions !== null) {
    try {
      await prisma.productOccasion.deleteMany({ where: { productId } });
      if (rawOccasions.length > 0) {
        const allOccasions = await prisma.occasion.findMany();
        const occMap = new Map();
        allOccasions.forEach(occ => {
          occMap.set(occ.id.toLowerCase(), occ.id);
          occMap.set(occ.slug.toLowerCase(), occ.id);
          occMap.set(occ.name.toLowerCase(), occ.id);
        });

        const matchedOccIds = new Set();
        for (const rawOcc of rawOccasions) {
          const token = typeof rawOcc === 'string' ? rawOcc : (rawOcc?.id || rawOcc?._id || rawOcc?.slug || rawOcc?.name || '');
          if (!token) continue;
          const occId = occMap.get(String(token).toLowerCase());
          if (occId) matchedOccIds.add(occId);
        }

        if (matchedOccIds.size > 0) {
          await prisma.productOccasion.createMany({
            data: Array.from(matchedOccIds).map(occasionId => ({
              productId,
              occasionId
            })),
            skipDuplicates: true
          });
        }
      }
    } catch (occErr) {
      console.error('Error syncing productOccasion relations for product', productId, occErr);
    }
  }
}

class ProductDocument {
  constructor(data) {
    Object.assign(this, data);
    const prodId = String(data.id || data._id || '');
    this._id = prodId;
    this.id = prodId;
    this.title = data.title || data.name || 'Flower Product';
    this.name = data.name || data.title || 'Flower Product';
    this.countInStock = (data.stock !== undefined && data.stock !== null)
      ? parseInt(data.stock)
      : (data.countInStock !== undefined && data.countInStock !== null ? parseInt(data.countInStock) : 10);
    this.stock = this.countInStock;
    this.isAvailable = data.isAvailable !== false;
    this.isOutOfStock = !this.isAvailable || this.stock <= 0;

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
    this.discount = data.discount !== undefined ? parseFloat(data.discount) : (detailsObj.discount !== undefined ? parseFloat(detailsObj.discount) : 0);
    this.comparePrice = data.comparePrice !== undefined ? data.comparePrice : (detailsObj.comparePrice !== undefined ? detailsObj.comparePrice : null);
    this.sameDay = detailsObj.sameDay !== false;
    this.isSameDay = this.sameDay;
    this.displayOrders = data.displayOrders || detailsObj.displayOrders || {};
    this.seasonalCampaigns = data.seasonalCampaigns || detailsObj.seasonalCampaigns || [];
    this.campaignSettings = data.campaignSettings || detailsObj.campaignSettings || {};

    // CATEGORIES
    let parsedCategories = [];
    if (Array.isArray(data.categories) && data.categories.length > 0) {
      parsedCategories = data.categories.map(c => {
        if (typeof c === 'string') return c;
        if (c.category && typeof c.category === 'object') return c.category.slug || c.category.name || '';
        if (c.slug) return c.slug;
        if (c.name) return c.name;
        return c.categoryId || '';
      }).filter(Boolean);
    } else if (Array.isArray(detailsObj.categories) && detailsObj.categories.length > 0) {
      parsedCategories = detailsObj.categories.map(c => {
        if (typeof c === 'string') return c;
        return c?.slug || c?.name || '';
      }).filter(Boolean);
    } else if (typeof data.category === 'string' && data.category.trim()) {
      parsedCategories = [data.category.trim()];
    } else if (typeof detailsObj.category === 'string' && detailsObj.category.trim()) {
      parsedCategories = [detailsObj.category.trim()];
    }

    this.categories = parsedCategories;

    // Primary category: preserve explicit data.category, else detailsObj.category, else first category, else 'flowers'
    this.category = data.category || detailsObj.category || (this.categories.length > 0 ? this.categories[0] : 'flowers');
    this.subcategory = data.subcategory || detailsObj.subcategory || '';
    this.tags = data.tags || detailsObj.tags || [];

    // OCCASIONS
    if (Array.isArray(data.occasions) && data.occasions.length > 0) {
      this.occasions = data.occasions.map(o => {
        if (typeof o === 'string') return o;
        if (o.occasion && typeof o.occasion === 'object') return o.occasion.slug || o.occasion.name || '';
        if (o.slug) return o.slug;
        if (o.name) return o.name;
        return o.occasionId || '';
      }).filter(Boolean);
    } else if (Array.isArray(detailsObj.occasions) && detailsObj.occasions.length > 0) {
      this.occasions = detailsObj.occasions;
    } else {
      this.occasions = [];
    }

    // IMAGES
    if (Array.isArray(data.images) && data.images.length > 0) {
      this.images = data.images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else if (Array.isArray(detailsObj.images) && detailsObj.images.length > 0) {
      this.images = detailsObj.images.map(img => typeof img === 'string' ? img : (img.url || img));
    } else if (typeof data.image === 'string' && data.image.trim()) {
      this.images = [data.image.trim()];
    } else {
      this.images = [];
    }

    if (data.priceVariants && Array.isArray(data.priceVariants) && data.priceVariants.length > 0) {
      this.priceVariants = data.priceVariants.map(v => ({
        _id: String(v.id || v._id || ''),
        id: String(v.id || v._id || ''),
        label: v.name || v.size || v.label,
        price: parseFloat(v.price || 0),
        stock: v.stock || 0
      }));
    } else {
      this.priceVariants = [];
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
      discount: parseFloat(this.discount || 0),
      comparePrice: this.comparePrice ? parseFloat(this.comparePrice) : null,
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
      isOutOfStock: this.isOutOfStock,
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

    await syncProductRelations(productId, this);

    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } }
      }
    });

    const doc = new ProductDocument(fullProduct || updated);
    Object.assign(this, doc);
    this._id = doc.id;
    this.id = doc.id;
    this.hidden = !doc.isVisible;
    this.isNew = doc.isNewArrival;
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
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } }
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
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
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
      categories: p.categories.map(c => c.category?.slug || c.category?.name).filter(Boolean)
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

    await syncProductRelations(productId, data);

    const fullProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } }
      }
    });

    return new ProductDocument(fullProduct || created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    const cleanData = sanitizeProductDataForPrisma(dataToUpdate);
    try {
      await prisma.product.update({
        where: { id: String(id) },
        data: cleanData
      });

      await syncProductRelations(String(id), dataToUpdate);

      const fullProduct = await prisma.product.findUnique({
        where: { id: String(id) },
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          priceVariants: { orderBy: { price: 'asc' } },
          categories: { include: { category: true } },
          occasions: { include: { occasion: true } }
        }
      });

      return new ProductDocument(fullProduct);
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
