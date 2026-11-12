const EventEmitter = require('events');
const dbConnectionManager = require('./dbConnectionManager');
const dbInspectorService = require('./dbInspectorService');
const dbBackupService = require('./dbBackupService');
const dbVerificationService = require('./dbVerificationService');
const dbMigrationHistoryService = require('./dbMigrationHistoryService');
const { sanitizeError } = require('../utils/credentialCrypto');

class DbMigrationEngine extends EventEmitter {
  constructor() {
    super();
    this.activeJob = null;
    this.isPaused = false;
    this.isCancelled = false;
  }

  /**
   * Returns current active job status
   */
  getStatus() {
    if (!this.activeJob) {
      return {
        status: 'idle',
        active: false,
        migrationId: null,
        progress: 0,
        stage: 'idle',
        currentTable: null,
        tablesCompleted: 0,
        totalTables: 0,
        recordsTransferred: 0,
        totalEstimatedRecords: 0,
        transferSpeed: 0,
        elapsedTimeMs: 0,
        estimatedRemainingTimeMs: 0,
        successfulTables: [],
        failedTables: [],
        isPaused: false,
        isCancelled: false,
        recentLogs: []
      };
    }

    const elapsed = Date.now() - this.activeJob.startedAt;
    const speed = elapsed > 0 ? Math.round((this.activeJob.recordsTransferred / (elapsed / 1000))) : 0;
    const remainingRecords = Math.max(0, this.activeJob.totalEstimatedRecords - this.activeJob.recordsTransferred);
    const estimatedRemaining = speed > 0 ? Math.round((remainingRecords / speed) * 1000) : 0;

    return {
      status: this.activeJob.status,
      active: ['running', 'paused', 'starting'].includes(this.activeJob.status),
      migrationId: this.activeJob.migrationId,
      progress: this.activeJob.progress,
      stage: this.activeJob.stage,
      currentTable: this.activeJob.currentTable,
      tablesCompleted: this.activeJob.tablesCompleted,
      totalTables: this.activeJob.tables.length,
      recordsTransferred: this.activeJob.recordsTransferred,
      totalEstimatedRecords: this.activeJob.totalEstimatedRecords,
      transferSpeed: speed,
      elapsedTimeMs: elapsed,
      estimatedRemainingTimeMs: estimatedRemaining,
      successfulTables: this.activeJob.successfulTables,
      failedTables: this.activeJob.failedTables,
      isPaused: this.isPaused,
      isCancelled: this.isCancelled,
      recentLogs: this.activeJob.logs.slice(-100)
    };
  }

  /**
   * Logs a message to memory, history file, and emits SSE event
   */
  log(message, type = 'info') {
    if (!this.activeJob) return;
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    this.activeJob.logs.push(logEntry);
    if (this.activeJob.logs.length > 500) {
      this.activeJob.logs.shift();
    }

    dbMigrationHistoryService.appendLog(this.activeJob.migrationId, `[${type.toUpperCase()}] ${message}`);
    this.emit('progress', this.getStatus());
  }

  /**
   * Pause current migration
   */
  pause() {
    if (this.activeJob && this.activeJob.status === 'running') {
      this.isPaused = true;
      this.activeJob.status = 'paused';
      this.log('⏸️ Migration paused by administrator', 'warning');
      this.emit('progress', this.getStatus());
      return true;
    }
    return false;
  }

  /**
   * Resume paused migration
   */
  resume() {
    if (this.activeJob && this.activeJob.status === 'paused') {
      this.isPaused = false;
      this.activeJob.status = 'running';
      this.log('▶️ Migration resumed by administrator', 'info');
      this.emit('progress', this.getStatus());
      return true;
    }
    return false;
  }

  /**
   * Cancel active migration safely
   */
  cancel() {
    if (this.activeJob && ['running', 'paused', 'starting'].includes(this.activeJob.status)) {
      this.isCancelled = true;
      this.activeJob.status = 'cancelling';
      this.log('🛑 Cancellation requested. Finishing current batch and terminating...', 'warning');
      this.emit('progress', this.getStatus());
      return true;
    }
    return false;
  }

