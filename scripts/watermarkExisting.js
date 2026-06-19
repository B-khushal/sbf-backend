const dotenv = require('dotenv');
const path = require('path');

// Load environment variables immediately before loading other modules that rely on env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const axios = require('axios');
const Product = require('../models/Product');
const Settings = require('../models/settings');
const { uploadToCloudinary, uploadToCloudinarySecure, deleteFromCloudinary } = require('../config/cloudinary');
const { watermarkImage } = require('../utils/watermark');


const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGO_URI or MONGODB_URI not found in environment variables.');
  process.exit(1);
}

// Helper to extract Cloudinary public ID from URL
function getPublicIdFromUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    // Remove version prefix if exists (e.g., v12345678/)
    const cleanedPath = pathPart.replace(/^v\d+\//, '');
    // Remove file extension
    const dotIndex = cleanedPath.lastIndexOf('.');
    if (dotIndex === -1) return cleanedPath;
    return cleanedPath.substring(0, dotIndex);
  } catch (err) {
    console.error('Error parsing public ID:', err);
    return null;
  }
}

async function runMigration() {
  try {
    console.log('🔄 Connecting to Database...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to Database');

    // 1. Fetch settings
    const settings = await Settings.findOne();
    const imageProtection = settings?.imageProtectionSettings || {
      enableWatermark: true,
      watermarkText: 'sbflorist.in',
      watermarkOpacity: 20,
      watermarkPosition: 'Center + Bottom Right',
      watermarkSize: 30,
      watermarkRotation: -45,
      repeatingPattern: false
    };

    console.log('⚙️ Loaded Watermark Settings:', imageProtection);

    if (!imageProtection.enableWatermark) {
      console.log('⚠️ Watermarking is disabled in admin settings. Skipping migration.');
      await mongoose.connection.close();
      return;
    }

    // 2. Fetch all products
    const products = await Product.find({});
    console.log(`📦 Found ${products.length} products to check.`);

    let processedCount = 0;
    let imageProcessedCount = 0;

    const force = process.argv.includes('--force') || process.env.FORCE === 'true';

    for (const product of products) {
      // Check if product already has originalImages matching images count and they are actually different (not identical fallback URLs)
      const hasOriginals = product.originalImages && product.originalImages.length === product.images.length && product.originalImages.length > 0;
      const isIdentical = hasOriginals && product.images.some((img, idx) => img === product.originalImages[idx]);
      
      if (hasOriginals && !isIdentical && !force) {
        console.log(`⏩ Skipping product "${product.title}" (already watermarked).`);
        continue;
      }

      console.log(`\n📷 Processing product: "${product.title}" (${product._id})`);
      const newImages = [];
      const newOriginals = [];
      const oldPublicIdsToDelete = [];

      for (let i = 0; i < product.images.length; i++) {
        const imageUrl = product.images[i];
        
        // Skip placeholders
        if (!imageUrl || imageUrl.includes('placeholder') || !imageUrl.startsWith('http')) {
          newImages.push(imageUrl);
          newOriginals.push(imageUrl);
          continue;
        }

        console.log(`   - Downloading image [${i + 1}/${product.images.length}]: ${imageUrl}`);
        try {
          // Download image buffer
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);

          // Get public ID of old image for deletion
          const oldPublicId = getPublicIdFromUrl(imageUrl);
          if (oldPublicId) {
            oldPublicIdsToDelete.push(oldPublicId);
          }

          // Generate unique filename base
          const filenameBase = `migrated-${product._id}-${i}-${Date.now()}`;

          // 1. Upload original as private/secure
          console.log(`   - Uploading original privately...`);
          const originalResult = await uploadToCloudinarySecure(imageBuffer, `${filenameBase}_original`, 'sbf-products');
          
          // 2. Apply watermark locally
          console.log(`   - Applying watermark...`);
          const watermarkedBuffer = await watermarkImage(imageBuffer, imageProtection);

          // 3. Upload watermarked publicly
          console.log(`   - Uploading watermarked publicly...`);
          const watermarkedResult = await uploadToCloudinary(watermarkedBuffer, filenameBase, 'sbf-products');

          newImages.push(watermarkedResult.secure_url);
          newOriginals.push(originalResult.secure_url);
          imageProcessedCount++;

          console.log(`   ✅ Succeeded: Watermarked: ${watermarkedResult.secure_url}`);
        } catch (imgErr) {
          console.error(`   ❌ Failed processing image: ${imageUrl}`, imgErr.message);
          // Keep original image as fallback
          newImages.push(imageUrl);
          newOriginals.push(imageUrl);
        }
      }

      // Update product fields
      product.images = newImages;
      product.originalImages = newOriginals;
      await product.save();
      processedCount++;
      console.log(`💾 Product "${product.title}" updated successfully.`);

      // Clean up old public images from Cloudinary to maintain security
      if (oldPublicIdsToDelete.length > 0) {
        console.log(`🗑️ Deleting ${oldPublicIdsToDelete.length} old public assets from Cloudinary...`);
        for (const pubId of oldPublicIdsToDelete) {
          try {
            await deleteFromCloudinary(pubId);
            console.log(`   - Deleted asset: ${pubId}`);
          } catch (delErr) {
            console.error(`   - Failed to delete asset: ${pubId}`, delErr.message);
          }
        }
      }
    }

    console.log(`\n🎉 Migration completed. Processed ${processedCount} products. Watermarked ${imageProcessedCount} images.`);
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration crashed:', error);
    if (mongoose.connection) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

runMigration();
