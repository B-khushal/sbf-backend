const mongoose = require('mongoose');
require('dotenv').config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const SeasonalCampaign = require('../models/SeasonalCampaign');
    
    console.log('🔄 Loading existing seasonal campaigns...');
    const campaigns = await SeasonalCampaign.find({});
    console.log(`Found ${campaigns.length} campaigns.`);
    
    for (const campaign of campaigns) {
      console.log(`Syncing offers for campaign: "${campaign.name}"...`);
      await SeasonalCampaign.syncOffers(campaign);
    }
    
    console.log('✅ Sync completed successfully!');
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
};

run();
