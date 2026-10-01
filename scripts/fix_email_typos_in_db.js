const prisma = require('../config/prisma');
const { normalizeEmail } = require('../utils/emailNormalizer');

async function fixExistingEmails() {
  console.log('🔄 Starting database email typo cleanup...');

  try {
    // 1. Clean Users
    const users = await prisma.user.findMany({
      where: {
        email: { contains: '.con' }
      }
    });

    console.log(`Found ${users.length} user(s) with .con emails:`);
    for (const u of users) {
      const fixedEmail = normalizeEmail(u.email);
      console.log(`  Updating User ${u.id}: "${u.email}" -> "${fixedEmail}"`);
      await prisma.user.update({
        where: { id: u.id },
        data: { email: fixedEmail }
      });
    }

    // 2. Clean Orders
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { customerEmail: { contains: '.con' } }
        ]
      }
    });

    console.log(`Found ${orders.length} order(s) with .con customerEmail:`);
    for (const o of orders) {
      const fixedCustomerEmail = normalizeEmail(o.customerEmail);
      
      let fixedShippingDetails = o.shippingDetails;
      if (fixedShippingDetails && typeof fixedShippingDetails === 'object' && fixedShippingDetails.email) {
        fixedShippingDetails = {
          ...fixedShippingDetails,
          email: normalizeEmail(fixedShippingDetails.email)
        };
      }

      let fixedShippingAddress = o.shippingAddress;
      if (fixedShippingAddress && typeof fixedShippingAddress === 'object' && fixedShippingAddress.email) {
        fixedShippingAddress = {
          ...fixedShippingAddress,
          email: normalizeEmail(fixedShippingAddress.email)
        };
      }

      console.log(`  Updating Order #${o.orderNumber} (${o.id}): "${o.customerEmail}" -> "${fixedCustomerEmail}"`);
      await prisma.order.update({
        where: { id: o.id },
        data: {
          customerEmail: fixedCustomerEmail,
          shippingDetails: fixedShippingDetails,
          shippingAddress: fixedShippingAddress
        }
      });
    }

    // 3. Clean Addresses
    const addresses = await prisma.address.findMany({
      where: {
        OR: [
          { email: { contains: '.con' } },
          { receiverEmail: { contains: '.con' } }
        ]
      }
    });

    console.log(`Found ${addresses.length} address(es) with .con emails:`);
    for (const a of addresses) {
      const fixedEmail = a.email ? normalizeEmail(a.email) : null;
      const fixedReceiverEmail = a.receiverEmail ? normalizeEmail(a.receiverEmail) : null;
      console.log(`  Updating Address ${a.id}: "${a.email}" -> "${fixedEmail}", "${a.receiverEmail}" -> "${fixedReceiverEmail}"`);
      await prisma.address.update({
        where: { id: a.id },
        data: {
          email: fixedEmail,
          receiverEmail: fixedReceiverEmail
        }
      });
    }

    // 4. Clean EmailLogs
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        recipient: { contains: '.con' }
      }
    });

    console.log(`Found ${emailLogs.length} emailLog(s) with .con recipient:`);
    for (const el of emailLogs) {
      const fixedRecipient = normalizeEmail(el.recipient);
      console.log(`  Updating EmailLog ${el.id}: "${el.recipient}" -> "${fixedRecipient}"`);
      await prisma.emailLog.update({
        where: { id: el.id },
        data: { recipient: fixedRecipient }
      });
    }

    console.log('✅ Email typo cleanup complete!');
  } catch (err) {
    console.error('❌ Error during email typo cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  fixExistingEmails();
}

module.exports = fixExistingEmails;
