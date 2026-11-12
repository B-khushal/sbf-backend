const assert = require('assert');
const path = require('path');

// Stub dependencies before requiring productController
const prismaPath = require.resolve(path.join(__dirname, '../config/prisma'));
const prefPath = require.resolve(path.join(__dirname, '../models/SectionSortingPreference'));
const activityLogPath = require.resolve(path.join(__dirname, '../models/ActivityLog'));
const merchandisingPath = require.resolve(path.join(__dirname, '../services/merchandisingService'));
const productModelPath = require.resolve(path.join(__dirname, '../models/Product'));
const userModelPath = require.resolve(path.join(__dirname, '../models/User'));
const vendorModelPath = require.resolve(path.join(__dirname, '../models/Vendor'));
const orderModelPath = require.resolve(path.join(__dirname, '../models/Order'));
const reviewModelPath = require.resolve(path.join(__dirname, '../models/Review'));

const dbProducts = new Map([
  ['prod-1', { id: 'prod-1', displayOrders: { shop: 10, categories: { roses: 2 } } }],
  ['prod-2', { id: 'prod-2', displayOrders: null }],
  ['prod-3', { id: 'prod-3', displayOrders: [] }]
]);

const transactionsRun = [];
const prefUpdates = [];
const invalidatedSections = [];

require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    product: {
      findMany: async ({ where }) => {
        const ids = where?.id?.in || [];
        return ids.filter((id) => dbProducts.has(id)).map((id) => ({ ...dbProducts.get(id) }));
      },
      update: ({ where, data }) => ({ where, data })
    },
    activityLog: {
      findFirst: async ({ where }) => {
        if (where?.id === 'log-rollback-1') {
          return {
            id: 'log-rollback-1',
            createdAt: new Date().toISOString(),
            details: {
              section: 'category:bouquets',
              previousPositions: { 'prod-1': 5, 'prod-missing': 99 }
            }
          };
        }
        return null;
      }
    },
    $transaction: async (ops) => {
      transactionsRun.push(ops);
      for (const op of ops) {
        if (!dbProducts.has(op.where.id)) {
          const err = new Error(`Record to update not found: ${op.where.id}`);
          err.code = 'P2025';
          throw err;
        }
        dbProducts.get(op.where.id).displayOrders = op.data.displayOrders;
      }
      return ops;
    }
  }
};

require.cache[prefPath] = {
  id: prefPath,
  filename: prefPath,
  loaded: true,
  exports: {
    findOneAndUpdate: async (where, update) => {
      prefUpdates.push({ where, update });
      return { ...where, ...update };
    }
  }
};

require.cache[activityLogPath] = {
  id: activityLogPath,
  filename: activityLogPath,
  loaded: true,
  exports: {
    create: async (data) => ({ id: 'log-1', ...data })
  }
};

require.cache[merchandisingPath] = {
  id: merchandisingPath,
  filename: merchandisingPath,
  loaded: true,
  exports: {
    invalidateMerchandisingCache: (sec) => invalidatedSections.push(sec)
  }
};

for (const p of [productModelPath, userModelPath, vendorModelPath, orderModelPath, reviewModelPath]) {
  require.cache[p] = { id: p, filename: p, loaded: true, exports: {} };
}

const {
  bulkReorderProducts,
  updateSectionProductsOrder,
  rollbackOrderChanges
} = require('../controllers/productController');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function invokeHandler(handler, req) {
  const res = createMockRes();
  return new Promise((resolve, reject) => {
    handler(req, res, (err) => {
      if (err) reject(err);
      else resolve(res);
    });
    setImmediate(() => resolve(res));
  });
}

async function runTests() {
  console.log('🧪 Running Bulk Reorder Regression Tests...\n');

  // 1. budget_friendly (previously crashed with ReferenceError: secKey is not defined)
  {
    const res = await invokeHandler(bulkReorderProducts, {
      body: {
        section: 'budget_friendly',
        displayOrders: { 'prod-1': 1, 'prod-2': 2, 'prod-missing': 3 },
        mode: 'manual'
      },
      user: { id: 'admin-1', name: 'Admin' }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.updatedCount, 2, 'Missing product ID must be skipped cleanly');
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.budget_friendly, 1);
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.categories['budget-friendly'], 1);
    assert.strictEqual(dbProducts.get('prod-2').displayOrders.budgetFriendly, 2);
    console.log('✅ Test 1 Passed: budget_friendly bulk reorder succeeded and skipped missing product.');
  }

  // 2. Category section (category:bouquets) & NaN/array displayOrders protection
  {
    const res = await invokeHandler(bulkReorderProducts, {
      body: {
        section: 'category:bouquets',
        displayOrders: { 'prod-1': 4, 'prod-3': 'not-a-number' },
        protectedTopCount: 'not-a-number'
      },
      user: { id: 'admin-1', name: 'Admin' }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.categories.bouquets, 4);
    assert.strictEqual(dbProducts.get('prod-3').displayOrders.categories.bouquets, 0, 'Non-numeric order falls back safely to 0');
    console.log('✅ Test 2 Passed: category:bouquets bulk reorder & NaN sanitization verified.');
  }

  // 3. Occasion section (occasion:get-well-soon)
  {
    const res = await invokeHandler(bulkReorderProducts, {
      body: {
        section: 'occasion:get-well-soon',
        displayOrders: { 'prod-1': 7 }
      },
      user: { id: 'admin-1', name: 'Admin' }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.occasions['get-well-soon'], 7);
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.occasions.getWellSoon, 7);
    console.log('✅ Test 3 Passed: occasion:get-well-soon bulk reorder verified.');
  }

  // 4. Reject invalid array displayOrders with 400 instead of 500
  {
    const res = await invokeHandler(bulkReorderProducts, {
      body: {
        section: 'shop',
        displayOrders: ['prod-1']
      }
    });
    assert.strictEqual(res.statusCode, 400);
    console.log('✅ Test 4 Passed: Array displayOrders rejected with 400.');
  }

  // 5. updateSectionProductsOrder & rollbackOrderChanges with category section and missing product ID
  {
    const updateRes = await invokeHandler(updateSectionProductsOrder, {
      body: {
        section: 'category:plants',
        displayOrders: { 'prod-2': 3, 'prod-missing': 4 }
      },
      user: { id: 'admin-1', name: 'Admin' }
    });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(dbProducts.get('prod-2').displayOrders.categories.plants, 3);

    const rollbackRes = await invokeHandler(rollbackOrderChanges, {
      body: { auditLogId: 'log-rollback-1' },
      user: { id: 'admin-1', name: 'Admin' }
    });
    assert.strictEqual(rollbackRes.statusCode, 200);
    assert.strictEqual(rollbackRes.body.restoredCount, 1);
    assert.strictEqual(dbProducts.get('prod-1').displayOrders.categories.bouquets, 5);
    console.log('✅ Test 5 Passed: updateSectionProductsOrder & rollbackOrderChanges verified.');
  }

  console.log('\n🎉 ALL BULK REORDER TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

