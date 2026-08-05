const fs = require('fs');
const path = require('path');
const prisma = require('./config/prisma');

const BACKUP_DIR = 'D:/SBF/mongodb_backup/test';

function readBackupJson(filename) {
  const filePath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Error reading ${filename}:`, e.message);
      return [];
    }
  }
  return [];
}

async function masterSync() {
  console.log('================================================================');
  console.log('🚀 MASTER FULL DATABASE SYNC (MONGODB BACKUP -> POSTGRESQL)');
  console.log('================================================================');

  // 1. SYNC CATEGORIES
  const categories = readBackupJson('categories.json');
  console.log(`📁 1. Syncing ${categories.length} Categories...`);
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c._id },
      update: {
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        image: c.image || null,
        icon: c.icon || null,
        banner: c.banner || null,
        displayOrder: c.sortOrder || 0,
        isActive: c.status !== 'inactive',
        isFeatured: c.showInShop === true
      },
      create: {
        id: c._id,
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        image: c.image || null,
        icon: c.icon || null,
        banner: c.banner || null,
        displayOrder: c.sortOrder || 0,
        isActive: c.status !== 'inactive',
        isFeatured: c.showInShop === true
      }
    });
  }
  for (const c of categories) {
    if (c.parentId) {
      const pExists = await prisma.category.findUnique({ where: { id: c.parentId } });
      if (pExists) {
        await prisma.category.update({ where: { id: c._id }, data: { parentId: c.parentId } });
      }
    }
  }
  console.log('✅ Categories Synced.');

  const dbCats = await prisma.category.findMany();
  const catMap = {};
  dbCats.forEach(c => {
    catMap[c.name.toLowerCase()] = c.id;
    catMap[c.slug.toLowerCase()] = c.id;
  });

  // 2. SYNC OCCASIONS
  const occasions = readBackupJson('occasions.json');
  console.log(`📁 2. Syncing ${occasions.length} Occasions...`);
  for (const occ of occasions) {
    await prisma.occasion.upsert({
      where: { id: occ._id },
      update: {
        name: occ.name,
        slug: occ.slug || occ.name.toLowerCase().replace(/\s+/g, '-'),
        description: occ.description || null,
        image: occ.image || null,
        banner: occ.bannerImage || occ.banner || null,
        displayOrder: occ.displayOrder || 0,
        isActive: occ.isActive !== false
      },
      create: {
        id: occ._id,
        name: occ.name,
        slug: occ.slug || occ.name.toLowerCase().replace(/\s+/g, '-'),
        description: occ.description || null,
        image: occ.image || null,
        banner: occ.bannerImage || occ.banner || null,
        displayOrder: occ.displayOrder || 0,
        isActive: occ.isActive !== false
      }
    });
  }
  console.log('✅ Occasions Synced.');

  // 3. SYNC PRODUCTS
  const products = readBackupJson('products.json');
  console.log(`📁 3. Syncing ${products.length} Products...`);
  for (const p of products) {
    const title = p.title || p.name || 'Flower Product';
    const price = p.price ? parseFloat(p.price) : 0;
    const stock = p.countInStock !== undefined ? parseInt(p.countInStock) : (p.stock ? parseInt(p.stock) : 10);

    await prisma.product.upsert({
      where: { id: p._id },
      update: {
        name: title,
        slug: p.slug || `prod-${p._id}`,
        description: p.description || '',
        price: price,
        stock: stock,
        isAvailable: p.isAvailable !== false,
        isVisible: p.hidden !== true,
        isFeatured: p.isFeatured === true,
        isBestseller: p.isBestseller === true,
        rating: p.rating ? parseFloat(p.rating) : 0,
        reviewCount: p.numReviews ? parseInt(p.numReviews) : 0
      },
      create: {
        id: p._id,
        name: title,
        slug: p.slug || `prod-${p._id}`,
        description: p.description || '',
        price: price,
        stock: stock,
        isAvailable: p.isAvailable !== false,
        isVisible: p.hidden !== true,
        isFeatured: p.isFeatured === true,
        isBestseller: p.isBestseller === true,
        rating: p.rating ? parseFloat(p.rating) : 0,
        reviewCount: p.numReviews ? parseInt(p.numReviews) : 0
      }
    });

    if (Array.isArray(p.images) && p.images.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: p._id } });
      let orderIdx = 0;
      for (const imgUrl of p.images) {
        const urlStr = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || '');
        if (urlStr) {
          await prisma.productImage.create({
            data: {
              id: `img_${p._id}_${orderIdx}`,
              productId: p._id,
              url: urlStr,
              displayOrder: orderIdx
            }
          });
          orderIdx++;
        }
      }
    }

    const linkedCatIds = new Set();
    if (p.category) {
      const catId = catMap[p.category.toLowerCase()];
      if (catId) linkedCatIds.add(catId);
    }
    if (Array.isArray(p.categories)) {
      for (const catName of p.categories) {
        const catId = catMap[catName.toLowerCase()];
        if (catId) linkedCatIds.add(catId);
      }
    }
    await prisma.productCategory.deleteMany({ where: { productId: p._id } });
    for (const catId of linkedCatIds) {
      await prisma.productCategory.create({
        data: { productId: p._id, categoryId: catId }
      });
    }

    if (Array.isArray(p.priceVariants) && p.priceVariants.length > 0) {
      await prisma.productVariant.deleteMany({ where: { productId: p._id } });
      for (const v of p.priceVariants) {
        await prisma.productVariant.create({
          data: {
            id: v.id || v._id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            productId: p._id,
            name: v.name || v.size || 'Standard',
            size: v.size || v.name || 'Standard',
            price: v.price ? parseFloat(v.price) : price,
            stock: v.stock || 0
          }
        });
      }
    }
  }
  console.log('✅ Products & Product Category Relations Synced.');

  // 4. SYNC USERS & USER CART / WISHLIST
  const users = readBackupJson('users.json');
  console.log(`📁 4. Syncing ${users.length} Users...`);
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u._id },
      update: {
        name: u.name,
        email: u.email ? u.email.toLowerCase() : '',
        password: u.password,
        role: u.role || 'customer',
        status: u.status || 'active',
        phone: u.phone || null,
        provider: u.provider || 'local',
        googleId: u.googleId || null,
        photoURL: u.photoURL || null
      },
      create: {
        id: u._id,
        name: u.name,
        email: u.email ? u.email.toLowerCase() : '',
        password: u.password,
        role: u.role || 'customer',
        status: u.status || 'active',
        phone: u.phone || null,
        provider: u.provider || 'local',
        googleId: u.googleId || null,
        photoURL: u.photoURL || null
      }
    });

    if (Array.isArray(u.cart) && u.cart.length > 0) {
      await prisma.cartItem.deleteMany({ where: { userId: u._id } });
      for (const item of u.cart) {
        const prodId = typeof item.product === 'string' ? item.product : item.productId;
        if (prodId) {
          const pExists = await prisma.product.findUnique({ where: { id: prodId } });
          if (pExists) {
            await prisma.cartItem.create({
              data: {
                id: item._id || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                userId: u._id,
                productId: prodId,
                quantity: item.quantity || 1
              }
            });
          }
        }
      }
    }

    if (Array.isArray(u.wishlist) && u.wishlist.length > 0) {
      await prisma.wishlistItem.deleteMany({ where: { userId: u._id } });
      for (const item of u.wishlist) {
        const prodId = typeof item === 'string' ? item : (item.product || item.productId);
        if (prodId) {
          const pExists = await prisma.product.findUnique({ where: { id: prodId } });
          if (pExists) {
            const wishId = `wish_${u._id}_${prodId}`;
            const wishExists = await prisma.wishlistItem.findUnique({ where: { id: wishId } });
            if (!wishExists) {
              await prisma.wishlistItem.create({
                data: {
                  id: wishId,
                  userId: u._id,
                  productId: prodId
                }
              });
            }
          }
        }
      }
    }
  }
  console.log('✅ Users, Cart, & Wishlist Synced.');

  // 5. SYNC ORDERS & ITEMS & TIMELINES
  const orders = readBackupJson('orders.json');
  console.log(`📁 5. Syncing ${orders.length} Orders...`);
  for (const o of orders) {
    const ship = o.shippingDetails || {};
    const gift = o.giftDetails || {};
    const pay = o.paymentDetails || {};

    let validUserId = null;
    if (o.user && typeof o.user === 'string') {
      const u = await prisma.user.findUnique({ where: { id: o.user } });
      if (u) validUserId = u.id;
    }

    const shipAddrObj = {
      fullName: ship.fullName || 'Customer',
      email: ship.email || '',
      phone: ship.phone || '',
      address: ship.address || gift.formattedAddress || '',
      city: ship.city || gift.recipientCity || 'Hyderabad',
      state: ship.state || gift.recipientState || 'Telangana',
      zipCode: ship.zipCode || gift.pincode || '500028',
      houseNo: gift.houseNo || '',
      landmark: gift.landmark || ''
    };

    await prisma.order.upsert({
      where: { id: o._id },
      update: {
        orderNumber: o.orderNumber,
        userId: validUserId,
        customerName: ship.fullName || null,
        customerEmail: ship.email || null,
        customerPhone: ship.phone || null,
        totalAmount: o.totalAmount ? parseFloat(o.totalAmount) : 0,
        subtotal: o.subtotal ? parseFloat(o.subtotal) : 0,
        shippingFee: o.deliveryCharge ? parseFloat(o.deliveryCharge) : 0,
        discountAmount: o.discount ? parseFloat(o.discount) : 0,
        orderStatus: o.status || 'order_placed',
        paymentStatus: pay.razorpayPaymentId ? 'completed' : 'pending',
        paymentMethod: pay.method || 'razorpay',
        razorpayOrderId: pay.razorpayOrderId || null,
        razorpayPaymentId: pay.razorpayPaymentId || null,
        razorpaySignature: pay.razorpaySignature || null,
        shippingAddress: shipAddrObj,
        deliveryDate: ship.deliveryDate ? new Date(ship.deliveryDate) : null,
        deliverySlot: ship.timeSlot || null,
        cardMessage: gift.message || null
      },
      create: {
        id: o._id,
        orderNumber: o.orderNumber || `SBF-${Date.now()}`,
        userId: validUserId,
        customerName: ship.fullName || null,
        customerEmail: ship.email || null,
        customerPhone: ship.phone || null,
        totalAmount: o.totalAmount ? parseFloat(o.totalAmount) : 0,
        subtotal: o.subtotal ? parseFloat(o.subtotal) : 0,
        shippingFee: o.deliveryCharge ? parseFloat(o.deliveryCharge) : 0,
        discountAmount: o.discount ? parseFloat(o.discount) : 0,
        orderStatus: o.status || 'order_placed',
        paymentStatus: pay.razorpayPaymentId ? 'completed' : 'pending',
        paymentMethod: pay.method || 'razorpay',
        razorpayOrderId: pay.razorpayOrderId || null,
        razorpayPaymentId: pay.razorpayPaymentId || null,
        razorpaySignature: pay.razorpaySignature || null,
        shippingAddress: shipAddrObj,
        deliveryDate: ship.deliveryDate ? new Date(ship.deliveryDate) : null,
        deliverySlot: ship.timeSlot || null,
        cardMessage: gift.message || null
      }
    });

    if (Array.isArray(o.items)) {
      for (const item of o.items) {
        let validProductId = null;
        if (item.product && typeof item.product === 'string') {
          const p = await prisma.product.findUnique({ where: { id: item.product } });
          if (p) validProductId = p.id;
        }

        await prisma.orderItem.upsert({
          where: { id: item._id },
          update: {
            productId: validProductId,
            productName: item.title || 'Product Item',
            price: item.price ? parseFloat(item.price) : 0,
            quantity: item.quantity || 1,
            subtotal: item.finalPrice ? parseFloat(item.finalPrice) : (item.price ? parseFloat(item.price) : 0),
            image: item.image || (item.images && item.images[0]) || null
          },
          create: {
            id: item._id,
            orderId: o._id,
            productId: validProductId,
            productName: item.title || 'Product Item',
            price: item.price ? parseFloat(item.price) : 0,
            quantity: item.quantity || 1,
            subtotal: item.finalPrice ? parseFloat(item.finalPrice) : (item.price ? parseFloat(item.price) : 0),
            image: item.image || (item.images && item.images[0]) || null
          }
        });
      }
    }

    if (Array.isArray(o.trackingHistory)) {
      for (const tr of o.trackingHistory) {
        const trId = tr._id || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const trExists = await prisma.orderTimeline.findUnique({ where: { id: trId } });
        if (!trExists) {
          await prisma.orderTimeline.create({
            data: {
              id: trId,
              orderId: o._id,
              status: tr.status || 'order_placed',
              title: tr.status ? tr.status.replace(/_/g, ' ') : 'Order Placed',
              description: tr.message || 'Order status updated',
              timestamp: tr.timestamp ? new Date(tr.timestamp) : new Date()
            }
          });
        }
      }
    }
  }
  console.log('✅ Orders, Items, & Timelines Synced.');

  // 6. SYNC SEASONAL CAMPAIGNS, VALENTINE SETTINGS
  const campaigns = readBackupJson('seasonalcampaigns.json');
  console.log(`📁 6. Syncing ${campaigns.length} Seasonal Campaigns...`);
  for (const sc of campaigns) {
    await prisma.seasonalCampaign.upsert({
      where: { id: sc._id },
      update: {
        title: sc.general?.campaignName || sc.title || sc.name,
        slug: sc.slug || `campaign-${sc._id}`,
        description: sc.description || null,
        bannerUrl: sc.bannerUrl || null,
        isActive: sc.enabled !== false
      },
      create: {
        id: sc._id,
        title: sc.general?.campaignName || sc.title || sc.name || 'Campaign',
        slug: sc.slug || `campaign-${sc._id}`,
        description: sc.description || null,
        bannerUrl: sc.bannerUrl || null,
        isActive: sc.enabled !== false
      }
    });
  }

  const valSettings = readBackupJson('valentinesettings.json');
  if (valSettings.length > 0) {
    const val = valSettings[0];
    await prisma.valentineSetting.upsert({
      where: { id: val._id || 'val_set_default' },
      update: { enabled: val.enabled !== false, data: val },
      create: { id: val._id || 'val_set_default', enabled: val.enabled !== false, data: val }
    });
  }
  console.log('✅ Campaigns & Valentine Settings Synced.');

  // 7. SYNC NOTIFICATIONS & DELIVERY PARTNERS
  const notifications = readBackupJson('notifications.json');
  console.log(`📁 7. Syncing ${notifications.length} Notifications...`);
  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n._id },
      update: {
        type: n.type || 'info',
        title: n.title || 'Notification',
        message: n.message || '',
        isRead: n.read || n.isRead || false
      },
      create: {
        id: n._id,
        type: n.type || 'info',
        title: n.title || 'Notification',
        message: n.message || '',
        isRead: n.read || n.isRead || false
      }
    });
  }

  const partners = readBackupJson('deliverypartners.json');
  console.log(`📁 8. Syncing ${partners.length} Delivery Partners...`);
  for (const dp of partners) {
    await prisma.deliveryPartner.upsert({
      where: { id: dp._id },
      update: {
        name: dp.name,
        phone: dp.phone,
        email: dp.email || null,
        status: dp.status || 'online',
        isActive: dp.isAvailable !== false
      },
      create: {
        id: dp._id,
        name: dp.name,
        phone: dp.phone,
        email: dp.email || null,
        status: dp.status || 'online',
        isActive: dp.isAvailable !== false
      }
    });
  }

  console.log('\n================================================================');
  console.log('🎉 MASTER FULL DATABASE SYNC COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

masterSync().catch(console.error);
