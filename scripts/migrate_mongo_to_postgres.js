const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '..', '..', 'mongodb_backup', 'test');

// Helper to extract clean primitive values from MongoDB JSON ($oid, $date, etc.)
function cleanVal(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val.$oid) return val.$oid;
    if (val.$date) return new Date(val.$date);
    if (Array.isArray(val)) return val.map(cleanVal);
    const obj = {};
    for (const [k, v] of Object.entries(val)) {
      obj[k] = cleanVal(v);
    }
    return obj;
  }
  return val;
}

function parseDate(val) {
  if (!val) return new Date();
  if (typeof val === 'object' && val.$date) return new Date(val.$date);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseDecimal(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}

async function runMigration() {
  console.log("==================================================");
  console.log("🚀 STARTING MONGODB TO POSTGRESQL DYNAMIC MIGRATION");
  console.log("==================================================");
  console.log(`📁 Source Backup Directory: ${BACKUP_DIR}`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`❌ Backup directory not found at: ${BACKUP_DIR}`);
    process.exit(1);
  }

  // Dynamic Collection Discovery
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  console.log(`🔍 Discovered ${files.length} MongoDB collection backup files.`);

  // Load all JSON data dynamically
  const backupData = {};
  for (const file of files) {
    const colName = file.replace('.json', '');
    const content = fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8');
    backupData[colName] = JSON.parse(content);
    console.log(`   - Discovered '${colName}': ${backupData[colName].length} documents`);
  }

  // Extract ID Sets for strict Foreign Key integrity checks
  const userIds = new Set((backupData.users || []).map(u => cleanVal(u._id)));
  const vendorIds = new Set((backupData.vendors || []).map(v => cleanVal(v._id)));
  const categoryIds = new Set((backupData.categories || []).map(c => cleanVal(c._id)));
  const occasionIds = new Set((backupData.occasions || []).map(o => cleanVal(o._id)));
  const productIds = new Set((backupData.products || []).map(p => cleanVal(p._id)));
  const orderIds = new Set((backupData.orders || []).map(o => cleanVal(o._id)));
  const partnerIds = new Set((backupData.deliverypartners || []).map(p => cleanVal(p._id)));
  const zoneIds = new Set((backupData.deliveryzones || []).map(z => cleanVal(z._id)));
  const reviewIds = new Set((backupData.reviews || []).map(r => cleanVal(r._id)));
  const assignmentIds = new Set((backupData.deliveryassignments || []).map(a => cleanVal(a._id)));

  console.log("\n--- Executing Migration In Relational Dependency Order ---\n");

  // 1. ROLES
  if (backupData.roles) {
    console.log(`📦 Migrating Roles (${backupData.roles.length})...`);
    for (const doc of backupData.roles) {
      const id = cleanVal(doc._id);
      await prisma.role.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || id,
          displayName: doc.displayName || doc.name,
          description: doc.description || null,
          permissions: doc.permissions ? cleanVal(doc.permissions) : [],
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 2. STORES, REDIRECTS, NEWSLETTERS, HOLIDAYS, HOMEPAGE VIDEOS, SOCIAL FEED POSTS
  if (backupData.stores) {
    console.log(`📦 Migrating Stores (${backupData.stores.length})...`);
    for (const doc of backupData.stores) {
      const id = cleanVal(doc._id);
      await prisma.store.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Store',
          code: doc.code || id,
          city: doc.city || null,
          address: doc.address || null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.redirects) {
    console.log(`📦 Migrating Redirects (${backupData.redirects.length})...`);
    for (const doc of backupData.redirects) {
      const id = cleanVal(doc._id);
      await prisma.redirect.upsert({
        where: { id },
        update: {},
        create: {
          id,
          sourceUrl: doc.sourceUrl || doc.source || `/redirect-${id}`,
          targetUrl: doc.targetUrl || doc.target || '/',
          statusCode: doc.statusCode || 301,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.newsletters) {
    console.log(`📦 Migrating Newsletters (${backupData.newsletters.length})...`);
    for (const doc of backupData.newsletters) {
      const id = cleanVal(doc._id);
      await prisma.newsletter.upsert({
        where: { id },
        update: {},
        create: {
          id,
          email: doc.email || `${id}@newsletter.subscriber`,
          status: doc.status || 'subscribed',
          subscribedAt: parseDate(doc.subscribedAt || doc.createdAt)
        }
      });
    }
  }

  if (backupData.holidays) {
    console.log(`📦 Migrating Holidays (${backupData.holidays.length})...`);
    for (const doc of backupData.holidays) {
      const id = cleanVal(doc._id);
      await prisma.holiday.upsert({
        where: { id },
        update: {},
        create: {
          id,
          title: doc.title || 'Holiday',
          date: parseDate(doc.date),
          description: doc.description || null,
          isRecurring: doc.isRecurring || false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.homepagevideos) {
    console.log(`📦 Migrating Homepage Videos (${backupData.homepagevideos.length})...`);
    for (const doc of backupData.homepagevideos) {
      const id = cleanVal(doc._id);
      await prisma.homepageVideo.upsert({
        where: { id },
        update: {},
        create: {
          id,
          videoUrl: doc.videoUrl || doc.url || '',
          thumbnailUrl: doc.thumbnailUrl || null,
          title: doc.title || null,
          displayOrder: doc.displayOrder || 0,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.social_feed_posts) {
    console.log(`📦 Migrating Social Feed Posts (${backupData.social_feed_posts.length})...`);
    for (const doc of backupData.social_feed_posts) {
      const id = cleanVal(doc._id);
      await prisma.socialFeedPost.upsert({
        where: { id },
        update: {},
        create: {
          id,
          embedUrl: doc.embedUrl || '',
          displayOrder: doc.displayOrder || 0,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 3. CATEGORIES & OCCASIONS & COLLECTIONS
  if (backupData.categories) {
    console.log(`📦 Migrating Categories (${backupData.categories.length})...`);
    // Pass 1: Insert all categories with parentId = null
    for (const doc of backupData.categories) {
      const id = cleanVal(doc._id);
      await prisma.category.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Category',
          slug: doc.slug || `category-${id}`,
          description: doc.description || null,
          image: doc.image || null,
          icon: doc.icon || null,
          banner: doc.banner || null,
          parentId: null,
          displayOrder: doc.displayOrder || 0,
          isActive: doc.isActive !== false,
          isFeatured: doc.isFeatured || false,
          metaTitle: doc.metaTitle || null,
          metaDescription: doc.metaDescription || null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }

    // Pass 2: Set parentId once all categories exist in database
    for (const doc of backupData.categories) {
      const id = cleanVal(doc._id);
      const parentId = cleanVal(doc.parentId);
      if (parentId && categoryIds.has(parentId)) {
        await prisma.category.update({
          where: { id },
          data: { parentId }
        }).catch(err => console.warn(`   ⚠️ Skip setting parentId for ${id}: ${err.message}`));
      }
    }
  }

  if (backupData.occasions) {
    console.log(`📦 Migrating Occasions (${backupData.occasions.length})...`);
    for (const doc of backupData.occasions) {
      const id = cleanVal(doc._id);
      await prisma.occasion.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Occasion',
          slug: doc.slug || `occasion-${id}`,
          description: doc.description || null,
          image: doc.image || null,
          icon: doc.icon || null,
          banner: doc.banner || null,
          displayOrder: doc.displayOrder || 0,
          isActive: doc.isActive !== false,
          isFeatured: doc.isFeatured || false,
          metaTitle: doc.metaTitle || null,
          metaDescription: doc.metaDescription || null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.collections) {
    console.log(`📦 Migrating Collections (${backupData.collections.length})...`);
    for (const doc of backupData.collections) {
      const id = cleanVal(doc._id);
      await prisma.collection.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Collection',
          slug: doc.slug || `collection-${id}`,
          description: doc.description || null,
          image: doc.image || null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 4. USERS & EMBEDDED ADDRESSES
  if (backupData.users) {
    console.log(`📦 Migrating Users (${backupData.users.length})...`);
    for (const doc of backupData.users) {
      const userId = cleanVal(doc._id);
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          name: doc.name || null,
          email: doc.email ? doc.email.toLowerCase() : `${userId}@user.invalid`,
          password: doc.password || null,
          role: doc.role || 'customer',
          status: doc.status || 'active',
          lastActive: doc.lastActive ? parseDate(doc.lastActive) : null,
          lastLogin: doc.lastLogin ? parseDate(doc.lastLogin) : null,
          provider: doc.provider || 'local',
          googleId: doc.googleId || null,
          photoURL: doc.photoURL || null,
          agreedToTerms: doc.agreedToTerms || false,
          vendorStatus: doc.vendorStatus || null,
          assigned_store: doc.assigned_store ? cleanVal(doc.assigned_store) : null,
          assigned_zone: doc.assigned_zone ? cleanVal(doc.assigned_zone) : null,
          created_by: doc.created_by ? cleanVal(doc.created_by) : null,
          employeeId: doc.employeeId || null,
          staffCode: doc.staffCode || null,
          phone: doc.phone || null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });

      // Embedded addresses
      if (Array.isArray(doc.addresses)) {
        for (const addr of doc.addresses) {
          const addrId = cleanVal(addr._id) || `${userId}_addr_${Math.random().toString(36).substr(2, 6)}`;
          await prisma.address.upsert({
            where: { id: addrId },
            update: {},
            create: {
              id: addrId,
              userId,
              fullName: addr.fullName || addr.name || doc.name,
              phone: addr.phone || doc.phone,
              street: addr.street || addr.address || null,
              addressLine1: addr.addressLine1 || addr.street || null,
              addressLine2: addr.addressLine2 || null,
              city: addr.city || null,
              state: addr.state || null,
              pincode: addr.pincode || addr.zipCode || null,
              zipCode: addr.zipCode || addr.pincode || null,
              country: addr.country || 'India',
              isDefault: addr.isDefault || false,
              type: addr.type || 'home',
              landmark: addr.landmark || null,
              createdAt: parseDate(addr.createdAt || doc.createdAt),
              updatedAt: parseDate(addr.updatedAt || doc.updatedAt)
            }
          });
        }
      }
    }
  }

  // 5. VENDORS
  if (backupData.vendors) {
    console.log(`📦 Migrating Vendors (${backupData.vendors.length})...`);
    for (const doc of backupData.vendors) {
      const vendorId = cleanVal(doc._id);
      const userId = cleanVal(doc.user);
      if (!userId || !userIds.has(userId)) continue;

      await prisma.vendor.upsert({
        where: { id: vendorId },
        update: {},
        create: {
          id: vendorId,
          userId,
          ownerName: doc.ownerName || null,
          storeName: doc.storeName || null,
          storeDescription: doc.storeDescription || null,
          status: doc.status || 'pending',
          signatureImage: doc.signatureImage || null,
          consentPdf: doc.consentPdf || null,
          consentPdfData: doc.consentPdfData || null,
          adminSignature: doc.adminSignature || null,
          approvalPdf: doc.approvalPdf || null,
          approvalPdfData: doc.approvalPdfData || null,
          approvedAt: doc.approvedAt ? parseDate(doc.approvedAt) : null,
          storeAddress: doc.storeAddress ? cleanVal(doc.storeAddress) : null,
          contactInfo: doc.contactInfo ? cleanVal(doc.contactInfo) : null,
          businessInfo: doc.businessInfo ? cleanVal(doc.businessInfo) : null,
          commission: doc.commission ? cleanVal(doc.commission) : null,
          verification: doc.verification ? cleanVal(doc.verification) : null,
          subscription: doc.subscription ? cleanVal(doc.subscription) : null,
          storeSettings: doc.storeSettings ? cleanVal(doc.storeSettings) : null,
          salesSettings: doc.salesSettings ? cleanVal(doc.salesSettings) : null,
          analytics: doc.analytics ? cleanVal(doc.analytics) : null,
          socialMedia: doc.socialMedia ? cleanVal(doc.socialMedia) : null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 6. ADDON PRODUCTS
  if (backupData.addonproducts) {
    console.log(`📦 Migrating Addon Products (${backupData.addonproducts.length})...`);
    for (const doc of backupData.addonproducts) {
      const id = cleanVal(doc._id);
      await prisma.addonProduct.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Addon',
          price: parseDecimal(doc.price),
          image: doc.image || null,
          description: doc.description || null,
          category: doc.category || null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 7. PRODUCTS & IMAGES & VARIANTS
  if (backupData.products) {
    console.log(`📦 Migrating Products (${backupData.products.length})...`);
    for (const doc of backupData.products) {
      const productId = cleanVal(doc._id);
      const rawVendorId = cleanVal(doc.vendor);
      const vendorId = (rawVendorId && vendorIds.has(rawVendorId)) ? rawVendorId : null;

      await prisma.product.upsert({
        where: { id: productId },
        update: {},
        create: {
          id: productId,
          name: doc.name || 'Product',
          slug: doc.slug || `product-${productId}`,
          sku: doc.sku || null,
          description: doc.description || null,
          shortDescription: doc.shortDescription || null,
          details: doc.details ? cleanVal(doc.details) : null,
          price: parseDecimal(doc.price),
          comparePrice: doc.comparePrice ? parseDecimal(doc.comparePrice) : null,
          costPrice: doc.costPrice ? parseDecimal(doc.costPrice) : null,
          stock: doc.stock || 0,
          isAvailable: doc.isAvailable !== false,
          isVisible: doc.isVisible !== false,
          isFeatured: doc.isFeatured || false,
          isBestseller: doc.isBestseller || false,
          isNewArrival: doc.isNewArrival || false,
          rating: parseFloat(doc.rating) || 0,
          reviewCount: doc.reviewCount || 0,
          vendorId: vendorId,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });

      // Product images array
      if (Array.isArray(doc.images)) {
        let imgIdx = 0;
        for (const img of doc.images) {
          const imgUrl = typeof img === 'string' ? img : img.url;
          if (!imgUrl) continue;
          const imgId = typeof img === 'object' && img._id ? cleanVal(img._id) : `${productId}_img_${imgIdx}`;
          await prisma.productImage.upsert({
            where: { id: imgId },
            update: {},
            create: {
              id: imgId,
              productId,
              url: imgUrl,
              publicId: typeof img === 'object' ? img.publicId : null,
              alt: typeof img === 'object' ? img.alt : null,
              displayOrder: imgIdx,
              isPrimary: imgIdx === 0
            }
          });
          imgIdx++;
        }
      }

      // Price variants array
      if (Array.isArray(doc.priceVariants)) {
        let varIdx = 0;
        for (const variant of doc.priceVariants) {
          const varId = cleanVal(variant._id) || `${productId}_var_${varIdx}`;
          await prisma.productVariant.upsert({
            where: { id: varId },
            update: {},
            create: {
              id: varId,
              productId,
              name: variant.name || variant.size || `Variant ${varIdx + 1}`,
              size: variant.size || variant.name || null,
              price: parseDecimal(variant.price),
              comparePrice: variant.comparePrice ? parseDecimal(variant.comparePrice) : null,
              stock: variant.stock || null,
              sku: variant.sku || null,
              isDefault: variant.isDefault || varIdx === 0
            }
          });
          varIdx++;
        }
      }

      // Product categories junction
      if (Array.isArray(doc.categories)) {
        for (const catRef of doc.categories) {
          const catId = cleanVal(catRef);
          if (catId && categoryIds.has(catId)) {
            await prisma.productCategory.upsert({
              where: { productId_categoryId: { productId, categoryId: catId } },
              update: {},
              create: { productId, categoryId: catId }
            }).catch(() => {});
          }
        }
      }
    }
  }

  // 8. ORDERS & ORDER ITEMS
  if (backupData.orders) {
    console.log(`📦 Migrating Orders (${backupData.orders.length})...`);
    for (const doc of backupData.orders) {
      const orderId = cleanVal(doc._id);
      const rawUserId = cleanVal(doc.user) || cleanVal(doc.userId);
      const userId = (rawUserId && userIds.has(rawUserId)) ? rawUserId : null;

      let promoCodeStr = null;
      if (typeof doc.promoCode === 'string') promoCodeStr = doc.promoCode;
      else if (typeof doc.promoCode === 'object' && doc.promoCode?.code) promoCodeStr = String(doc.promoCode.code);
      else if (typeof doc.couponCode === 'string') promoCodeStr = doc.couponCode;

      let discountCodeStr = null;
      if (typeof doc.discountCode === 'string') discountCodeStr = doc.discountCode;
      else if (typeof doc.discountCode === 'object' && doc.discountCode?.code) discountCodeStr = String(doc.discountCode.code);

      await prisma.order.upsert({
        where: { id: orderId },
        update: {},
        create: {
          id: orderId,
          orderNumber: doc.orderNumber || `ORD-${orderId}`,
          userId: userId,
          customerName: doc.customerName || doc.shippingAddress?.fullName || null,
          customerEmail: doc.customerEmail || doc.shippingAddress?.email || null,
          customerPhone: doc.customerPhone || doc.shippingAddress?.phone || null,
          totalAmount: parseDecimal(doc.totalAmount || doc.total),
          subtotal: parseDecimal(doc.subtotal || doc.totalAmount || 0),
          taxAmount: parseDecimal(doc.taxAmount || 0),
          shippingFee: parseDecimal(doc.shippingFee || doc.deliveryCharge || 0),
          discountAmount: parseDecimal(doc.discountAmount || 0),
          orderStatus: doc.orderStatus || doc.status || 'pending',
          paymentStatus: doc.paymentStatus || 'pending',
          paymentMethod: doc.paymentMethod || null,
          razorpayOrderId: doc.razorpayOrderId || null,
          razorpayPaymentId: doc.razorpayPaymentId || null,
          razorpaySignature: doc.razorpaySignature || null,
          shippingAddress: doc.shippingAddress ? cleanVal(doc.shippingAddress) : null,
          billingAddress: doc.billingAddress ? cleanVal(doc.billingAddress) : null,
          deliveryDate: doc.deliveryDate ? parseDate(doc.deliveryDate) : null,
          deliverySlot: doc.deliverySlot || null,
          deliveryInstruction: doc.deliveryInstruction || null,
          cardMessage: doc.cardMessage || null,
          senderName: doc.senderName || null,
          senderPhone: doc.senderPhone || null,
          recipientName: doc.recipientName || null,
          recipientPhone: doc.recipientPhone || null,
          promoCode: promoCodeStr,
          discountCode: discountCodeStr,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });

      // Order items
      if (Array.isArray(doc.items)) {
        let itemIdx = 0;
        for (const item of doc.items) {
          const itemId = cleanVal(item._id) || `${orderId}_item_${itemIdx}`;
          const rawProdId = cleanVal(item.product) || cleanVal(item.productId);
          const prodId = (rawProdId && productIds.has(rawProdId)) ? rawProdId : null;
          await prisma.orderItem.upsert({
            where: { id: itemId },
            update: {},
            create: {
              id: itemId,
              orderId,
              productId: prodId,
              productName: item.productName || item.name || 'Product Item',
              sku: item.sku || null,
              variantName: item.variantName || item.size || null,
              price: parseDecimal(item.price),
              quantity: item.quantity || 1,
              subtotal: parseDecimal(item.subtotal || (item.price * item.quantity)),
              image: item.image || null,
              addons: item.addons ? cleanVal(item.addons) : null
            }
          });
          itemIdx++;
        }
      }
    }
  }

  // 9. PROMO CODES & OFFERS
  if (backupData.promocodes) {
    console.log(`📦 Migrating Promo Codes (${backupData.promocodes.length})...`);
    for (const doc of backupData.promocodes) {
      const id = cleanVal(doc._id);
      await prisma.promoCode.upsert({
        where: { id },
        update: {},
        create: {
          id,
          code: doc.code || `CODE_${id}`,
          discountType: doc.discountType || 'percentage',
          discountValue: parseDecimal(doc.discountValue || doc.discount),
          minOrderAmount: doc.minOrderAmount ? parseDecimal(doc.minOrderAmount) : null,
          maxDiscountAmount: doc.maxDiscountAmount ? parseDecimal(doc.maxDiscountAmount) : null,
          usageLimit: doc.usageLimit || null,
          usedCount: doc.usedCount || 0,
          startDate: doc.startDate ? parseDate(doc.startDate) : null,
          endDate: doc.endDate ? parseDate(doc.endDate) : null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.offers) {
    console.log(`📦 Migrating Offers (${backupData.offers.length})...`);
    for (const doc of backupData.offers) {
      const id = cleanVal(doc._id);
      await prisma.offer.upsert({
        where: { id },
        update: {},
        create: {
          id,
          title: doc.title || 'Special Offer',
          description: doc.description || null,
          code: doc.code || null,
          discountPercentage: doc.discountPercentage ? parseDecimal(doc.discountPercentage) : null,
          image: doc.image || null,
          banner: doc.banner || null,
          startDate: doc.startDate ? parseDate(doc.startDate) : null,
          endDate: doc.endDate ? parseDate(doc.endDate) : null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 10. REVIEWS
  if (backupData.reviews) {
    console.log(`📦 Migrating Reviews (${backupData.reviews.length})...`);
    for (const doc of backupData.reviews) {
      const reviewId = cleanVal(doc._id);
      const rawProdId = cleanVal(doc.product) || cleanVal(doc.productId);
      const rawUserId = cleanVal(doc.user) || cleanVal(doc.userId);
      if (!rawProdId || !productIds.has(rawProdId)) continue;
      const userId = (rawUserId && userIds.has(rawUserId)) ? rawUserId : null;

      await prisma.review.upsert({
        where: { id: reviewId },
        update: {},
        create: {
          id: reviewId,
          userId,
          productId: rawProdId,
          rating: doc.rating || 5,
          title: doc.title || null,
          comment: doc.comment || doc.reviewText || '',
          status: doc.status || 'approved',
          isVerifiedPurchase: doc.isVerifiedPurchase || false,
          likeCount: doc.likeCount || 0,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 11. DELIVERY PARTNERS, ZONES, LOCATIONS & ASSIGNMENTS
  if (backupData.deliveryzones) {
    console.log(`📦 Migrating Delivery Zones (${backupData.deliveryzones.length})...`);
    for (const doc of backupData.deliveryzones) {
      const id = cleanVal(doc._id);
      await prisma.deliveryZone.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Zone',
          code: doc.code || null,
          pincodes: doc.pincodes ? cleanVal(doc.pincodes) : [],
          deliveryFee: parseDecimal(doc.deliveryFee || 0),
          minOrderAmount: doc.minOrderAmount ? parseDecimal(doc.minOrderAmount) : null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.deliverypartners) {
    console.log(`📦 Migrating Delivery Partners (${backupData.deliverypartners.length})...`);
    for (const doc of backupData.deliverypartners) {
      const id = cleanVal(doc._id);
      await prisma.deliveryPartner.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || 'Delivery Partner',
          phone: doc.phone || '0000000000',
          email: doc.email || null,
          vehicleNumber: doc.vehicleNumber || null,
          status: doc.status || 'available',
          currentLocation: doc.currentLocation ? cleanVal(doc.currentLocation) : null,
          isActive: doc.isActive !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.deliverylocations) {
    console.log(`📦 Migrating Delivery Locations (${backupData.deliverylocations.length})...`);
    for (const doc of backupData.deliverylocations) {
      const id = cleanVal(doc._id);
      const rawZoneId = cleanVal(doc.zone) || cleanVal(doc.zoneId);
      const zoneId = (rawZoneId && zoneIds.has(rawZoneId)) ? rawZoneId : null;

      await prisma.deliveryLocation.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: doc.name || doc.locationName || 'Location',
          pincode: String(doc.pincode || doc.pinCode || ''),
          city: doc.city || null,
          state: doc.state || null,
          zoneId: zoneId,
          deliveryCharge: doc.deliveryCharge ? parseDecimal(doc.deliveryCharge) : null,
          isDeliverable: doc.isDeliverable !== false,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.deliveryassignments) {
    console.log(`📦 Migrating Delivery Assignments (${backupData.deliveryassignments.length})...`);
    for (const doc of backupData.deliveryassignments) {
      const id = cleanVal(doc._id);
      const rawOrderId = cleanVal(doc.order) || cleanVal(doc.orderId);
      if (!rawOrderId || !orderIds.has(rawOrderId)) continue;
      const rawPartnerId = cleanVal(doc.deliveryPartner) || cleanVal(doc.partnerId);
      const partnerId = (rawPartnerId && partnerIds.has(rawPartnerId)) ? rawPartnerId : null;

      await prisma.deliveryAssignment.upsert({
        where: { id },
        update: {},
        create: {
          id,
          orderId: rawOrderId,
          deliveryPartnerId: partnerId,
          status: doc.status || 'pending',
          payoutAmount: doc.payoutAmount ? parseDecimal(doc.payoutAmount) : null,
          distanceKm: doc.distanceKm ? parseFloat(doc.distanceKm) : null,
          assignedAt: doc.assignedAt ? parseDate(doc.assignedAt) : null,
          acceptedAt: doc.acceptedAt ? parseDate(doc.acceptedAt) : null,
          pickedUpAt: doc.pickedUpAt ? parseDate(doc.pickedUpAt) : null,
          deliveredAt: doc.deliveredAt ? parseDate(doc.deliveredAt) : null,
          failedAt: doc.failedAt ? parseDate(doc.failedAt) : null,
          failureReason: doc.failureReason || null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  // 12. LOGS & NOTIFICATIONS & SETTINGS
  if (backupData.notifications) {
    console.log(`📦 Migrating Notifications (${backupData.notifications.length})...`);
    for (const doc of backupData.notifications) {
      const id = cleanVal(doc._id);
      const rawUserId = cleanVal(doc.user) || cleanVal(doc.userId);
      const userId = (rawUserId && userIds.has(rawUserId)) ? rawUserId : null;

      await prisma.notification.upsert({
        where: { id },
        update: {},
        create: {
          id,
          userId,
          title: doc.title || 'Notification',
          message: doc.message || '',
          type: doc.type || 'info',
          link: doc.link || null,
          isRead: doc.isRead || false,
          metadata: doc.metadata ? cleanVal(doc.metadata) : null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.activitylogs) {
    console.log(`📦 Migrating Activity Logs (${backupData.activitylogs.length})...`);
    for (const doc of backupData.activitylogs) {
      const id = cleanVal(doc._id);
      const rawUserId = cleanVal(doc.user) || cleanVal(doc.userId);
      const userId = (rawUserId && userIds.has(rawUserId)) ? rawUserId : null;

      await prisma.activityLog.upsert({
        where: { id },
        update: {},
        create: {
          id,
          userId,
          action: doc.action || 'activity',
          module: doc.module || null,
          details: doc.details ? cleanVal(doc.details) : null,
          ipAddress: doc.ipAddress || null,
          userAgent: doc.userAgent || null,
          createdAt: parseDate(doc.createdAt)
        }
      });
    }
  }

  if (backupData.emaillogs) {
    console.log(`📦 Migrating Email Logs (${backupData.emaillogs.length})...`);
    for (const doc of backupData.emaillogs) {
      const id = cleanVal(doc._id);
      await prisma.emailLog.upsert({
        where: { id },
        update: {},
        create: {
          id,
          recipient: doc.recipient || doc.to || 'unknown@recipient.com',
          subject: doc.subject || 'Email',
          type: doc.type || null,
          status: doc.status || 'sent',
          error: doc.error || null,
          metadata: doc.metadata ? cleanVal(doc.metadata) : null,
          sentAt: parseDate(doc.sentAt || doc.createdAt)
        }
      });
    }
  }

  if (backupData.settings) {
    console.log(`📦 Migrating System Settings (${backupData.settings.length})...`);
    for (const doc of backupData.settings) {
      const id = cleanVal(doc._id);
      await prisma.setting.upsert({
        where: { id },
        update: {},
        create: {
          id,
          key: doc.key || 'global',
          data: cleanVal(doc),
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.valentinesettings) {
    console.log(`📦 Migrating Valentine Settings (${backupData.valentinesettings.length})...`);
    for (const doc of backupData.valentinesettings) {
      const id = cleanVal(doc._id);
      await prisma.valentineSetting.upsert({
        where: { id },
        update: {},
        create: {
          id,
          key: doc.key || 'valentine',
          enabled: doc.enabled !== false,
          data: cleanVal(doc),
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  if (backupData.seasonalcampaigns) {
    console.log(`📦 Migrating Seasonal Campaigns (${backupData.seasonalcampaigns.length})...`);
    for (const doc of backupData.seasonalcampaigns) {
      const id = cleanVal(doc._id);
      await prisma.seasonalCampaign.upsert({
        where: { id },
        update: {},
        create: {
          id,
          title: doc.title || 'Campaign',
          slug: doc.slug || `campaign-${id}`,
          description: doc.description || null,
          bannerUrl: doc.bannerUrl || null,
          startDate: doc.startDate ? parseDate(doc.startDate) : null,
          endDate: doc.endDate ? parseDate(doc.endDate) : null,
          isActive: doc.isActive !== false,
          config: doc.config ? cleanVal(doc.config) : null,
          createdAt: parseDate(doc.createdAt),
          updatedAt: parseDate(doc.updatedAt)
        }
      });
    }
  }

  console.log("\n==================================================");
  console.log("✅ DATA MIGRATION EXECUTED SUCCESSFULLY!");
  console.log("==================================================");

  await prisma.$disconnect();
}

runMigration().catch(err => {
  console.error("❌ Migration failed with error:", err);
  prisma.$disconnect();
  process.exit(1);
});
