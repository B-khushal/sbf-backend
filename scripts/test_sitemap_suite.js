require('dotenv').config();
const {
  generateSitemapXml,
  generateSitemapIndexXml,
  generatePagesSitemapXml,
  generateCategoriesSitemapXml,
  generateProductsSitemapXml,
  generateOccasionsSitemapXml,
  generateFullSitemapXml,
  generateRobotsTxt,
  SITE_URL
} = require('../services/seoService');

async function runSitemapTestSuite() {
  console.log('====================================================');
  console.log('   SPRING BLOSSOMS FLORIST — SITEMAP TEST SUITE     ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  // 1. Test Sitemap Index
  console.log('1. Testing Sitemap Index (/sitemap.xml)...');
  const indexXml = await generateSitemapIndexXml(true);
  assert(indexXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
  assert(indexXml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Valid sitemap index namespace');
  assert(indexXml.includes(`${SITE_URL}/sitemap-pages.xml`), 'References sitemap-pages.xml');
  assert(indexXml.includes(`${SITE_URL}/sitemap-categories.xml`), 'References sitemap-categories.xml');
  assert(indexXml.includes(`${SITE_URL}/sitemap-products.xml`), 'References sitemap-products.xml');
  assert(indexXml.includes(`${SITE_URL}/sitemap-occasions.xml`), 'References sitemap-occasions.xml');
  assert(!indexXml.includes('localhost'), 'No localhost URLs in index');

  const sitemapLocMatches = indexXml.match(/<loc>(.*?)<\/loc>/g) || [];
  const sitemapLocs = sitemapLocMatches.map(m => m.replace(/<\/?loc>/g, ''));
  const uniqueSitemapLocs = new Set(sitemapLocs);
  assert(sitemapLocs.every(loc => loc.startsWith('https://sbflorist.in/')), 'All child sitemaps in index use secure canonical HTTPS');
  assert(sitemapLocs.length === uniqueSitemapLocs.size, `No duplicate child sitemaps in index (found ${sitemapLocs.length})`);

  // 2. Test Pages Sitemap
  console.log('\n2. Testing Pages Sitemap (/sitemap-pages.xml)...');
  const pagesXml = await generatePagesSitemapXml(true);
  assert(pagesXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
  assert(pagesXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Valid urlset namespace');
  assert(pagesXml.includes(`${SITE_URL}/`), 'Includes homepage');
  assert(pagesXml.includes(`${SITE_URL}/shop`), 'Includes shop page');
  assert(pagesXml.includes(`${SITE_URL}/flower-delivery-hyderabad`), 'Includes Hyderabad delivery page');
  assert(pagesXml.includes(`${SITE_URL}/flower-delivery-secunderabad`), 'Includes Secunderabad delivery page');
  assert(pagesXml.includes(`${SITE_URL}/about`), 'Includes about page');
  assert(pagesXml.includes(`${SITE_URL}/contact`), 'Includes contact page');
  assert(pagesXml.includes(`${SITE_URL}/shipping`), 'Includes shipping page');
  assert(pagesXml.includes(`${SITE_URL}/privacy`), 'Includes privacy policy');
  assert(pagesXml.includes(`${SITE_URL}/terms`), 'Includes terms of service');
  assert(pagesXml.includes(`${SITE_URL}/refund-policy`), 'Includes refund policy');
  assert(pagesXml.includes(`${SITE_URL}/cancellation-policy`), 'Includes cancellation policy');

  // Verify exclusions
  assert(!pagesXml.includes('/cart'), 'Excludes /cart');
  assert(!pagesXml.includes('/checkout'), 'Excludes /checkout');
  assert(!pagesXml.includes('/admin'), 'Excludes /admin');
  assert(!pagesXml.includes('/login'), 'Excludes /login');
  assert(!pagesXml.includes('/profile'), 'Excludes /profile');

  // 3. Test Categories Sitemap
  console.log('\n3. Testing Categories Sitemap (/sitemap-categories.xml)...');
  const catXml = await generateCategoriesSitemapXml(true);
  assert(catXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
  assert(catXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Valid urlset namespace');
  assert(catXml.includes(`${SITE_URL}/bouquets`), 'Includes /bouquets category');
  assert(catXml.includes(`${SITE_URL}/roses`), 'Includes /roses category');
  assert(catXml.includes(`${SITE_URL}/combos`), 'Includes /combos category');

  const catLocMatches = catXml.match(/<loc>(.*?)<\/loc>/g) || [];
  const catLocs = catLocMatches.map(m => m.replace(/<\/?loc>/g, ''));
  const uniqueCatLocs = new Set(catLocs);
  assert(catLocs.length === uniqueCatLocs.size, `Zero duplicate category URLs (verified ${catLocs.length} unique categories)`);

  // 4. Test Products Sitemap
  console.log('\n4. Testing Products Sitemap (/sitemap-products.xml)...');
  const prodXml = await generateProductsSitemapXml(true);
  assert(prodXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
  assert(prodXml.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'), 'Google Image extension namespace present');
  assert(prodXml.includes('<image:image>'), 'Contains <image:image> blocks');
  assert(prodXml.includes('<image:loc>'), 'Contains <image:loc> image URLs');
  assert(prodXml.includes('<image:title>'), 'Contains <image:title> image titles');

  const prodLocMatches = prodXml.match(/<loc>(.*?)<\/loc>/g) || [];
  const prodLocs = prodLocMatches.map(m => m.replace(/<\/?loc>/g, ''));
  const uniqueProdLocs = new Set(prodLocs);
  assert(prodLocs.length === uniqueProdLocs.size, `Zero duplicate product URLs (verified ${prodLocs.length} unique products)`);
  assert(prodLocs.length >= 150, `Substantial catalog discoverability (${prodLocs.length} products discovered)`);

  // Verify XML escaping in titles
  assert(!prodXml.includes(' & ') && !prodXml.includes('<image:title> & </image:title>'), 'Ampersands properly escaped as &amp;');

  // 5. Test Occasions Sitemap
  console.log('\n5. Testing Occasions Sitemap (/sitemap-occasions.xml)...');
  const occXml = await generateOccasionsSitemapXml(true);
  assert(occXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration present');
  assert(occXml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Valid urlset namespace');
  assert(occXml.includes(`${SITE_URL}/occasions/birthday`), 'Includes birthday occasion');
  assert(occXml.includes(`${SITE_URL}/occasions/anniversary`), 'Includes anniversary occasion');

  const occLocMatches = occXml.match(/<loc>(.*?)<\/loc>/g) || [];
  const occLocs = occLocMatches.map(m => m.replace(/<\/?loc>/g, ''));
  const uniqueOccLocs = new Set(occLocs);
  assert(occLocs.length === uniqueOccLocs.size, `Zero duplicate occasion URLs (verified ${occLocs.length} unique occasions)`);

  // 6. Test Cross-Sitemap Disjointness (No overlapping URLs between child sitemaps)
  console.log('\n6. Testing Cross-Sitemap URL Disjointness...');
  const overlapPagesAndCats = pagesLocs = new Set(pagesXml.match(/<loc>(.*?)<\/loc>/g).map(m => m.replace(/<\/?loc>/g, '')));
  let collisionCount = 0;
  catLocs.forEach(catUrl => {
    if (pagesLocs.has(catUrl)) collisionCount++;
  });
  assert(collisionCount === 0, `No collision between static pages and categories (overlap: ${collisionCount})`);

  // 7. Test Robots.txt
  console.log('\n7. Testing Robots.txt...');
  const robots = generateRobotsTxt();
  assert(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'Robots.txt advertises primary sitemap index endpoint');
  assert(robots.includes('Disallow: /admin/'), 'Robots.txt blocks /admin/');
  assert(robots.includes('Disallow: /checkout/'), 'Robots.txt blocks /checkout/');
  assert(robots.includes('Allow: /bouquets'), 'Robots.txt explicitly allows /bouquets');

  // Summary
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log(`  Total Discovered Pages: ${pagesLocs.size}`);
  console.log(`  Total Discovered Categories: ${catLocs.length}`);
  console.log(`  Total Discovered Products: ${prodLocs.length}`);
  console.log(`  Total Discovered Occasions: ${occLocs.length}`);
  console.log(`  Total Indexable URLs in Sitemap System: ${pagesLocs.size + catLocs.length + prodLocs.length + occLocs.length}`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSitemapTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
