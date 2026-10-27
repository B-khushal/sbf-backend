const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to create clean URL slugs
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Safe HTML sanitizer for rich text content
const sanitizeHtml = (dirty = '') => {
  if (typeof dirty !== 'string') return '';
  return dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:[^"']*/gi, '');
};

// ==========================================
// PUBLIC CONTROLLERS
// ==========================================

/**
 * @desc Get published FAQs with optional filtering (category, location, search, featured)
 * @route GET /api/faqs
 * @access Public
 */
const getFaqs = async (req, res) => {
  try {
    const { category, location, search, featured, limit } = req.query;

    const where = {
      isPublished: true
    };

    // Category filter by ID or slug
    if (category) {
      where.OR = [
        { categoryId: category },
        { category: { slug: category } }
      ];
    }

    // Display location filter
    if (location) {
      where.displayLocations = {
        has: location
      };
    }

    // Featured filter
    if (featured === 'true' || featured === '1') {
      where.isFeatured = true;
    }

    // Search query filter (matches question, answer, or keywords)
    if (search && search.trim()) {
      const query = search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { question: { contains: query, mode: 'insensitive' } },
            { answer: { contains: query, mode: 'insensitive' } },
            { keywords: { has: query.toLowerCase() } }
          ]
        }
      ];
    }

    const faqs = await prisma.faq.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            displayOrder: true
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ],
      ...(limit ? { take: parseInt(limit, 10) } : {})
    });

    return res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
};

/**
 * @desc Get all active FAQ categories with published question counts
 * @route GET /api/faqs/categories
 * @access Public
 */
const getFaqCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const categories = await prisma.faqCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            faqs: {
              where: { isPublished: true }
            }
          }
        }
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ categories',
      error: error.message
    });
  }
};

/**
 * @desc Get single FAQ by slug
 * @route GET /api/faqs/by-slug/:slug
 * @access Public
 */
const getFaqBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const faq = await prisma.faq.findUnique({
      where: { slug },
      include: {
        category: true
      }
    });

    if (!faq || (!faq.isPublished && (!req.user || req.user.role !== 'admin'))) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ by slug:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ',
      error: error.message
    });
  }
};

/**
 * @desc Vote helpful or not helpful on an FAQ
 * @route POST /api/faqs/:id/vote
 * @access Public
 */
const voteHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;

    if (vote !== 'helpful' && vote !== 'not_helpful') {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote parameter. Must be "helpful" or "not_helpful".'
      });
    }

    const updated = await prisma.faq.update({
      where: { id },
      data: {
        ...(vote === 'helpful'
          ? { helpfulCount: { increment: 1 } }
          : { notHelpfulCount: { increment: 1 } })
      },
      select: {
        id: true,
        helpfulCount: true,
        notHelpfulCount: true
      }
    });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error recording FAQ vote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register vote',
      error: error.message
    });
  }
};

// ==========================================
// ADMIN CONTROLLERS (PROTECTED)
// ==========================================

/**
 * @desc Get all FAQs for admin dashboard with search, category & pagination
 * @route GET /api/faqs/admin/all
 * @access Private/Admin
 */
const getAdminFaqs = async (req, res) => {
  try {
    const { search, categoryId, status, location, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * pageSize;

    const where = {};

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (status === 'published') {
      where.isPublished = true;
    } else if (status === 'draft') {
      where.isPublished = false;
    }

    if (location && location !== 'all') {
      where.displayLocations = {
        has: location
      };
    }

    if (search && search.trim()) {
      const query = search.trim();
      where.OR = [
        { question: { contains: query, mode: 'insensitive' } },
        { answer: { contains: query, mode: 'insensitive' } },
        { keywords: { has: query.toLowerCase() } }
      ];
    }

    const [total, faqs, categories] = await Promise.all([
      prisma.faq.count({ where }),
      prisma.faq.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: [
          { displayOrder: 'asc' },
          { updatedAt: 'desc' }
        ],
        skip,
        take: pageSize
      }),
      prisma.faqCategory.findMany({
        orderBy: { displayOrder: 'asc' }
      })
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: faqs,
      categories
    });
  } catch (error) {
    console.error('Error fetching admin FAQs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load FAQs for admin',
      error: error.message
    });
  }
};

/**
 * @desc Create new FAQ
 * @route POST /api/faqs/admin
 * @access Private/Admin
 */
