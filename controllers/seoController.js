// SBF Florist - SEO Controller
// Handles Admin SEO Dashboard APIs, Product SEO Metadata CRUD, Bulk Generation, CSV Import/Export,
// Category SEO management, and Valentine's Day Seasonal Preservation.

const prisma = require('../config/prisma');
const Product = require('../models/Product');
const Category = require('../models/Category');
const {
  generateProductSeo,
  evaluateSeoScore,
  getValentineWeekCalendar,
  slugify,
  cleanText
} = require('../services/productSeoGenerator');
const { invalidateSitemapCache } = require('../services/seoService');
const {
  getGlobalSeoSettings,
  updateGlobalSeoSettings,
  getAllBlogPosts,
  getBlogPostBySlug,
  createOrUpdateBlogPost,
  deleteBlogPost,
  getCategorySeoExtensions,
  saveCategorySeoExtension,
  runComprehensiveSeoAudit,
  getKeywordMappings,
  upsertKeywordMapping,
  deleteKeywordMapping,
  exportKeywordMappingsCsv,
  importKeywordMappingsCsv,
  getBacklinksData,
  upsertBacklinkRecord,
  deleteBacklinkRecord,
  getSeoPerformanceDashboardData
} = require('../services/seoBlogAndSettingsService');

// @desc    Get SEO Overview Statistics for Admin Dashboard
// @route   GET /api/seo/admin/stats
// @access  Private/Admin
const getSeoOverviewStats = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { approvalStatus: 'approved' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        seoSettings: true,
        images: {
          select: { alt: true },
          take: 1
        }
      }
    });

    const totalProducts = products.length;
    let optimizedCount = 0;
    let manualCount = 0;
    let totalScore = 0;
    let missingTitleCount = 0;
    let missingDescCount = 0;
    let missingAltCount = 0;

    for (const p of products) {
      const seo = p.seoSettings || {};
      const hasTitle = Boolean(seo.seoTitle || seo.metaTitle);
      const hasDesc = Boolean(seo.metaDescription || seo.seoDescription);
      const hasAlt = Boolean(p.images?.[0]?.alt);

      if (!hasTitle) missingTitleCount++;
      if (!hasDesc) missingDescCount++;
      if (!hasAlt) missingAltCount++;

      if (seo.isManual) manualCount++;

      // If SEO exists, compute or read score
      if (hasTitle && hasDesc) {
        optimizedCount++;
        const score = typeof seo.score === 'number' ? seo.score : 80;
        totalScore += score;
      } else {
        // Fallback score calculation
        const preview = generateProductSeo({
          ...p,
          title: p.name,
          images: p.images
        }, seo);
        totalScore += preview.score;
      }
    }

    const averageScore = totalProducts > 0 ? Math.round(totalScore / totalProducts) : 0;
    const optimizationRate = totalProducts > 0 ? Math.round((optimizedCount / totalProducts) * 100) : 0;

    const categoriesCount = await prisma.category.count({ where: { isActive: true } });

    res.json({
      success: true,
      stats: {
        totalProducts,
        optimizedCount,
        unoptimizedCount: totalProducts - optimizedCount,
        manualCount,
        optimizationRate,
        averageScore,
        missingTitleCount,
        missingDescCount,
        missingAltCount,
        categoriesCount
      }
    });
  } catch (error) {
    console.error('Error fetching SEO stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch SEO stats', error: error.message });
  }
};

