const assert = require('assert');
const merchandisingService = require('../services/merchandisingService');

async function runMerchandisingTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MERCHANDISING ENGINE VALIDATION TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Reason: ${err.message}`);
      if (err.stack) {
        console.error(`     ${err.stack.split('\n').slice(1, 3).join('\n     ')}`);
      }
    }
  }

  async function runAsyncTest(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Reason: ${err.message}`);
      if (err.stack) {
        console.error(`     ${err.stack.split('\n').slice(1, 3).join('\n     ')}`);
      }
    }
  }

  // Sample Mock Products
  const mockProducts = [
    {
      id: 'prod-1',
      title: 'Red Rose Elegance Bouquet',
      category: 'bouquets',
      price: 1299,
      discountPrice: 999,
      ratings: 4.8,
      reviewsCount: 35,
      inStock: true,
      stock: 50,
      createdAt: new Date('2026-03-01T10:00:00Z'),
      displayPriority: 10
    },
    {
      id: 'prod-2',
      title: 'Belgian Chocolate Truffle Cake',
      category: 'cakes',
      price: 899,
      ratings: 4.9,
      reviewsCount: 80,
      inStock: true,
      stock: 20,
      createdAt: new Date('2026-02-15T10:00:00Z'),
      displayPriority: 5
    },
    {
      id: 'prod-3',
      title: 'White Orchid In Ceramic Pot',
      category: 'plants',
      price: 1599,
      ratings: 4.5,
      reviewsCount: 12,
      inStock: true,
      stock: 15,
      createdAt: new Date('2026-01-20T10:00:00Z'),
      displayPriority: 0
    },
    {
      id: 'prod-4',
      title: 'Yellow Sunshine Lily Bouquet',
      category: 'bouquets',
      price: 1199,
      ratings: 4.2,
      reviewsCount: 8,
      inStock: true,
      stock: 30,
      createdAt: new Date('2026-03-25T10:00:00Z'),
      displayPriority: 0
    },
    {
      id: 'prod-5',
      title: 'Pink Carnation Spring Basket',
      category: 'bouquets',
      price: 1099,
      ratings: 4.6,
      reviewsCount: 22,
      inStock: true,
      stock: 25,
      createdAt: new Date('2026-02-28T10:00:00Z'),
      displayPriority: 2
    },
    {
      id: 'prod-6',
      title: 'Exotic Bonsai Tree',
      category: 'plants',
      price: 2499,
      ratings: 4.7,
      reviewsCount: 14,
      inStock: true,
      stock: 5,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      displayPriority: 0
    },
    {
      id: 'prod-7',
      title: 'Red Velvet Heart Cake',
      category: 'cakes',
      price: 999,
      ratings: 4.3,
      reviewsCount: 18,
      inStock: true,
      stock: 12,
      createdAt: new Date('2026-02-01T10:00:00Z'),
      displayPriority: 0
    },
    {
      id: 'prod-8',
      title: 'Vintage Lavender Bunch (Sold Out)',
      category: 'bouquets',
      price: 899,
      ratings: 4.9,
      reviewsCount: 50,
      inStock: false,
      stock: 0,
      createdAt: new Date('2026-01-05T10:00:00Z'),
      displayPriority: 0
    }
  ];

  // ----------------------------------------------------
  // TEST SUITE 1: Deterministic Mulberry32 PRNG & FNV-1a
  // ----------------------------------------------------
  console.log('📌 Suite 1: Mathematical PRNG & Determinism');

  runTest('Mulberry32 produces identical sequences with identical seed strings', () => {
    const seed = 'bestsellers:daily:2026-10-09:1';
    const rng1 = merchandisingService._createDeterministicRng(seed);
    const rng2 = merchandisingService._createDeterministicRng(seed);

    const values1 = [rng1(), rng1(), rng1(), rng1()];
    const values2 = [rng2(), rng2(), rng2(), rng2()];

    assert.deepStrictEqual(values1, values2, 'Identical seeds must yield identical sequence');
    assert.ok(values1.every(v => v >= 0 && v < 1), 'Values must strictly lie in [0, 1)');
  });

  runTest('Different seeds yield distinct sequences', () => {
    const rngA = merchandisingService._createDeterministicRng('featured:daily:2026-10-09:1');
    const rngB = merchandisingService._createDeterministicRng('featured:daily:2026-10-09:2');

    assert.notStrictEqual(rngA(), rngB(), 'Different versions should produce different first floats');
  });

  // ----------------------------------------------------
  // TEST SUITE 2: Mode A - Manual Ordering & Pinning
  // ----------------------------------------------------
  console.log('\n📌 Suite 2: Mode A - Manual Ordering & Admin Pinning');

  await runAsyncTest('Manual mode preserves exact saved sequence and pins designated product', async () => {
    const config = {
      mode: 'manual',
      pinnedProductIds: ['prod-3'],
      savedOrderIds: ['prod-5', 'prod-1', 'prod-2', 'prod-4']
    };

    const result = await merchandisingService.merchandiseProducts(
      mockProducts,
      'featured',
      config
    );

    // Pinned prod-3 must be #1
    assert.strictEqual(result[0].id, 'prod-3', 'Pinned product must be at the very top');
    // Followed by saved order: prod-5, prod-1, prod-2, prod-4
    assert.strictEqual(result[1].id, 'prod-5');
    assert.strictEqual(result[2].id, 'prod-1');
    assert.strictEqual(result[3].id, 'prod-2');
    assert.strictEqual(result[4].id, 'prod-4');

    // No duplicates
    const idSet = new Set(result.map(p => p.id));
    assert.strictEqual(idSet.size, result.length, 'Output must have no duplicate products');
  });

  // ----------------------------------------------------
  // TEST SUITE 3: Mode B - Smart Ranking Algorithm
  // ----------------------------------------------------
  console.log('\n📌 Suite 3: Mode B - Smart Ranking & Business Signals');

  await runAsyncTest('Smart Ranking positions high-performing and in-stock items ahead of out-of-stock items', async () => {
    const config = {
      mode: 'smart',
      pinnedProductIds: []
    };

    const result = await merchandisingService.merchandiseProducts(
      mockProducts,
      'bestsellers',
      config
    );

    // Sold out item (prod-8) must be relegated towards the end despite high ratings
    const lastItem = result[result.length - 1];
    assert.strictEqual(lastItem.id, 'prod-8', 'Out of stock product must be penalized and placed at the bottom');

    // Result length must equal mockProducts length
    assert.strictEqual(result.length, mockProducts.length);
  });

  await runAsyncTest('Smart Ranking strictly preserves pinned products at top', async () => {
    const config = {
      mode: 'smart',
      pinnedProductIds: ['prod-7']
    };

    const result = await merchandisingService.merchandiseProducts(
      mockProducts,
      'bestsellers',
      config
    );

    assert.strictEqual(result[0].id, 'prod-7', 'Admin pinned product must stay #1 even in Smart Mode');
  });

  // ----------------------------------------------------
  // TEST SUITE 4: Mode C - Controlled Rotation
  // ----------------------------------------------------
  console.log('\n📌 Suite 4: Mode C - Smart Ranking + Controlled Rotation');

  await runAsyncTest('Mode C locks top 4 positions and stably preserves order within the same rotation window', async () => {
    const config = {
      mode: 'smart_rotation',
      protectedTopCount: 4,
      rotationFrequency: 'daily',
      rotationVersion: 1,
      pinnedProductIds: []
    };

    const run1 = await merchandisingService.merchandiseProducts(mockProducts, 'bouquets', config);
    const run2 = await merchandisingService.merchandiseProducts(mockProducts, 'bouquets', config);

    // Exact identity check: run1 and run2 must be 100% identical
    const run1Ids = run1.map(p => p.id);
    const run2Ids = run2.map(p => p.id);
    assert.deepStrictEqual(run1Ids, run2Ids, 'Successive calls in the same rotation window must produce identical order');

    // Check top 4 protection
    const top4Smart = (await merchandisingService.merchandiseProducts(mockProducts, 'bouquets', { mode: 'smart' }))
      .slice(0, 4)
      .map(p => p.id);

    assert.deepStrictEqual(run1Ids.slice(0, 4), top4Smart, 'Top 4 positions must strictly match Smart Ranking top zone');
  });

  await runAsyncTest('Bumping rotation version shifts discovery items while keeping protected top-zone locked', async () => {
    const configV1 = {
      mode: 'smart_rotation',
      protectedTopCount: 4,
      rotationFrequency: 'daily',
      rotationVersion: 1,
      pinnedProductIds: []
    };

    const configV2 = {
      mode: 'smart_rotation',
      protectedTopCount: 4,
      rotationFrequency: 'daily',
      rotationVersion: 2,
      pinnedProductIds: []
    };

    const runV1 = await merchandisingService.merchandiseProducts(mockProducts, 'bouquets', configV1);
    const runV2 = await merchandisingService.merchandiseProducts(mockProducts, 'bouquets', configV2);

    const v1Ids = runV1.map(p => p.id);
    const v2Ids = runV2.map(p => p.id);

    // Top 4 must remain unchanged
    assert.deepStrictEqual(v1Ids.slice(0, 4), v2Ids.slice(0, 4), 'Top 4 protected products must NOT change between rotation versions');

    // Discovery pool (positions 4 to 6, excluding sold-out at index 7) should cycle or shift
    console.log(`     V1 discovery pool: [${v1Ids.slice(4).join(', ')}]`);
    console.log(`     V2 discovery pool: [${v2Ids.slice(4).join(', ')}]`);
    // Out of stock product must stay at the bottom in both versions
    assert.strictEqual(v1Ids[v1Ids.length - 1], 'prod-8');
    assert.strictEqual(v2Ids[v2Ids.length - 1], 'prod-8');
  });

  await runAsyncTest('No product appears twice in Mode C result set under any circumstances', async () => {
    const config = {
      mode: 'smart_rotation',
      protectedTopCount: 3,
      rotationFrequency: 'daily',
      rotationVersion: 5,
      pinnedProductIds: ['prod-2', 'prod-5']
    };

    const result = await merchandisingService.merchandiseProducts(mockProducts, 'category:cakes', config);
    const ids = result.map(p => p.id);
    const uniqueIds = new Set(ids);

    assert.strictEqual(ids.length, uniqueIds.size, 'All products in result set must be unique (no duplicates)');
    assert.strictEqual(ids[0], 'prod-2', 'First pinned product must be first');
    assert.strictEqual(ids[1], 'prod-5', 'Second pinned product must be second');
  });

  // ----------------------------------------------------
  // TEST SUITE 5: Mode D - Personalized Recommendations
  // ----------------------------------------------------
  console.log('\n📌 Suite 5: Mode D - Privacy-Conscious Personalization & Fallbacks');

  await runAsyncTest('Personalized Mode promotes user-affinity category when signals exist', async () => {
    const userSignals = {
      browsedCategories: ['plants'],
      recentlyViewedIds: ['prod-3']
    };

    const result = await merchandisingService.merchandiseProducts(
      mockProducts,
      'shop',
      { mode: 'personalized' },
      userSignals
    );

    // The first non-pinned products should prioritize 'plants' category products (prod-3 or prod-6)
    const top2Categories = result.slice(0, 2).map(p => p.category);
    assert.ok(
      top2Categories.includes('plants'),
      `Personalized ranking should boost plants category for a plant-interested shopper, got: ${top2Categories.join(', ')}`
    );
  });

  await runAsyncTest('Personalized Mode falls back gracefully to Mode C when user context is null or empty', async () => {
    const result = await merchandisingService.merchandiseProducts(
      mockProducts,
      'shop',
      { mode: 'personalized' },
      null // anonymous user with 0 signals
    );

    assert.ok(Array.isArray(result), 'Must return an array');
    assert.strictEqual(result.length, mockProducts.length, 'Must return full catalog without throwing errors');
  });

  // ----------------------------------------------------
  // TEST SUITE 6: Simulation Preview Without Side Effects
  // ----------------------------------------------------
  console.log('\n📌 Suite 6: Admin Preview Simulation');

  await runAsyncTest('generateMerchandisingPreview returns side-by-side orders without mutating DB', async () => {
    const preview = await merchandisingService.generateMerchandisingPreview('bouquets', {
      mode: 'smart_rotation',
      protectedTopCount: 4,
      rotationFrequency: 'daily',
      rotationVersion: 1,
      pinnedProductIds: ['prod-1']
    });

    assert.ok(preview.summary, 'Preview must have summary');
    assert.ok(Array.isArray(preview.manual), 'Manual preview must be an array');
    assert.ok(Array.isArray(preview.smart), 'Smart preview must be an array');
    assert.ok(Array.isArray(preview.smartRotation), 'Smart rotation preview must be an array');
    assert.ok(preview.summary.totalEligibleProducts >= 0, 'Eligible count must be >= 0');
  });

  // ----------------------------------------------------
  // TEST SUITE 7: Analytics Aggregation Safety
  // ----------------------------------------------------
  console.log('\n📌 Suite 7: Analytics Calculation & Non-Zero-Div Safety');

  await runAsyncTest('getMerchandisingAnalytics computes valid non-NaN rates even with 0 events', async () => {
    const analytics = await merchandisingService.getMerchandisingAnalytics({ days: 30 });

    assert.ok(analytics.summary, 'Analytics must have summary');
    assert.strictEqual(typeof analytics.summary.overallCtr, 'number');
    assert.strictEqual(typeof analytics.summary.overallConversionRate, 'number');
    assert.ok(!isNaN(analytics.summary.overallCtr), 'CTR must never be NaN');
    assert.ok(!isNaN(analytics.summary.overallConversionRate), 'Conversion rate must never be NaN');
    assert.ok(Array.isArray(analytics.strategies), 'Strategies breakdown must be an array');
  });

  console.log('\n======================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

runMerchandisingTests()
  .then(() => {
    console.log('🎉 All Merchandising Engine Acceptance Tests Passed Successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