const createFaq = async (req, res) => {
  try {
    const {
      question,
      answer,
      categoryId,
      keywords,
      isPublished = true,
      isFeatured = false,
      displayLocations = ['faq_page'],
      displayOrder = 0,
      seoTitle,
      seoDescription,
      slug: customSlug
    } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }
    if (!answer || !answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    // Verify category exists
    const cat = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
    if (!cat) {
      return res.status(400).json({ success: false, message: 'Specified category does not exist' });
    }

    // Generate unique slug
    let baseSlug = customSlug ? slugify(customSlug) : slugify(question);
    if (!baseSlug) baseSlug = `faq-${Date.now()}`;
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (await prisma.faq.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const cleanKeywords = Array.isArray(keywords)
      ? keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean)
      : typeof keywords === 'string'
      ? keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : [];

    const cleanLocations = Array.isArray(displayLocations) && displayLocations.length > 0
      ? displayLocations
      : ['faq_page'];

    const newFaq = await prisma.faq.create({
      data: {
        question: question.trim(),
        answer: sanitizeHtml(answer.trim()),
        slug: uniqueSlug,
        categoryId,
        keywords: cleanKeywords,
        isPublished: Boolean(isPublished),
        isFeatured: Boolean(isFeatured),
        displayLocations: cleanLocations,
        displayOrder: Number(displayOrder) || 0,
        seoTitle: seoTitle ? seoTitle.trim() : null,
        seoDescription: seoDescription ? seoDescription.trim() : null
      },
      include: {
        category: true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: newFaq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
};

/**
 * @desc Update FAQ
 * @route PUT /api/faqs/admin/:id
 * @access Private/Admin
 */
const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question,
      answer,
      categoryId,
      keywords,
      isPublished,
      isFeatured,
      displayLocations,
      displayOrder,
      seoTitle,
      seoDescription,
      slug: customSlug
    } = req.body;

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    const data = {};

    if (question !== undefined) data.question = question.trim();
    if (answer !== undefined) data.answer = sanitizeHtml(answer.trim());
    if (categoryId !== undefined) {
      const cat = await prisma.faqCategory.findUnique({ where: { id: categoryId } });
      if (!cat) {
        return res.status(400).json({ success: false, message: 'Category not found' });
      }
      data.categoryId = categoryId;
    }
    if (keywords !== undefined) {
      data.keywords = Array.isArray(keywords)
        ? keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean)
        : typeof keywords === 'string'
        ? keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
        : [];
    }
    if (isPublished !== undefined) data.isPublished = Boolean(isPublished);
    if (isFeatured !== undefined) data.isFeatured = Boolean(isFeatured);
    if (displayLocations !== undefined) {
      data.displayLocations = Array.isArray(displayLocations) ? displayLocations : [displayLocations];
    }
    if (displayOrder !== undefined) data.displayOrder = Number(displayOrder);
    if (seoTitle !== undefined) data.seoTitle = seoTitle ? seoTitle.trim() : null;
    if (seoDescription !== undefined) data.seoDescription = seoDescription ? seoDescription.trim() : null;

    if (customSlug && customSlug !== existing.slug) {
      const slugCandidate = slugify(customSlug);
      const conflict = await prisma.faq.findUnique({ where: { slug: slugCandidate } });
      if (conflict && conflict.id !== id) {
        return res.status(400).json({ success: false, message: 'A FAQ with this slug already exists' });
      }
      data.slug = slugCandidate;
    }

    const updated = await prisma.faq.update({
      where: { id },
      data,
      include: {
        category: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update FAQ',
      error: error.message
    });
  }
};

/**
 * @desc Delete FAQ
 * @route DELETE /api/faqs/admin/:id
 * @access Private/Admin
 */
const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    await prisma.faq.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ',
      error: error.message
    });
  }
};

/**
 * @desc Toggle published status of FAQ
 * @route PATCH /api/faqs/admin/:id/publish
 * @access Private/Admin
 */
const togglePublishFaq = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    const updated = await prisma.faq.update({
      where: { id },
      data: { isPublished: !existing.isPublished }
    });

    return res.status(200).json({
      success: true,
      message: `FAQ ${updated.isPublished ? 'published' : 'unpublished'} successfully`,
      data: updated
    });
  } catch (error) {
    console.error('Error toggling FAQ status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle FAQ publish status',
      error: error.message
    });
  }
};

/**
 * @desc Reorder FAQs
 * @route PUT /api/faqs/admin/reorder
 * @access Private/Admin
 */
const reorderFaqs = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, displayOrder }

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    await Promise.all(
      items.map(item =>
        prisma.faq.update({
          where: { id: item.id },
          data: { displayOrder: Number(item.displayOrder) || 0 }
        })
      )
    );

    return res.status(200).json({
      success: true,
      message: 'FAQs reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder FAQs',
      error: error.message
    });
  }
};

// ==========================================
// FAQ CATEGORY MANAGEMENT
// ==========================================

const createFaqCategory = async (req, res) => {
  try {
    const { name, slug, description, icon, displayOrder = 0, isActive = true } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const categorySlug = slug ? slugify(slug) : slugify(name);
    const existing = await prisma.faqCategory.findUnique({ where: { slug: categorySlug } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category with this slug already exists' });
    }

    const created = await prisma.faqCategory.create({
      data: {
        name: name.trim(),
        slug: categorySlug,
        description: description ? description.trim() : null,
        icon: icon ? icon.trim() : null,
        displayOrder: Number(displayOrder) || 0,
        isActive: Boolean(isActive)
      }
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ category created successfully',
      data: created
    });
  } catch (error) {
    console.error('Error creating FAQ category:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
};

const updateFaqCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, icon, displayOrder, isActive } = req.body;

    const existing = await prisma.faqCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (icon !== undefined) data.icon = icon ? icon.trim() : null;
    if (displayOrder !== undefined) data.displayOrder = Number(displayOrder);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (slug && slug !== existing.slug) {
      const slugCandidate = slugify(slug);
      const conflict = await prisma.faqCategory.findUnique({ where: { slug: slugCandidate } });
      if (conflict && conflict.id !== id) {
        return res.status(400).json({ success: false, message: 'A category with this slug already exists' });
      }
      data.slug = slugCandidate;
    }

    const updated = await prisma.faqCategory.update({
      where: { id },
      data
    });

    return res.status(200).json({
      success: true,
      message: 'FAQ category updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
};

const deleteFaqCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.faqCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { faqs: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (existing._count.faqs > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: contains ${existing._count.faqs} FAQs. Pass force=true to delete along with its FAQs.`
      });
    }

    await prisma.faqCategory.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'FAQ category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ category:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
};

module.exports = {
  getFaqs,
  getFaqCategories,
  getFaqBySlug,
  voteHelpful,
  getAdminFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  togglePublishFaq,
  reorderFaqs,
  createFaqCategory,
  updateFaqCategory,
  deleteFaqCategory
};
