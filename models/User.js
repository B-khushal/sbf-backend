const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

class UserDocument {
  constructor(data) {
    Object.assign(this, data);
    this._id = data.id || data._id;
    this.cart = Array.isArray(data.cart)
      ? data.cart
      : Array.isArray(data.cartItems)
      ? data.cartItems.map(c => {
          const cust = c.customizations && typeof c.customizations === 'object' ? c.customizations : {};
          const isAddon = cust.isAddon || cust.productModel === 'AddonProduct';
          const resolvedProdId = isAddon && cust.addonId ? cust.addonId : (c.productId || (c.product ? c.product.id || c.product._id : null));
          const resolvedModel = cust.productModel || (isAddon ? 'AddonProduct' : 'Product');

          return {
            _id: c.id,
            id: c.id,
            productId: resolvedProdId,
            productModel: resolvedModel,
            product: c.product,
            quantity: c.quantity || 1,
            customizations: c.customizations,
            customPrice: c.selectedPrice !== null && c.selectedPrice !== undefined ? Number(c.selectedPrice) : undefined,
            selectedVariant: c.variantId
          };
        })
      : [];
    this.wishlist = Array.isArray(data.wishlist)
      ? data.wishlist
      : Array.isArray(data.wishlistItems)
      ? data.wishlistItems.map(w => ({
          _id: w.id,
          id: w.id,
          productId: w.productId || (w.product ? w.product.id || w.product._id : null),
          product: w.product,
          addedAt: w.createdAt
        }))
      : [];
    this.addresses = Array.isArray(data.addresses)
      ? data.addresses.map((a, idx) => {
          if (!a || typeof a !== 'object') return null;
          const rawName = (a.fullName || `${a.firstName || ''} ${a.lastName || ''}`).trim();
          const nameParts = rawName.split(' ');
          const firstName = a.firstName || nameParts[0] || '';
          const lastName = a.lastName || nameParts.slice(1).join(' ') || '';
          const streetAddr = a.address || a.street || a.addressLine1 || a.formattedAddress || '';
          const apt = a.apartment || a.addressLine2 || a.houseNo || '';
          const zip = a.zipCode || a.pincode || '';

          return {
            id: String(a.id || a._id || `addr_${Date.now()}_${idx}`),
            firstName,
            lastName,
            fullName: rawName || `${firstName} ${lastName}`.trim(),
            address: streetAddr,
            street: streetAddr,
            addressLine1: streetAddr,
            apartment: apt,
            addressLine2: apt,
            houseNo: a.houseNo || apt || '',
            city: a.city || 'Hyderabad',
            state: a.state || 'Telangana',
            zipCode: zip,
            pincode: zip,
            phone: a.phone || '',
            email: a.email || '',
            notes: a.notes || a.deliveryInstructions || '',
            deliveryOption: a.deliveryOption === 'gift' ? 'gift' : 'self',
            isDefault: !!a.isDefault,
            giftMessage: a.giftMessage || '',
            receiverFirstName: a.receiverFirstName || '',
            receiverLastName: a.receiverLastName || '',
            receiverEmail: a.receiverEmail || '',
            receiverPhone: a.receiverPhone || '',
            receiverAddress: a.receiverAddress || '',
            receiverApartment: a.receiverApartment || '',
            receiverCity: a.receiverCity || '',
            receiverState: a.receiverState || '',
            receiverZipCode: a.receiverZipCode || '',
            latitude: a.latitude,
            longitude: a.longitude,
            formattedAddress: a.formattedAddress || streetAddr,
            landmark: a.landmark || '',
          };
        }).filter(Boolean)
      : [];
    this.login_history = [];
    this.permissions = [];
  }

  async matchPassword(enteredPassword) {
    if (!this.password || !enteredPassword) return false;
    return await bcrypt.compare(enteredPassword, this.password);
  }

