const assert = require('assert');
const {
  encryptCredential,
  decryptCredential,
  maskConnectionString,
  sanitizeError
} = require('../utils/credentialCrypto');
const dbConnectionManager = require('../services/dbConnectionManager');
const dbInspectorService = require('../services/dbInspectorService');
const dbMigrationEngine = require('../services/dbMigrationEngine');

async function runTests() {
  console.log('🧪 Starting Database Migration System Automated Tests...\n');

  // Test 1: Encryption & Decryption
  {
    const secretUrl = 'postgresql://postgres:mySuperSecretPass123@187.127.150.217:5432/sbflorist';
    const encrypted = encryptCredential(secretUrl);
    assert.notStrictEqual(encrypted, secretUrl, 'Encrypted output must not match plaintext');
    assert.strictEqual(encrypted.includes('mySuperSecretPass123'), false, 'Encrypted payload must not contain secret');

    const decrypted = decryptCredential(encrypted);
    assert.strictEqual(decrypted, secretUrl, 'Decrypted output must match original plaintext');
    console.log('✅ Test 1 Passed: AES-256-GCM encryption & decryption verified.');
  }

  // Test 2: URL Masking & Error Sanitization
  {
    const rawUrl = 'postgresql://postgres:ddkka2006@187.127.150.217:5432/sbflorist';
    const masked = maskConnectionString(rawUrl);
    assert.strictEqual(masked, 'postgresql://postgres:••••••••@187.127.150.217:5432/sbflorist', 'Masked string matches pattern');
    assert.strictEqual(masked.includes('ddkka2006'), false, 'Masked URL must never expose password');

    const errWithSecret = new Error('Connection failed to postgresql://postgres:ddkka2006@187.127.150.217:5432/sbflorist');
    const sanitizedMsg = sanitizeError(errWithSecret);
    assert.strictEqual(sanitizedMsg.includes('ddkka2006'), false, 'Sanitized error must not contain password');
    console.log('✅ Test 2 Passed: Credential masking & error sanitization verified.');
  }

  // Test 3: Connection URL Parsing & SSL handling
  {
    const parsed = dbConnectionManager.parseConnectionString('postgresql://postgres:khushal893@localhost:5432/sbflorist_db', { mode: 'disable' });
    assert.strictEqual(parsed.host, 'localhost');
    assert.strictEqual(parsed.port, 5432);
    assert.strictEqual(parsed.database, 'sbflorist_db');
    assert.strictEqual(parsed.user, 'postgres');
    assert.strictEqual(parsed.ssl, false);

    const parsedRemote = dbConnectionManager.parseConnectionString('postgresql://postgres:ddkka2006@187.127.150.217:5432/sbflorist?sslmode=require');
    assert.strictEqual(parsedRemote.host, '187.127.150.217');
    assert.strictEqual(parsedRemote.port, 5432);
    assert.strictEqual(parsedRemote.database, 'sbflorist');
    assert.notStrictEqual(parsedRemote.ssl, false);
    console.log('✅ Test 3 Passed: Connection string parsing and SSL configuration verified.');
  }

  // Test 4: Topological Sorting for Foreign Key Dependencies
  {
    const dummyTables = [
      {
        fullName: 'public.order_items',
        foreignKeys: [{ foreignTable: 'public.orders' }, { foreignTable: 'public.products' }]
      },
      {
        fullName: 'public.orders',
        foreignKeys: [{ foreignTable: 'public.users' }]
      },
      {
        fullName: 'public.products',
        foreignKeys: [{ foreignTable: 'public.categories' }]
      },
      {
        fullName: 'public.users',
        foreignKeys: []
      },
      {
        fullName: 'public.categories',
        foreignKeys: []
      }
    ];

    const sorted = dbMigrationEngine._sortTablesByDependencies(dummyTables);
    const sortedNames = sorted.map(t => t.fullName);

    const userIdx = sortedNames.indexOf('public.users');
    const orderIdx = sortedNames.indexOf('public.orders');
    const orderItemIdx = sortedNames.indexOf('public.order_items');
    const categoryIdx = sortedNames.indexOf('public.categories');
    const productIdx = sortedNames.indexOf('public.products');

    assert.ok(userIdx < orderIdx, 'Users must be migrated before Orders');
    assert.ok(orderIdx < orderItemIdx, 'Orders must be migrated before OrderItems');
    assert.ok(categoryIdx < productIdx, 'Categories must be migrated before Products');
    assert.ok(productIdx < orderItemIdx, 'Products must be migrated before OrderItems');
    console.log('✅ Test 4 Passed: Topological sorting of foreign keys verified.');
  }

  // Test 5: Schema Column Comparison Logic
  {
    const sourceCols = [
      { name: 'id', udtName: 'uuid' },
      { name: 'name', udtName: 'varchar' },
      { name: 'created_at', udtName: 'timestamptz' }
    ];
    const destCols = [
      { name: 'id', udtName: 'uuid' },
      { name: 'name', udtName: 'text' } // type mismatch & missing created_at
    ];

    const diff = dbInspectorService._compareColumns(sourceCols, destCols);
    assert.strictEqual(diff.hasDifferences, true);
    assert.strictEqual(diff.missingInDest.length, 1);
    assert.strictEqual(diff.missingInDest[0].name, 'created_at');
    assert.strictEqual(diff.typeMismatches.length, 1);
    assert.strictEqual(diff.typeMismatches[0].column, 'name');
    console.log('✅ Test 5 Passed: Column comparison & difference detection verified.');
  }

  // Test 6: PostgreSQL ARRAY, JSON/JSONB, and DDL Column Type Serialization
  {
    const arrayColMeta = { name: 'keywords', dataType: 'ARRAY', udtName: '_text' };
    const serializedArray = dbMigrationEngine._serializeParamValue(['place order', 'buy flowers'], arrayColMeta);
    assert.ok(Array.isArray(serializedArray), 'ARRAY column values must remain JS arrays');
    assert.deepStrictEqual(serializedArray, ['place order', 'buy flowers']);

    const serializedArrayFromJson = dbMigrationEngine._serializeParamValue('["place order","buy flowers"]', arrayColMeta);
    assert.ok(Array.isArray(serializedArrayFromJson), 'Stringified JSON array for ARRAY column must coerce to JS array');
    assert.deepStrictEqual(serializedArrayFromJson, ['place order', 'buy flowers']);

    const jsonColMeta = { name: 'deviceInfo', dataType: 'jsonb', udtName: 'jsonb' };
    assert.strictEqual(dbMigrationEngine._serializeParamValue({ os: 'Windows' }, jsonColMeta), '{"os":"Windows"}');
    assert.strictEqual(dbMigrationEngine._serializeParamValue('mobile', jsonColMeta), '"mobile"');
    assert.strictEqual(dbMigrationEngine._serializeParamValue('', jsonColMeta), '""');
    assert.strictEqual(dbMigrationEngine._serializeParamValue(null, jsonColMeta), null);

    assert.strictEqual(dbMigrationEngine._resolvePgColumnType(arrayColMeta), 'TEXT[]');
    assert.strictEqual(dbMigrationEngine._resolvePgColumnType({ dataType: 'ARRAY', udtName: '_int4' }), 'INTEGER[]');
    assert.strictEqual(dbMigrationEngine._resolvePgColumnType({ dataType: 'character', udtName: 'bpchar', charMaxLength: 4 }), 'CHAR(4)');
    console.log('✅ Test 6 Passed: ARRAY & JSON/JSONB parameter serialization and DDL mapping verified.');
  }

  // Test 7: Migration History Reconciliation (active vs stale)
  {
    const dbMigrationHistoryService = require('../services/dbMigrationHistoryService');
    const rec = dbMigrationHistoryService.createMigrationRecord({
      migrationId: 'mig_test_active_check',
      startedBy: 'Test Runner',
      migrationType: 'complete'
    });
    assert.strictEqual(rec.status, 'in_progress');

    // Active job stays in_progress when activeMigrationId matches
    const whileActive = dbMigrationHistoryService.getHistory('mig_test_active_check').find(h => h.migrationId === 'mig_test_active_check');
    assert.strictEqual(whileActive.status, 'in_progress');

    // Stale job is marked failed when activeMigrationId is null
    const whenStale = dbMigrationHistoryService.getHistory(null).find(h => h.migrationId === 'mig_test_active_check');
    assert.strictEqual(whenStale.status, 'failed');
    assert.ok(whenStale.errorDetails && whenStale.errorDetails.length > 0);

    // Clean up test record
    dbMigrationHistoryService.deleteMigrationRecord('mig_test_active_check');
    console.log('✅ Test 7 Passed: Migration history persistence (.dat) & active/stale reconciliation verified.');
  }

  console.log('\n🎉 ALL 7 DATABASE MIGRATION ENGINE AUTOMATED TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});

