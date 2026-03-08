/**
 * Script to fix the vendor user index to allow multiple null values
 * Run this once to fix the duplicate key error
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

const fixVendorIndex = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const vendorsCollection = db.collection('vendors');

        // Drop the old user_1 index
        try {
            await vendorsCollection.dropIndex('user_1');
            console.log('✅ Dropped old user_1 index');
        } catch (err) {
            console.log('⚠️ Index user_1 does not exist or already dropped');
        }

        // Create new sparse unique index on user field
        await vendorsCollection.createIndex(
            { user: 1 },
            { sparse: true, unique: true }
        );
        console.log('✅ Created new sparse unique index on user field');

        console.log('\n🎉 Index fix completed successfully!');
        console.log('You can now submit vendor applications without user accounts.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing vendor index:', error);
        process.exit(1);
    }
};

fixVendorIndex();
