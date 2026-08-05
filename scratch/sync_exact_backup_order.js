const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const backupDir = 'D:\\SBF\\mongodb_backup\\test';

async function syncExactBackupOrder() {
  console.log('🚀 Syncing exact product timestamps, display orders, and section sequence from MongoDB backup...');

  const productsBackupPath = path.join(backupDir, 'products.json');
  if (!fs.existsSync(productsBackupPath)) {
    console.error('Backup file not found:', productsBackupPath);
    process.exit(1);
  }

  const productsBackup = JSON.parse(fs.readFileSync(productsBackupPath, 'utf8'));
  console.log('Loaded products from backup:', productsBackup.length);

  let updatedCount = 0;

  for (const p of productsBackup) {
    const id = (p._id && p._id.$oid) ? p._id.$oid : (p._id || p.id);
    if (!id) continue;

    const createdAt = p.createdAt ? new Date(p.createdAt) : undefined;
    const updatedAt = p.updatedAt ? new Date(p.updatedAt) : undefined;
    const displayOrders = p.displayOrders || {};
    const isFeatured = p.isFeatured === true;
    const isBestseller = p.isBestseller === true;
    const isNewArrival = p.isNewArrival === true || p.isNew === true;
    const isVisible = p.hidden !== true && p.isVisible !== false;
    const sameDay = p.sameDay !== false;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (existing) {
        const details = (existing.details && typeof existing.details === 'object') ? { ...existing.details } : {};
        details.displayOrders = displayOrders;
        details.sameDay = sameDay;

        await prisma.product.update({
          where: { id },
          data: {
            isFeatured,
            isBestseller,
            isNewArrival,
            isVisible,
            details,
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {})
          }
        });
        updatedCount++;
      }
    } catch (err) {
      console.error('Error syncing product ID:', id, err.message);
    }
  }

  console.log('✅ Successfully updated exact timestamps and display orders for', updatedCount, 'products!');

  // Sync Section Sorting Preferences
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
        console.log('  ✅ Restored section preference for:', page);
      } catch (prefErr) {
        console.error('Error restoring section preference:', prefErr.message);
      }
    }
  }

  // Verification step
  console.log('\n🔍 Verifying sample product ordering...');
  const first3Backup = productsBackup.slice(0, 3).map(p => ({
    id: (p._id && p._id.$oid) ? p._id.$oid : p._id,
    title: p.title,
    createdAt: p.createdAt
  }));
  console.log('Backup First 3 Products:');
  first3Backup.forEach((p, idx) => console.log(`  [${idx + 1}] ${p.title} (${p.id}) | ${p.createdAt}`));

  const first3PG = await prisma.product.findMany({
    where: { isVisible: true },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log('\nPostgreSQL First 3 Products (Newest first):');
  first3PG.forEach((p, idx) => console.log(`  [${idx + 1}] ${p.name} (${p.id}) | ${p.createdAt.toISOString()}`));
}

syncExactBackupOrder()
  .then(() => {
    console.log('\n🎉 Product Order & Timestamp Synchronization Complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
