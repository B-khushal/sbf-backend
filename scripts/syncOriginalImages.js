const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

async function syncOriginalImages() {
  console.log('🔄 Syncing unwatermarked original images to PostgreSQL Product.details...');

  const backupPath = path.join(__dirname, '../../mongodb_backup/test/products.json');
  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found at:', backupPath);
    return;
  }

  const raw = fs.readFileSync(backupPath, 'utf8');
  const backupProducts = JSON.parse(raw);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const bp of backupProducts) {
    if (!Array.isArray(bp.originalImages) || bp.originalImages.length === 0) {
      continue;
    }

    // Match in PostgreSQL by id, slug, or name
    const whereConditions = [];
    if (bp._id) whereConditions.push({ id: bp._id });
    if (bp.slug) whereConditions.push({ slug: bp.slug });
    if (bp.title) whereConditions.push({ name: bp.title });

    if (whereConditions.length === 0) continue;

    const dbProduct = await prisma.product.findFirst({
      where: {
        OR: whereConditions
      }
    });

    if (!dbProduct) {
      skippedCount++;
      continue;
    }

    const currentDetails = (dbProduct.details && typeof dbProduct.details === 'object') ? dbProduct.details : {};
    
    // Check if already has originalImages
    if (Array.isArray(currentDetails.originalImages) && currentDetails.originalImages.length > 0) {
      continue;
    }

    await prisma.product.update({
      where: { id: dbProduct.id },
      data: {
        details: {
          ...currentDetails,
          originalImages: bp.originalImages
        }
      }
    });

    updatedCount++;
  }

  console.log(`✅ Successfully synced ${updatedCount} products with unwatermarked originalImages. (Skipped/Missing: ${skippedCount})`);
}

syncOriginalImages()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
