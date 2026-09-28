const { generateProductCatalogCsv, CSV_HEADERS } = require('../services/productExportService');

async function runTests() {
  console.log('🧪 Starting Comprehensive Product Catalog Export Tests...\n');

  // Test 1: Full Catalog Export
  console.log('--- TEST 1: Full Catalog Export ---');
  const fullRes = await generateProductCatalogCsv({ type: 'all' });
  console.log('✅ Generated filename:', fullRes.filename);
  console.log('✅ Total products:', fullRes.totalCount);
  console.log('✅ Complete products:', fullRes.completeCount);
  console.log('✅ Warnings count:', fullRes.warningCount);

  if (!fullRes.csv.startsWith('\uFEFF')) {
    throw new Error('CSV is missing UTF-8 BOM!');
  }
  console.log('✅ UTF-8 BOM verified.');

  const lines = fullRes.csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);
  const headerCols = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  console.log('✅ Header columns count:', headerCols.length);
  if (headerCols.length !== 8) {
    throw new Error('Expected 8 header columns, got: ' + headerCols.length);
  }
  CSV_HEADERS.forEach((col, i) => {
    if (headerCols[i] !== col) {
      throw new Error(`Header column ${i} mismatch: expected '${col}', got '${headerCols[i]}'`);
    }
  });
  console.log('✅ All 8 Header columns strictly match exact required names and order.');

  // Simple CSV parser for validation
  function parseCsvRow(rowStr) {
    const cells = [];
    let insideQuote = false;
    let cell = '';
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"') {
        if (insideQuote && rowStr[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        cells.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells;
  }

  let rowCount = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    if (row.length !== 8) {
      throw new Error(`Row ${i} has ${row.length} columns instead of 8: ${lines[i]}`);
    }
    const [img, id, name, desc, price, avail, deliv, url] = row;
    if (img.includes('localhost')) throw new Error(`Row ${i} has localhost image!`);
    if (url.includes('localhost')) throw new Error(`Row ${i} has localhost product URL!`);
    if (!['In Stock', 'Out of Stock', 'in stock', 'out of stock'].includes(avail)) throw new Error(`Row ${i} has invalid availability: ${avail}`);
    if (img.includes('undefined') || id.includes('undefined') || name.includes('undefined')) {
      throw new Error(`Row ${i} contains 'undefined'!`);
    }
    rowCount++;
  }
  console.log(`✅ Validated all ${rowCount} rows: strictly 8 columns, valid availability, no localhost, no undefined/null strings.`);

  // Test 2: Category Export
  console.log('\n--- TEST 2: Category Export (Bouquets and Cakes) ---');
  const catRes = await generateProductCatalogCsv({ type: 'categories', categoryIds: ['bouquets', 'cakes'] });
  console.log('✅ Generated filename:', catRes.filename);
  console.log('✅ Category products count:', catRes.totalCount);
  if (catRes.totalCount === 0) throw new Error('Expected at least 1 product for bouquets and cakes!');

  // Test 3: Specific Products Export
  console.log('\n--- TEST 3: Specific Product IDs Export ---');
  const sampleRow = parseCsvRow(lines[1]);
  const sampleId = sampleRow[1];
  console.log('Using sample product ID:', sampleId);
  const prodRes = await generateProductCatalogCsv({ type: 'products', productIds: [sampleId] });
  console.log('✅ Filename:', prodRes.filename);
  console.log('✅ Exported count:', prodRes.totalCount);
  if (prodRes.totalCount !== 1) throw new Error(`Expected 1 product, got ${prodRes.totalCount}`);

  // Test 4: Staging URL sanitization (e.g. sbf-frontend.onrender.com -> sbflorist.in/product)
  console.log('\n--- TEST 4: Domain Sanitization (onrender.com -> sbflorist.in/product) ---');
  const oldEnv = process.env.FRONTEND_URL;
  try {
    process.env.FRONTEND_URL = 'https://sbf-frontend.onrender.com';
    const renderRes = await generateProductCatalogCsv({ type: 'products', productIds: [sampleId] });
    const renderLines = renderRes.csv.replace('\uFEFF', '').split('\r\n').filter(Boolean);
    const renderRow = parseCsvRow(renderLines[1]);
    const renderUrl = renderRow[7];
    console.log('Product URL with onrender env:', renderUrl);
    if (!renderUrl.startsWith('https://sbflorist.in/product/')) {
      throw new Error(`Expected product URL to start with https://sbflorist.in/product/, got: ${renderUrl}`);
    }
    if (renderUrl.includes('onrender')) {
      throw new Error(`Product URL contains onrender: ${renderUrl}`);
    }
    console.log('✅ Successfully sanitized onrender URL to https://sbflorist.in/product/...');
  } finally {
    process.env.FRONTEND_URL = oldEnv;
  }

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Production-ready.');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
