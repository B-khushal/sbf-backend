/**
 * ============================================================================
 * SBFlorist Production Launch Test Data Cleanup Script
 * ============================================================================
 * 
 * Safe cleanup of testing/demo data before production launch:
 * 1. Identifies test orders based on isTestOrder flag, test customer helper checks,
 *    and matching the name/email/details containing "rahul" (case-insensitive).
 * 2. Backups all matching orders and related documents (payouts, assignments, logs, etc.)
 *    to server/scripts/backups/cleanup_test_data_<timestamp>/ before deletion.
 * 3. Permanently deletes these test records.
 * 4. Recalculates Vendor analytics and PromoCode usedCount based on remaining real orders.
 * 5. Generates an audit log.
 * 
 * Usage:
 *   Dry Run (Verify what will be deleted):
 *     node scripts/cleanProductionTestData.js
 * 
 *   Execute Deletion (Backup, delete, and recalculate):
 *     node scripts/cleanProductionTestData.js --execute
 * 
 * ============================================================================
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// --- Models ---
const Order = require('../models/Order');
const VendorPayout = require('../models/VendorPayout');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const ReviewEmailLog = require('../models/ReviewEmailLog');
const Vendor = require('../models/Vendor');
const PromoCode = require('../models/PromoCode');
const Product = require('../models/Product');
const User = require('../models/User');

// --- Delivery Logistics Models ---
const DeliveryAssignment = require('../models/DeliveryAssignment');
const DeliveryEarning = require('../models/DeliveryEarning');
const DeliveryLocation = require('../models/DeliveryLocation');
const DeliveryProof = require('../models/DeliveryProof');

const { checkIsPlaceholderCustomer } = require('../utils/testCustomerHelper');

// Configurations
const ORDER_RELATED_ACTION_PATTERNS = [
  /order/i,
  /payment/i,
  /refund/i,
  /delivery/i,
  /checkout/i,
  /invoice/i,
  /transaction/i,
];

// Helper functions
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const formatCount = (n) => n.toLocaleString('en-IN');
const separator = () => console.log('─'.repeat(80));

async function main() {
  const isExecute = process.argv.includes('--execute');
  
  separator();
  console.log(`🚀 SBFlorist Production Data Cleanup Tool`);
  console.log(`📅 Executed on: ${new Date().toLocaleString()}`);
  console.log(`⚙️  Mode: ${isExecute ? '⚠️ EXECUTE DELETION' : '🔍 DRY RUN (SIMULATION)'}`);
  separator();

  // Connect to MongoDB
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI not found in environment variables.');
    process.exit(1);
  }

  console.log(`🔗 Connecting to database...`);
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`✅ Connected to: ${mongoose.connection.name}`);
  separator();

  // 1. Identify Test Orders
  console.log('🔍 Step 1: Identifying test orders for name "rahul" or placeholder fields...');
  const allOrders = await Order.find({}).lean();
  
  const testOrders = [];
  const realOrders = [];

  for (const order of allOrders) {
    const isExplicitTest = order.isTestOrder === true;
    const placeholderCheck = checkIsPlaceholderCustomer(order);
    
    // User filter: "make sure to remove only the test orders as with name rahul"
    const fullName = order.shippingDetails?.fullName || '';
    const email = order.shippingDetails?.email || '';
    const hasRahulName = fullName.toLowerCase().includes('rahul') || email.toLowerCase().includes('rahul');
    
    if ((isExplicitTest || placeholderCheck.isPlaceholder) && hasRahulName) {
      testOrders.push({
        order,
        reason: isExplicitTest ? 'isTestOrder flag set to true' : placeholderCheck.reason
      });
    } else {
      realOrders.push(order);
    }
  }

  console.log(`   Found ${testOrders.length} test orders to delete.`);
  console.log(`   Found ${realOrders.length} real orders to preserve.`);
  
  if (testOrders.length === 0) {
    console.log('\n✅ No test orders matching target criteria found in the database. Nothing to clean.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nTest orders identified for deletion:');
  testOrders.forEach(({ order, reason }, idx) => {
    console.log(`   ${idx + 1}. Order #${order.orderNumber} - Customer: ${order.shippingDetails?.fullName} (${order.shippingDetails?.email}) - Amount: INR ${order.finalTotal || order.totalAmount} - Reason: ${reason}`);
  });
  separator();

  const testOrderIds = testOrders.map(t => t.order._id);
  const testOrderNumbers = testOrders.map(t => t.order.orderNumber);

  // 2. Identify Associated Records
  console.log('🔍 Step 2: Querying associated test records...');
  
  const testPayouts = await VendorPayout.find({ 'orders.orderId': { $in: testOrderIds } }).lean();
  const testReviewLogs = await ReviewEmailLog.find({ order: { $in: testOrderIds } }).lean();
  const testNotifications = await Notification.find({ 
    $or: [
      { type: 'order', title: { $regex: new RegExp(testOrderNumbers.join('|'), 'i') } },
      { message: { $regex: new RegExp(testOrderNumbers.join('|'), 'i') } }
    ]
  }).lean();
  
  const testActivityLogs = await ActivityLog.find({
    $or: [
      { actionDetails: { $regex: new RegExp(testOrderNumbers.join('|'), 'i') } },
      { description: { $regex: new RegExp(testOrderNumbers.join('|'), 'i') } },
      { orderId: { $in: testOrderIds } }
    ]
  }).lean();

  const testAssignments = await DeliveryAssignment.find({ orderId: { $in: testOrderIds } }).lean();
  const testAssignmentIds = testAssignments.map(a => a._id);

  const testEarnings = await DeliveryEarning.find({ assignmentId: { $in: testAssignmentIds } }).lean();
  const testLocations = await DeliveryLocation.find({ assignmentId: { $in: testAssignmentIds } }).lean();
  const testProofs = await DeliveryProof.find({ assignmentId: { $in: testAssignmentIds } }).lean();

  console.log(`   Associated records found:`);
  console.log(`     • Vendor Payouts: ${testPayouts.length}`);
  console.log(`     • Review Email Logs: ${testReviewLogs.length}`);
  console.log(`     • Notifications: ${testNotifications.length}`);
  console.log(`     • Activity Logs: ${testActivityLogs.length}`);
  console.log(`     • Delivery Assignments: ${testAssignments.length}`);
  console.log(`     • Delivery Earnings: ${testEarnings.length}`);
  console.log(`     • Delivery Locations: ${testLocations.length}`);
  console.log(`     • Delivery Proofs: ${testProofs.length}`);
  separator();

  // If Dry Run, end here
  if (!isExecute) {
    console.log(`🔍 DRY RUN COMPLETE. No data was deleted.`);
    console.log(`   To execute this deletion, run the script with --execute flag:`);
    console.log(`   node scripts/cleanProductionTestData.js --execute`);
    await mongoose.disconnect();
    return;
  }

  // 3. Create Backup
  console.log('📦 Step 3: Creating backups before deletion...');
  const backupDir = path.join(__dirname, 'backups', `cleanup_test_data_${timestamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const backupData = {
    orders: testOrders.map(t => t.order),
    vendorpayouts: testPayouts,
    reviewemaillogs: testReviewLogs,
    notifications: testNotifications,
    activitylogs: testActivityLogs,
    deliveryassignments: testAssignments,
    deliveryearnings: testEarnings,
    deliverylocations: testLocations,
    deliveryproofs: testProofs
  };

  for (const [key, docs] of Object.entries(backupData)) {
    const filePath = path.join(backupDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
    console.log(`   💾 Saved ${docs.length} ${key} to ${path.basename(filePath)}`);
  }
  console.log(`   ✅ Backups saved in folder: ${backupDir}`);
  separator();

  // 4. Perform Deletions
  console.log('🗑️  Step 4: Deleting test data permanently...');
  
  const orderDel = await Order.deleteMany({ _id: { $in: testOrderIds } });
  console.log(`   Deleted Orders: ${formatCount(orderDel.deletedCount)}`);

  const payoutDel = await VendorPayout.deleteMany({ 'orders.orderId': { $in: testOrderIds } });
  console.log(`   Deleted Vendor Payouts: ${formatCount(payoutDel.deletedCount)}`);

  const reviewLogDel = await ReviewEmailLog.deleteMany({ order: { $in: testOrderIds } });
  console.log(`   Deleted Review Email Logs: ${formatCount(reviewLogDel.deletedCount)}`);

  const notifDel = await Notification.deleteMany({ _id: { $in: testNotifications.map(n => n._id) } });
  console.log(`   Deleted Order Notifications: ${formatCount(notifDel.deletedCount)}`);

  const activityDel = await ActivityLog.deleteMany({ _id: { $in: testActivityLogs.map(l => l._id) } });
  console.log(`   Deleted Order Activity Logs: ${formatCount(activityDel.deletedCount)}`);

  const proofDel = await DeliveryProof.deleteMany({ assignmentId: { $in: testAssignmentIds } });
  console.log(`   Deleted Delivery Proofs: ${formatCount(proofDel.deletedCount)}`);

  const locationDel = await DeliveryLocation.deleteMany({ assignmentId: { $in: testAssignmentIds } });
  console.log(`   Deleted Delivery Locations: ${formatCount(locationDel.deletedCount)}`);

  const earningDel = await DeliveryEarning.deleteMany({ assignmentId: { $in: testAssignmentIds } });
  console.log(`   Deleted Delivery Earnings: ${formatCount(earningDel.deletedCount)}`);

  const assignDel = await DeliveryAssignment.deleteMany({ _id: { $in: testAssignmentIds } });
  console.log(`   Deleted Delivery Assignments: ${formatCount(assignDel.deletedCount)}`);

  separator();

  // 5. Recalculate Vendor Analytics
  console.log('🔄 Step 5: Recalculating analytics for remaining real orders...');
  
  const vendors = await Vendor.find({});
  console.log(`   Processing ${vendors.length} vendors...`);

  for (const vendor of vendors) {
    // Get product IDs for this vendor
    const vendorProducts = await Product.find({ vendor: vendor._id }, '_id');
    const productIds = vendorProducts.map(p => p._id.toString());

    // Aggregate remaining orders for this vendor
    const stats = await Order.aggregate([
      {
        $match: {
          'items.product': { $in: vendorProducts.map(p => p._id) },
          status: { $in: ['delivered', 'completed'] }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': { $in: vendorProducts.map(p => p._id) }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $multiply: [
                '$items.quantity',
                { $ifNull: ['$items.finalPrice', '$items.price'] }
              ]
            }
          },
          totalOrders: { $addToSet: '$_id' }
        }
      }
    ]);

    const totalRevenue = stats[0]?.totalRevenue || 0;
    const totalOrdersCount = stats[0]?.totalOrders?.length || 0;
    
    // Calculate commission
    const earnings = vendor.calculateEarnings(totalRevenue);
    const platformCommission = earnings.platformCommission;

    // Update Vendor document
    await Vendor.updateOne(
      { _id: vendor._id },
      {
        $set: {
          'analytics.totalOrders': totalOrdersCount,
          'analytics.totalRevenue': totalRevenue,
          'analytics.totalCommissionPaid': platformCommission
        }
      }
    );
    console.log(`     • Recalculated Vendor "${vendor.storeName}": orders=${totalOrdersCount}, revenue=INR ${totalRevenue.toFixed(2)}, commission=INR ${platformCommission.toFixed(2)}`);
  }

  // 6. Recalculate PromoCode usedCount
  console.log('\n🔄 Step 6: Recalculating PromoCode usage counts...');
  const promoCodes = await PromoCode.find({});
  for (const promo of promoCodes) {
    const usageCount = await Order.countDocuments({
      'promoCode.code': promo.code
    });
    
    await PromoCode.updateOne(
      { _id: promo._id },
      { $set: { usedCount: usageCount } }
    );
    console.log(`     • Recalculated PromoCode "${promo.code}": usedCount=${usageCount}`);
  }
  separator();

  // 7. Write Audit Log
  const logDir = path.join(__dirname, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const auditLogPath = path.join(logDir, 'cleanup_audit.log');
  
  const logEntry = `[${new Date().toISOString()}] CLEANUP EXECUTION
- Deleted Orders: ${testOrderIds.length} (${testOrderNumbers.join(', ')})
- Deleted Associated records:
  * Payouts: ${testPayouts.length}
  * Assignments: ${testAssignments.length}
  * Locations: ${testLocations.length}
  * Earnings: ${testEarnings.length}
  * Proofs: ${testProofs.length}
  * Notifications: ${testNotifications.length}
  * Review logs: ${testReviewLogs.length}
  * Activity logs: ${testActivityLogs.length}
- Recalculated Vendor Analytics for ${vendors.length} vendors
- Recalculated PromoCode counts for ${promoCodes.length} promo codes
- Backup directory: ${backupDir}
--------------------------------------------------------------\n`;

  fs.appendFileSync(auditLogPath, logEntry);
  console.log(`📝 Audit log written to: ${auditLogPath}`);
  
  console.log('\n🎉 CLEANUP COMPLETED SUCCESSFULLY!');
  separator();
  
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌ FATAL ERROR IN CLEANUP:', err);
  process.exit(1);
});