  /**
   * Topologically sorts tables based on foreign key dependencies
   */
  _sortTablesByDependencies(tables) {
    const tableMap = new Map(tables.map(t => [t.fullName, t]));
    const visited = new Set();
    const visiting = new Set();
    const sorted = [];

    const visit = (fullName) => {
      if (visited.has(fullName)) return;
      if (visiting.has(fullName)) {
        // Cyclic dependency detected, break cycle gracefully
        return;
      }

      visiting.add(fullName);
      const table = tableMap.get(fullName);

      if (table && Array.isArray(table.foreignKeys)) {
        for (const fk of table.foreignKeys) {
          if (tableMap.has(fk.foreignTable) && fk.foreignTable !== fullName) {
            visit(fk.foreignTable);
          }
        }
      }

      visiting.delete(fullName);
      visited.add(fullName);
      if (table) sorted.push(table);
    };

    for (const t of tables) {
      if (!visited.has(t.fullName)) {
        visit(t.fullName);
      }
    }

    return sorted;
  }

  /**
   * Starts a new migration job
   */
  async startMigration(options = {}) {
    if (this.activeJob && ['running', 'paused', 'starting'].includes(this.activeJob.status)) {
      throw new Error('A migration job is already in progress. Please wait for it to complete or cancel it.');
    }

    const {
      mode = 'complete', // complete | selective | data_only
      selectedTables = [], // list of table fullNames ('public.users')
      conflictStrategy = 'upsert', // upsert | skip | replace | insert
      batchSize = 1000,
      createBackup = true,
      user = null
    } = options;

    const migrationId = `mig_${Date.now()}`;
    this.isPaused = false;
    this.isCancelled = false;

    // 1. Inspect source database to collect table structures and row estimates
    const inspection = await dbInspectorService.inspectDatabase('source', { exactCounts: false });
    if (!inspection.success) {
      throw new Error(`Failed to inspect source database: ${inspection.error}`);
    }

    let tablesToMigrate = [];
    if (mode === 'selective') {
      if (!selectedTables || selectedTables.length === 0) {
        throw new Error('Selective migration mode requires at least one table selected.');
      }
      tablesToMigrate = inspection.tables.filter(t => selectedTables.includes(t.fullName));
    } else {
      tablesToMigrate = inspection.tables;
    }

    if (tablesToMigrate.length === 0) {
      throw new Error('No valid tables found to migrate.');
    }

    // Topological sort by foreign key dependencies
    tablesToMigrate = this._sortTablesByDependencies(tablesToMigrate);

    const totalEstimatedRecords = tablesToMigrate.reduce((acc, t) => acc + t.estimatedRows, 0);

    const sourceProfile = dbConnectionManager.getMaskedProfile('source');
    const destProfile = dbConnectionManager.getMaskedProfile('destination');

    this.activeJob = {
      migrationId,
      status: 'starting',
      stage: 'initializing',
      mode,
      conflictStrategy,
      batchSize: Math.max(100, Math.min(5000, parseInt(batchSize, 10) || 1000)),
      createBackup: !!createBackup,
      tables: tablesToMigrate,
      totalEstimatedRecords,
      recordsTransferred: 0,
      tablesCompleted: 0,
      currentTable: null,
      successfulTables: [],
      failedTables: [],
      progress: 0,
      startedAt: Date.now(),
      logs: [],
      verificationReport: null
    };

    // Record in history
    dbMigrationHistoryService.createMigrationRecord({
      migrationId,
      startedBy: user?.name || user?.email || 'Platform Administrator',
      startedById: user?.id || null,
      sourceIdentifier: `${sourceProfile.host}:${sourceProfile.port}/${sourceProfile.database}`,
      destIdentifier: `${destProfile.host}:${destProfile.port}/${destProfile.database}`,
      migrationType: mode,
      conflictStrategy,
      batchSize: this.activeJob.batchSize,
      tablesSelected: tablesToMigrate.map(t => t.fullName),
      totalEstimatedRecords
    });

    this.log(`🚀 Starting Database Migration [ID: ${migrationId}]`, 'info');
    this.log(`Mode: ${mode.toUpperCase()} | Tables: ${tablesToMigrate.length} | Strategy: ${conflictStrategy} | Batch: ${this.activeJob.batchSize}`, 'info');
    this.log(`Source: ${sourceProfile.maskedUrl}`, 'info');
    this.log(`Destination: ${destProfile.maskedUrl}`, 'info');

    // Run execution asynchronously in background so endpoint returns immediately
    setImmediate(() => {
      this._executeMigrationWorkflow().catch(err => {
        console.error('[DbMigrationEngine] Fatal unhandled error:', err);
      });
    });

    return {
      success: true,
      migrationId,
      status: 'starting',
      totalTables: tablesToMigrate.length,
      estimatedRecords: totalEstimatedRecords
    };
  }