// @desc    Get Paginated & Filterable Product SEO List
// @route   GET /api/seo/admin/products
// @access  Private/Admin
const getProductsSeoList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const scoreFilter = (req.query.scoreFilter || 'all').toLowerCase(); // all, good, fair, poor, missing
    const missingFilter = (req.query.missing || 'all').toLowerCase(); // title, desc, alt, all

    const where = { approvalStatus: 'approved' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category && category !== 'all') {
      where.categories = {
        some: {
          category: {
            slug: category
          }
        }
      };
    }

    const [totalProducts, rawProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          description: true,
          shortDescription: true,
          seoSettings: true,
          isVisible: true,
          updatedAt: true,
          images: {
            select: { url: true, alt: true, isPrimary: true },
            orderBy: { isPrimary: 'desc' },
            take: 2
          },
          categories: {
            select: { category: { select: { id: true, name: true, slug: true } } },
            take: 1
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const items = rawProducts.map(p => {
      const existingSeo = p.seoSettings || {};
      const catName = p.categories?.[0]?.category?.name || 'Flowers';

      // Evaluate SEO completeness & generate preview if missing
      const preview = generateProductSeo({
        ...p,
        title: p.name,
        category: catName
      }, existingSeo);

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: catName,
        price: Number(p.price),
        image: p.images?.[0]?.url || '',
        imageAlt: p.images?.[0]?.alt || '',
        isVisible: p.isVisible,
        seoSettings: {
          focusKeyword: existingSeo.focusKeyword || preview.focusKeyword,
          secondaryKeywords: existingSeo.secondaryKeywords || preview.secondaryKeywords,
          seoTitle: existingSeo.seoTitle || existingSeo.metaTitle || preview.seoTitle,
          metaDescription: existingSeo.metaDescription || existingSeo.seoDescription || preview.metaDescription,
          slug: existingSeo.slug || p.slug || preview.slug,
          h1: existingSeo.h1 || preview.h1,
          imageAlt: existingSeo.imageAlt || p.images?.[0]?.alt || preview.imageAlt,
          canonicalUrl: existingSeo.canonicalUrl || preview.canonicalUrl,
          noindex: Boolean(existingSeo.noindex),
          isManual: Boolean(existingSeo.isManual),
          score: typeof existingSeo.score === 'number' ? existingSeo.score : preview.score,
          warnings: existingSeo.warnings || preview.warnings,
          passed: existingSeo.passed || preview.passed
        },
        updatedAt: p.updatedAt
      };
    });

    // Client/query post-filter for score ranges if requested
    let filteredItems = items;
    if (scoreFilter === 'good') {
      filteredItems = items.filter(i => i.seoSettings.score >= 75);
    } else if (scoreFilter === 'fair') {
      filteredItems = items.filter(i => i.seoSettings.score >= 50 && i.seoSettings.score < 75);
    } else if (scoreFilter === 'poor') {
      filteredItems = items.filter(i => i.seoSettings.score < 50);
    } else if (scoreFilter === 'missing') {
      filteredItems = items.filter(i => !i.seoSettings.isManual);
    }

    if (missingFilter === 'title') {
      filteredItems = filteredItems.filter(i => !i.seoSettings.seoTitle);
    } else if (missingFilter === 'desc') {
      filteredItems = filteredItems.filter(i => !i.seoSettings.metaDescription);
    } else if (missingFilter === 'alt') {
      filteredItems = filteredItems.filter(i => !i.imageAlt);
    }

    res.json({
      success: true,
      data: filteredItems,
      pagination: {
        page,
        limit,
        total: totalProducts,
        pages: Math.ceil(totalProducts / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching product SEO list:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product SEO list', error: error.message });
  }
};

// @desc    Update Single Product SEO Metadata
// @route   PUT /api/seo/admin/products/:id
// @access  Private/Admin
const updateProductSeo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      focusKeyword,
      secondaryKeywords,
      seoTitle,
      metaDescription,
      slug,
      h1,
      imageAlt,
      canonicalUrl,
      noindex,
      ogImage
    } = req.body;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 1 }
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Evaluate score for new metadata
    const analysis = evaluateSeoScore({
      focusKeyword,
      seoTitle,
      metaDescription,
      h1: h1 || product.name,
      imageAlt: imageAlt || product.images?.[0]?.alt,
      productName: product.name,
      description: product.description || product.shortDescription
    });

    const newSeoSettings = {
      focusKeyword: cleanText(focusKeyword),
      secondaryKeywords: Array.isArray(secondaryKeywords)
        ? secondaryKeywords.map(k => cleanText(k)).filter(Boolean)
        : String(secondaryKeywords || '').split(',').map(k => cleanText(k)).filter(Boolean),
      seoTitle: cleanText(seoTitle),
      metaTitle: cleanText(seoTitle),
      metaDescription: cleanText(metaDescription),
      seoDescription: cleanText(metaDescription),
      slug: slugify(slug || product.slug),
      h1: cleanText(h1 || product.name),
      imageAlt: cleanText(imageAlt),
      canonicalUrl: canonicalUrl ? String(canonicalUrl).trim() : `https://sbflorist.in/product/${slugify(slug || product.slug || id)}`,
      noindex: Boolean(noindex),
      ogImage: ogImage ? String(ogImage).trim() : (product.images?.[0]?.url || ''),
      isManual: true, // Tag as manual so bulk operations never overwrite it!
      score: analysis.score,
      warnings: analysis.warnings,
      passed: analysis.passed,
      updatedAt: new Date().toISOString()
    };

    const updatePayload = {
      seoSettings: newSeoSettings
    };

    if (slug && slugify(slug) !== product.slug) {
      // Ensure slug uniqueness
      const existingSlug = await prisma.product.findFirst({
        where: { slug: slugify(slug), id: { not: id } }
      });
      if (!existingSlug) {
        updatePayload.slug = slugify(slug);
      }
    }

    await prisma.product.update({
      where: { id },
      data: updatePayload
    });

    // Update primary image alt text if provided
    if (imageAlt && product.images && product.images.length > 0) {
      await prisma.productImage.update({
        where: { id: product.images[0].id },
        data: { alt: cleanText(imageAlt) }
      });
    }

    invalidateSitemapCache();

    res.json({
      success: true,
      message: 'Product SEO updated successfully',
      seoSettings: newSeoSettings
    });
  } catch (error) {
    console.error('Error updating product SEO:', error);
    res.status(500).json({ success: false, message: 'Failed to update product SEO', error: error.message });
  }
};

