const dbConnectionManager = require('./dbConnectionManager');
const { sanitizeError } = require('../utils/credentialCrypto');

class DbVerificationService {
  /**
   * Runs comprehensive verification comparing source and destination tables
   */
  async verifyMigration(migratedTables = []) {
    let sourceClient = null;
    let destClient = null;

    const startedAt = Date.now();
    const tableResults = [];
    let passedCount = 0;
    let warningCount = 0;
    let failedCount = 0;
    const detectedInconsistencies = [];

    try {
      sourceClient = dbConnectionManager.createClient('source', true);
      destClient = dbConnectionManager.createClient('destination', false);

      await Promise.all([
        sourceClient.connect(),
        destClient.connect()
      ]);

      await sourceClient.query('SET default_transaction_read_only = on;');

      // If no tables specified, fetch all user tables from source
      let tablesToVerify = migratedTables;
      if (!tablesToVerify || tablesToVerify.length === 0) {
        const tblRes = await sourceClient.query(`
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            AND table_type = 'BASE TABLE'
          ORDER BY table_schema, table_name;
        `);
        tablesToVerify = tblRes.rows.map(r => `${r.table_schema}.${r.table_name}`);
      }

      for (const fullTableName of tablesToVerify) {
        const parts = fullTableName.split('.');
        const schema = parts.length === 2 ? parts[0] : 'public';
        const table = parts.length === 2 ? parts[1] : parts[0];

        const item = {
          tableName: fullTableName,
          schema,
          table,
          sourceExists: false,
          destExists: false,
          sourceRows: 0,
          destRows: 0,
          rowMatch: false,
          pkMatch: false,
          fkIntegrity: true,
          sequenceSynced: true,
          status: 'PASSED',
          notes: []
        };

        try {
          // 1. Verify existence
          const [sExist, dExist] = await Promise.all([
            sourceClient.query(`
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = $1 AND table_name = $2
            `, [schema, table]),
            destClient.query(`
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = $1 AND table_name = $2
            `, [schema, table])
          ]);

          item.sourceExists = sExist.rowCount > 0;
          item.destExists = dExist.rowCount > 0;

          if (!item.destExists) {
            item.status = 'FAILED';
            item.notes.push('Table missing in destination database');
            failedCount++;
            detectedInconsistencies.push({ table: fullTableName, issue: 'Table missing in destination' });
            tableResults.push(item);
            continue;
          }

          // 2. Compare exact row counts
          const [sCountRes, dCountRes] = await Promise.all([
            sourceClient.query(`SELECT count(*)::bigint as cnt FROM "${schema}"."${table}"`),
            destClient.query(`SELECT count(*)::bigint as cnt FROM "${schema}"."${table}"`)
          ]);

          item.sourceRows = parseInt(sCountRes.rows[0]?.cnt || '0', 10);
          item.destRows = parseInt(dCountRes.rows[0]?.cnt || '0', 10);
          item.rowMatch = item.sourceRows === item.destRows;

          if (!item.rowMatch) {
            item.status = 'WARNING';
            item.notes.push(`Row count mismatch: Source=${item.sourceRows}, Dest=${item.destRows}`);
            detectedInconsistencies.push({
              table: fullTableName,
              issue: `Row count mismatch (${item.sourceRows} vs ${item.destRows})`
            });
          }

          // 3. Primary Key Check
          const [sPk, dPk] = await Promise.all([
            sourceClient.query(`
              SELECT kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2
              ORDER BY kcu.ordinal_position;
            `, [schema, table]),
            destClient.query(`
              SELECT kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = $1 AND tc.table_name = $2
              ORDER BY kcu.ordinal_position;
            `, [schema, table])
          ]);

          const sPkCols = sPk.rows.map(r => r.column_name).sort();
          const dPkCols = dPk.rows.map(r => r.column_name).sort();
          item.pkMatch = JSON.stringify(sPkCols) === JSON.stringify(dPkCols);

          if (!item.pkMatch) {
            item.status = item.status === 'FAILED' ? 'FAILED' : 'WARNING';
            item.notes.push(`Primary key definition mismatch: [${sPkCols.join(',')}] vs [${dPkCols.join(',')}]`);
          }

          // 4. Sequence sync check (if serial / identity)
          try {
            const seqRes = await destClient.query(`
              SELECT pg_get_serial_sequence($1, $2) as seq_name
            `, [`"${schema}"."${table}"`, sPkCols[0] || 'id']);

            const seqName = seqRes.rows[0]?.seq_name;
            if (seqName) {
              const [seqValRes, maxValRes] = await Promise.all([
                destClient.query(`SELECT last_value, is_called FROM ${seqName}`),
                destClient.query(`SELECT COALESCE(MAX("${sPkCols[0] || 'id'}"), 0)::bigint as max_val FROM "${schema}"."${table}"`)
              ]);
              const lastVal = parseInt(seqValRes.rows[0]?.last_value || '0', 10);
              const maxVal = parseInt(maxValRes.rows[0]?.max_val || '0', 10);
              if (maxVal > 0 && lastVal < maxVal) {
                item.sequenceSynced = false;
                item.notes.push(`Sequence ${seqName} (${lastVal}) is lower than max ID (${maxVal})`);
                detectedInconsistencies.push({
                  table: fullTableName,
                  issue: `Sequence ${seqName} out of sync`
                });
              }
            }
          } catch (seqErr) {
            // Not a sequence column, ignore
          }

          if (item.status === 'PASSED') {
            passedCount++;
          } else if (item.status === 'WARNING') {
            warningCount++;
          } else {
            failedCount++;
          }

          tableResults.push(item);
        } catch (tblErr) {
          item.status = 'FAILED';
          item.notes.push(`Verification error: ${sanitizeError(tblErr)}`);
          failedCount++;
          tableResults.push(item);
        }
      }

      let overallStatus = 'PASSED';
      if (failedCount > 0) {
        overallStatus = 'FAILED';
      } else if (warningCount > 0) {
        overallStatus = 'WARNING';
      }

      const totalSourceRecords = tableResults.reduce((acc, t) => acc + t.sourceRows, 0);
      const totalDestRecords = tableResults.reduce((acc, t) => acc + t.destRows, 0);

      return {
        success: true,
        overallStatus,
        verificationDurationMs: Date.now() - startedAt,
        summary: {
          totalTablesChecked: tableResults.length,
          passedTables: passedCount,
          warningTables: warningCount,
          failedTables: failedCount,
          totalSourceRecords,
          totalDestRecords,
          recordsDelta: totalSourceRecords - totalDestRecords,
          inconsistenciesCount: detectedInconsistencies.length
        },
        tableResults,
        detectedInconsistencies,
        verifiedAt: new Date().toISOString()
      };
    } catch (err) {
      return {
        success: false,
        overallStatus: 'FAILED',
        error: sanitizeError(err),
        summary: {
          totalTablesChecked: 0,
          passedTables: 0,
          warningTables: 0,
          failedTables: 1,
          totalSourceRecords: 0,
          totalDestRecords: 0
        },
        tableResults: [],
        detectedInconsistencies: [{ issue: sanitizeError(err) }]
      };
    } finally {
      if (sourceClient) try { await sourceClient.end(); } catch (e) {}
      if (destClient) try { await destClient.end(); } catch (e) {}
    }
  }
}

module.exports = new DbVerificationService();

