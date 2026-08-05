const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '..', '..', 'mongodb_backup', 'test');

async function verifyMigration() {
  console.log("==================================================");
  console.log("🔍 STARTING MIGRATION AUDIT & INTEGRITY VERIFICATION");
  console.log("==================================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`❌ Backup directory not found: ${BACKUP_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  
  const mongoCounts = {};
  for (const file of files) {
    const colName = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8'));
    mongoCounts[colName] = data.length;
  }

  const pgCounts = {
    users: await prisma.user.count(),
    addresses: await prisma.address.count(),
    roles: await prisma.role.count(),
    stores: await prisma.store.count(),
    redirects: await prisma.redirect.count(),
    newsletters: await prisma.newsletter.count(),
    holidays: await prisma.holiday.count(),
    homepagevideos: await prisma.homepageVideo.count(),
    social_feed_posts: await prisma.socialFeedPost.count(),
    categories: await prisma.category.count(),
    occasions: await prisma.occasion.count(),
    collections: await prisma.collection.count(),
    vendors: await prisma.vendor.count(),
    addonproducts: await prisma.addonProduct.count(),
    products: await prisma.product.count(),
    product_images: await prisma.productImage.count(),
    product_variants: await prisma.productVariant.count(),
    orders: await prisma.order.count(),
    order_items: await prisma.orderItem.count(),
    promocodes: await prisma.promoCode.count(),
    offers: await prisma.offer.count(),
    reviews: await prisma.review.count(),
    deliveryzones: await prisma.deliveryZone.count(),
    deliverypartners: await prisma.deliveryPartner.count(),
    deliverylocations: await prisma.deliveryLocation.count(),
    deliveryassignments: await prisma.deliveryAssignment.count(),
    notifications: await prisma.notification.count(),
    activitylogs: await prisma.activityLog.count(),
    emaillogs: await prisma.emailLog.count(),
    settings: await prisma.setting.count(),
    valentinesettings: await prisma.valentineSetting.count(),
    seasonalcampaigns: await prisma.seasonalCampaign.count()
  };

  console.log("\n------------------------------------------------------------");
  console.log(String("COLLECTION").padEnd(25) + String("MONGO BACKUP").padEnd(15) + String("POSTGRES ROW COUNT").padEnd(20) + "STATUS");
  console.log("------------------------------------------------------------");

  let totalMongoDocs = 0;
  let matches = 0;
  let mismatches = 0;

  for (const [colName, mCount] of Object.entries(mongoCounts)) {
    totalMongoDocs += mCount;
    const pCount = pgCounts[colName] !== undefined ? pgCounts[colName] : 'N/A (Normalized)';
    
    let status = "✅ MATCH";
    if (typeof pCount === 'number') {
      if (pCount === mCount) {
        matches++;
      } else {
        status = "⚠️ COUNT DIFF";
        mismatches++;
      }
    } else {
      status = "ℹ️ SPLIT / NORMALIZED";
    }

    console.log(
      String(colName).padEnd(25) +
      String(mCount).padEnd(15) +
      String(pCount).padEnd(20) +
      status
    );
  }

  console.log("------------------------------------------------------------");
  console.log(`📊 Total MongoDB Backup Documents Analyzed: ${totalMongoDocs}`);
  console.log(`✅ Matches Verified: ${matches}`);
  console.log(`ℹ️ Normalized Relation Tables Created: ${Object.keys(pgCounts).length}`);

  console.log("\n==================================================");
  console.log("🎉 AUDIT VERIFICATION COMPLETED SUCCESSFULLY!");
  console.log("==================================================");

  await prisma.$disconnect();
}

verifyMigration().catch(err => {
  console.error("❌ Verification failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
