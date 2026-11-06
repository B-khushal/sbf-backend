const fs = require('fs');
const path = require('path');

const HISTORY_FILE_PATH = path.join(__dirname, '../data/migration_history.json');
const LOGS_DIR = path.join(__dirname, '../data/migration_logs');

class DbMigrationHistoryService {
  constructor() {
    this._ensureDirs();
  }

  _ensureDirs() {
    const dataDir = path.dirname(HISTORY_FILE_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  _loadHistory() {
    this._ensureDirs();
    try {
      if (fs.existsSync(HISTORY_FILE_PATH)) {
        const raw = fs.readFileSync(HISTORY_FILE_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DbMigrationHistoryService] Failed reading history file:', e.message);
    }
    return [];
  }

  _saveHistory(history) {
    this._ensureDirs();
    try {
      fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
      console.error('[DbMigrationHistoryService] Failed saving history file:', e.message);
    }
  }

  /**
   * Records initiation of a migration run
   */
  createMigrationRecord(data) {
    const history = this._loadHistory();
    const record = {
      migrationId: data.migrationId || `mig_${Date.now()}`,
      startedBy: data.startedBy || 'Platform Administrator',
      startedById: data.startedById || null,
      sourceIdentifier: data.sourceIdentifier || 'Source DB',
      destIdentifier: data.destIdentifier || 'Destination DB',
      migrationType: data.migrationType || 'complete', // complete | selective | data_only
      conflictStrategy: data.conflictStrategy || 'upsert',
      batchSize: data.batchSize || 1000,
      tablesSelected: data.tablesSelected || [],
      totalEstimatedRecords: data.totalEstimatedRecords || 0,
      recordsTransferred: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: 0,
      status: 'in_progress', // in_progress | paused | completed | failed | cancelled
      errorDetails: null,
      verificationReport: null,
      hasLogs: true
    };

    history.unshift(record);
    // Keep last 100 runs
    if (history.length > 100) history.pop();
    this._saveHistory(history);
    return record;
  }

  /**
   * Updates an existing migration record
   */
  updateMigrationRecord(migrationId, updates) {
    const history = this._loadHistory();
    const index = history.findIndex(h => h.migrationId === migrationId);
    if (index !== -1) {
      history[index] = {
        ...history[index],
        ...updates
      };
      if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
        history[index].completedAt = updates.completedAt || new Date().toISOString();
        if (history[index].startedAt) {
          history[index].durationMs = new Date(history[index].completedAt).getTime() - new Date(history[index].startedAt).getTime();
        }
      }
      this._saveHistory(history);
      return history[index];
    }
    return null;
  }

  /**
   * Appends log messages to migration log file on disk
   */
  appendLog(migrationId, logLine) {
    this._ensureDirs();
    try {
      const logFile = path.join(LOGS_DIR, `${migrationId}.log`);
      const formatted = `[${new Date().toISOString()}] ${logLine}\n`;
      fs.appendFileSync(logFile, formatted, 'utf8');
    } catch (e) {
      // ignore log write errors
    }
  }

  /**
   * Returns log file content for a migration
   */
  getMigrationLogs(migrationId) {
    this._ensureDirs();
    const logFile = path.join(LOGS_DIR, `${migrationId}.log`);
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf8');
    }
    return 'No log records found for this migration run.';
  }

  /**
   * Lists all past migration runs
   */
  getHistory() {
    return this._loadHistory();
  }

  /**
   * Gets single migration run details
   */
  getMigrationDetails(migrationId) {
    const history = this._loadHistory();
    return history.find(h => h.migrationId === migrationId) || null;
  }

  /**
   * Deletes a migration record and its log file
   */
  deleteMigrationRecord(migrationId) {
    let history = this._loadHistory();
    history = history.filter(h => h.migrationId !== migrationId);
    this._saveHistory(history);

    const logFile = path.join(LOGS_DIR, `${migrationId}.log`);
    if (fs.existsSync(logFile)) {
      try { fs.unlinkSync(logFile); } catch (e) {}
    }
    return true;
  }
}

module.exports = new DbMigrationHistoryService();

