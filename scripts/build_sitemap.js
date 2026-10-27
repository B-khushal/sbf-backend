const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../config/db');
const { generateSitemapXml, generateRobotsTxt } = require('../services/seoService');

async function buildStaticSitemap() {
  try {
    await connectDB();
    console.log('Generating dynamic XML sitemap from database...');
    const sitemapXml = await generateSitemapXml();
    const robotsTxt = generateRobotsTxt();

    const targets = [
      path.resolve(__dirname, '../../sbf-main/public/sitemap.xml'),
      path.resolve(__dirname, '../../sbf-main/dist/sitemap.xml')
    ];

    targets.forEach(target => {
      try {
        const dir = path.dirname(target);
        if (fs.existsSync(dir)) {
          fs.writeFileSync(target, sitemapXml, 'utf8');
          console.log(`✅ Saved sitemap to: ${target}`);
        }
      } catch (e) {
        console.warn(`Could not write to ${target}:`, e.message);
      }
    });

    const robotsTargets = [
      path.resolve(__dirname, '../../sbf-main/public/robots.txt'),
      path.resolve(__dirname, '../../sbf-main/dist/robots.txt')
    ];

    robotsTargets.forEach(target => {
      try {
        const dir = path.dirname(target);
        if (fs.existsSync(dir)) {
          fs.writeFileSync(target, robotsTxt, 'utf8');
          console.log(`✅ Saved robots.txt to: ${target}`);
        }
      } catch (e) {
        console.warn(`Could not write to ${target}:`, e.message);
      }
    });

    console.log('Sitemap and robots build completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error building static sitemap:', err);
    process.exit(1);
  }
}

buildStaticSitemap();
