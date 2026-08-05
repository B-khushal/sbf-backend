const prisma = require('../../config/prisma');

class ProductPostgresService {
  async findBySlug(slug) {
    return await prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } },
        reviews: {
          where: { status: 'approved' },
          include: { user: { select: { name: true, photoURL: true } }, images: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        vendor: { select: { id: true, storeName: true, ownerName: true } }
      }
    });
  }

  async findById(id) {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        priceVariants: { orderBy: { price: 'asc' } },
        categories: { include: { category: true } },
        occasions: { include: { occasion: true } },
        reviews: { where: { status: 'approved' } },
        vendor: true
      }
    });
  }

  async searchProducts({ query, categorySlug, occasionSlug, minPrice, maxPrice, sortBy, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const where = { isVisible: true, isAvailable: true };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { some: { tag: { contains: query, mode: 'insensitive' } } } }
      ];
    }

    if (categorySlug) {
      where.categories = { some: { category: { slug: categorySlug } } };
    }

    if (occasionSlug) {
      where.occasions = { some: { occasion: { slug: occasionSlug } } };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = parseFloat(minPrice);
      if (maxPrice !== undefined) where.price.lte = parseFloat(maxPrice);
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    if (sortBy === 'price_desc') orderBy = { price: 'desc' };
    if (sortBy === 'rating') orderBy = { rating: 'desc' };
    if (sortBy === 'bestseller') orderBy = { isBestseller: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        include: {
          images: { orderBy: { displayOrder: 'asc' }, take: 2 },
          priceVariants: true,
          categories: { include: { category: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    };
  }
}

module.exports = new ProductPostgresService();
