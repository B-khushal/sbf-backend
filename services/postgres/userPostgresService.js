const prisma = require('../../config/prisma');

class UserPostgresService {
  async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        addresses: true,
        vendor: true,
        permissions: true
      }
    });
  }

  async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        vendor: true,
        permissions: true,
        cartItems: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        },
        wishlistItems: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        }
      }
    });
  }

  async createUser(data) {
    return await prisma.user.create({
      data: {
        id: data.id || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        email: data.email.toLowerCase(),
        password: data.password,
        role: data.role || 'customer',
        status: data.status || 'active',
        phone: data.phone || null,
        provider: data.provider || 'local',
        googleId: data.googleId || null,
        photoURL: data.photoURL || null,
        agreedToTerms: data.agreedToTerms || false
      }
    });
  }

  async updateUser(id, updateData) {
    return await prisma.user.update({
      where: { id },
      data: updateData
    });
  }

  async addAddress(userId, addressData) {
    return await prisma.address.create({
      data: {
        id: `addr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        fullName: addressData.fullName || addressData.name,
        phone: addressData.phone,
        street: addressData.street || addressData.address,
        addressLine1: addressData.addressLine1 || addressData.street,
        addressLine2: addressData.addressLine2 || null,
        city: addressData.city,
        state: addressData.state,
        pincode: addressData.pincode || addressData.zipCode,
        zipCode: addressData.zipCode || addressData.pincode,
        country: addressData.country || 'India',
        isDefault: addressData.isDefault || false,
        type: addressData.type || 'home',
        landmark: addressData.landmark || null
      }
    });
  }
}

module.exports = new UserPostgresService();