// @desc    Generate Product SEO on the Fly (for Preview or Save)
// @route   POST /api/seo/admin/products/generate/:id
// @access  Private/Admin
const generateProductSeoSingle = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 2 },
        categories: { include: { category: true }, take: 1 }
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const catName = product.categories?.[0]?.category?.name || 'Flowers';
    const generated = generateProductSeo({
      ...product,
      title: product.name,
      category: catName
    });

    res.json({
      success: true,
      generated
    });
  } catch (error) {
    console.error('Error generating product SEO:', error);
    res.status(500).json({ success: false, message: 'Failed to generate product SEO', error: error.message });
  }
};

// @desc    Bulk Generate Missing SEO for Catalog Products
// @route   POST /api/seo/admin/products/bulk-generate
// @access  Private/Admin
const bulkGenerateSeo = async (req, res) => {
  try {
    const { overwriteNonManual = false } = req.body;

    const products = await prisma.product.findMany({
      where: { approvalStatus: 'approved' },
      include: {
        images: { orderBy: { isPrimary: 'desc' }, take: 1 },
        categories: { include: { category: true }, take: 1 }
      }
    });

    let generatedCount = 0;
    let skippedCount = 0;

    for (const p of products) {
      const existingSeo = p.seoSettings || {};

      // Rule: Never overwrite manually edited metadata!
      if (existingSeo.isManual) {
        skippedCount++;
        continue;
      }

      // Check if already has SEO and overwrite is false
      if (existingSeo.seoTitle && existingSeo.metaDescription && !overwriteNonManual) {
        skippedCount++;
        continue;
      }

      const catName = p.categories?.[0]?.category?.name || 'Flowers';
      const newSeo = generateProductSeo({
        ...p,
        title: p.name,
        category: catName
      });

      await prisma.product.update({
        where: { id: p.id },
        data: {
          seoSettings: newSeo
        }
      });

      // Update image alt if missing
      if (p.images?.[0] && !p.images[0].alt) {
        await prisma.productImage.update({
          where: { id: p.images[0].id },
          data: { alt: newSeo.imageAlt }
        });
      }

      generatedCount++;
    }

    invalidateSitemapCache();

    res.json({
      success: true,
      message: `Bulk SEO generation complete. Generated: ${generatedCount}, Preserved manual: ${skippedCount}.`,
      generatedCount,
      skippedCount
    });
  } catch (error) {
    console.error('Error in bulk SEO generation:', error);
    res.status(500).json({ success: false, message: 'Bulk SEO generation failed', error: error.message });
  }
};

