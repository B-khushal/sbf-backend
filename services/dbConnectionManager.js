const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const {
  encryptCredential,
  decryptCredential,
  maskConnectionString,
  sanitizeError
} = require('../utils/credentialCrypto');

const CONFIG_STORAGE_PATH = path.join(__dirname, '../data/migration_connections.enc');

class DbConnectionManager {
  constructor() {
    this.sourceConfig = null;
    this.destConfig = null;
    this._loadStoredConfigs();
  }

  /**
   * Loads encrypted configuration from disk if available
   */
  _loadStoredConfigs() {
    try {
      if (fs.existsSync(CONFIG_STORAGE_PATH)) {
        const encryptedData = fs.readFileSync(CONFIG_STORAGE_PATH, 'utf8');
        const json = decryptCredential(encryptedData);
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed.source) this.sourceConfig = parsed.source;
          if (parsed.destination) this.destConfig = parsed.destination;
        }
      }
    } catch (err) {
      console.warn('[DbConnectionManager] Could not load stored configs:', err.message);
    }
  }

  /**
   * Persists configs encrypted to disk
   */
  _saveConfigs() {
    try {
      const dir = path.dirname(CONFIG_STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const dataToSave = JSON.stringify({
        source: this.sourceConfig,
        destination: this.destConfig,
        updatedAt: new Date().toISOString()
      });
      const encrypted = encryptCredential(dataToSave);
      fs.writeFileSync(CONFIG_STORAGE_PATH, encrypted, 'utf8');
    } catch (err) {
      console.error('[DbConnectionManager] Failed to save encrypted configs:', err.message);
    }
  }

  /**
   * Parses and validates a PostgreSQL connection string
   */
  parseConnectionString(connectionString, sslConfig = {}) {
    if (!connectionString || typeof connectionString !== 'string') {
      throw new Error('Connection URL is required');
    }

    const trimmed = connectionString.trim();
    if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
      throw new Error('Invalid connection URL. Must begin with postgresql:// or postgres://');
    }

    let url;
    try {
      url = new URL(trimmed);
    } catch (err) {
      throw new Error('Malformed PostgreSQL URL structure: ' + err.message);
    }

    const urlSslMode = url.searchParams.get('sslmode');
    const urlSsl = url.searchParams.get('ssl');
    const sslMode = sslConfig.mode || urlSslMode || (url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? 'disable' : 'prefer');

    let ssl = false;
    if (sslMode === 'disable' || urlSsl === 'false') {
      ssl = false;
      // Remove sslmode from URL so pg does not override ssl: false
      url.searchParams.delete('sslmode');
      url.searchParams.delete('ssl');
    } else if (sslMode === 'require' || sslMode === 'prefer' || urlSsl === 'true') {
      ssl = {
        rejectUnauthorized: sslConfig.rejectUnauthorized === true
      };
    }

    return {
      connectionString: url.toString(),
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username || 'postgres'),
      ssl,
      sslMode
    };
  }

  /**
   * Creates a dedicated pg.Client for testing or querying
   */
  createClient(target = 'source', isReadOnly = false) {
    const config = target === 'source' ? this.sourceConfig : this.destConfig;
    if (!config || !config.connectionString) {
      throw new Error(`${target.toUpperCase()} database connection is not configured.`);
    }

    const clientConfig = {
      connectionString: config.connectionString,
      ssl: config.ssl ? config.ssl : false,
      connectionTimeoutMillis: 15000, // 15s timeout
      query_timeout: 120000
    };

    if (isReadOnly || target === 'source') {
      clientConfig.statement_timeout = 60000;
    }

    return new Client(clientConfig);
  }

  /**
   * Connects a client with automatic fallback from SSL to non-SSL if the server does not support SSL
   */
  async _connectWithFallback(parsed) {
    let client = new Client({
      connectionString: parsed.connectionString,
      ssl: parsed.ssl,
      connectionTimeoutMillis: 10000
    });

    try {
      await client.connect();
      return { client, effectiveSsl: parsed.ssl, effectiveSslMode: parsed.ssl ? parsed.sslMode : 'disable' };
    } catch (err) {
      try { await client.end(); } catch (e) {}

      // If SSL failed because the PostgreSQL server does not support SSL connections, automatically fall back to non-SSL
      const msg = (err && err.message) ? err.message : '';
      if (parsed.ssl && /does not support SSL|SSL|handshake/i.test(msg)) {
        const cleanUrl = new URL(parsed.connectionString);
        cleanUrl.searchParams.delete('sslmode');
        cleanUrl.searchParams.delete('ssl');
        const cleanConnStr = cleanUrl.toString();

        client = new Client({
          connectionString: cleanConnStr,
          ssl: false,
          connectionTimeoutMillis: 10000
        });
        await client.connect();
        parsed.connectionString = cleanConnStr;
        parsed.ssl = false;
        parsed.sslMode = 'disable';
        return { client, effectiveSsl: false, effectiveSslMode: 'disable' };
      }

      // If destination database does not exist yet on localhost, try auto-creating it
      if (/database ".*" does not exist/i.test(msg)) {
        await this._tryCreateDatabase(parsed);
        client = new Client({
          connectionString: parsed.connectionString,
          ssl: parsed.ssl,
          connectionTimeoutMillis: 10000
        });
        await client.connect();
        return { client, effectiveSsl: parsed.ssl, effectiveSslMode: parsed.ssl ? parsed.sslMode : 'disable' };
      }

      throw err;
    }
  }

  /**
   * Automatically creates the destination database if it does not exist yet
   */
  async _tryCreateDatabase(parsed) {
    const adminUrl = new URL(parsed.connectionString);
    const targetDbName = parsed.database;
    if (!targetDbName || targetDbName === 'postgres') return;

    adminUrl.pathname = '/postgres';
    const adminClient = new Client({
      connectionString: adminUrl.toString(),
      ssl: parsed.ssl,
      connectionTimeoutMillis: 10000
    });

    try {
      await adminClient.connect();
      const SafeDbName = targetDbName.replace(/"/g, '');
      await adminClient.query(`CREATE DATABASE "${SafeDbName}";`);
      console.log(`[DbConnectionManager] Auto-created missing database: ${SafeDbName}`);
    } finally {
      try { await adminClient.end(); } catch (e) {}
    }
  }

  /**
   * Tests connection to either source or destination database
   */
  async testConnection(target, connectionString, sslConfig = {}) {
    const start = Date.now();
    let client = null;

    try {
      const parsed = this.parseConnectionString(connectionString, sslConfig);
      const connRes = await this._connectWithFallback(parsed);
      client = connRes.client;

      // If testing source database, strictly ensure read-only session
      if (target === 'source') {
        await client.query('SET default_transaction_read_only = on;');
      }

      // Collect diagnostic metrics in a single round-trip query
      const pingStart = Date.now();
      const diagRes = await client.query(`
        SELECT
          version() AS full_version,
          current_database() AS db_name,
          inet_server_addr() AS server_ip,
          inet_server_port() AS server_port,
          (
            SELECT count(*)::int
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
              AND table_type = 'BASE TABLE'
          ) AS total_tables,
          (
            SELECT COALESCE(SUM(GREATEST(reltuples, 0))::bigint, 0)
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ) AS total_records,
          pg_size_pretty(pg_database_size(current_database())) AS pretty_size,
          pg_database_size(current_database()) AS raw_size
      `);
      const latencyMs = Date.now() - pingStart;
      const diag = diagRes.rows[0] || {};

      // If pg_class reltuples is 0 (e.g. ANALYZE hasn't run recently) but tables exist, count actual rows across tables
      let estimatedRecords = parseInt(diag.total_records || '0', 10);
      const totalTables = diag.total_tables || 0;
      if (totalTables > 0 && estimatedRecords === 0) {
        try {
          const tbls = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
              AND table_type = 'BASE TABLE'
          `);
          let exactSum = 0;
          for (const r of tbls.rows) {
            const cRes = await client.query(`SELECT count(*)::bigint as cnt FROM "${r.table_schema}"."${r.table_name}"`);
            exactSum += parseInt(cRes.rows[0]?.cnt || '0', 10);
          }
          estimatedRecords = exactSum;
        } catch (e) {}
      }

      const versionString = diag.full_version || 'PostgreSQL';
      const versionMatch = versionString.match(/PostgreSQL\s+([\d.]+)/i);
      const pgVersion = versionMatch ? versionMatch[1] : versionString.split(' ')[0];

      return {
        success: true,
        target,
        latencyMs,
        pgVersion,
        fullVersion: versionString,
        databaseName: diag.db_name || parsed.database,
        host: parsed.host,
        port: parsed.port,
        serverIp: diag.server_ip || parsed.host,
        totalTables,
        estimatedRecords,
        databaseSize: diag.pretty_size || '0 MB',
        rawDatabaseSize: parseInt(diag.raw_size || '0', 10),
        maskedUrl: maskConnectionString(parsed.connectionString),
        sslActive: !!connRes.effectiveSsl,
        effectiveSslMode: connRes.effectiveSslMode,
        effectiveConnectionString: parsed.connectionString,
        effectiveSslConfig: connRes.effectiveSsl,
        readOnlyEnforced: target === 'source',
        testedAt: new Date().toISOString()
      };
    } catch (err) {
      const sanitized = sanitizeError(err);
      return {
        success: false,
        target,
        latencyMs: Date.now() - start,
        error: sanitized,
        testedAt: new Date().toISOString()
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
   * Saves database connection profile
   */
  async saveConnection(target, connectionString, sslConfig = {}) {
    const testResult = await this.testConnection(target, connectionString, sslConfig);
    if (!testResult.success) {
      throw new Error(`Cannot save connection: verification failed. Details: ${testResult.error}`);
    }

    const parsed = this.parseConnectionString(connectionString, sslConfig);
    // Use the verified SSL settings from testResult (in case automatic fallback occurred)
    const effectiveConnString = testResult.effectiveConnectionString || parsed.connectionString;
    const effectiveSsl = testResult.effectiveSslConfig !== undefined ? testResult.effectiveSslConfig : parsed.ssl;
    const effectiveSslMode = testResult.effectiveSslMode || parsed.sslMode;

    // Strip internal fields from public diagnostics
    const publicDiagnostics = { ...testResult };
    delete publicDiagnostics.effectiveConnectionString;
    delete publicDiagnostics.effectiveSslConfig;

    const profile = {
      connectionString: effectiveConnString,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      ssl: effectiveSsl,
      sslMode: effectiveSslMode,
      diagnostics: publicDiagnostics,
      savedAt: new Date().toISOString()
    };

    if (target === 'source') {
      this.sourceConfig = profile;
    } else {
      this.destConfig = profile;
    }

    this._saveConfigs();

    return this.getMaskedProfile(target);
  }

  /**
   * Returns safe masked profile for frontend display (NEVER exposes password)
   */
  getMaskedProfile(target) {
    const config = target === 'source' ? this.sourceConfig : this.destConfig;
    if (!config) {
      return {
        configured: false,
        target,
        maskedUrl: null,
        database: null,
        host: null,
        port: null,
        diagnostics: null
      };
    }

    return {
      configured: true,
      target,
      maskedUrl: maskConnectionString(config.connectionString),
      database: config.database,
      host: config.host,
      port: config.port,
      user: config.user,
      sslActive: !!config.ssl,
      sslMode: config.sslMode,
      savedAt: config.savedAt,
      diagnostics: config.diagnostics || null
    };
  }

  /**
   * Returns raw configuration for backend migration engine only (Never exposed via API)
   */
  getInternalConfig(target) {
    return target === 'source' ? this.sourceConfig : this.destConfig;
  }

  /**
   * Clears stored connection configuration
   */
  clearConnection(target) {
    if (target === 'source') {
      this.sourceConfig = null;
    } else if (target === 'destination') {
      this.destConfig = null;
    }
    this._saveConfigs();
  }
}

module.exports = new DbConnectionManager();
