const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const connectDB = require('../config/db');

async function inspectDb() {
  try {
    await connectDB();
    const Product = require('../models/Product');
    const Category = require('../models/Category');
    const Occasion = require('../models/Occasion');
    const Settings = require('../models/settings');

    const productCount = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ hidden: { $ne: true } });
    const categoryCount = await Category.countDocuments();
    const occasionCount = await Occasion.countDocuments();
    const settings = await Settings.findOne();

    console.log('--- DATABASE STATS ---');
    console.log('Total Products:', productCount);
    console.log('Active Products:', activeProducts);
    console.log('Total Categories:', categoryCount);
    console.log('Total Occasions:', occasionCount);

    const sampleProducts = await Product.find({ hidden: { $ne: true } }).limit(8);
    console.log('\n--- SAMPLE ACTIVE PRODUCTS ---');
    sampleProducts.forEach(p => {
      console.log(`- Title: "${p.title}" | Price: ₹${p.price} | Category: ${p.category} | slug: ${p.slug || p.valentineSlug || p._id}`);
    });

    const categories = await Category.find().limit(20);
    console.log('\n--- SAMPLE CATEGORIES ---');
    categories.forEach(c => {
      console.log(`- Name: "${c.name}" | slug: ${c.slug} | parentId: ${c.parentId} | url: ${c.categoryUrl}`);
    });

    const occasions = await Occasion.find().limit(10);
    console.log('\n--- SAMPLE OCCASIONS ---');
    occasions.forEach(o => {
      console.log(`- Name: "${o.name}" | slug: ${o.slug} | seoTitle: "${o.seoTitle}"`);
    });

    if (settings) {
      console.log('\n--- SETTINGS STORE INFO ---');
      console.log('Store Name:', settings.storeName || settings.name);
      console.log('Phone:', settings.footerSettings?.contactInfo?.phone);
      console.log('Address:', settings.footerSettings?.contactInfo?.address);
      console.log('Email:', settings.footerSettings?.contactInfo?.email);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error inspecting DB:', err);
    process.exit(1);
  }
}

inspectDb();