  /**
   * Internal migration workflow runner
   */
  async _executeMigrationWorkflow() {
    let sourceClient = null;
    let destClient = null;

    try {
      this.activeJob.status = 'running';

      // 1. Optional Destination Backup
      if (this.activeJob.createBackup && this.activeJob.conflictStrategy === 'replace') {
        this.activeJob.stage = 'backup';
        this.log('🛡️ Creating destination pre-migration backup...', 'info');
        const backupRes = await dbBackupService.createDestinationBackup(this.activeJob.tables.map(t => t.fullName));
        if (backupRes.success) {
          this.log(`✅ Backup created successfully: ${backupRes.backupId} (${backupRes.fileSizePretty})`, 'info');
        } else {
          this.log(`⚠️ Backup warning: ${backupRes.error}`, 'warning');
        }
      }

      // 2. Connect to both databases
      sourceClient = dbConnectionManager.createClient('source', true);
      destClient = dbConnectionManager.createClient('destination', false);

      sourceClient.on('error', (err) => {
        this.log(`⚠️ Source client connection notice: ${sanitizeError(err)}`, 'warning');
      });
      destClient.on('error', (err) => {
        this.log(`⚠️ Destination client connection notice: ${sanitizeError(err)}`, 'warning');
      });

      await Promise.all([
        sourceClient.connect(),
        destClient.connect()
      ]);

      // STRICT READ-ONLY ON SOURCE
      await sourceClient.query('SET default_transaction_read_only = on;');
      this.log('🔒 Strict Read-Only enforced on Source database', 'info');

      // 3. Schema & Table Structure Creation (for Mode A: Complete)
      if (this.activeJob.mode === 'complete') {
        this.activeJob.stage = 'schema_transfer';
        this.log('🏗️ Transferring schema definitions & table structures...', 'info');
        await this._transferSchemaStructures(sourceClient, destClient);
      }

      // 4. Data Transfer
      this.activeJob.stage = 'data_transfer';
      this.log('🚚 Transferring table records in dependency order...', 'info');

      // Attempt to disable FK triggers temporarily on destination during bulk load if permitted
      let replicationRoleSet = false;
      try {
        await destClient.query("SET session_replication_role = 'replica';");
        replicationRoleSet = true;
        this.log('⚡ Replication role set to replica for high-performance bulk loading', 'info');
      } catch (e) {
        this.log('ℹ️ Standard referential checks active (running in topological dependency order)', 'info');
      }

      const totalTables = this.activeJob.tables.length;

      for (let i = 0; i < totalTables; i++) {
        // Check for pause
        while (this.isPaused && !this.isCancelled) {
          await new Promise(r => setTimeout(r, 500));
        }

        // Check for cancellation
        if (this.isCancelled) {
          this.log('🛑 Migration cancelled by administrator.', 'warning');
          this.activeJob.status = 'cancelled';
          dbMigrationHistoryService.updateMigrationRecord(this.activeJob.migrationId, {
            status: 'cancelled',
            recordsTransferred: this.activeJob.recordsTransferred
          });
          break;
        }

        const table = this.activeJob.tables[i];
        this.activeJob.currentTable = table.fullName;
        this.log(`📦 Processing table [${i + 1}/${totalTables}]: ${table.fullName}`, 'info');

        try {
          const recordsInserted = await this._transferTableData(sourceClient, destClient, table);
          this.activeJob.tablesCompleted++;
          this.activeJob.successfulTables.push(table.fullName);
          this.activeJob.progress = Math.round((this.activeJob.tablesCompleted / totalTables) * 90);
          this.log(`✅ Completed ${table.fullName}: ${recordsInserted} records transferred`, 'info');
          dbMigrationHistoryService.updateMigrationRecord(this.activeJob.migrationId, {
            recordsTransferred: this.activeJob.recordsTransferred,
            durationMs: Date.now() - this.activeJob.startedAt
          });
        } catch (tableErr) {
          const errMsg = sanitizeError(tableErr);
          this.activeJob.failedTables.push({
            table: table.fullName,
            error: errMsg
          });
          this.log(`❌ Failed transferring ${table.fullName}: ${errMsg}`, 'error');
        }

        this.emit('progress', this.getStatus());
      }

      // Restore replication role if modified
      if (replicationRoleSet) {
        try {
          await destClient.query("SET session_replication_role = 'origin';");
        } catch (e) {}
      }

      // 5. Sequence Synchronization
      if (!this.isCancelled) {
        this.activeJob.stage = 'sequence_sync';
        this.log('🔢 Synchronizing PostgreSQL sequences to max IDs...', 'info');
        await this._syncSequences(destClient, this.activeJob.successfulTables);
        this.log('✅ All sequences successfully synchronized', 'info');
      }

      // 6. Post-Migration Verification
      if (!this.isCancelled) {
        this.activeJob.stage = 'verifying';
        this.activeJob.progress = 95;
        this.log('🔍 Executing post-migration data integrity verification...', 'info');

        const verification = await dbVerificationService.verifyMigration(this.activeJob.successfulTables);
        this.activeJob.verificationReport = verification;

        if (verification.overallStatus === 'PASSED') {
          this.log('🎉 Verification PASSED: 100% data integrity verified!', 'info');
          this.activeJob.status = 'completed';
        } else if (verification.overallStatus === 'WARNING') {
          this.log(`⚠️ Verification completed with WARNINGS: ${verification.summary.inconsistenciesCount} minor discrepancies`, 'warning');
          this.activeJob.status = 'completed';
        } else {
          this.log(`❌ Verification FAILED: Detected structural or record discrepancies`, 'error');
          this.activeJob.status = 'failed';
        }

        this.activeJob.progress = 100;
      }

      // Record completion
      dbMigrationHistoryService.updateMigrationRecord(this.activeJob.migrationId, {
        status: this.activeJob.status,
        recordsTransferred: this.activeJob.recordsTransferred,
        verificationReport: this.activeJob.verificationReport,
        errorDetails: this.activeJob.failedTables.length > 0 ? JSON.stringify(this.activeJob.failedTables) : null
      });

      this.log(`🏁 Migration Workflow Finished with status: ${this.activeJob.status.toUpperCase()}`, 'info');
      this.emit('progress', this.getStatus());
    } catch (fatalErr) {
      const errMsg = sanitizeError(fatalErr);
      if (this.activeJob) {
        this.activeJob.status = 'failed';
        this.log(`💥 Fatal migration error: ${errMsg}`, 'error');
        dbMigrationHistoryService.updateMigrationRecord(this.activeJob.migrationId, {
          status: 'failed',
          errorDetails: errMsg
        });
        this.emit('progress', this.getStatus());
      }
    } finally {
      if (sourceClient) try { await sourceClient.end(); } catch (e) {}
      if (destClient) try { await destClient.end(); } catch (e) {}
    }
  }

