const dbConnectionManager = require('../services/dbConnectionManager');
const dbInspectorService = require('../services/dbInspectorService');
const dbMigrationEngine = require('../services/dbMigrationEngine');
const dbVerificationService = require('../services/dbVerificationService');
const dbMigrationHistoryService = require('../services/dbMigrationHistoryService');
const { sanitizeError } = require('../utils/credentialCrypto');

/**
 * 1. Overview Dashboard
 */
const getOverview = async (req, res) => {
  try {
    const sourceProfile = dbConnectionManager.getMaskedProfile('source');
    const destProfile = dbConnectionManager.getMaskedProfile('destination');

    const history = dbMigrationHistoryService.getHistory();
    const lastSuccessful = history.find(h => h.status === 'completed');
    const totalRecordsTransferredAllTime = history
      .filter(h => h.status === 'completed')
      .reduce((acc, h) => acc + (h.recordsTransferred || 0), 0);

    const activeJob = dbMigrationEngine.getStatus();

    res.json({
      success: true,
      source: sourceProfile,
      destination: destProfile,
      stats: {
        lastSuccessfulMigration: lastSuccessful ? lastSuccessful.completedAt : null,
        totalMigrationsCount: history.length,
        totalRecordsTransferredAllTime,
        activeJobRunning: activeJob.active
      },
      activeJob
    });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 2. Test Connection
 */
const testConnection = async (req, res) => {
  try {
    const { target, connectionString, sslConfig } = req.body;
    if (!target || !['source', 'destination'].includes(target)) {
      return res.status(400).json({ success: false, error: 'Target must be either "source" or "destination"' });
    }
    if (!connectionString) {
      return res.status(400).json({ success: false, error: 'Connection string is required' });
    }

    const result = await dbConnectionManager.testConnection(target, connectionString, sslConfig);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 3. Save Connection
 */
const saveConnection = async (req, res) => {
  try {
    const { target, connectionString, sslConfig } = req.body;
    if (!target || !['source', 'destination'].includes(target)) {
      return res.status(400).json({ success: false, error: 'Target must be either "source" or "destination"' });
    }
    if (!connectionString) {
      return res.status(400).json({ success: false, error: 'Connection string is required' });
    }

    const savedProfile = await dbConnectionManager.saveConnection(target, connectionString, sslConfig);
    res.json({
      success: true,
      message: `${target.toUpperCase()} database connection successfully tested and securely saved.`,
      profile: savedProfile
    });
  } catch (err) {
    res.status(400).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 4. Get Connection Profiles (Masked)
 */
const getConnections = async (req, res) => {
  try {
    res.json({
      success: true,
      source: dbConnectionManager.getMaskedProfile('source'),
      destination: dbConnectionManager.getMaskedProfile('destination')
    });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 5. Clear Connection
 */
const clearConnection = async (req, res) => {
  try {
    const { target } = req.params;
    dbConnectionManager.clearConnection(target);
    res.json({ success: true, message: `${target} connection cleared.` });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 6. Inspect Database
 */
const inspectDatabase = async (req, res) => {
  try {
    const { target } = req.params;
    const exact = req.query.exact === 'true';

    if (!['source', 'destination'].includes(target)) {
      return res.status(400).json({ success: false, error: 'Target must be "source" or "destination"' });
    }

    const inspection = await dbInspectorService.inspectDatabase(target, { exactCounts: exact });
    if (!inspection.success) {
      return res.status(400).json(inspection);
    }
    res.json(inspection);
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 7. Compare Schemas Side-by-Side
 */
const compareDatabases = async (req, res) => {
  try {
    const exact = req.query.exact === 'true';
    const comparison = await dbInspectorService.compareDatabases({ exactCounts: exact });
    res.json(comparison);
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 8. Preview Migration & Conflicts
 */
const previewMigration = async (req, res) => {
  try {
    const { mode = 'complete', selectedTables = [], conflictStrategy = 'upsert' } = req.body;
    const comparison = await dbInspectorService.compareDatabases({ exactCounts: false });

    if (!comparison.success) {
      return res.status(400).json({ success: false, error: comparison.error });
    }

    let tables = comparison.source?.tables || [];
    if (mode === 'selective' && Array.isArray(selectedTables) && selectedTables.length > 0) {
      tables = tables.filter(t => selectedTables.includes(t.fullName));
    }

    const estimatedTotalRecords = tables.reduce((acc, t) => acc + t.estimatedRows, 0);
    const estimatedTotalBytes = tables.reduce((acc, t) => acc + t.totalBytes, 0);

    // Calculate potential conflicts
    const destinationExistingRecords = comparison.destination?.summary?.totalRecords || 0;
    const willOverwrite = conflictStrategy === 'replace' || conflictStrategy === 'upsert';

    res.json({
      success: true,
      preview: {
        mode,
        conflictStrategy,
        selectedTablesCount: tables.length,
        selectedTables: tables.map(t => ({
          fullName: t.fullName,
          schema: t.schema,
          name: t.name,
          estimatedRows: t.estimatedRows,
          prettySize: t.prettySize,
          existsInDest: !comparison.missingTablesInDest.some(m => m.fullName === t.fullName)
        })),
        estimatedTotalRecords,
        estimatedTotalBytes,
        destinationExistingRecords,
        willOverwrite,
        missingTablesInDest: comparison.missingTablesInDest,
        schemaDifferences: comparison.tableDifferences.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 9. Start Migration
 */
const startMigration = async (req, res) => {
  try {
    const { mode, selectedTables, conflictStrategy, batchSize, createBackup } = req.body;

    const result = await dbMigrationEngine.startMigration({
      mode,
      selectedTables,
      conflictStrategy,
      batchSize,
      createBackup,
      user: req.user
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 10. Pause Migration
 */
const pauseMigration = async (req, res) => {
  try {
    const success = dbMigrationEngine.pause();
    res.json({ success, message: success ? 'Migration paused' : 'Unable to pause' });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 11. Resume Migration
 */
const resumeMigration = async (req, res) => {
  try {
    const success = dbMigrationEngine.resume();
    res.json({ success, message: success ? 'Migration resumed' : 'Unable to resume' });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 12. Cancel Migration
 */
const cancelMigration = async (req, res) => {
  try {
    const success = dbMigrationEngine.cancel();
    res.json({ success, message: success ? 'Migration cancellation requested' : 'Unable to cancel' });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 13. Get Current Migration Status
 */
const getStatus = async (req, res) => {
  try {
    res.json({ success: true, status: dbMigrationEngine.getStatus() });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 14. Server-Sent Events (SSE) Stream
 */
const streamProgress = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(dbMigrationEngine.getStatus())}\n\n`);

  const onProgress = (status) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  dbMigrationEngine.on('progress', onProgress);

  // Heartbeat ping every 15s to keep connection alive through load balancers
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    dbMigrationEngine.off('progress', onProgress);
  });
};

/**
 * 15. Standalone Post-Migration Verification
 */
const verifyMigration = async (req, res) => {
  try {
    const { tables } = req.body;
    const result = await dbVerificationService.verifyMigration(tables || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 16. Get Migration History
 */
const getHistory = async (req, res) => {
  try {
    const history = dbMigrationHistoryService.getHistory();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 17. Get Single Migration Details
 */
const getHistoryDetails = async (req, res) => {
  try {
    const { migrationId } = req.params;
    const details = dbMigrationHistoryService.getMigrationDetails(migrationId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Migration record not found' });
    }
    res.json({ success: true, details });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 18. Download Migration Logs
 */
const getMigrationLogs = async (req, res) => {
  try {
    const { migrationId } = req.params;
    const logs = dbMigrationHistoryService.getMigrationLogs(migrationId);

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${migrationId}.log"`);
      return res.send(logs);
    }

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

/**
 * 19. Delete History Record
 */
const deleteHistory = async (req, res) => {
  try {
    const { migrationId } = req.params;
    dbMigrationHistoryService.deleteMigrationRecord(migrationId);
    res.json({ success: true, message: 'History record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeError(err) });
  }
};

module.exports = {
  getOverview,
  testConnection,
  saveConnection,
  getConnections,
  clearConnection,
  inspectDatabase,
  compareDatabases,
  previewMigration,
  startMigration,
  pauseMigration,
  resumeMigration,
  cancelMigration,
  getStatus,
  streamProgress,
  verifyMigration,
  getHistory,
  getHistoryDetails,
  getMigrationLogs,
  deleteHistory
};

