const prisma = require('../config/prisma');

function cleanOrderWhere(where = {}) {
  if (!where || typeof where !== 'object') return {};
  const clean = {};

  if (Array.isArray(where.$or)) {
    const cleanOr = where.$or.map(cond => cleanOrderWhere(cond)).filter(c => Object.keys(c).length > 0);
    if (cleanOr.length > 0) {
      clean.OR = cleanOr;
    }
  }

  if (where.orderNumber) clean.orderNumber = String(where.orderNumber);
  if (where.userId || where.user) clean.userId = String(where.userId || where.user);
  if (where._id || where.id) clean.id = String(where._id || where.id);
  if (where.razorpayOrderId) clean.razorpayOrderId = String(where.razorpayOrderId);

  const emailVal = where.customerEmail || where.email || where['shippingDetails.email'];
  if (emailVal) {
    if (typeof emailVal === 'string') {
      clean.customerEmail = { equals: emailVal, mode: 'insensitive' };
    } else if (typeof emailVal === 'object' && emailVal.$regex) {
      const pattern = emailVal.$regex.source || String(emailVal.$regex).replace(/^\/|\/[a-z]*$/g, '').replace(/\^|\$/g, '');
      clean.customerEmail = { contains: pattern, mode: 'insensitive' };
    }
  }

  const phoneVal = where.customerPhone || where.phone || where['shippingDetails.phone'];
  if (phoneVal) {
    if (typeof phoneVal === 'string') {
      clean.customerPhone = { contains: phoneVal };
    } else if (typeof phoneVal === 'object' && phoneVal.$regex) {
      const pattern = phoneVal.$regex.source || String(phoneVal.$regex).replace(/^\/|\/[a-z]*$/g, '').replace(/\^|\$/g, '');
      clean.customerPhone = { contains: pattern };
    }
  }

  const statusFilter = where.orderStatus || where.status;
  if (statusFilter) {
    if (typeof statusFilter === 'string') {
      clean.orderStatus = statusFilter;
    } else if (typeof statusFilter === 'object') {
      if (statusFilter.$in && Array.isArray(statusFilter.$in)) {
        clean.orderStatus = { in: statusFilter.$in };
      }
      if (statusFilter.$ne) {
        clean.orderStatus = { not: statusFilter.$ne };
      }
    }
  }

  if (where.paymentStatus && typeof where.paymentStatus === 'string') {
    clean.paymentStatus = where.paymentStatus;
  }

  // Handle date filters
  if (where.createdAt && typeof where.createdAt === 'object') {
    clean.createdAt = {};
    if (where.createdAt.$gte) clean.createdAt.gte = new Date(where.createdAt.$gte);
    if (where.createdAt.$lte) clean.createdAt.lte = new Date(where.createdAt.$lte);
    if (where.createdAt.$gt) clean.createdAt.gt = new Date(where.createdAt.$gt);
    if (where.createdAt.$lt) clean.createdAt.lt = new Date(where.createdAt.$lt);
  }

  if (where.giftDetails !== undefined) {
    if (where.giftDetails === null) {
      clean.giftDetails = { equals: null };
    } else if (typeof where.giftDetails === 'object' && where.giftDetails.$ne === null) {
      clean.giftDetails = { not: null };
    }
  }

  return clean;
}

class OrderDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.user = data.user && typeof data.user === 'object' ? data.user : (data.userId || data.user);
    this.status = data.orderStatus || data.status || 'pending';
    this.orderStatus = this.status;
    this.currency = 'INR';

    const uObj = data.user && typeof data.user === 'object' ? data.user : null;
    const rawShip = (data.shippingAddress && typeof data.shippingAddress === 'object')
      ? data.shippingAddress
      : ((data.shippingDetails && typeof data.shippingDetails === 'object') ? data.shippingDetails : {});

    const isValidEmailStr = (em) => em && typeof em === 'string' && !['n/a', 'na', 'null', 'undefined', 'none', ''].includes(em.trim().toLowerCase()) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim());

    this.customerName = data.customerName || rawShip.fullName || (uObj ? uObj.name : null) || 'Customer';
    const resolvedEmail = (isValidEmailStr(data.customerEmail) && data.customerEmail.trim())
      || (isValidEmailStr(rawShip.email) && rawShip.email.trim())
      || (isValidEmailStr(uObj?.email) && uObj.email.trim())
      || (isValidEmailStr(data.shippingDetails?.email) && data.shippingDetails.email.trim())
      || null;
    this.customerEmail = resolvedEmail;
    this.customerPhone = data.customerPhone || rawShip.phone || (uObj ? uObj.phone : null) || null;

    this.subtotal = parseFloat(data.subtotal || data.totalAmount || data.finalTotal || (Array.isArray(data.items) ? data.items.reduce((s, i) => s + (parseFloat(i.price || 0) * parseInt(i.quantity || i.qty || 1)), 0) : 0));
    this.shippingFee = parseFloat(data.shippingFee || data.deliveryCharge || 0);
    this.taxAmount = parseFloat(data.taxAmount || 0);
    this.discountAmount = parseFloat(data.discountAmount || data.discount || 0);
    this.totalAmount = parseFloat(data.totalAmount || data.finalTotal || (this.subtotal + this.shippingFee - this.discountAmount));

    const nameParts = this.customerName.split(' ');
    const firstName = rawShip.firstName || nameParts[0] || 'Customer';
    const lastName = rawShip.lastName || nameParts.slice(1).join(' ') || '';

    // Map shippingDetails backward compatibility
    this.shippingDetails = {
      fullName: this.customerName,
      firstName,
      lastName,
      email: this.customerEmail,
      phone: this.customerPhone,
      address: rawShip.address || rawShip.formattedAddress || rawShip.street || '',
      apartment: rawShip.apartment || rawShip.landmark || '',
      city: rawShip.city || 'Hyderabad',
      state: rawShip.state || 'Telangana',
      zipCode: rawShip.zipCode || rawShip.pincode || '',
      deliveryDate: data.deliveryDate || rawShip.deliveryDate || null,
      timeSlot: data.deliverySlot || rawShip.timeSlot || null,
      cardMessage: data.cardMessage || rawShip.cardMessage || null,
      deliverySpecialInstructions: rawShip.deliverySpecialInstructions || rawShip.notes || null,
      latitude: rawShip.latitude || null,
      longitude: rawShip.longitude || null,
      landmark: rawShip.landmark || '',
      houseNo: rawShip.houseNo || '',
      floor: rawShip.floor || ''
    };

    const resolvedMethod = (data.paymentMethod && data.paymentMethod.toLowerCase() !== 'cod')
      ? data.paymentMethod
      : (data.paymentDetails?.method && data.paymentDetails.method.toLowerCase() !== 'cod'
        ? data.paymentDetails.method
        : 'razorpay');
    const resolvedStatus = data.paymentStatus || data.paymentDetails?.status || 'completed';

    this.paymentMethod = resolvedMethod;
    this.paymentStatus = resolvedStatus;
    this.paymentDetails = {
      method: resolvedMethod,
      razorpayPaymentId: data.razorpayPaymentId || data.paymentDetails?.razorpayPaymentId || null,
      razorpayOrderId: data.razorpayOrderId || data.paymentDetails?.razorpayOrderId || null,
      status: resolvedStatus
    };

    if (Array.isArray(data.timeline)) {
      this.trackingHistory = data.timeline.map(t => ({
        status: t.status,
        timestamp: t.timestamp ? new Date(t.timestamp) : new Date()
      }));
    } else {
      this.trackingHistory = Array.isArray(data.trackingHistory) ? data.trackingHistory : [];
    }

    if (Array.isArray(data.items)) {
      this.items = data.items.map(item => {
        const itemPrice = parseFloat(item.price ?? item.finalPrice ?? item.unitPrice ?? 0);
        const itemQty = parseInt(item.quantity ?? item.qty ?? 1);
        const itemSub = parseFloat(item.subtotal || (itemPrice * itemQty));
        const prodId = String(item.productId || (typeof item.product === 'object' ? item.product.id || item.product._id : item.product) || '');
        const itemTitle = item.productName || item.title || item.name || (typeof item.product === 'object' ? item.product.title || item.product.name : '') || 'Florist Arrangement';

        return {
          _id: item.id || item._id || `item_${Math.random()}`,
          id: item.id || item._id || `item_${Math.random()}`,
          productId: prodId,
          productModel: item.productModel || 'Product',
          product: typeof item.product === 'object' ? item.product : {
            _id: prodId,
            id: prodId,
            name: itemTitle,
            title: itemTitle,
            price: itemPrice,
            images: item.image ? [item.image] : []
          },
          productName: itemTitle,
          name: itemTitle,
          title: itemTitle,
          price: itemPrice,
          finalPrice: itemPrice,
          unitPrice: itemPrice,
          quantity: itemQty,
          qty: itemQty,
          subtotal: itemSub,
          image: item.image || (Array.isArray(item.images) ? item.images[0] : '') || '',
          images: Array.isArray(item.images) ? item.images : (item.image ? [item.image] : []),
          customizations: item.customizations || null,
          selectedVariant: item.selectedVariant || null
        };
      });
    } else {
      this.items = [];
    }
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      orderNumber: this.orderNumber,
      userId: this.userId,
      user: this.user,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      status: this.status,
      orderStatus: this.status,
      paymentStatus: this.paymentStatus,
      totalAmount: this.totalAmount,
      subtotal: this.subtotal,
      shippingFee: this.shippingFee,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      currency: this.currency,
      shippingDetails: this.shippingDetails,
      paymentDetails: this.paymentDetails,
      trackingHistory: this.trackingHistory,
      items: this.items,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    let orderId = this.id || this._id;
    let orderNum = this.orderNumber;

    if (!orderId && orderNum) {
      const existingOrder = await prisma.order.findUnique({ where: { orderNumber: orderNum } });
      if (existingOrder) {
        orderId = existingOrder.id;
      }
    }

    if (!orderId) {
      orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    if (!orderNum) {
      orderNum = `SBF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const userId = typeof this.user === 'object' ? this.user.id : (this.userId || this.user || null);

    const updated = await prisma.order.upsert({
      where: { id: orderId },
      update: {
        orderStatus: this.status || this.orderStatus || 'pending',
        paymentStatus: this.paymentStatus || this.paymentDetails?.status || 'completed',
        paymentMethod: (this.paymentMethod && this.paymentMethod.toLowerCase() !== 'cod') ? this.paymentMethod : (this.paymentDetails?.method && this.paymentDetails.method.toLowerCase() !== 'cod' ? this.paymentDetails.method : 'razorpay'),
        razorpayOrderId: this.razorpayOrderId || null,
        razorpayPaymentId: this.razorpayPaymentId || null,
        razorpaySignature: this.razorpaySignature || null,
        totalAmount: this.totalAmount ? parseFloat(this.totalAmount) : 0,
        subtotal: this.subtotal ? parseFloat(this.subtotal) : 0,
        shippingFee: this.shippingFee ? parseFloat(this.shippingFee) : 0,
        taxAmount: this.taxAmount ? parseFloat(this.taxAmount) : 0,
        discountAmount: this.discountAmount ? parseFloat(this.discountAmount) : 0,
        deliveryDate: this.shippingDetails?.deliveryDate ? new Date(this.shippingDetails.deliveryDate) : undefined,
        deliverySlot: this.shippingDetails?.timeSlot || undefined,
        cardMessage: this.shippingDetails?.cardMessage || undefined,
        shippingAddress: this.shippingDetails || undefined,
        shippingDetails: this.shippingDetails || undefined,
        paymentDetails: this.paymentDetails || undefined,
        giftDetails: this.giftDetails || undefined,
        deliveryCharge: this.shippingFee ? parseFloat(this.shippingFee) : undefined,
        discount: this.discountAmount ? parseFloat(this.discountAmount) : undefined,
        finalTotal: this.totalAmount ? parseFloat(this.totalAmount) : undefined,
        trackingHistory: this.trackingHistory || undefined,
        customerName: this.customerName || undefined,
        customerEmail: this.customerEmail || undefined,
        customerPhone: this.customerPhone || undefined,
        userId: userId || undefined
      },
      create: {
        id: orderId,
        orderNumber: orderNum,
        userId: userId,
        customerName: this.customerName || this.shippingDetails?.fullName || 'Customer',
        customerEmail: this.customerEmail || this.shippingDetails?.email || null,
        customerPhone: this.customerPhone || this.shippingDetails?.phone || null,
        totalAmount: this.totalAmount ? parseFloat(this.totalAmount) : 0,
        subtotal: this.subtotal ? parseFloat(this.subtotal) : 0,
        shippingFee: this.shippingFee ? parseFloat(this.shippingFee) : 0,
        taxAmount: this.taxAmount ? parseFloat(this.taxAmount) : 0,
        discountAmount: this.discountAmount ? parseFloat(this.discountAmount) : 0,
        orderStatus: this.status || this.orderStatus || 'pending',
        paymentStatus: this.paymentStatus || this.paymentDetails?.status || 'completed',
        paymentMethod: (this.paymentMethod && this.paymentMethod.toLowerCase() !== 'cod') ? this.paymentMethod : (this.paymentDetails?.method && this.paymentDetails.method.toLowerCase() !== 'cod' ? this.paymentDetails.method : 'razorpay'),
        razorpayOrderId: this.razorpayOrderId || null,
        razorpayPaymentId: this.razorpayPaymentId || null,
        razorpaySignature: this.razorpaySignature || null,
        deliveryDate: this.shippingDetails?.deliveryDate ? new Date(this.shippingDetails.deliveryDate) : undefined,
        deliverySlot: this.shippingDetails?.timeSlot || undefined,
        cardMessage: this.shippingDetails?.cardMessage || undefined,
        shippingAddress: this.shippingDetails || undefined,
        shippingDetails: this.shippingDetails || undefined,
        paymentDetails: this.paymentDetails || undefined,
        giftDetails: this.giftDetails || undefined,
        deliveryCharge: this.shippingFee ? parseFloat(this.shippingFee) : 0,
        discount: this.discountAmount ? parseFloat(this.discountAmount) : 0,
        finalTotal: this.totalAmount ? parseFloat(this.totalAmount) : 0,
        trackingHistory: this.trackingHistory || undefined
      }
    });

    // Save order items into OrderItem table
    if (Array.isArray(this.items) && this.items.length > 0) {
      try {
        await prisma.orderItem.deleteMany({ where: { orderId: updated.id } });
        for (const item of this.items) {
          if (!item) continue;
          const prodId = String(item.productId || (typeof item.product === 'object' ? item.product.id || item.product._id : item.product) || '');
          const pExists = prodId ? await prisma.product.findUnique({ where: { id: prodId }, select: { id: true } }) : null;
          
          await prisma.orderItem.create({
            data: {
              id: item._id || item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              orderId: updated.id,
              productId: pExists ? pExists.id : null,
              productName: item.productName || item.title || item.name || 'Florist Item',
              price: parseFloat(item.price || 0),
              quantity: parseInt(item.quantity || item.qty || 1),
              subtotal: parseFloat(item.subtotal || (parseFloat(item.price || 0) * parseInt(item.quantity || item.qty || 1))),
              image: item.image || (Array.isArray(item.images) ? item.images[0] : '') || ''
            }
          });
        }
      } catch (itemErr) {
        console.error('Error saving order items:', itemErr.message);
      }
    }

    Object.assign(this, updated);
    this._id = updated.id;
    return this;
  }
}

class QueryChain {
  constructor(prismaQuery) {
    this.prismaQuery = prismaQuery;
  }

  populate() { return this; }
  sort() { return this; }
  skip() { return this; }
  limit() { return this; }
  select() { return this; }
  lean() { return this; }
  exec() { return this.then(r => r); }

  async then(resolve, reject) {
    try {
      const res = await this.prismaQuery;
      if (Array.isArray(res)) {
        resolve(res.map(o => new OrderDocument(o)));
      } else if (res) {
        resolve(new OrderDocument(res));
      } else {
        resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  }
}

class OrderModel {
  static find(where = {}) {
    const prismaWhere = cleanOrderWhere(where);

    const query = prisma.order.findMany({
      where: prismaWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        timeline: true,
        payments: true,
        user: true
      }
    });

    return new QueryChain(query);
  }

  static findOne(where = {}) {
    const prismaWhere = cleanOrderWhere(where);

    const query = prisma.order.findFirst({
      where: prismaWhere,
      include: {
        items: true,
        timeline: true,
        payments: true,
        user: true
      }
    });

    return new QueryChain(query);
  }

  static findById(id) {
    if (!id) return new QueryChain(Promise.resolve(null));
    const query = prisma.order.findUnique({
      where: { id: String(id) },
      include: {
        items: true,
        timeline: true,
        payments: true,
        user: true
      }
    });

    return new QueryChain(query);
  }

  static async create(data) {
    const orderId = data.id || data._id || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const created = await prisma.order.create({
      data: {
        id: orderId,
        orderNumber: data.orderNumber || `ORD-${orderId}`,
        userId: typeof data.user === 'object' ? data.user.id : (data.userId || data.user || null),
        customerName: data.customerName || data.shippingDetails?.fullName || null,
        customerEmail: data.customerEmail || data.shippingDetails?.email || null,
        customerPhone: data.customerPhone || data.shippingDetails?.phone || null,
        totalAmount: parseFloat(data.totalAmount || data.total || 0),
        subtotal: parseFloat(data.subtotal || data.totalAmount || 0),
        orderStatus: data.orderStatus || data.status || 'pending',
        paymentStatus: data.paymentStatus || data.paymentDetails?.status || 'completed',
        paymentMethod: (data.paymentMethod && data.paymentMethod.toLowerCase() !== 'cod') ? data.paymentMethod : (data.paymentDetails?.method && data.paymentDetails.method.toLowerCase() !== 'cod' ? data.paymentDetails.method : 'razorpay')
      }
    });

    return new OrderDocument(created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.order.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new OrderDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const prismaWhere = cleanOrderWhere(where);
    return await prisma.order.count({ where: prismaWhere });
  }

  static async aggregate(pipeline) {
    let prismaWhere = {};
    if (pipeline && Array.isArray(pipeline)) {
      const matchStage = pipeline.find(p => p && p.$match);
      if (matchStage && matchStage.$match) {
        prismaWhere = cleanOrderWhere(matchStage.$match);
      }
    }

    const orders = await prisma.order.findMany({
      where: prismaWhere,
      include: { user: true, items: true }
    });
    
    if (pipeline && Array.isArray(pipeline)) {
      const projectStage = pipeline.find(p => p && p.$project);
      const groupStage = pipeline.find(p => p && p.$group);

      if (projectStage && !groupStage) {
        return orders.map(o => {
          let giftDetails = o.giftDetails;
          if (typeof giftDetails === 'string') {
            try { giftDetails = JSON.parse(giftDetails); } catch (e) {}
          }
          let shippingDetails = o.shippingDetails;
          if (typeof shippingDetails === 'string') {
            try { shippingDetails = JSON.parse(shippingDetails); } catch (e) {}
          }
          const cardMessage = giftDetails?.message || giftDetails?.cardMessage || shippingDetails?.cardMessage || o.cardMessage || '';
          const greeting = giftDetails?.greetingCard || giftDetails?.greeting || '';
          return {
            cardMessage,
            greeting
          };
        });
      }
      
      if (groupStage && groupStage.$group) {
        const idField = groupStage.$group._id;

        // Payment Breakdown
        if (typeof idField === 'object' && idField && (idField.method || idField.razorpayPaymentId)) {
          const paymentMap = {};
          orders.forEach(o => {
            const method = o.paymentMethod || 'razorpay';
            if (!paymentMap[method]) paymentMap[method] = { revenue: 0, transactions: 0, id: { method, razorpayPaymentId: o.razorpayPaymentId } };
            paymentMap[method].revenue += parseFloat(o.totalAmount || 0);
            paymentMap[method].transactions += 1;
          });
          return Object.values(paymentMap).map(p => ({
            _id: p.id,
            revenue: p.revenue,
            transactions: p.transactions
          }));
        }

        // Sales Data Chart (year, month, day)
        if (typeof idField === 'object' && idField && idField.year) {
          const salesMap = {};
          orders.forEach(o => {
            const d = new Date(o.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            if (!salesMap[key]) {
              salesMap[key] = {
                _id: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
                total: 0,
                orders: 0
              };
            }
            salesMap[key].total += parseFloat(o.totalAmount || 0);
            salesMap[key].orders += 1;
          });
          return Object.values(salesMap);
        }

        // Status distribution
        if (idField === '$status' || idField === '$orderStatus') {
          const statusMap = {};
          orders.forEach(o => {
            const st = o.orderStatus || 'pending';
            statusMap[st] = (statusMap[st] || 0) + 1;
          });
          return Object.keys(statusMap).map(st => ({ _id: st, count: statusMap[st] }));
        }

        // Top Selling Products aggregation ($items.product)
        if (idField === '$items.product') {
          const prodMap = {};
          for (const o of orders) {
            if (o.orderStatus === 'cancelled') continue;
            const items = Array.isArray(o.items) ? o.items : [];
            for (const item of items) {
              const prodId = String(item.productId || (typeof item.product === 'object' ? item.product.id || item.product._id : item.product) || '');
              if (!prodId) continue;
              const itemName = item.productName || item.title || item.name || (typeof item.product === 'object' ? item.product.title || item.product.name : 'Product');
              const itemPrice = parseFloat(item.price || item.finalPrice || 0);
              const itemQty = parseInt(item.quantity || item.qty || 1);

              if (!prodMap[prodId]) {
                prodMap[prodId] = {
                  _id: prodId,
                  name: itemName,
                  sold: 0,
                  revenue: 0
                };
              }
              prodMap[prodId].sold += itemQty;
              prodMap[prodId].revenue += itemPrice * itemQty;
            }
          }

          const result = Object.values(prodMap).sort((a, b) => b.sold - a.sold).slice(0, 10);
          
          if (result.length === 0) {
            const catalogProds = await prisma.product.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
            return catalogProds.map(p => ({
              _id: p.id,
              name: p.name,
              sold: 1,
              revenue: parseFloat(p.price || 0)
            }));
          }

          return result;
        }

        // City distribution
        if (idField === '$shippingDetails.city') {
          const cityMap = {};
          orders.forEach(o => {
            let city = 'Hyderabad';
            if (o.shippingAddress && typeof o.shippingAddress === 'object') {
              city = o.shippingAddress.city || 'Hyderabad';
            }
            if (!cityMap[city]) cityMap[city] = { revenue: 0, orders: 0 };
            cityMap[city].revenue += parseFloat(o.totalAmount || 0);
            cityMap[city].orders += 1;
          });
          return Object.keys(cityMap).map(c => ({ _id: c, revenue: cityMap[c].revenue, orders: cityMap[c].orders }));
        }
      }
    }

    const totalSales = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
    const subtotalSales = orders.reduce((sum, o) => sum + parseFloat(o.subtotal || o.totalAmount || 0), 0);
    return [{
      _id: null,
      count: orders.length,
      grossSales: subtotalSales,
      netRevenue: totalSales
    }];
  }

  static populate() { return this; }
}

function OrderWrapper(data) {
  if (!(this instanceof OrderWrapper)) {
    return new OrderWrapper(data);
  }
  return new OrderDocument(data);
}

Object.getOwnPropertyNames(OrderModel).forEach(prop => {
  if (typeof OrderModel[prop] === 'function') {
    OrderWrapper[prop] = OrderModel[prop].bind(OrderModel);
  }
});

module.exports = OrderWrapper;
