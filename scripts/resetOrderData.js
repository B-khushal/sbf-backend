/**
 * ============================================================================
 * RESET ORDER DATA SCRIPT
 * ============================================================================
 * 
 * Deletes all order-related data from the database while preserving
 * users, products, categories, reviews, settings, and all other data.
 * 
 * Creates JSON backups before deletion.
 * 
 * Usage:
 *   node scripts/resetOrderData.js
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

// Models for verification (preserved data)
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Settings = require('../models/settings');

// ─── Configuration ──────────────────────────────────────────────────────────

// Action types considered order-related for ActivityLog cleanup
const ORDER_RELATED_ACTION_PATTERNS = [
  /order/i,
  /payment/i,
  /refund/i,
  /delivery/i,
  /checkout/i,
  /invoice/i,
  /transaction/i,
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const separator = () => console.log('─'.repeat(60));

const formatCount = (n) => n.toLocaleString('en-IN');

async function safeCount(Model, filter = {}) {
  try {
    return await Model.countDocuments(filter);
  } catch {
    return 'N/A';
  }
}

// ─── Backup ─────────────────────────────────────────────────────────────────

async function createBackups(backupDir) {
  console.log('\n📦 STEP 1: Creating backups...\n');

  fs.mkdirSync(backupDir, { recursive: true });

  const collections = [
    { name: 'orders', Model: Order, filter: {} },
    { name: 'vendorpayouts', Model: VendorPayout, filter: {} },
    { name: 'reviewemaillogs', Model: ReviewEmailLog, filter: {} },
    { name: 'notifications_order', Model: Notification, filter: { type: 'order' } },
    {
      name: 'activitylogs_order',
      Model: ActivityLog,
      filter: {
        $or: ORDER_RELATED_ACTION_PATTERNS.map((pattern) => ({
          actionType: { $regex: pattern },
        })),
      },
    },
  ];

  const backupResults = {};

  for (const { name, Model, filter } of collections) {
    try {
      const docs = await Model.find(filter).lean();
      const filePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
      backupResults[name] = docs.length;
      console.log(`   ✅ ${name}: ${formatCount(docs.length)} records → ${path.basename(filePath)}`);
    } catch (err) {
      backupResults[name] = `ERROR: ${err.message}`;
      console.log(`   ⚠️  ${name}: Backup failed - ${err.message}`);
    }
  }

  // Also backup vendor analytics and promo usedCount (for rollback reference)
  try {
    const vendors = await Vendor.find({}, 'storeName analytics').lean();
    fs.writeFileSync(
      path.join(backupDir, 'vendor_analytics_snapshot.json'),
      JSON.stringify(vendors, null, 2)
    );
    console.log(`   ✅ vendor_analytics: ${formatCount(vendors.length)} vendor snapshots`);
  } catch (err) {
    console.log(`   ⚠️  vendor_analytics: Backup failed - ${err.message}`);
  }

  try {
    const promos = await PromoCode.find({}, 'code usedCount').lean();
    fs.writeFileSync(
      path.join(backupDir, 'promocode_usedcount_snapshot.json'),
      JSON.stringify(promos, null, 2)
    );
    console.log(`   ✅ promocode_usedcount: ${formatCount(promos.length)} promo code snapshots`);
  } catch (err) {
    console.log(`   ⚠️  promocode_usedcount: Backup failed - ${err.message}`);
  }

  return backupResults;
}

// ─── Deletion ───────────────────────────────────────────────────────────────

async function deleteOrderData() {
  console.log('\n🗑️  STEP 2: Deleting order-related data...\n');

  const results = {};

  // 1. Delete all orders
  try {
    const r = await Order.deleteMany({});
    results.orders = r.deletedCount;
    console.log(`   ✅ Orders deleted: ${formatCount(r.deletedCount)}`);
  } catch (err) {
    results.orders = `ERROR: ${err.message}`;
    console.log(`   ❌ Orders: ${err.message}`);
  }

  // 2. Delete all vendor payouts
  try {
    const r = await VendorPayout.deleteMany({});
    results.vendorPayouts = r.deletedCount;
    console.log(`   ✅ Vendor payouts deleted: ${formatCount(r.deletedCount)}`);
  } catch (err) {
    results.vendorPayouts = `ERROR: ${err.message}`;
    console.log(`   ❌ Vendor payouts: ${err.message}`);
  }

  // 3. Delete all review email logs (they reference orders)
  try {
    const r = await ReviewEmailLog.deleteMany({});
    results.reviewEmailLogs = r.deletedCount;
    console.log(`   ✅ Review email logs deleted: ${formatCount(r.deletedCount)}`);
  } catch (err) {
    results.reviewEmailLogs = `ERROR: ${err.message}`;
    console.log(`   ❌ Review email logs: ${err.message}`);
  }

  // 4. Delete order-type notifications ONLY
  try {
    const r = await Notification.deleteMany({ type: 'order' });
    results.orderNotifications = r.deletedCount;
    console.log(`   ✅ Order notifications deleted: ${formatCount(r.deletedCount)}`);
  } catch (err) {
    results.orderNotifications = `ERROR: ${err.message}`;
    console.log(`   ❌ Order notifications: ${err.message}`);
  }

  // 5. Delete order-related activity logs ONLY
  try {
    const r = await ActivityLog.deleteMany({
      $or: ORDER_RELATED_ACTION_PATTERNS.map((pattern) => ({
        actionType: { $regex: pattern },
      })),
    });
    results.orderActivityLogs = r.deletedCount;
    console.log(`   ✅ Order-related activity logs deleted: ${formatCount(r.deletedCount)}`);
  } catch (err) {
    results.orderActivityLogs = `ERROR: ${err.message}`;
    console.log(`   ❌ Order activity logs: ${err.message}`);
  }

  return results;
}

// ─── Reset Counters ─────────────────────────────────────────────────────────

async function resetCounters() {
  console.log('\n🔄 STEP 3: Resetting analytics counters...\n');

  const results = {};

  // 1. Reset vendor analytics
  try {
    const r = await Vendor.updateMany(
      {},
      {
        $set: {
          'analytics.totalOrders': 0,
          'analytics.totalRevenue': 0,
          'analytics.totalCommissionPaid': 0,
        },
      }
    );
    results.vendorAnalyticsReset = r.modifiedCount;
    console.log(`   ✅ Vendor analytics reset: ${formatCount(r.modifiedCount)} vendors updated`);
  } catch (err) {
    results.vendorAnalyticsReset = `ERROR: ${err.message}`;
    console.log(`   ❌ Vendor analytics: ${err.message}`);
  }

  // 2. Reset promo code usage counts
  try {
    const r = await PromoCode.updateMany(
      { usedCount: { $gt: 0 } },
      { $set: { usedCount: 0 } }
    );
    results.promoCodeReset = r.modifiedCount;
    console.log(`   ✅ PromoCode usedCount reset: ${formatCount(r.modifiedCount)} codes updated`);
  } catch (err) {
    results.promoCodeReset = `ERROR: ${err.message}`;
    console.log(`   ❌ PromoCode usedCount: ${err.message}`);
  }

  return results;
}

// ─── Verification ───────────────────────────────────────────────────────────

async function verifyReset() {
  console.log('\n✅ STEP 4: Verification Report\n');

  separator();
  console.log('  ORDER-RELATED DATA (should all be 0)');
  separator();

  const orderCount = await safeCount(Order);
  const payoutCount = await safeCount(VendorPayout);
  const reviewEmailLogCount = await safeCount(ReviewEmailLog);
  const orderNotifCount = await safeCount(Notification, { type: 'order' });

  console.log(`  Total Orders:              ${formatCount(orderCount)}`);
  console.log(`  Vendor Payouts:            ${formatCount(payoutCount)}`);
  console.log(`  Review Email Logs:         ${formatCount(reviewEmailLogCount)}`);
  console.log(`  Order Notifications:       ${formatCount(orderNotifCount)}`);

  separator();
  console.log('  PRESERVED DATA (should be unchanged)');
  separator();

  const userCount = await safeCount(User);
  const productCount = await safeCount(Product);
  let categoryCount;
  try {
    categoryCount = await Category.countDocuments();
  } catch {
    categoryCount = 'N/A (may be stored in Settings)';
  }
  let reviewCount;
  try {
    reviewCount = await Review.countDocuments();
  } catch {
    reviewCount = 'N/A';
  }
  const vendorCount = await safeCount(Vendor);
  const promoCount = await safeCount(PromoCode);
  let settingsCount;
  try {
    settingsCount = await Settings.countDocuments();
  } catch {
    settingsCount = 'N/A';
  }
  const nonOrderNotifCount = await safeCount(Notification, { type: { $ne: 'order' } });
  const nonOrderActivityCount = await safeCount(ActivityLog);

  console.log(`  Users/Customers:           ${formatCount(userCount)}`);
  console.log(`  Products:                  ${formatCount(productCount)}`);
  console.log(`  Categories:                ${categoryCount}`);
  console.log(`  Reviews:                   ${reviewCount}`);
  console.log(`  Vendors:                   ${formatCount(vendorCount)}`);
  console.log(`  Promo Codes:               ${formatCount(promoCount)}`);
  console.log(`  Settings:                  ${settingsCount}`);
  console.log(`  Non-order Notifications:   ${formatCount(nonOrderNotifCount)}`);
  console.log(`  Remaining Activity Logs:   ${formatCount(nonOrderActivityCount)}`);

  separator();
  console.log('  FINANCIAL METRICS (should all be ₹0)');
  separator();

  // Simulate what the dashboard controller would return
  const totalRevenue = await Order.aggregate([
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const revenue = totalRevenue[0]?.total || 0;

  console.log(`  Total Revenue:             ₹${formatCount(revenue)}`);
  console.log(`  Total Orders:              ${formatCount(orderCount)}`);
  console.log(`  Sales Analytics:           ${formatCount(orderCount)}`);
  console.log(`  Order History:             ${orderCount === 0 ? 'Empty' : orderCount}`);

  separator();

  // Check vendor analytics are zeroed
  const vendorsWithOrders = await Vendor.countDocuments({
    $or: [
      { 'analytics.totalOrders': { $gt: 0 } },
      { 'analytics.totalRevenue': { $gt: 0 } },
      { 'analytics.totalCommissionPaid': { $gt: 0 } },
    ],
  });
  console.log(`  Vendors with non-zero analytics: ${vendorsWithOrders} (should be 0)`);

  // Check promo codes are zeroed
  const promosWithUsage = await PromoCode.countDocuments({ usedCount: { $gt: 0 } });
  console.log(`  PromoCodes with non-zero usedCount: ${promosWithUsage} (should be 0)`);

  separator();

  const allClear =
    orderCount === 0 &&
    payoutCount === 0 &&
    reviewEmailLogCount === 0 &&
    orderNotifCount === 0 &&
    revenue === 0 &&
    vendorsWithOrders === 0 &&
    promosWithUsage === 0;

  if (allClear) {
    console.log('\n🎉 VERIFICATION PASSED — All order/revenue data has been reset.');
    console.log('   Products, users, and all other data remain intact.\n');
  } else {
    console.log('\n⚠️  VERIFICATION WARNING — Some data may not have been fully reset.');
    console.log('   Please review the counts above.\n');
  }

  return allClear;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  ORDER DATA RESET SCRIPT');
  console.log('  ' + new Date().toLocaleString());
  console.log('═'.repeat(60));

  // Connect to MongoDB
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI not found in environment variables.');
    process.exit(1);
  }

  console.log(`\n🔗 Connecting to MongoDB...`);
  console.log(`   URI: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`);

  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log(`   ✅ Connected to: ${mongoose.connection.name}`);

  // Create timestamped backup directory
  const backupDir = path.join(__dirname, 'backups', `order-reset-${timestamp()}`);

  try {
    // Step 1: Backup
    await createBackups(backupDir);
    console.log(`\n   📂 Backups saved to: ${backupDir}`);

    // Step 2: Delete order data
    const deleteResults = await deleteOrderData();

    // Step 3: Reset counters
    const counterResults = await resetCounters();

    // Step 4: Verify
    const verified = await verifyReset();

    // Final summary
    console.log('═'.repeat(60));
    console.log('  SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n  Backup Location: ${backupDir}`);
    console.log(`\n  Deleted:`);
    console.log(`    • Orders: ${deleteResults.orders}`);
    console.log(`    • Vendor Payouts: ${deleteResults.vendorPayouts}`);
    console.log(`    • Review Email Logs: ${deleteResults.reviewEmailLogs}`);
    console.log(`    • Order Notifications: ${deleteResults.orderNotifications}`);
    console.log(`    • Order Activity Logs: ${deleteResults.orderActivityLogs}`);
    console.log(`\n  Reset:`);
    console.log(`    • Vendor Analytics: ${counterResults.vendorAnalyticsReset} vendors`);
    console.log(`    • PromoCode usedCount: ${counterResults.promoCodeReset} codes`);
    console.log(`\n  Preserved:`);
    console.log(`    • Users, Admins, Products, Categories, Reviews`);
    console.log(`    • Settings, Coupons, Vendors, Media, Inventory`);
    console.log(`    • Non-order Notifications & Activity Logs`);
    console.log(`\n  Status: ${verified ? '✅ COMPLETE & VERIFIED' : '⚠️ COMPLETED WITH WARNINGS'}`);
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.\n');
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
