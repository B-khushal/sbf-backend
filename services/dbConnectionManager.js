const { Client, Pool } = require('pg');
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
    this.sourcePool = null;
    this.destPool = null;
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

    const sslMode = sslConfig.mode || url.searchParams.get('sslmode') || 'prefer';
    let ssl = false;

    if (sslConfig.rejectUnauthorized !== undefined) {
      ssl = { rejectUnauthorized: !!sslConfig.rejectUnauthorized };
    } else if (sslMode === 'disable') {
      ssl = false;
    } else if (sslMode === 'require' || sslMode === 'prefer' || url.searchParams.get('ssl') === 'true') {
      // By default for cloud / remote postgres, allow connection with self-signed or CA certs
      ssl = { rejectUnauthorized: false };
    }

    return {
      connectionString: trimmed,
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
      ssl: config.ssl,
      connectionTimeoutMillis: 10000, // 10s timeout
      query_timeout: 60000
    };

    // If read-only is requested (mandatory for SOURCE)
    if (isReadOnly || target === 'source') {
      clientConfig.statement_timeout = 30000;
    }

    return new Client(clientConfig);
  }

  /**
   * Tests connection to either source or destination database
   */
  async testConnection(target, connectionString, sslConfig = {}) {
    const start = Date.now();
    let client = null;

    try {
      const parsed = this.parseConnectionString(connectionString, sslConfig);
      
      client = new Client({
        connectionString: parsed.connectionString,
        ssl: parsed.ssl,
        connectionTimeoutMillis: 10000
      });

      await client.connect();

      // If testing source database, strictly ensure read-only session
      if (target === 'source') {
        await client.query('SET default_transaction_read_only = on;');
      }

      // Collect diagnostic metrics
      const pingRes = await client.query('SELECT 1 as ping');
      const latencyMs = Date.now() - start;

      const [versionRes, dbNameRes, hostRes, tableCountRes, recordCountRes, dbSizeRes] = await Promise.all([
        client.query('SELECT version()'),
        client.query('SELECT current_database() as db_name'),
        client.query('SELECT inet_server_addr() as server_ip, inet_server_port() as server_port'),
        client.query(`
          SELECT count(*)::int as total_tables
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            AND table_type = 'BASE TABLE'
        `),
        client.query(`
          SELECT COALESCE(SUM(reltuples)::bigint, 0) as total_records
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r'
            AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        `),
        client.query(`
          SELECT pg_size_pretty(pg_database_size(current_database())) as pretty_size,
                 pg_database_size(current_database()) as raw_size
        `)
      ]);

      const versionString = versionRes.rows[0]?.version || 'PostgreSQL';
      const versionMatch = versionString.match(/PostgreSQL\s+([\d.]+)/i);
      const pgVersion = versionMatch ? versionMatch[1] : versionString.split(' ')[0];

      return {
        success: true,
        target,
        latencyMs,
        pgVersion,
        fullVersion: versionString,
        databaseName: dbNameRes.rows[0]?.db_name || parsed.database,
        host: parsed.host,
        port: parsed.port,
        serverIp: hostRes.rows[0]?.server_ip || parsed.host,
        totalTables: tableCountRes.rows[0]?.total_tables || 0,
        estimatedRecords: parseInt(recordCountRes.rows[0]?.total_records || '0', 10),
        databaseSize: dbSizeRes.rows[0]?.pretty_size || '0 MB',
        rawDatabaseSize: parseInt(dbSizeRes.rows[0]?.raw_size || '0', 10),
        maskedUrl: maskConnectionString(parsed.connectionString),
        sslActive: !!parsed.ssl,
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
        } catch (e) {
          // ignore cleanup errors
        }
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
    const profile = {
      connectionString: parsed.connectionString,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      ssl: parsed.ssl,
      sslMode: parsed.sslMode,
      diagnostics: testResult,
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

// Export singleton instance
module.exports = new DbConnectionManager();

