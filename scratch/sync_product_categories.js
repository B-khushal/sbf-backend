const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const backupDir = 'D:\\SBF\\mongodb_backup\\test';

async function syncProductCategories() {
  console.log('🚀 Syncing product category assignments from MongoDB backup...');

  const productsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));
  const categoriesInPG = await prisma.category.findMany();

  // Build lookup maps: name->id and slug->id (case-insensitive)
  const catByName = {};
  const catBySlug = {};
  categoriesInPG.forEach(c => {
    catByName[c.name.toLowerCase()] = c.id;
    catBySlug[c.slug.toLowerCase()] = c.id;
  });

  console.log('Categories in PG:', categoriesInPG.length);
  console.log('Products in backup:', productsBackup.length);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const p of productsBackup) {
    const productId = (p._id && p._id.$oid) ? p._id.$oid : p._id;
    if (!productId) continue;

    // Check if product exists in PG
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      skippedCount++;
      continue;
    }

    // Gather all category names from the backup product
    const categoryNames = new Set();
    if (p.category) categoryNames.add(p.category);
    if (Array.isArray(p.categories)) p.categories.forEach(c => categoryNames.add(c));

    // Resolve category names to PG category IDs
    const resolvedCategoryIds = new Set();
    for (const catName of categoryNames) {
      const lower = catName.toLowerCase().trim();
      const slug = lower.replace(/\s+/g, '-');
      const catId = catByName[lower] || catBySlug[slug] || catBySlug[lower];
      if (catId) {
        resolvedCategoryIds.add(catId);
      }
    }

    if (resolvedCategoryIds.size === 0) continue;

    // Get existing ProductCategory relations
    const existingRelations = await prisma.productCategory.findMany({
      where: { productId }
    });
    const existingCatIds = new Set(existingRelations.map(r => r.categoryId));

    // Find missing relations
    const toAdd = [...resolvedCategoryIds].filter(catId => !existingCatIds.has(catId));

    if (toAdd.length > 0) {
      for (const categoryId of toAdd) {
        try {
          await prisma.productCategory.create({
            data: { productId, categoryId }
          });
        } catch (err) {
          // Ignore duplicate key errors
        }
      }
      updatedCount++;
      console.log(`  ✅ ${p.title}: added ${toAdd.length} category links (total: ${resolvedCategoryIds.size})`);
    }
  }

  // Also store categories in details JSON for the Product model layer
  console.log('\n📦 Updating details.categories on all products...');
  const allProducts = await prisma.product.findMany({
    include: { categories: { include: { category: true } } }
  });

  let detailsUpdated = 0;
  for (const prod of allProducts) {
    const catNames = prod.categories.map(pc => pc.category.name).filter(Boolean);
    const details = (prod.details && typeof prod.details === 'object') ? { ...prod.details } : {};
    
    // Only update if categories changed
    const existingDetailsCats = details.categories || [];
    const sortedNew = [...catNames].sort();
    const sortedOld = [...existingDetailsCats].sort();
    
    if (JSON.stringify(sortedNew) !== JSON.stringify(sortedOld)) {
      details.categories = catNames;
      await prisma.product.update({
        where: { id: prod.id },
        data: { details }
      });
      detailsUpdated++;
    }
  }

  console.log(`\n✅ Added category relations for ${updatedCount} products`);
  console.log(`✅ Updated details.categories for ${detailsUpdated} products`);
  console.log(`⏩ Skipped ${skippedCount} products (not found in PG)`);

  // Verify
  const totalPC = await prisma.productCategory.count();
  console.log(`📊 Total ProductCategory rows: ${totalPC}`);
}

syncProductCategories()
  .then(() => {
    console.log('🎉 Product Category Sync Complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
