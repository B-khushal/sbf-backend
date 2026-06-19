const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const SeasonalCampaign = require('../models/SeasonalCampaign');
    
    console.log('🗑️ Clearing existing campaigns...');
    await SeasonalCampaign.deleteMany({});
    
    console.log('🌱 Reseeding default occasions...');
    await SeasonalCampaign.seedDefaultCampaigns();
    
    // Enable Father's Day by default to make testing easy
    console.log('👨 Enabling Father\'s Day campaign...');
    const fd = await SeasonalCampaign.findOne({ slug: 'fathers-day' });
    if (fd) {
      fd.enabled = true;
      await fd.save();
      await SeasonalCampaign.syncOffers(fd);
    }
    
    console.log('✅ Reseed and sync completed successfully!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Reseed failed:', error);
  }
};

run();