  /**
   * Resolves introspected Postgres column metadata to valid DDL SQL type string
   */
  _resolvePgColumnType(c) {
    const udt = String(c.udtName || '').toLowerCase();
    const dt = String(c.dataType || '').toLowerCase();

    if (dt === 'array' || udt.startsWith('_')) {
      const baseUdt = udt.startsWith('_') ? udt.slice(1) : udt;
      const baseMap = {
        text: 'TEXT',
        varchar: 'VARCHAR',
        bpchar: 'CHAR',
        int2: 'SMALLINT',
        int4: 'INTEGER',
        int8: 'BIGINT',
        float4: 'REAL',
        float8: 'DOUBLE PRECISION',
        numeric: 'NUMERIC',
        bool: 'BOOLEAN',
        uuid: 'UUID',
        json: 'JSON',
        jsonb: 'JSONB',
        timestamptz: 'TIMESTAMP WITH TIME ZONE',
        timestamp: 'TIMESTAMP',
        date: 'DATE',
      };
      const mapped = baseMap[baseUdt] || baseUdt.toUpperCase() || 'TEXT';
      return `${mapped}[]`;
    }

    if (dt === 'character varying' && c.charMaxLength) {
      return `VARCHAR(${c.charMaxLength})`;
    }
    if ((udt === 'bpchar' || dt === 'character') && c.charMaxLength) {
      return `CHAR(${c.charMaxLength})`;
    }
    if (dt === 'numeric' && c.precision) {
      return `NUMERIC(${c.precision}, ${c.scale || 0})`;
    }
    if (udt === 'text') return 'TEXT';
    if (udt === 'timestamptz') return 'TIMESTAMP WITH TIME ZONE';
    if (udt === 'timestamp') return 'TIMESTAMP';
    if (udt === 'bool') return 'BOOLEAN';
    if (udt === 'jsonb') return 'JSONB';
    if (udt === 'json') return 'JSON';
    if (udt === 'uuid') return 'UUID';
    if (udt === 'int4') return 'INTEGER';
    if (udt === 'int8') return 'BIGINT';
    if (udt === 'int2') return 'SMALLINT';
    if (udt === 'float8') return 'DOUBLE PRECISION';
    if (udt === 'float4') return 'REAL';
    return c.udtName || c.dataType || 'TEXT';
  }

