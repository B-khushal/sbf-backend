const { renderCrawlerHtml, generateRobotsTxt, generateSitemapXml } = require('../services/seoService');

async function testSeo() {
  console.log('=== TESTING ROBOTS.TXT ===');
  const robots = generateRobotsTxt();
  console.log('Robots has /bouquets:', robots.includes('Allow: /bouquets'));
  console.log('Robots has /roses:', robots.includes('Allow: /roses'));
  console.log('Robots has /cakes:', robots.includes('Allow: /cakes'));
  console.log('Robots has /combos:', robots.includes('Allow: /combos'));
  console.log('Robots has /flower-baskets:', robots.includes('Allow: /flower-baskets'));
  console.log('Robots has Disallow /admin/:', robots.includes('Disallow: /admin/'));

  console.log('\n=== TESTING SITEMAP XML ===');
  const sitemap = await generateSitemapXml();
  const testUrls = [
    'https://sbflorist.in/bouquets',
    'https://sbflorist.in/roses',
    'https://sbflorist.in/cakes',
    'https://sbflorist.in/combos',
    'https://sbflorist.in/sunflowers',
    'https://sbflorist.in/lilies',
    'https://sbflorist.in/flower-baskets',
    'https://sbflorist.in/hydrangea'
  ];
  for (const url of testUrls) {
    console.log(`Sitemap includes ${url}:`, sitemap.includes(`<loc>${url}</loc>`));
  }

  console.log('\n=== TESTING CRAWLER PRERENDERED HTML ===');
  const testPaths = [
    '/',
    '/bouquets',
    '/roses',
    '/cakes',
    '/combos',
    '/sunflowers',
    '/lilies',
    '/flower-baskets',
    '/hydrangea'
  ];

  for (const p of testPaths) {
    const html = await renderCrawlerHtml(p);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const allH1Matches = [...html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)].map(m => m[1].trim());
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);

    console.log(`\n[Path: ${p}]`);
    console.log('  Title:    ', titleMatch ? titleMatch[1] : 'NONE');
    console.log('  All H1s:  ', allH1Matches);
    console.log('  Canonical:', canonicalMatch ? canonicalMatch[1] : 'NONE');
    console.log('  Desc:     ', descMatch ? descMatch[1].slice(0, 80) + '...' : 'NONE');
  }

  process.exit(0);
}

testSeo().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