  async updateLastActive() {
    const userId = this.id || this._id;
    if (!userId) return;
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { lastActive: new Date() }
      });
      this.lastActive = updated.lastActive;
    } catch (err) {
      // Ignore background timestamp update error
    }
  }

  async deleteOne() {
    const userId = String(this.id || this._id);
    try {
      await prisma.$transaction([
        prisma.cartItem.deleteMany({ where: { userId } }),
        prisma.wishlistItem.deleteMany({ where: { userId } }),
        prisma.address.deleteMany({ where: { userId } }),
        prisma.loginHistory.deleteMany({ where: { userId } }),
        prisma.userPermission.deleteMany({ where: { userId } }),
        prisma.deviceToken.deleteMany({ where: { userId } }),
        prisma.notification.deleteMany({ where: { userId } }),
        prisma.reviewLike.deleteMany({ where: { userId } })
      ]);
      try { await prisma.vendor.deleteMany({ where: { userId } }); } catch (e) {}
      try { await prisma.review.deleteMany({ where: { userId } }); } catch (e) {}
      
      const deleted = await prisma.user.delete({ where: { id: userId } });
      return deleted;
    } catch (err) {
      console.error('Error in User.deleteOne:', err.message);
      return await prisma.user.delete({ where: { id: userId } }).catch(e => null);
    }
  }

  async save() {
    let pwd = this.password;
    if (pwd && pwd.length < 50 && !pwd.startsWith('$2a$') && !pwd.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(12);
      pwd = await bcrypt.hash(pwd, salt);
    }

    const userId = this.id || this._id;
    const updated = await prisma.user.upsert({
      where: { id: userId },
      update: {
        name: this.name,
        email: this.email ? this.email.toLowerCase() : undefined,
        password: pwd,
        role: this.role,
        status: this.status,
        phone: this.phone,
        provider: this.provider,
        googleId: this.googleId,
        photoURL: this.photoURL
      },
      create: {
        id: userId || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: this.name || 'User',
        email: this.email ? this.email.toLowerCase() : `user_${Date.now()}@example.com`,
        password: pwd || '',
        role: this.role || 'customer',
        status: this.status || 'active',
        phone: this.phone || null,
        provider: this.provider || 'local',
        googleId: this.googleId || null,
        photoURL: this.photoURL || null
      }
    });

    // Persist cart to PostgreSQL CartItem table
    if (Array.isArray(this.cart)) {
      try {
        await prisma.cartItem.deleteMany({ where: { userId } });
        const defaultProduct = await prisma.product.findFirst({ select: { id: true } });
        const fallbackProductId = defaultProduct ? defaultProduct.id : null;

        for (const item of this.cart) {
          if (!item || (!item.productId && !item.product)) continue;
          const prodId = String(item.productId || (item.product ? item.product.id || item.product._id : ''));
          if (!prodId) continue;

          let validProdId = prodId;
          const isAddonItem = item.productModel === 'AddonProduct';
          const productExists = await prisma.product.findUnique({ where: { id: prodId }, select: { id: true } });

          if (!productExists) {
            validProdId = fallbackProductId || prodId;
          }

          if (!validProdId) continue;

          const custObj = item.customizations && typeof item.customizations === 'object' ? item.customizations : {};
          const customizationsData = {
            ...custObj,
            productModel: item.productModel || (isAddonItem ? 'AddonProduct' : 'Product'),
            addonId: prodId,
            isAddon: isAddonItem || !productExists
          };

          try {
            await prisma.cartItem.create({
              data: {
                id: item._id || item.id || `cart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                userId: userId,
                productId: validProdId,
                quantity: parseInt(item.quantity || 1),
                customizations: customizationsData,
                selectedPrice: item.customPrice !== undefined ? parseFloat(item.customPrice) : undefined
              }
            });
          } catch (itemErr) {
            console.error('Error creating cart item in DB:', itemErr.message);
          }
        }
      } catch (cartErr) {
        console.error('Error persisting cart items in User.save:', cartErr.message);
      }
    }

    // Persist addresses to PostgreSQL Address table
    if (Array.isArray(this.addresses)) {
      try {
        await prisma.address.deleteMany({ where: { userId } });
        for (const addr of this.addresses) {
          if (!addr) continue;
          const fullName = addr.fullName || `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'Address';
          await prisma.address.create({
            data: {
              id: addr.id || addr._id || `addr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              userId,
              fullName: fullName,
              phone: addr.phone || null,
              street: addr.address || addr.street || addr.formattedAddress || '',
              addressLine1: addr.address || addr.addressLine1 || '',
              addressLine2: addr.apartment || addr.addressLine2 || '',
              city: addr.city || 'Hyderabad',
              state: addr.state || 'Telangana',
              pincode: addr.zipCode || addr.pincode || '',
              zipCode: addr.zipCode || addr.pincode || '',
              country: addr.country || 'India',
              landmark: addr.landmark || addr.apartment || '',
              isDefault: !!addr.isDefault
            }
          });
        }
      } catch (addrErr) {
        console.error('Error persisting addresses in User.save:', addrErr.message);
      }
    }
    if (Array.isArray(this.wishlist)) {
      try {
        await prisma.wishlistItem.deleteMany({ where: { userId } });
        for (const item of this.wishlist) {
          if (!item) continue;
          const prodId = String(item.productId || (item.product ? item.product.id || item.product._id : '') || item.id || item._id);
          if (!prodId) continue;

          const productExists = await prisma.product.findUnique({ where: { id: prodId }, select: { id: true } });
          if (!productExists) continue;

          try {
            await prisma.wishlistItem.create({
              data: {
                id: item._id || item.id || `wish_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                userId: userId,
                productId: prodId
              }
            });
          } catch (itemErr) {
            console.error('Error creating wishlist item in DB:', itemErr.message);
          }
        }
      } catch (wishErr) {
        console.error('Error persisting wishlist items in User.save:', wishErr.message);
      }
    }

    Object.assign(this, updated);
    this._id = updated.id;
    return this;
  }

  toObject() {
    return {
      _id: this._id,
      id: this.id || this._id,
      name: this.name,
      email: this.email,
      role: this.role,
      status: this.status,
      phone: this.phone,
      provider: this.provider,
      googleId: this.googleId,
      photoURL: this.photoURL,
      addresses: this.addresses,
      vendor: this.vendor,
      cartItems: this.cartItems,
      wishlistItems: this.wishlistItems,
      login_history: this.login_history,
      permissions: this.permissions,
      cart: this.cart,
      wishlist: this.wishlist,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class UserQueryChain {
  constructor(prismaPromise) {
    this.prismaPromise = prismaPromise;
  }

  select(fields) {
    return this;
  }

  populate(relation) {
    return this;
  }

  sort(order) {
    return this;
  }

  skip(count) {
    return this;
  }

  limit(count) {
    return this;
  }

  lean() {
    return this;
  }

  exec() {
    return this.then(res => res);
  }

  async then(resolve, reject) {
    try {
      const res = await this.prismaPromise;
      if (Array.isArray(res)) {
        resolve(res.map(u => new UserDocument(u)));
      } else if (res) {
        resolve(new UserDocument(res));
      } else {
        resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  }
}

function cleanUserWhere(where = {}) {
  const filter = {};
  if (!where || typeof where !== 'object') return filter;

  if (where.$or && Array.isArray(where.$or)) {
    const orConditions = where.$or.map(cond => cleanUserWhere(cond)).filter(c => Object.keys(c).length > 0);
    if (orConditions.length > 0) {
      filter.OR = orConditions;
    }
    return filter;
  }

  if (where.email) filter.email = String(where.email).toLowerCase();
  if (where._id || where.id) filter.id = String(where._id || where.id);
  if (where.googleId) filter.googleId = String(where.googleId);

  if (where.role) {
    if (typeof where.role === 'string') {
      filter.role = where.role;
    } else if (typeof where.role === 'object' && where.role !== null) {
      if (where.role.$ne !== undefined) {
        filter.role = { not: where.role.$ne };
      } else if (where.role.$in && Array.isArray(where.role.$in)) {
        filter.role = { in: where.role.$in };
      } else if (where.role.$nin && Array.isArray(where.role.$nin)) {
        filter.role = { notIn: where.role.$nin };
      }
    }
  }

  if (where.status) {
    if (typeof where.status === 'string') {
      filter.status = where.status;
    } else if (typeof where.status === 'object' && where.status !== null) {
      if (where.status.$ne !== undefined) {
        filter.status = { not: where.status.$ne };
      } else if (where.status.$in && Array.isArray(where.status.$in)) {
        filter.status = { in: where.status.$in };
      } else if (where.status.$nin && Array.isArray(where.status.$nin)) {
        filter.status = { notIn: where.status.$nin };
      }
    }
  }

  if (where.assigned_store) {
    filter.assigned_store = String(where.assigned_store);
  }

  if (where.assigned_zone) {
    filter.assigned_zone = String(where.assigned_zone);
  }

  if (where.lastActive && typeof where.lastActive === 'object') {
    filter.lastActive = {};
    if (where.lastActive.$gte) filter.lastActive.gte = new Date(where.lastActive.$gte);
    if (where.lastActive.$lte) filter.lastActive.lte = new Date(where.lastActive.$lte);
    if (where.lastActive.$gt) filter.lastActive.gt = new Date(where.lastActive.$gt);
    if (where.lastActive.$lt) filter.lastActive.lt = new Date(where.lastActive.$lt);
  }

  return filter;
}

class UserModel {
  static findOne(where = {}) {
    const filter = cleanUserWhere(where);

    const promise = prisma.user.findFirst({
      where: filter,
      include: {
        addresses: true,
        vendor: true,
        cartItems: { include: { product: { include: { images: true } } } },
        wishlistItems: { include: { product: { include: { images: true } } } }
      }
    });
    return new UserQueryChain(promise);
  }

  static findById(id) {
    if (!id) return new UserQueryChain(Promise.resolve(null));
    const promise = prisma.user.findUnique({
      where: { id: String(id) },
      include: {
        addresses: true,
        vendor: true,
        cartItems: { include: { product: { include: { images: true } } } },
        wishlistItems: { include: { product: { include: { images: true } } } }
      }
    });
    return new UserQueryChain(promise);
  }

  static find(where = {}) {
    const filter = cleanUserWhere(where);

    const promise = prisma.user.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: {
        addresses: true,
        vendor: true,
        cartItems: { include: { product: { include: { images: true } } } },
        wishlistItems: { include: { product: { include: { images: true } } } }
      }
    });
    return new UserQueryChain(promise);
  }

  static async aggregate(pipeline) {
    if (pipeline && Array.isArray(pipeline)) {
      const unwindStage = pipeline.find(p => p && p.$unwind);
      if (unwindStage && (unwindStage.$unwind === '$wishlist' || unwindStage.$unwind === 'wishlist')) {
        const count = await prisma.wishlistItem.count();
        return [{ _id: null, count }];
      }
    }

    const users = await prisma.user.findMany();
    if (pipeline && Array.isArray(pipeline)) {
      const groupStage = pipeline.find(p => p.$group);
      if (groupStage && groupStage.$group) {
        const idField = groupStage.$group._id;
        
        if (typeof idField === 'object' && idField && idField.year) {
          const salesMap = {};
          users.forEach(u => {
            const d = new Date(u.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            if (!salesMap[key]) {
              salesMap[key] = {
                _id: { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() },
                users: 0
              };
            }
            salesMap[key].users += 1;
          });
          return Object.values(salesMap);
        }

        if (idField === '$role') {
          const roleMap = {};
          users.forEach(u => {
            const r = u.role || 'customer';
            roleMap[r] = (roleMap[r] || 0) + 1;
          });
          return Object.keys(roleMap).map(r => ({ _id: r, count: roleMap[r] }));
        }
      }
    }
    return [{ _id: null, count: users.length }];
  }

  static async create(data) {
    let password = data.password;
    if (password && password.length < 50 && !password.startsWith('$2a$') && !password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(12);
      password = await bcrypt.hash(password, salt);
    }

    const created = await prisma.user.create({
      data: {
        id: data.id || data._id || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        email: data.email.toLowerCase(),
        password,
        role: data.role || 'customer',
        status: data.status || 'active',
        phone: data.phone || null,
        provider: data.provider || 'local',
        googleId: data.googleId || null,
        photoURL: data.photoURL || null
      }
    });

    return new UserDocument(created);
  }

  static async findByIdAndUpdate(id, update, options = {}) {
    const dataToUpdate = update.$set ? update.$set : update;
    try {
      const updated = await prisma.user.update({
        where: { id: String(id) },
        data: dataToUpdate
      });
      return new UserDocument(updated);
    } catch (e) {
      return null;
    }
  }

  static async findByIdAndDelete(id) {
    if (!id) return null;
    try {
      const user = await UserModel.findById(id);
      if (!user) return null;
      await user.deleteOne();
      return user;
    } catch (e) {
      console.error('Error in UserModel.findByIdAndDelete:', e.message);
      return null;
    }
  }

  static async countDocuments(where = {}) {
    const filter = cleanUserWhere(where);
    return await prisma.user.count({ where: filter });
  }

  static populate() {
    return this;
  }
}

module.exports = UserModel;
