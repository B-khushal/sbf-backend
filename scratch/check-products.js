const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Product = require('../models/Product');
    const count = await Product.countDocuments({ seasonalCampaigns: { $exists: true, $not: { $size: 0 } } });
    console.log('Products with campaigns:', count);
    
    const products = await Product.find({ seasonalCampaigns: { $exists: true, $not: { $size: 0 } } }, 'title seasonalCampaigns campaignSettings').limit(5);
    console.log(JSON.stringify(products, null, 2));
    
    mongoose.disconnect();
  } catch (error) {
    console.error(error);
  }
};

run();
