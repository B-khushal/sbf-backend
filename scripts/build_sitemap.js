const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const {
  generateSitemapIndexXml,
  generatePagesSitemapXml,
  generateCategoriesSitemapXml,
  generateProductsSitemapXml,
  generateOccasionsSitemapXml,
  generateRobotsTxt
} = require('../services/seoService');

async function buildStaticSitemap() {
  try {
    await connectDB();
    console.log('Generating dynamic XML sitemaps from database...');

    const [indexXml, pagesXml, catXml, prodXml, occXml] = await Promise.all([
      generateSitemapIndexXml(true),
      generatePagesSitemapXml(true),
      generateCategoriesSitemapXml(true),
      generateProductsSitemapXml(true),
      generateOccasionsSitemapXml(true)
    ]);
    const robotsTxt = generateRobotsTxt();

    const outputFiles = [
      { filename: 'sitemap.xml', content: indexXml },
      { filename: 'sitemap-pages.xml', content: pagesXml },
      { filename: 'sitemap-static.xml', content: pagesXml },
      { filename: 'sitemap-categories.xml', content: catXml },
      { filename: 'sitemap-products.xml', content: prodXml },
      { filename: 'sitemap-occasions.xml', content: occXml },
      { filename: 'robots.txt', content: robotsTxt }
    ];

    const targetDirs = [
      path.resolve(__dirname, '../../sbf-main/public'),
      path.resolve(__dirname, '../../sbf-main/dist')
    ];

    targetDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        outputFiles.forEach(file => {
          try {
            const filePath = path.join(dir, file.filename);
            fs.writeFileSync(filePath, file.content, 'utf8');
            console.log(`✅ Saved ${file.filename} to: ${filePath}`);
          } catch (e) {
            console.warn(`Could not write ${file.filename} to ${dir}:`, e.message);
          }
        });
      }
    });

    console.log('Sitemap Index and child sitemaps build completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error building static sitemaps:', err);
    process.exit(1);
  }
}

buildStaticSitemap();
