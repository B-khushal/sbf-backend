const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://khushalprasad242:ddkka2006@cluster0.qxae3.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

async function runTest() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const Settings = require('../models/settings');
    let settings = await Settings.findOne();
    if (!settings) {
      console.log('No settings document found! Creating one with defaults...');
      settings = await Settings.create({});
    }

    console.log('Current WhatsApp Settings (before test):', settings.notificationsSettings?.whatsappFloating);

    // Ensure notificationsSettings subdoc exists
    if (!settings.notificationsSettings) {
      settings.notificationsSettings = {};
    }
    if (!settings.notificationsSettings.whatsappFloating) {
      settings.notificationsSettings.whatsappFloating = {};
    }

    // Toggle the value to verify persistence
    const originalVal = !!settings.notificationsSettings.whatsappFloating.showOnlyOnHomepage;
    const testVal = !originalVal;

    console.log(`Setting showOnlyOnHomepage from ${originalVal} to ${testVal}...`);
    settings.notificationsSettings.whatsappFloating.showOnlyOnHomepage = testVal;
    
    // Save settings
    settings.markModified('notificationsSettings');
    await settings.save();
    console.log('Settings saved.');

    // Fetch again
    const reloadedSettings = await Settings.findOne();
    const loadedVal = reloadedSettings.notificationsSettings?.whatsappFloating?.showOnlyOnHomepage;
    console.log('WhatsApp Settings after reloading from DB:', reloadedSettings.notificationsSettings?.whatsappFloating);
    
    if (loadedVal === testVal) {
      console.log('✅ Success: New field successfully persisted in Mongoose/MongoDB!');
    } else {
      console.log('❌ Failure: Field did not persist correctly.');
    }

    // Restore original value
    console.log(`Restoring showOnlyOnHomepage back to original value: ${originalVal}...`);
    reloadedSettings.notificationsSettings.whatsappFloating.showOnlyOnHomepage = originalVal;
    reloadedSettings.markModified('notificationsSettings');
    await reloadedSettings.save();
    console.log('Restored successfully.');

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

runTest();