// @desc    Get Categories SEO List
// @route   GET /api/seo/admin/categories
// @access  Private/Admin
const getCategoriesSeoList = async (req, res) => {
  try {
    const [categories, extensions] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          categoryUrl: true,
          description: true,
          metaTitle: true,
          metaDescription: true,
          updatedAt: true,
          _count: {
            select: { products: true }
          }
        },
        orderBy: { displayOrder: 'asc' }
      }),
      getCategorySeoExtensions()
    ]);

    const categoryH1Map = {
      'bouquets': 'Flower Bouquets in Hyderabad',
      'roses': 'Rose Bouquets in Hyderabad',
      'premium-roses': 'Premium Long-Stem Rose Bouquets',
      'cakes': 'Cakes in Hyderabad for Every Celebration',
      'combos': 'Flower and Cake Combos in Hyderabad',
      'sunflowers': 'Sunflower Bouquets in Hyderabad',
      'lilies': 'Lily Flowers and Bouquets in Hyderabad',
      'tulips': 'Fresh Tulip Bouquets Online in Hyderabad',
      'orchids': 'Exotic Orchid Bouquets & Arrangements',
      'lavender-lisianthus': 'Lisianthus (Eustoma) Flower Bouquets',
      'carnation': 'Fresh Carnation Flower Bouquets',
      'vase': 'Luxury Glass Vase Flower Arrangements',
      'flower-baskets': 'Flower Baskets for Special Occasions',
      'baskets': 'Flower Baskets for Special Occasions',
      'hydrangea': 'Hydrangea Flower Bouquets in Hyderabad'
    };

    const data = categories.map(c => {
      const ext = extensions[c.id] || extensions[c.slug] || {};
      const defaultTitle = `Buy ${c.name} Online | Fresh ${c.name} Delivery – SBFlorist`;
      const defaultDesc = c.description || `Order fresh ${c.name.toLowerCase()} online from Spring Blossoms Florist. Handcrafted arrangements with same-day & midnight delivery across Hyderabad & Secunderabad.`;
      const h1 = ext.h1 || categoryH1Map[c.slug] || `${c.name} in Hyderabad`;
      const seoIntro = ext.seoIntro || c.description || `Explore our handcrafted collection of ${c.name.toLowerCase()} prepared fresh daily by master florists at Spring Blossoms Florist.`;
      const seoContent = ext.seoContent || '';
      const focusKeyword = ext.focusKeyword || `${c.name} Online Hyderabad`;
      const canonicalUrl = ext.canonicalUrl || c.categoryUrl || `/${c.slug}`;

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        categoryUrl: canonicalUrl,
        h1,
        seoIntro,
        seoContent,
        focusKeyword,
        metaTitle: c.metaTitle || defaultTitle,
        metaDescription: c.metaDescription || defaultDesc,
        hasCustomSeo: Boolean(c.metaTitle && c.metaDescription),
        productCount: c._count?.products || 0,
        updatedAt: c.updatedAt
      };
    });

    res.json({
      success: true,
      categories: data
    });
  } catch (error) {
    console.error('Error fetching categories SEO:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories SEO', error: error.message });
  }
};

// @desc    Update Category SEO
// @route   PUT /api/seo/admin/categories/:id
// @access  Private/Admin
const updateCategorySeo = async (req, res) => {
  try {
    const { id } = req.params;
    const { metaTitle, metaDescription, slug, categoryUrl, h1, seoIntro, seoContent, focusKeyword } = req.body;

    const updated = await prisma.category.update({
      where: { id },
      data: {
        metaTitle: cleanText(metaTitle),
        metaDescription: cleanText(metaDescription),
        ...(seoIntro ? { description: cleanText(seoIntro) } : {}),
        ...(slug ? { slug: slugify(slug) } : {}),
        ...(categoryUrl ? { categoryUrl: String(categoryUrl).trim() } : {})
      }
    });

    await saveCategorySeoExtension(id, {
      slug: updated.slug,
      h1: h1 ? cleanText(h1) : undefined,
      seoIntro: seoIntro ? cleanText(seoIntro) : undefined,
      seoContent: seoContent !== undefined ? String(seoContent).trim() : undefined,
      focusKeyword: focusKeyword ? cleanText(focusKeyword) : undefined,
      canonicalUrl: categoryUrl ? String(categoryUrl).trim() : undefined
    });

    invalidateSitemapCache();

    res.json({
      success: true,
      message: 'Category SEO updated successfully',
      category: updated
    });
  } catch (error) {
    console.error('Error updating category SEO:', error);
    res.status(500).json({ success: false, message: 'Failed to update category SEO', error: error.message });
  }
};

