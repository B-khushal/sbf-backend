const fs = require('fs');
const prisma = require('./config/prisma');

async function syncAll() {
  console.log('==================================================');
  console.log('🚀 STARTING COMPREHENSIVE CATEGORY & PRODUCT SYNC');
  console.log('==================================================');

  // 1. Sync Categories
  const categoriesData = JSON.parse(fs.readFileSync('D:/SBF/mongodb_backup/test/categories.json', 'utf8'));
  console.log(`📁 Processing ${categoriesData.length} Categories...`);

  // First pass: upsert top-level categories
  for (const c of categoriesData) {
    await prisma.category.upsert({
      where: { id: c._id },
      update: {
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        image: c.image || null,
        displayOrder: c.sortOrder || 0,
        isActive: c.status !== 'inactive',
        isFeatured: c.showInShop === true
      },
      create: {
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        image: c.image || null,
        displayOrder: c.sortOrder || 0,
        isActive: c.status !== 'inactive',
        isFeatured: c.showInShop === true
      }
    });
  }

  // Second pass: set parentId relationships
  for (const c of categoriesData) {
    if (c.parentId) {
      const parentExists = await prisma.category.findUnique({ where: { id: c.parentId } });
      if (parentExists) {
        await prisma.category.update({
          where: { id: c._id },
          data: { parentId: c.parentId }
        });
      }
    }
  }
  console.log('✅ Categories successfully synced!');

  // 2. Load all categories for fast mapping
  const allDbCats = await prisma.category.findMany();
  const catNameToIdMap = {};
  allDbCats.forEach(c => {
    catNameToIdMap[c.name.toLowerCase()] = c.id;
    catNameToIdMap[c.slug.toLowerCase()] = c.id;
  });

  // 3. Sync Products
  const productsData = JSON.parse(fs.readFileSync('D:/SBF/mongodb_backup/test/products.json', 'utf8'));
  console.log(`📁 Processing ${productsData.length} Products...`);

  for (const p of productsData) {
    const prodTitle = p.title || p.name || 'Flower Product';
    const prodPrice = p.price ? parseFloat(p.price) : 0;
    const prodStock = p.countInStock !== undefined ? parseInt(p.countInStock) : (p.stock ? parseInt(p.stock) : 10);

    const createdProd = await prisma.product.upsert({
      where: { id: p._id },
      update: {
        name: prodTitle,
        slug: p.slug || `prod-${p._id}`,
        description: p.description || '',
        price: prodPrice,
        stock: prodStock,
        isAvailable: p.isAvailable !== false,
        isVisible: p.hidden !== true,
        isFeatured: p.isFeatured === true,
        isBestseller: p.isBestseller === true,
        rating: p.rating ? parseFloat(p.rating) : 0,
        reviewCount: p.numReviews ? parseInt(p.numReviews) : 0
      },
      create: {
        id: p._id,
        name: prodTitle,
        slug: p.slug || `prod-${p._id}`,
        description: p.description || '',
        price: prodPrice,
        stock: prodStock,
        isAvailable: p.isAvailable !== false,
        isVisible: p.hidden !== true,
        isFeatured: p.isFeatured === true,
        isBestseller: p.isBestseller === true,
        rating: p.rating ? parseFloat(p.rating) : 0,
        reviewCount: p.numReviews ? parseInt(p.numReviews) : 0
      }
    });

    // Product Images
    if (Array.isArray(p.images) && p.images.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: p._id } });
      let displayOrder = 0;
      for (const imgUrl of p.images) {
        const urlStr = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || '');
        if (urlStr) {
          await prisma.productImage.create({
            data: {
              id: `img_${p._id}_${displayOrder}`,
              productId: p._id,
              url: urlStr,
              displayOrder
            }
          });
          displayOrder++;
        }
      }
    }

    // Product Category Relations
    const linkedCatIds = new Set();
    if (p.category) {
      const catId = catNameToIdMap[p.category.toLowerCase()];
      if (catId) linkedCatIds.add(catId);
    }
    if (Array.isArray(p.categories)) {
      for (const catName of p.categories) {
        const catId = catNameToIdMap[catName.toLowerCase()];
        if (catId) linkedCatIds.add(catId);
      }
    }

    await prisma.productCategory.deleteMany({ where: { productId: p._id } });
    for (const catId of linkedCatIds) {
      await prisma.productCategory.create({
        data: {
          productId: p._id,
          categoryId: catId
        }
      });
    }
  }

  console.log('✅ Products & Category relations successfully synced!');

  // 4. Print Category Product Counts Summary
  const categoriesWithCounts = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n==================================================');
  console.log('📊 CATEGORY PRODUCT COUNTS SUMMARY');
  console.log('==================================================');
  categoriesWithCounts.forEach(c => {
    console.log(`- ${c.name} (${c.slug}): ${c._count.products} products (ShowInShop/Featured: ${c.isFeatured})`);
  });

  console.log('\n✅ ALL DATA SYNCED PERFECTLY WITH CATEGORIES!');
}

syncAll().catch(console.error);
