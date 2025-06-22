const mongoose = require('mongoose');
require('dotenv').config();

// Import the PromoCode model
const PromoCode = require('./models/PromoCode');
const User = require('./models/User');

async function createSamplePromoCodes() {
  try {
    console.log('🎟️ Creating Sample Promo Codes...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ssl: true,
      sslValidate: false,
    });
    
    console.log('✅ Connected to MongoDB Atlas');
    
    // Find or create an admin user for the createdBy field
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️ No admin user found, creating a test admin...');
      adminUser = new User({
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'hashedpassword', // This won't be used
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Test admin user created');
    }
    
    // Sample promo codes
    const samplePromoCodes = [
      {
        code: 'WELCOME10',
        description: 'Welcome discount for new customers - 10% off on orders above ₹500',
        discountType: 'percentage',
        discountValue: 10,
        minimumOrderAmount: 500,
        maximumDiscountAmount: 200,
        usageLimit: 100,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
        createdBy: adminUser._id,
        metadata: {
          campaignName: 'Welcome Campaign',
          notes: 'Perfect for first-time customers',
          tags: ['welcome', 'new-customer', 'percentage']
        }
      },
      {
        code: 'SAVE50',
        description: 'Flat ₹50 off on all orders above ₹200',
        discountType: 'fixed',
        discountValue: 50,
        minimumOrderAmount: 200,
        usageLimit: 50,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        isActive: true,
        createdBy: adminUser._id,
        metadata: {
          campaignName: 'Fixed Discount',
          notes: 'Great for smaller orders',
          tags: ['fixed', 'small-orders']
        }
      },
      {
        code: 'FLOWERS20',
        description: '20% off on all flower arrangements - Limited time offer!',
        discountType: 'percentage',
        discountValue: 20,
        minimumOrderAmount: 1000,
        maximumDiscountAmount: 500,
        usageLimit: 25,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        isActive: true,
        applicableCategories: ['Flowers', 'Bouquets', 'Arrangements'],
        createdBy: adminUser._id,
        metadata: {
          campaignName: 'Flower Special',
          notes: 'Perfect for special occasions',
          tags: ['flowers', 'premium', 'limited-time']
        }
      },
      {
        code: 'BIGORDER',
        description: '₹100 off on orders above ₹2000 - For bulk purchases',
        discountType: 'fixed',
        discountValue: 100,
        minimumOrderAmount: 2000,
        usageLimit: 20,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        isActive: true,
        createdBy: adminUser._id,
        metadata: {
          campaignName: 'Bulk Orders',
          notes: 'Encourage larger purchases',
          tags: ['bulk', 'high-value', 'corporate']
        }
      },
      {
        code: 'EXPIRED10',
        description: 'Expired promo code for testing - 10% off',
        discountType: 'percentage',
        discountValue: 10,
        minimumOrderAmount: 300,
        validFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        validUntil: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (expired)
        isActive: true,
        createdBy: adminUser._id,
        metadata: {
          campaignName: 'Test Expired',
          notes: 'For testing expired promo code behavior',
          tags: ['test', 'expired']
        }
      }
    ];
    
    console.log('\n🗑️ Clearing existing sample promo codes...');
    await PromoCode.deleteMany({ 
      code: { $in: samplePromoCodes.map(p => p.code) }
    });
    
    console.log('📝 Creating new sample promo codes...\n');
    
    for (const promoData of samplePromoCodes) {
      try {
        const promoCode = new PromoCode(promoData);
        await promoCode.save();
        
        const status = promoCode.isCurrentlyValid ? '✅ Active' : 
                      new Date() > new Date(promoCode.validUntil) ? '❌ Expired' : '⏳ Pending';
        
        console.log(`✅ Created: ${promoCode.code}`);
        console.log(`   📝 ${promoCode.description}`);
        console.log(`   💰 ${promoCode.discountType === 'percentage' ? promoCode.discountValue + '%' : '₹' + promoCode.discountValue} discount`);
        console.log(`   📦 Min order: ₹${promoCode.minimumOrderAmount}`);
        console.log(`   📅 Valid until: ${promoCode.validUntil.toLocaleDateString()}`);
        console.log(`   📊 Status: ${status}`);
        console.log('');
      } catch (error) {
        console.log(`❌ Failed to create ${promoData.code}:`, error.message);
      }
    }
    
    // Get final count
    const totalPromoCodes = await PromoCode.countDocuments();
    const activePromoCodes = await PromoCode.countDocuments({
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });
    
    console.log('📊 Summary:');
    console.log(`   🎟️ Total promo codes: ${totalPromoCodes}`);
    console.log(`   ✅ Currently active: ${activePromoCodes}`);
    
    console.log('\n🎉 Sample promo codes created successfully!');
    console.log('\n🧪 Testing Instructions:');
    console.log('1. Go to your admin panel: http://localhost:5173/admin/promocodes');
    console.log('2. You should see all the sample promo codes');
    console.log('3. Try creating a new one through the UI');
    console.log('4. Test validation with these codes:');
    console.log('   - WELCOME10 (10% off, min ₹500)');
    console.log('   - SAVE50 (₹50 off, min ₹200)');
    console.log('   - FLOWERS20 (20% off, min ₹1000)');
    console.log('   - EXPIRED10 (should fail - expired)');
    
  } catch (error) {
    console.error('❌ Error creating sample promo codes:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
createSamplePromoCodes(); 