// @desc    Bulk Generate & Persist Category SEO Metadata
// @route   POST /api/seo/admin/categories/bulk-generate
// @access  Private/Admin
const bulkGenerateCategoriesSeo = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true }
    });

    let updatedCount = 0;
    for (const c of categories) {
      if (c.metaTitle && c.metaDescription && !req.body?.overwrite) {
        continue;
      }
      const cleanName = cleanText(c.name);
      let metaTitle = `Buy ${cleanName} Online | Fresh ${cleanName} – SBFlorist`;
      if (metaTitle.length > 60) {
        metaTitle = `${cleanName} Online | SBFlorist Hyderabad`;
      }
      if (metaTitle.length > 60) {
        metaTitle = `${cleanName.slice(0, 42)} | SBFlorist`;
      }

      let metaDescription = `Order ${cleanName.toLowerCase()} online from Spring Blossoms Florist. Explore handcrafted arrangements with same-day and midnight delivery in Hyderabad & Secunderabad.`;
      if (metaDescription.length > 160) {
        metaDescription = metaDescription.slice(0, 157).trim() + '...';
      }

      await prisma.category.update({
        where: { id: c.id },
        data: {
          metaTitle,
          metaDescription,
          description: c.description || `Explore our freshly handcrafted ${cleanName.toLowerCase()} curated by master florists at Spring Blossoms Florist for birthdays, anniversaries, and special celebrations.`
        }
      });
      updatedCount++;
    }

    invalidateSitemapCache();
    res.json({
      success: true,
      message: `Optimized SEO metadata for ${updatedCount} categories.`,
      updatedCount
    });
  } catch (error) {
    console.error('Error bulk generating category SEO:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk generate category SEO', error: error.message });
  }
};

// @desc    Export Product SEO to CSV
// @route   GET /api/seo/admin/export-csv
// @access  Private/Admin
const exportSeoCsv = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { approvalStatus: 'approved' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        seoSettings: true,
        images: { select: { alt: true }, take: 1 },
        categories: { select: { category: { select: { name: true } } }, take: 1 }
      },
      orderBy: { name: 'asc' }
    });

    const headers = [
      'ID',
      'Product Name',
      'Category',
      'Price',
      'Focus Keyword',
      'SEO Title',
      'Meta Description',
      'Slug',
      'H1',
      'Image Alt',
      'Canonical URL',
      'Noindex',
      'Is Manual',
      'SEO Score'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = products.map(p => {
      const seo = p.seoSettings || {};
      const cat = p.categories?.[0]?.category?.name || 'Flowers';

      return [
        escapeCsv(p.id),
        escapeCsv(p.name),
        escapeCsv(cat),
        escapeCsv(p.price),
        escapeCsv(seo.focusKeyword || ''),
        escapeCsv(seo.seoTitle || seo.metaTitle || ''),
        escapeCsv(seo.metaDescription || seo.seoDescription || ''),
        escapeCsv(seo.slug || p.slug || ''),
        escapeCsv(seo.h1 || p.name),
        escapeCsv(seo.imageAlt || p.images?.[0]?.alt || ''),
        escapeCsv(seo.canonicalUrl || `https://sbflorist.in/product/${p.slug || p.id}`),
        escapeCsv(seo.noindex ? 'TRUE' : 'FALSE'),
        escapeCsv(seo.isManual ? 'TRUE' : 'FALSE'),
        escapeCsv(seo.score || '')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sbflorist-seo-catalog-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting SEO CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to export SEO CSV', error: error.message });
  }
};

// @desc    Import Product SEO from CSV
// @route   POST /api/seo/admin/import-csv
// @access  Private/Admin
const importSeoCsv = async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ success: false, message: 'csvData string is required' });
    }

    const lines = csvData.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV contains no data rows' });
    }

    const parseCsvRow = (row) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' && row[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseCsvRow(lines[0]).map(h => h.toLowerCase());
    const idIdx = header.findIndex(h => h.includes('id'));
    const focusIdx = header.findIndex(h => h.includes('focus'));
    const titleIdx = header.findIndex(h => h.includes('title'));
    const descIdx = header.findIndex(h => h.includes('desc'));
    const slugIdx = header.findIndex(h => h.includes('slug'));
    const h1Idx = header.findIndex(h => h.includes('h1'));
    const altIdx = header.findIndex(h => h.includes('alt'));
    const canonicalIdx = header.findIndex(h => h.includes('canonical'));
    const noindexIdx = header.findIndex(h => h.includes('noindex'));

    if (idIdx === -1) {
      return res.status(400).json({ success: false, message: 'CSV header must include an "ID" column' });
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvRow(lines[i]);
      const prodId = cols[idIdx];
      if (!prodId) continue;

      try {
        const product = await prisma.product.findUnique({ where: { id: prodId } });
        if (!product) {
          failedCount++;
          continue;
        }

        const focusKeyword = focusIdx !== -1 ? cols[focusIdx] : '';
        const seoTitle = titleIdx !== -1 ? cols[titleIdx] : '';
        const metaDescription = descIdx !== -1 ? cols[descIdx] : '';
        const slug = slugIdx !== -1 ? cols[slugIdx] : '';
        const h1 = h1Idx !== -1 ? cols[h1Idx] : '';
        const imageAlt = altIdx !== -1 ? cols[altIdx] : '';
        const canonicalUrl = canonicalIdx !== -1 ? cols[canonicalIdx] : '';
        const noindex = noindexIdx !== -1 ? (cols[noindexIdx]?.toUpperCase() === 'TRUE') : false;

        const analysis = evaluateSeoScore({
          focusKeyword,
          seoTitle,
          metaDescription,
          h1: h1 || product.name,
          imageAlt,
          productName: product.name,
          description: product.description || product.shortDescription
        });

        const newSeoSettings = {
          ...(product.seoSettings || {}),
          focusKeyword: cleanText(focusKeyword),
          seoTitle: cleanText(seoTitle),
          metaTitle: cleanText(seoTitle),
          metaDescription: cleanText(metaDescription),
          seoDescription: cleanText(metaDescription),
          slug: slugify(slug || product.slug),
          h1: cleanText(h1 || product.name),
          imageAlt: cleanText(imageAlt),
          canonicalUrl: canonicalUrl ? cleanText(canonicalUrl) : `https://sbflorist.in/product/${slugify(slug || product.slug || prodId)}`,
          noindex: Boolean(noindex),
          isManual: true,
          score: analysis.score,
          warnings: analysis.warnings,
          passed: analysis.passed,
          updatedAt: new Date().toISOString()
        };

        await prisma.product.update({
          where: { id: prodId },
          data: {
            seoSettings: newSeoSettings,
            ...(slug ? { slug: slugify(slug) } : {})
          }
        });

        updatedCount++;
      } catch (err) {
        console.error(`Error importing row ${i}:`, err.message);
        failedCount++;
      }
    }

    invalidateSitemapCache();

    res.json({
      success: true,
      message: `CSV import completed. Updated: ${updatedCount}, Failed: ${failedCount}.`,
      updatedCount,
      failedCount
    });
  } catch (error) {
    console.error('Error importing SEO CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to import SEO CSV', error: error.message });
  }
};

