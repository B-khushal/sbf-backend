const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const dbConnectionManager = require('./dbConnectionManager');
const { sanitizeError } = require('../utils/credentialCrypto');

const BACKUP_DIR = path.join(__dirname, '../data/backups');

class DbBackupService {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * Creates a snapshot backup of destination tables before destructive migration
   */
  async createDestinationBackup(tables = []) {
    let client = null;
    const backupId = `dest_backup_${Date.now()}`;
    const filePath = path.join(BACKUP_DIR, `${backupId}.json.gz`);

    try {
      this._ensureDir();
      client = dbConnectionManager.createClient('destination');
      await client.connect();

      // If no tables specified, fetch all user tables
      let targetTables = tables;
      if (!targetTables || targetTables.length === 0) {
        const tblRes = await client.query(`
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            AND table_type = 'BASE TABLE'
        `);
        targetTables = tblRes.rows.map(r => `${r.table_schema}.${r.table_name}`);
      }

      const backupData = {
        backupId,
        createdAt: new Date().toISOString(),
        tables: []
      };

      let totalRecords = 0;

      for (const fullTableName of targetTables) {
        const parts = fullTableName.split('.');
        const schema = parts.length === 2 ? parts[0] : 'public';
        const table = parts.length === 2 ? parts[1] : parts[0];

        try {
          const rowsRes = await client.query(`SELECT * FROM "${schema}"."${table}" LIMIT 50000`);
          backupData.tables.push({
            schema,
            table,
            fullName: fullTableName,
            rowCount: rowsRes.rows.length,
            rows: rowsRes.rows
          });
          totalRecords += rowsRes.rows.length;
        } catch (tblErr) {
          console.warn(`[DbBackupService] Skipping backup of ${fullTableName}: ${tblErr.message}`);
        }
      }

      // Compress and save
      const jsonStr = JSON.stringify(backupData);
      const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'));
      fs.writeFileSync(filePath, compressed);

      // Clean old backups (keep 5 newest)
      this.cleanupOldBackups(5);

      const stats = fs.statSync(filePath);

      return {
        success: true,
        backupId,
        filePath,
        fileSizeBytes: stats.size,
        fileSizePretty: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        totalTables: backupData.tables.length,
        totalRecords,
        createdAt: backupData.createdAt
      };
    } catch (err) {
      return {
        success: false,
        error: sanitizeError(err)
      };
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (e) {}
      }
    }
  }

  /**
   * Lists available destination backups
   */
  listBackups() {
    this._ensureDir();
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz'));
      return files.map(file => {
        const fPath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(fPath);
        return {
          filename: file,
          backupId: file.replace('.json.gz', ''),
          sizeBytes: stats.size,
          sizePretty: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          createdAt: stats.birthtime
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return [];
    }
  }

  /**
   * Retains only the most recent N backups
   */
  cleanupOldBackups(retainCount = 5) {
    try {
      const backups = this.listBackups();
      if (backups.length > retainCount) {
        const toDelete = backups.slice(retainCount);
        for (const b of toDelete) {
          const p = path.join(BACKUP_DIR, b.filename);
          if (fs.existsSync(p)) {
            fs.unlinkSync(p);
          }
        }
      }
    } catch (e) {
      console.warn('[DbBackupService] Cleanup error:', e.message);
    }
  }
}

module.exports = new DbBackupService();

