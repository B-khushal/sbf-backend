const { fixEmailTypo, normalizeEmail, recursivelyNormalizeEmails, emailNormalizerMiddleware } = require('../utils/emailNormalizer');
const prisma = require('../config/prisma');

async function runComprehensiveTests() {
  console.log('🧪 Starting Comprehensive Email Typo Fixer Tests...\n');

  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, testName) {
    if (actual === expected) {
      console.log(`  ✅ [PASS] ${testName}: "${actual}" === "${expected}"`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}: Expected "${expected}", got "${actual}"`);
      failed++;
    }
  }

  console.log('--- 1. Testing Core Email Typo Fixes ---');
  assertEqual(fixEmailTypo('rimimurmu123@gmail.con'), 'rimimurmu123@gmail.com', 'Fixes gmail.con to gmail.com');
  assertEqual(fixEmailTypo('USER@GMAIL.CON'), 'USER@gmail.com', 'Fixes uppercase GMAIL.CON to gmail.com');
  assertEqual(fixEmailTypo('john.doe+tag@gmail.con'), 'john.doe+tag@gmail.com', 'Fixes plus tagged gmail.con');
  assertEqual(fixEmailTypo('alice@gmai.com'), 'alice@gmail.com', 'Fixes gmai.com');
  assertEqual(fixEmailTypo('bob@gamil.com'), 'bob@gmail.com', 'Fixes gamil.com');
  assertEqual(fixEmailTypo('charlie@gmial.com'), 'charlie@gmail.com', 'Fixes gmial.com');
  assertEqual(fixEmailTypo('dave@gmail.co'), 'dave@gmail.com', 'Fixes gmail.co');
  assertEqual(fixEmailTypo('eve@gmailcom'), 'eve@gmail.com', 'Fixes gmailcom (missing dot)');
  assertEqual(fixEmailTypo('heidi@yahoo.con'), 'heidi@yahoo.com', 'Fixes yahoo.con');
  assertEqual(fixEmailTypo('heidi@yaho.com'), 'heidi@yahoo.com', 'Fixes yaho.com');
  assertEqual(fixEmailTypo('mark@outlook.con'), 'mark@outlook.com', 'Fixes outlook.con');
  assertEqual(fixEmailTypo('sarah@hotmail.con'), 'sarah@hotmail.com', 'Fixes hotmail.con');
  assertEqual(fixEmailTypo('custom@company.con'), 'custom@company.com', 'Fixes generic .con to .com');
  assertEqual(fixEmailTypo('custom@company.cmo'), 'custom@company.com', 'Fixes generic .cmo to .com');
  assertEqual(fixEmailTypo('custom@company.comm'), 'custom@company.com', 'Fixes generic .comm to .com');
  assertEqual(fixEmailTypo('  padded@gmail.con  '), 'padded@gmail.com', 'Trims whitespace');
  assertEqual(fixEmailTypo('Name <user@gmail.con>'), 'Name <user@gmail.com>', 'Handles angle brackets');
  assertEqual(fixEmailTypo('u1@gmail.con, u2@yahoo.con'), 'u1@gmail.com, u2@yahoo.com', 'Handles comma list');

  console.log('\n--- 2. Testing Recursive Object Normalization ---');
  const testPayload = {
    email: 'user@gmail.con',
    customerEmail: 'customer@gmail.con',
    shippingDetails: {
      fullName: 'John Doe',
      email: 'shipping@gmail.con',
      phone: '9999999999'
    },
    items: [
      { id: 1, name: 'Rose Bouquet' }
    ],
    metadata: {
      recipientEmail: 'gift@gmail.con',
      otherField: 'not an email'
    }
  };

  recursivelyNormalizeEmails(testPayload);
  assertEqual(testPayload.email, 'user@gmail.com', 'Payload email cleaned');
  assertEqual(testPayload.customerEmail, 'customer@gmail.com', 'Payload customerEmail cleaned');
  assertEqual(testPayload.shippingDetails.email, 'shipping@gmail.com', 'Payload nested shippingDetails.email cleaned');
  assertEqual(testPayload.metadata.recipientEmail, 'gift@gmail.com', 'Payload nested metadata.recipientEmail cleaned');
  assertEqual(testPayload.metadata.otherField, 'not an email', 'Non-email string untouched');

  console.log('\n--- 3. Testing Express Middleware ---');
  const mockReq = {
    body: {
      email: 'reg@gmail.con',
      password: 'password123'
    },
    query: {
      searchEmail: 'search@gmail.con'
    }
  };
  let nextCalled = false;
  emailNormalizerMiddleware(mockReq, {}, () => { nextCalled = true; });
  assertEqual(mockReq.body.email, 'reg@gmail.com', 'Middleware normalized req.body.email');
  assertEqual(mockReq.query.searchEmail, 'search@gmail.com', 'Middleware normalized req.query.searchEmail');
  assertEqual(nextCalled, true, 'Middleware invoked next()');

  console.log('\n--- 4. Checking Database for any Remaining .con Emails ---');
  try {
    const userCount = await prisma.user.count({
      where: { email: { contains: '.con' } }
    });
    assertEqual(userCount, 0, 'Zero users with .con in database');

    const orderCount = await prisma.order.count({
      where: { customerEmail: { contains: '.con' } }
    });
    assertEqual(orderCount, 0, 'Zero orders with .con in database');

    const emailLogCount = await prisma.emailLog.count({
      where: { recipient: { contains: '.con' } }
    });
    assertEqual(emailLogCount, 0, 'Zero EmailLogs with .con in database');
  } catch (dbErr) {
    console.error('DB query error:', dbErr.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n===========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===========================================\n`);
}

runComprehensiveTests();