// @desc    Get Dynamic Valentine's Week Calendar and SEO Content
// @route   GET /api/seo/valentine-calendar
// @access  Public
const getValentineCalendarData = (req, res) => {
  try {
    const targetYear = req.query.year ? parseInt(req.query.year) : undefined;
    const days = getValentineWeekCalendar(targetYear);
    res.json({
      success: true,
      year: days[0]?.year,
      days
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Global SEO Settings
// @route   GET /api/seo/global-settings
// @access  Public
const getPublicGlobalSeoSettings = async (req, res) => {
  try {
    const settings = await getGlobalSeoSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Global SEO Settings
// @route   PUT /api/seo/admin/global-settings
// @access  Private/Admin
const updateAdminGlobalSeoSettings = async (req, res) => {
  try {
    const updated = await updateGlobalSeoSettings(req.body || {});
    invalidateSitemapCache();
    res.json({
      success: true,
      message: 'Global SEO settings updated successfully',
      settings: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Public Blog Posts
// @route   GET /api/seo/blogs
// @access  Public
const getPublicBlogs = async (req, res) => {
  try {
    const { category, search } = req.query;
    let posts = await getAllBlogPosts(false);

    if (category && category !== 'all') {
      const catLower = String(category).toLowerCase();
      posts = posts.filter((p) => String(p.category || '').toLowerCase() === catLower);
    }

    if (search) {
      const q = String(search).toLowerCase().trim();
      posts = posts.filter(
        (p) =>
          String(p.title || '').toLowerCase().includes(q) ||
          String(p.excerpt || '').toLowerCase().includes(q) ||
          String(p.focusKeyword || '').toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: posts.length,
      blogs: posts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Single Public Blog Post by Slug + Real Catalog Related Products
// @route   GET /api/seo/blogs/:slug
// @access  Public
const getPublicBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await getBlogPostBySlug(slug, false);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Blog article not found' });
    }

    const allPosts = await getAllBlogPosts(false);
    const relatedPosts = allPosts
      .filter((p) => p.slug !== post.slug)
      .slice(0, 4);

    // Query real catalog products matching relatedProductQuery
    let relatedProducts = [];
    try {
      const queryWord = String(post.relatedProductQuery || 'rose').trim();
      const rawProducts = await prisma.product.findMany({
        where: {
          isVisible: true,
          approvalStatus: 'approved',
          OR: [
            { name: { contains: queryWord, mode: 'insensitive' } },
            { description: { contains: queryWord, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          comparePrice: true,
          rating: true,
          reviewCount: true,
          images: { select: { url: true, alt: true }, orderBy: { isPrimary: 'desc' }, take: 1 },
          categories: { include: { category: { select: { name: true, slug: true } } }, take: 1 }
        },
        take: 6,
        orderBy: { isBestseller: 'desc' }
      });

      relatedProducts = rawProducts.map((p) => ({
        _id: p.id,
        id: p.id,
        title: p.name,
        name: p.name,
        slug: p.slug,
        price: Number(p.price) || 0,
        originalPrice: p.comparePrice ? Number(p.comparePrice) : undefined,
        rating: p.rating || 0,
        numReviews: p.reviewCount || 0,
        image: p.images?.[0]?.url || '/images/logo_final.png',
        images: p.images?.map((i) => i.url) || [],
        category: p.categories?.[0]?.category?.name || 'Flowers'
      }));
    } catch (e) {
      console.warn('Error fetching related products for blog post:', e.message);
    }

    res.json({
      success: true,
      blog: post,
      relatedPosts,
      relatedProducts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Blog Posts for Admin (including drafts)
// @route   GET /api/seo/admin/blogs
// @access  Private/Admin
const getAdminBlogs = async (req, res) => {
  try {
    const posts = await getAllBlogPosts(true, true);
    res.json({
      success: true,
      count: posts.length,
      blogs: posts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create Blog Post (Admin)
// @route   POST /api/seo/admin/blogs
// @access  Private/Admin
const createAdminBlog = async (req, res) => {
  try {
    const post = await createOrUpdateBlogPost(req.body || {});
    invalidateSitemapCache();
    res.status(201).json({
      success: true,
      message: 'Blog article created successfully',
      blog: post
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Blog Post (Admin)
// @route   PUT /api/seo/admin/blogs/:id
// @access  Private/Admin
const updateAdminBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await createOrUpdateBlogPost(req.body || {}, id);
    invalidateSitemapCache();
    res.json({
      success: true,
      message: 'Blog article updated successfully',
      blog: post
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Blog Post (Admin)
// @route   DELETE /api/seo/admin/blogs/:id
// @access  Private/Admin
const deleteAdminBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteBlogPost(id);
    invalidateSitemapCache();
    res.json({
      success: true,
      deleted,
      message: deleted ? 'Blog article deleted' : 'Blog article not found'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Run Comprehensive SEO Health & Diagnostics Audit
// @route   GET /api/seo/admin/health
// @access  Private/Admin
const getAdminSeoHealthAudit = async (req, res) => {
  try {
    const audit = await runComprehensiveSeoAudit();
    res.json({
      success: true,
      audit
    });
  } catch (error) {
    console.error('Error running SEO health audit:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Centralized Keyword-to-Page Mappings & Cannibalization Diagnostics
// @route   GET /api/seo/admin/keyword-mappings
// @access  Private/Admin
const getAdminKeywordMappings = async (req, res) => {
  try {
    const forceSync = req.query.sync === 'true';
    const data = await getKeywordMappings(forceSync);
    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error getting keyword mappings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Sync Keyword Mappings from Live Catalog, Categories, Occasions & Blogs
// @route   POST /api/seo/admin/keyword-mappings/sync
// @access  Private/Admin
const syncAdminKeywordMappings = async (req, res) => {
  try {
    const data = await getKeywordMappings(true);
    res.json({
      success: true,
      message: `Synchronized ${data.mappings.length} pages into Keyword Mapping System`,
      ...data
    });
  } catch (error) {
    console.error('Error syncing keyword mappings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or Update a Keyword Mapping Record
// @route   POST /api/seo/admin/keyword-mappings
// @route   PUT /api/seo/admin/keyword-mappings/:id
// @access  Private/Admin
const saveAdminKeywordMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await upsertKeywordMapping(req.body || {}, id || null);
    res.json({
      success: true,
      message: 'Keyword mapping saved successfully',
      ...result
    });
  } catch (error) {
    console.error('Error saving keyword mapping:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a Keyword Mapping Record
// @route   DELETE /api/seo/admin/keyword-mappings/:id
// @access  Private/Admin
const removeAdminKeywordMapping = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteKeywordMapping(id);
    res.json({
      success: true,
      message: result.deleted ? 'Keyword mapping deleted' : 'Mapping not found',
      ...result
    });
  } catch (error) {
    console.error('Error deleting keyword mapping:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Keyword Mappings as CSV
// @route   GET /api/seo/admin/keyword-mappings/export
// @access  Private/Admin
const exportAdminKeywordMappingsCsv = async (req, res) => {
  try {
    const csv = await exportKeywordMappingsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sbflorist-keyword-mappings.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error exporting keyword mappings CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Import Keyword Mappings from CSV JSON rows
// @route   POST /api/seo/admin/keyword-mappings/import
// @access  Private/Admin
const importAdminKeywordMappingsCsv = async (req, res) => {
  try {
    const { rows } = req.body || {};
    const data = await importKeywordMappingsCsv(Array.isArray(rows) ? rows : []);
    res.json({
      success: true,
      message: `Imported and updated keyword mappings (${data.mappings.length} total pages)`,
      ...data
    });
  } catch (error) {
    console.error('Error importing keyword mappings CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Backlink & Referring Domain Authority Data + Playbook
// @route   GET /api/seo/admin/backlinks
// @access  Private/Admin
const getAdminBacklinks = async (req, res) => {
  try {
    const data = await getBacklinksData();
    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error fetching backlinks:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create or Update a Backlink / Outreach Prospect Record
// @route   POST /api/seo/admin/backlinks
// @route   PUT /api/seo/admin/backlinks/:id
// @access  Private/Admin
const saveAdminBacklink = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await upsertBacklinkRecord(req.body || {}, id || null);
    res.json({
      success: true,
      message: 'Backlink record saved successfully',
      ...data
    });
  } catch (error) {
    console.error('Error saving backlink record:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a Backlink / Outreach Prospect Record
// @route   DELETE /api/seo/admin/backlinks/:id
// @access  Private/Admin
const removeAdminBacklink = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await deleteBacklinkRecord(id);
    res.json({
      success: true,
      message: 'Backlink record removed',
      ...data
    });
  } catch (error) {
    console.error('Error deleting backlink record:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get SEO & Conversion Performance Dashboard Data (GSC/GA4 + Live DB Funnel + Competitor Gap)
// @route   GET /api/seo/admin/performance
// @access  Private/Admin
const getAdminSeoPerformance = async (req, res) => {
  try {
    const performance = await getSeoPerformanceDashboardData();
    res.json({
      success: true,
      performance
    });
  } catch (error) {
    console.error('Error fetching SEO performance data:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSeoOverviewStats,
  getProductsSeoList,
  updateProductSeo,
  generateProductSeoSingle,
  bulkGenerateSeo,
  getCategoriesSeoList,
  updateCategorySeo,
  bulkGenerateCategoriesSeo,
  exportSeoCsv,
  importSeoCsv,
  getValentineCalendarData,
  getPublicGlobalSeoSettings,
  updateAdminGlobalSeoSettings,
  getPublicBlogs,
  getPublicBlogBySlug,
  getAdminBlogs,
  createAdminBlog,
  updateAdminBlog,
  deleteAdminBlog,
  getAdminSeoHealthAudit,
  getAdminKeywordMappings,
  syncAdminKeywordMappings,
  saveAdminKeywordMapping,
  removeAdminKeywordMapping,
  exportAdminKeywordMappingsCsv,
  importAdminKeywordMappingsCsv,
  getAdminBacklinks,
  saveAdminBacklink,
  removeAdminBacklink,
  getAdminSeoPerformance
};

