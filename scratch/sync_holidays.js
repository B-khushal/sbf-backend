const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const backupDir = 'D:\\SBF\\mongodb_backup\\test';

async function syncHolidays() {
  console.log('🚀 Syncing holidays from MongoDB backup into PostgreSQL...');
  
  const holidaysBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'holidays.json'), 'utf8'));
  console.log('Loaded holidays from backup:', holidaysBackup.length);

  for (const h of holidaysBackup) {
    const id = (h._id && h._id.$oid) ? h._id.$oid : (h._id || h.id);
    if (!id) continue;

    const title = h.name || h.title || 'Holiday';
    const date = h.date ? new Date(h.date) : new Date();
    const description = h.reason || h.description || null;
    const isRecurring = h.recurring === true || h.isRecurring === true;

    try {
      await prisma.holiday.upsert({
        where: { id },
        update: {
          title,
          date,
          description,
          isRecurring
        },
        create: {
          id,
          title,
          date,
          description,
          isRecurring
        }
      });
      console.log('✅ Synced holiday:', title, '(', date.toISOString().split('T')[0], ')');
    } catch (err) {
      console.error('Error syncing holiday ID:', id, err.message);
    }
  }
}

syncHolidays()
  .then(() => {
    console.log('🎉 Holiday Sync Completed Successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Holiday sync failed:', err);
    process.exit(1);
  });
