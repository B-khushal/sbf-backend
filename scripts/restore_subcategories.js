const mongoose = require('mongoose');
const prisma = require('../config/prisma');
const Product = require('../models/Product');

const MONGO_URI = "mongodb+srv://khushalprasad242:ddkka2006@cluster0.qxae3.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function restoreSubcategories() {
  console.log('🔄 Starting subcategory restoration from original MongoDB source of truth...');

  // Connect to MongoDB
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const mongoDb = mongoose.connection.db;
  const mongoProducts = await mongoDb.collection('products').find({}).toArray();
  console.log(`📦 Loaded ${mongoProducts.length} original products from MongoDB`);

  // Build MongoDB product map by string ID
  const mongoMap = new Map();
  mongoProducts.forEach(p => {
    const idStr = String(p._id);
    mongoMap.set(idStr, p);
  });

  // Fetch all PostgreSQL products
  const pgProducts = await prisma.product.findMany({});
  console.log(`📦 Loaded ${pgProducts.length} products from PostgreSQL`);

  let restoredCount = 0;
  let clearedCount = 0;

  for (const pgProd of pgProducts) {
    const mongoProd = mongoMap.get(pgProd.id);
    let detailsObj = (pgProd.details && typeof pgProd.details === 'object') ? { ...pgProd.details } : {};

    let originalSubcat = '';
    if (mongoProd && mongoProd.subcategory) {
      originalSubcat = String(mongoProd.subcategory).trim();
    }

    // Check if the product currently has 'Test Luxury Boxes' or needs restoration
    const currentSubcat = String(detailsObj.subcategory || '').trim();
    const isTestSubcat = currentSubcat.toLowerCase().includes('test luxury boxes') || currentSubcat.toLowerCase().includes('test');

    if (isTestSubcat || originalSubcat) {
      if (originalSubcat) {
        detailsObj.subcategory = originalSubcat;
        restoredCount++;
      } else {
        delete detailsObj.subcategory;
        clearedCount++;
      }

      await prisma.product.update({
        where: { id: pgProd.id },
        data: {
          details: detailsObj
        }
      });
    }
  }

  console.log(`✅ Restoration complete!`);
  console.log(`   - Restored original subcategory on: ${restoredCount} products`);
  console.log(`   - Cleared test subcategory on: ${clearedCount} products`);

  // Verify no 'Test Luxury Boxes' remains in database
  const remainingTest = await prisma.product.findMany({
    where: {
      details: {
        path: ['subcategory'],
        equals: 'Test Luxury Boxes'
      }
    }
  });

  console.log(`🔍 Remaining products with 'Test Luxury Boxes': ${remainingTest.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

restoreSubcategories().catch(err => {
  console.error('❌ Restoration failed:', err);
  process.exit(1);
});
