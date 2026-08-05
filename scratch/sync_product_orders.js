const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const backupDir = 'D:\\SBF\\mongodb_backup\\test';

async function syncProductOrders() {
  console.log('🚀 Syncing product section orders & sorting preferences from backup...');
  
  const productsBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'products.json'), 'utf8'));
  console.log('Loaded products from backup:', productsBackup.length);

  let updatedProductsCount = 0;

  for (const p of productsBackup) {
    const id = (p._id && p._id.$oid) ? p._id.$oid : (p._id || p.id);
    if (!id) continue;

    const displayOrders = p.displayOrders || {};
    const isFeatured = p.isFeatured === true;
    const isBestseller = p.isBestseller === true;
    const isNewArrival = p.isNewArrival === true || p.isNew === true;
    const isVisible = p.hidden !== true && p.isVisible !== false;
    const sameDay = p.sameDay !== false;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (existing) {
        const details = (existing.details && typeof existing.details === 'object') ? existing.details : {};
        details.displayOrders = displayOrders;
        details.sameDay = sameDay;

        await prisma.product.update({
          where: { id },
          data: {
            isFeatured,
            isBestseller,
            isNewArrival,
            isVisible,
            details
          }
        });
        updatedProductsCount++;
      }
    } catch (err) {
      console.error('Error updating product order for ID:', id, err.message);
    }
  }

  console.log('✅ Successfully updated section display orders for', updatedProductsCount, 'products!');

  const prefsBackupPath = path.join(backupDir, 'sectionsortingpreferences.json');
  if (fs.existsSync(prefsBackupPath)) {
    const prefsBackup = JSON.parse(fs.readFileSync(prefsBackupPath, 'utf8'));
    console.log('Loaded section sorting preferences from backup:', prefsBackup.length);

    for (const pref of prefsBackup) {
      const prefId = (pref._id && pref._id.$oid) ? pref._id.$oid : (pref._id || `pref_${pref.section || pref.page || 'home'}`);
      const page = pref.section || pref.page || 'home';
      const rawData = {
        section: page,
        sortBy: pref.sortBy || 'custom',
        sortDirection: pref.sortDirection || 'asc',
        sequence: pref.sequence || {}
      };

      try {
        await prisma.sectionSortingPreference.upsert({
          where: { id: prefId },
          update: {
            page,
            preferences: rawData
          },
          create: {
            id: prefId,
            page,
            preferences: rawData
          }
        });
        console.log('✅ Restored section preference for:', page);
      } catch (prefErr) {
        console.error('Error restoring section preference:', prefErr.message);
      }
    }
  }
}

syncProductOrders()
  .then(() => {
    console.log('🎉 Product Section Order Sync Completed Successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
