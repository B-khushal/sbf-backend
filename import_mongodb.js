const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

async function importDatabase() {
  const targetUri = process.env.IMPORT_MONGODB_URI || process.env.MONGODB_URI;
  if (!targetUri) {
    console.error("No MongoDB URI specified. Please set MONGODB_URI or IMPORT_MONGODB_URI in .env");
    process.exit(1);
  }

  const backupDir = path.join(__dirname, '..', 'mongodb_backup');
  const summaryPath = path.join(backupDir, 'backup_summary.json');

  if (!fs.existsSync(backupDir) || !fs.existsSync(summaryPath)) {
    console.error(`Backup folder or summary file not found at ${backupDir}`);
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  console.log(`Loading backup created at: ${summary.exportDate}`);

  console.log(`Connecting to target MongoDB...`);
  const conn = await mongoose.connect(targetUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...(targetUri.includes('mongodb+srv') ? {
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority'
    } : {})
  });

  const targetDbName = conn.connection.name;
  console.log(`Target Database: ${targetDbName}`);

  for (const [dbName, dbData] of Object.entries(summary.databases)) {
    console.log(`\nImporting data from source database: ${dbName}...`);
    
    for (const [colName, colMeta] of Object.entries(dbData.collections)) {
      const colFilePath = path.join(backupDir, colMeta.file);
      if (!fs.existsSync(colFilePath)) {
        console.warn(`Skipping missing file: ${colFilePath}`);
        continue;
      }

      const docs = JSON.parse(fs.readFileSync(colFilePath, 'utf8'));
      if (!docs || docs.length === 0) {
        console.log(`  - ${colName}: 0 documents, skipping insertion.`);
        continue;
      }

      const collection = conn.connection.db.collection(colName);
      
      // Clear existing collection optionally or upsert/bulk write
      // For clean import, insertMany (ignoring duplicates if any)
      try {
        console.log(`  Importing ${docs.length} documents into '${colName}'...`);
        // Remove _id if needed or keep existing _id
        const result = await collection.insertMany(docs, { ordered: false });
        console.log(`  ✓ Inserted ${result.insertedCount} documents into '${colName}'`);
      } catch (err) {
        if (err.code === 11000 || err.writeErrors) {
          const inserted = err.result?.nInserted || 0;
          console.log(`  ⚠️ Partial import for '${colName}': ${inserted}/${docs.length} documents inserted (some duplicate keys were skipped).`);
        } else {
          console.error(`  ❌ Error importing '${colName}': ${err.message}`);
        }
      }
    }
  }

  console.log('\n✅ Import process completed!');
  await mongoose.disconnect();
  process.exit(0);
}

importDatabase().catch(err => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
