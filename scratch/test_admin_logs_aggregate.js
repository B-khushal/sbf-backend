const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// Import models
const Settings = require('../models/settings');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

async function runTest() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to:', mongoose.connection.name);

    // 1. Fetch current settings
    const settingsDoc = await Settings.findOne();
    const currentToggle = settingsDoc?.globalSettings?.showAdminLogsInUserActivity ?? false;
    console.log('\n--- Current Settings ---');
    console.log('showAdminLogsInUserActivity:', currentToggle);

    // 2. Fetch log counts by role and user lookup to see what data exists
    console.log('\n--- Total Activity Logs in DB ---');
    const totalLogsCount = await ActivityLog.countDocuments();
    console.log('Total logs:', totalLogsCount);

    // Run custom verification pipeline
    async function testPipeline(showAdminLogsVal, userTypeVal) {
      console.log(`\n--- Testing pipeline with toggle = ${showAdminLogsVal}, userType = "${userTypeVal}" ---`);
      
      let effectiveUserType = userTypeVal;
      if (!showAdminLogsVal) {
        effectiveUserType = 'customer';
      }

      const pipeline = [
        { $match: {} }, // BaseMatch
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (effectiveUserType === 'customer') {
        pipeline.push({
          $match: {
            $or: [
              { 'user._id': { $exists: false } },
              { 'user.role': 'user' },
            ],
          },
        });
      } else if (effectiveUserType === 'admin') {
        pipeline.push({
          $match: {
            'user._id': { $exists: true },
            'user.role': { $in: ['admin', 'vendor'] },
          },
        });
      }

      pipeline.push({
        $addFields: {
          resolvedUserName: { $ifNull: ['$user.name', '$userName'] },
          resolvedEmail: { $ifNull: ['$user.email', '$email'] },
        },
      });

      pipeline.push({
        $facet: {
          logs: [
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                userName: '$resolvedUserName',
                email: '$resolvedEmail',
                role: { $ifNull: ['$user.role', 'user'] },
                actionType: 1,
                timestamp: 1,
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      });

      const result = await ActivityLog.aggregate(pipeline);
      const logs = result[0]?.logs || [];
      const total = result[0]?.totalCount[0]?.count || 0;

      console.log(`Total count matching: ${total}`);
      console.log('Sample logs:');
      logs.forEach(l => {
        console.log(` - User: ${l.userName} (${l.role}), Action: ${l.actionType}`);
      });
    }

    // Run combinations
    await testPipeline(false, 'all');       // Should force to 'customer'
    await testPipeline(false, 'admin');     // Should force to 'customer'
    await testPipeline(true, 'all');        // Both admin and customer
    await testPipeline(true, 'customer');   // Only customer
    await testPipeline(true, 'admin');      // Only admin

  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
}

runTest();