  /**
   * Transfers schema structures and table DDL from source to destination
   */
  async _transferSchemaStructures(sourceClient, destClient) {
    for (const table of this.activeJob.tables) {
      const schema = table.schema;
      const tblName = table.name;

      // 1. Ensure Schema Exists
      await destClient.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);

      // 2. Check if table already exists
      const existRes = await destClient.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      `, [schema, tblName]);

      if (existRes.rowCount === 0) {
        // Construct CREATE TABLE statement based on introspected columns
        if (!table.columns || table.columns.length === 0) {
          continue;
        }

        const colDefs = table.columns.map(c => {
          const typeStr = this._resolvePgColumnType(c);
          let def = `"${c.name}" ${typeStr}`;
          if (!c.isNullable) def += ' NOT NULL';
          if (c.defaultValue && !c.defaultValue.includes('nextval')) {
            def += ` DEFAULT ${c.defaultValue}`;
          }
          return def;
        });

        // Add primary key
        if (Array.isArray(table.primaryKey) && table.primaryKey.length > 0) {
          const pkCols = table.primaryKey.map(p => `"${p}"`).join(', ');
          colDefs.push(`PRIMARY KEY (${pkCols})`);
        }

        const createSql = `CREATE TABLE "${schema}"."${tblName}" (\n  ${colDefs.join(',\n  ')}\n);`;
        await destClient.query(createSql);
        this.log(`  ➕ Created destination table: "${schema}"."${tblName}"`, 'info');
      } else if (Array.isArray(table.columns) && table.columns.length > 0) {
        // Add any columns present in source that do not yet exist in destination
        const destColsRes = await destClient.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
        `, [schema, tblName]);
        const destColSet = new Set(destColsRes.rows.map(r => r.column_name));

