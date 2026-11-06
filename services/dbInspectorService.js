const dbConnectionManager = require('./dbConnectionManager');
const { sanitizeError } = require('../utils/credentialCrypto');

class DbInspectorService {
  /**
   * Introspects full schema of specified database target ('source' or 'destination')
   */
  async inspectDatabase(target = 'source', options = {}) {
    let client = null;
    try {
      client = dbConnectionManager.createClient(target, target === 'source');
      await client.connect();

      if (target === 'source') {
        await client.query('SET default_transaction_read_only = on;');
      }

      // 1. Schemas
      const schemasRes = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name;
      `);
      const schemas = schemasRes.rows.map(r => r.schema_name);

      // 2. Tables with estimated row counts & sizes
      const tablesRes = await client.query(`
        SELECT 
          t.table_schema,
          t.table_name,
          COALESCE(c.reltuples::bigint, 0) AS estimated_rows,
          pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) AS total_bytes,
          pg_size_pretty(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))) AS pretty_size
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
        WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name;
      `);

      // 3. Columns
      const columnsRes = await client.query(`
        SELECT 
          table_schema,
          table_name,
          column_name,
          ordinal_position,
          column_default,
          is_nullable,
          data_type,
          udt_name,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name, ordinal_position;
      `);

      // 4. Primary Keys
      const pkRes = await client.query(`
        SELECT
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position;
      `);

      // 5. Foreign Keys
      const fkRes = await client.query(`
        SELECT
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          tc.constraint_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY tc.table_schema, tc.table_name;
      `);

      // 6. Indexes
      const indexRes = await client.query(`
        SELECT
          schemaname AS table_schema,
          tablename AS table_name,
          indexname AS index_name,
          indexdef AS index_def
        FROM pg_indexes
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename, indexname;
      `);

      // Organize tables and relationships
      const tableMap = new Map();

      for (const t of tablesRes.rows) {
        const fullKey = `${t.table_schema}.${t.table_name}`;
        tableMap.set(fullKey, {
          schema: t.table_schema,
          name: t.table_name,
          fullName: fullKey,
          estimatedRows: Math.max(0, parseInt(t.estimated_rows, 10)),
          exactRows: null,
          totalBytes: parseInt(t.total_bytes, 10) || 0,
          prettySize: t.pretty_size || '0 kB',
          columns: [],
          primaryKey: [],
          foreignKeys: [],
          indexes: []
        });
      }

      // Attach columns
      for (const col of columnsRes.rows) {
        const fullKey = `${col.table_schema}.${col.table_name}`;
        if (tableMap.has(fullKey)) {
          tableMap.get(fullKey).columns.push({
            name: col.column_name,
            position: col.ordinal_position,
            defaultValue: col.column_default,
            isNullable: col.is_nullable === 'YES',
            dataType: col.data_type,
            udtName: col.udt_name,
            charMaxLength: col.character_maximum_length,
            precision: col.numeric_precision,
            scale: col.numeric_scale
          });
        }
      }

      // Attach primary keys
      for (const pk of pkRes.rows) {
        const fullKey = `${pk.table_schema}.${pk.table_name}`;
        if (tableMap.has(fullKey)) {
          tableMap.get(fullKey).primaryKey.push(pk.column_name);
        }
      }

      // Attach foreign keys
      for (const fk of fkRes.rows) {
        const fullKey = `${fk.table_schema}.${fk.table_name}`;
        if (tableMap.has(fullKey)) {
          tableMap.get(fullKey).foreignKeys.push({
            column: fk.column_name,
            constraintName: fk.constraint_name,
            foreignTable: `${fk.foreign_table_schema}.${fk.foreign_table_name}`,
            foreignColumn: fk.foreign_column_name,
            updateRule: fk.update_rule,
            deleteRule: fk.delete_rule
          });
        }
      }

      // Attach indexes
      for (const idx of indexRes.rows) {
        const fullKey = `${idx.table_schema}.${idx.table_name}`;
        if (tableMap.has(fullKey)) {
          tableMap.get(fullKey).indexes.push({
            name: idx.index_name,
            definition: idx.index_def,
            isUnique: idx.index_def.toUpperCase().includes('UNIQUE INDEX')
          });
        }
      }

      // Compute exact row counts if requested or when table count is <= 100
      if (options.exactCounts || tableMap.size <= 100) {
        for (const [fullKey, table] of tableMap.entries()) {
          try {
            const countRes = await client.query(`SELECT count(*)::bigint as cnt FROM "${table.schema}"."${table.name}"`);
            table.exactRows = parseInt(countRes.rows[0]?.cnt || '0', 10);
            table.estimatedRows = table.exactRows;
          } catch (e) {
            table.exactRows = table.estimatedRows;
          }
        }
      }

      const tables = Array.from(tableMap.values());
      const totalRecords = tables.reduce((acc, t) => acc + (t.exactRows !== null ? t.exactRows : t.estimatedRows), 0);
      const totalBytes = tables.reduce((acc, t) => acc + t.totalBytes, 0);

      return {
        success: true,
        target,
        schemas,
        tables,
        summary: {
          totalSchemas: schemas.length,
          totalTables: tables.length,
          totalRecords,
          totalBytes,
          inspectedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      return {
        success: false,
        target,
        error: sanitizeError(err),
        schemas: [],
        tables: [],
        summary: { totalSchemas: 0, totalTables: 0, totalRecords: 0, totalBytes: 0 }
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
   * Compares schemas between Source and Destination databases
   */
  async compareDatabases(options = {}) {
    const [sourceInspection, destInspection] = await Promise.all([
      this.inspectDatabase('source', options),
      this.inspectDatabase('destination', options)
    ]);

    if (!sourceInspection.success) {
      return {
        success: false,
        error: `Source inspection failed: ${sourceInspection.error}`,
        source: null,
        destination: null
      };
    }

    if (!destInspection.success) {
      return {
        success: false,
        error: `Destination inspection failed: ${destInspection.error}`,
        source: sourceInspection,
        destination: null
      };
    }

    const sourceTableMap = new Map(sourceInspection.tables.map(t => [t.fullName, t]));
    const destTableMap = new Map(destInspection.tables.map(t => [t.fullName, t]));

    const missingTablesInDest = [];
    const extraTablesInDest = [];
    const matchingTables = [];
    const tableDifferences = [];

    // Find missing and matching
    for (const [fullName, sTable] of sourceTableMap.entries()) {
      if (!destTableMap.has(fullName)) {
        missingTablesInDest.push({
          fullName,
          schema: sTable.schema,
          name: sTable.name,
          sourceRows: sTable.estimatedRows,
          sourceSize: sTable.prettySize
        });
      } else {
        const dTable = destTableMap.get(fullName);
        const colDiffs = this._compareColumns(sTable.columns, dTable.columns);
        const pkMatch = JSON.stringify(sTable.primaryKey.sort()) === JSON.stringify(dTable.primaryKey.sort());
        const rowDelta = (sTable.exactRows ?? sTable.estimatedRows) - (dTable.exactRows ?? dTable.estimatedRows);

        const diffObj = {
          fullName,
          schema: sTable.schema,
          name: sTable.name,
          sourceRows: sTable.exactRows ?? sTable.estimatedRows,
          destRows: dTable.exactRows ?? dTable.estimatedRows,
          rowDelta,
          pkMatch,
          sourceColumnsCount: sTable.columns.length,
          destColumnsCount: dTable.columns.length,
          hasColumnDifferences: colDiffs.hasDifferences,
          columnDifferences: colDiffs
        };

        matchingTables.push(diffObj);

        if (colDiffs.hasDifferences || !pkMatch || rowDelta !== 0) {
          tableDifferences.push(diffObj);
        }
      }
    }

    // Find extra tables in destination
    for (const [fullName, dTable] of destTableMap.entries()) {
      if (!sourceTableMap.has(fullName)) {
        extraTablesInDest.push({
          fullName,
          schema: dTable.schema,
          name: dTable.name,
          destRows: dTable.estimatedRows,
          destSize: dTable.prettySize
        });
      }
    }

    // Overall sync status
    let syncStatus = 'in_sync';
    if (missingTablesInDest.length > 0) {
      syncStatus = 'tables_missing';
    } else if (tableDifferences.length > 0) {
      syncStatus = 'diverged';
    }

    return {
      success: true,
      syncStatus,
      summary: {
        sourceTablesCount: sourceInspection.tables.length,
        destTablesCount: destInspection.tables.length,
        sourceTotalRecords: sourceInspection.summary.totalRecords,
        destTotalRecords: destInspection.summary.totalRecords,
        missingTablesCount: missingTablesInDest.length,
        extraTablesCount: extraTablesInDest.length,
        matchingTablesCount: matchingTables.length,
        tablesWithDifferencesCount: tableDifferences.length,
        comparedAt: new Date().toISOString()
      },
      missingTablesInDest,
      extraTablesInDest,
      matchingTables,
      tableDifferences,
      source: sourceInspection,
      destination: destInspection
    };
  }

  _compareColumns(sourceCols, destCols) {
    const sMap = new Map(sourceCols.map(c => [c.name, c]));
    const dMap = new Map(destCols.map(c => [c.name, c]));

    const missingInDest = [];
    const missingInSource = [];
    const typeMismatches = [];

    for (const [name, sCol] of sMap.entries()) {
      if (!dMap.has(name)) {
        missingInDest.push(sCol);
      } else {
        const dCol = dMap.get(name);
        if (sCol.udtName !== dCol.udtName) {
          typeMismatches.push({
            column: name,
            sourceType: sCol.udtName,
            destType: dCol.udtName
          });
        }
      }
    }

    for (const [name, dCol] of dMap.entries()) {
      if (!sMap.has(name)) {
        missingInSource.push(dCol);
      }
    }

    return {
      hasDifferences: missingInDest.length > 0 || missingInSource.length > 0 || typeMismatches.length > 0,
      missingInDest,
      missingInSource,
      typeMismatches
    };
  }
}

module.exports = new DbInspectorService();

