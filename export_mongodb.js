const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

async function backupDatabase() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error("MONGODB_URI is not defined in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const conn = await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...(mongoURI.includes('mongodb+srv') ? {
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority'
    } : {})
  });

  const db = conn.connection.db;
  const dbName = conn.connection.name;
  console.log(`Connected to Database: ${dbName}`);

  // Also list all databases accessible
  const adminDb = db.admin();
  let dbList = [];
  try {
    const listDatabasesResult = await adminDb.listDatabases();
    dbList = listDatabasesResult.databases.map(d => d.name);
    console.log("Available databases on cluster:", dbList);
  } catch (err) {
    console.log("Could not list all databases (permission restricted?), backing up current database:", dbName);
    dbList = [dbName];
  }

  // Backup target directory
  const backupBaseDir = path.join(__dirname, '..', 'mongodb_backup');
  if (!fs.existsSync(backupBaseDir)) {
    fs.mkdirSync(backupBaseDir, { recursive: true });
  }

  // Determine databases to backup (non-system dbs with data)
  const dbsToBackup = dbList.filter(d => !['admin', 'local', 'config'].includes(d));
  if (!dbsToBackup.includes(dbName)) {
    dbsToBackup.push(dbName);
  }

  console.log(`Databases to backup: ${dbsToBackup.join(', ')}`);

  const summary = {
    exportDate: new Date().toISOString(),
    mongoURI: mongoURI.replace(/\/\/.*@/, '//***:***@'),
    databases: {}
  };

  for (const targetDbName of dbsToBackup) {
    console.log(`\n--- Backing up database: [${targetDbName}] ---`);
    const currentDb = conn.connection.client.db(targetDbName);
    const collections = await currentDb.listCollections().toArray();
    
    const dbBackupDir = path.join(backupBaseDir, targetDbName);
    if (!fs.existsSync(dbBackupDir)) {
      fs.mkdirSync(dbBackupDir, { recursive: true });
    }

    summary.databases[targetDbName] = {
      collectionsCount: collections.length,
      collections: {}
    };

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const collection = currentDb.collection(colName);
      const docs = await collection.find({}).toArray();
      
      const filePath = path.join(dbBackupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');

      console.log(`  ✓ Exported ${colName}: ${docs.length} documents -> ${filePath}`);
      
      summary.databases[targetDbName].collections[colName] = {
        count: docs.length,
        file: `${targetDbName}/${colName}.json`,
        sizeBytes: fs.statSync(filePath).size
      };
    }
  }

  // Write summary metadata
  const summaryPath = path.join(backupBaseDir, 'backup_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\n✅ Backup finished successfully! Summary saved to: ${summaryPath}`);

  await mongoose.disconnect();
  process.exit(0);
}

backupDatabase().catch(err => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
