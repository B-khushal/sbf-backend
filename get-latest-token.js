const mongoose = require('mongoose');
require('dotenv').config();

// Get the most recent token and return it
const getMostRecentToken = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const DeviceToken = require('./models/DeviceToken');
    const token = await DeviceToken.findOne({ isActive: true }).sort({ lastUsed: -1 });

    if (token) {
      console.log(token.token);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

getMostRecentToken();