        for (const c of table.columns) {
          if (!destColSet.has(c.name)) {
            const typeStr = this._resolvePgColumnType(c);
            let alterSql = `ALTER TABLE "${schema}"."${tblName}" ADD COLUMN IF NOT EXISTS "${c.name}" ${typeStr}`;
            if (c.defaultValue && !c.defaultValue.includes('nextval')) {
              alterSql += ` DEFAULT ${c.defaultValue}`;
            }
            alterSql += ';';
            try {
              await destClient.query(alterSql);
              this.log(`  ➕ Added missing column "${c.name}" to "${schema}"."${tblName}"`, 'info');
            } catch (alterErr) {
              this.log(`  ⚠️ Could not add column "${c.name}" to "${schema}"."${tblName}": ${sanitizeError(alterErr)}`, 'warning');
            }
          }
        }
      }
    }
  }

  /**
   * Serializes a single column value safely for node-postgres parameterized queries
   */
  _serializeParamValue(val, colMeta) {
    if (val === null || val === undefined) return null;

    const udtName = String(colMeta?.udtName || '').toLowerCase();
    const dataType = String(colMeta?.dataType || '').toLowerCase();

    // JSON / JSONB columns: pg automatically parses JSON values on read (including
    // scalar strings, numbers, booleans, arrays, objects), so we must always JSON.stringify
    // before writing back to a json/jsonb column.
    if (udtName === 'json' || udtName === 'jsonb' || dataType === 'json' || dataType === 'jsonb') {
      return JSON.stringify(val);
    }

    // PostgreSQL ARRAY columns (e.g., TEXT[], VARCHAR[], INT[]):
    // Pass native JS arrays directly so node-postgres encodes PG array literals properly
    // instead of converting them into JSON strings like '["a","b"]'.
    if (dataType === 'array' || udtName.startsWith('_')) {
      let arrVal = val;
      if (typeof arrVal === 'string') {
        const trimmed = arrVal.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) arrVal = parsed;
          } catch (e) {}
        }
      }
      if (Array.isArray(arrVal)) {
        if (udtName === '_json' || udtName === '_jsonb') {
          return arrVal.map(el => (el === null || el === undefined ? null : JSON.stringify(el)));
        }
        return arrVal;
      }
      return arrVal;
    }

    if (typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
      if (typeof val.toPostgres === 'function') {
        return val.toPostgres();
      }
      return JSON.stringify(val);
    }

    return val;
  }

  /**
   * Transfers rows for a single table in streaming batches
   */
  async _transferTableData(sourceClient, destClient, table) {
    const schema = table.schema;
    const tblName = table.name;
    const batchSize = this.activeJob.batchSize;
    const strategy = this.activeJob.conflictStrategy;

    // Optional Replace strategy: truncate destination table before insert
    if (strategy === 'replace') {
      try {
        await destClient.query(`TRUNCATE TABLE "${schema}"."${tblName}" CASCADE;`);
        this.log(`  🗑️ Truncated destination table "${schema}"."${tblName}"`, 'info');
      } catch (truncErr) {
        this.log(`  ⚠️ Truncate note: ${sanitizeError(truncErr)}`, 'warning');
      }
    }

    // Determine primary key columns for conflict resolution
    const pkCols = Array.isArray(table.primaryKey) && table.primaryKey.length > 0 ? table.primaryKey : null;

    let offset = 0;
    let totalTransferredForTable = 0;
    let hasMore = true;

    // Intersect source columns with destination columns to guard against schema drift in data_only mode
    const sourceCols = table.columns || [];
    if (sourceCols.length === 0) return 0;

    let colNames = sourceCols.map(c => c.name);
    const colMetaMap = new Map(sourceCols.map(c => [c.name, c]));

    try {
      const destColsRes = await destClient.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
      `, [schema, tblName]);
      if (destColsRes.rowCount > 0) {
        const destColSet = new Set(destColsRes.rows.map(r => r.column_name));
        const filteredCols = colNames.filter(name => destColSet.has(name));
        if (filteredCols.length < colNames.length) {
          const skipped = colNames.filter(name => !destColSet.has(name));
          this.log(`  ⚠️ Skipping columns absent in destination "${schema}"."${tblName}": ${skipped.join(', ')}`, 'warning');
        }
        colNames = filteredCols;
      }
    } catch (colErr) {
      // Fallback to source columns
    }

    if (colNames.length === 0) return 0;

    const quotedCols = colNames.map(c => `"${c}"`).join(', ');

    // Order by primary key or first column for deterministic batch pagination
    const orderByCol = pkCols && pkCols[0] ? `"${pkCols[0]}"` : `"${colNames[0]}"`;

    while (hasMore) {
      if (this.isCancelled) break;
      while (this.isPaused && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 500));
      }

      // Query batch from SOURCE (Strictly Read-Only)
      const querySql = `
        SELECT ${quotedCols}
        FROM "${schema}"."${tblName}"
        ORDER BY ${orderByCol} ASC
        LIMIT ${batchSize} OFFSET ${offset};
      `;

      const sourceBatch = await sourceClient.query(querySql);
      const rows = sourceBatch.rows;

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      // Insert rows into DESTINATION
      await this._insertBatchIntoDestination(destClient, schema, tblName, colNames, colMetaMap, rows, pkCols, strategy);

      totalTransferredForTable += rows.length;
      this.activeJob.recordsTransferred += rows.length;
      offset += rows.length;

      if (rows.length < batchSize) {
        hasMore = false;
      }

      this.emit('progress', this.getStatus());
    }

    return totalTransferredForTable;
  }

  /**
   * Generates and executes batch INSERT/UPSERT on destination
   */
  async _insertBatchIntoDestination(destClient, schema, tblName, colNames, colMetaMap, rows, pkCols, strategy) {
    if (rows.length === 0) return;

    // Respect PostgreSQL's 65,535 bind parameter limit by chunking wide tables safely
    const maxRowsPerQuery = Math.max(1, Math.floor(30000 / Math.max(1, colNames.length)));

    for (let start = 0; start < rows.length; start += maxRowsPerQuery) {
      const chunk = rows.slice(start, start + maxRowsPerQuery);

      const valuePlaceholders = [];
      const flatParams = [];
      let paramIndex = 1;

      for (const row of chunk) {
        const rowPlaceholders = [];
        for (const col of colNames) {
          rowPlaceholders.push(`$${paramIndex++}`);
          const colMeta = colMetaMap.get(col);
          flatParams.push(this._serializeParamValue(row[col], colMeta));
        }
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const quotedCols = colNames.map(c => `"${c}"`).join(', ');
      let insertSql = `INSERT INTO "${schema}"."${tblName}" (${quotedCols}) VALUES \n  ${valuePlaceholders.join(',\n  ')}`;

      // Conflict strategy
      const validPkCols = pkCols && pkCols.filter(p => colNames.includes(p));
      if (strategy === 'upsert' && validPkCols && validPkCols.length > 0) {
        const quotedPk = validPkCols.map(p => `"${p}"`).join(', ');
        const updateCols = colNames
          .filter(c => !validPkCols.includes(c))
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');

        if (updateCols.length > 0) {
          insertSql += `\nON CONFLICT (${quotedPk}) DO UPDATE SET ${updateCols};`;
        } else {
          insertSql += `\nON CONFLICT (${quotedPk}) DO NOTHING;`;
        }
      } else if (strategy === 'skip' && validPkCols && validPkCols.length > 0) {
        const quotedPk = validPkCols.map(p => `"${p}"`).join(', ');
        insertSql += `\nON CONFLICT (${quotedPk}) DO NOTHING;`;
      } else {
        insertSql += ';';
      }

      // Execute with automatic retry on transient error
      let attempts = 0;
      while (attempts < 3) {
        try {
          await destClient.query(insertSql, flatParams);
          break;
        } catch (err) {
          attempts++;
          if (attempts >= 3) {
            throw err;
          }
          await new Promise(r => setTimeout(r, 500 * attempts));
        }
      }
    }
  }

  /**
   * Resets sequences to match max(id) on destination
   */
  async _syncSequences(destClient, tableList) {
    for (const fullTableName of tableList) {
      const parts = fullTableName.split('.');
      const schema = parts.length === 2 ? parts[0] : 'public';
      const tblName = parts.length === 2 ? parts[1] : parts[0];

      try {
        const seqRes = await destClient.query(`
          SELECT 
            c.column_name,
            pg_get_serial_sequence($1, c.column_name) as seq_name
          FROM information_schema.columns c
          WHERE c.table_schema = $2 AND c.table_name = $3
            AND pg_get_serial_sequence($1, c.column_name) IS NOT NULL;
        `, [`"${schema}"."${tblName}"`, schema, tblName]);

        for (const row of seqRes.rows) {
          if (row.seq_name) {
            await destClient.query(`
              SELECT setval(
                $1, 
                COALESCE((SELECT MAX("${row.column_name}") FROM "${schema}"."${tblName}"), 1),
                true
              );
            `, [row.seq_name]);
          }
        }
      } catch (e) {
        // Not a fatal issue if some tables don't have sequences
      }
    }
  }
}

// Export singleton instance
module.exports = new DbMigrationEngine();

