const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to Cloudinary with optimization transformations
const uploadToCloudinary = async (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: 'sbf-products', // Organize uploads in a folder
        public_id: filename.split('.')[0], // Use filename without extension
        transformation: [
          {
            width: 1000,
            crop: "scale"
          },
          {
            quality: "auto:best"
          },
          {
            fetch_format: "auto"
          }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('✅ Cloudinary upload success:', result.secure_url);
          console.log('📐 Image transformations applied: width=1000, quality=auto, format=auto');
          resolve(result);
        }
      }
    );
    
    stream.end(buffer);
  });
};

// Generate optimized image URLs with transformations
const getOptimizedImageUrl = (publicId, transformations = {}) => {
  const defaultTransformations = {
    width: transformations.width || 1000,
    crop: transformations.crop || "scale",
    quality: transformations.quality || "auto",
    fetch_format: transformations.fetch_format || "auto"
  };

  return cloudinary.url(publicId, {
    transformation: [
      {
        width: defaultTransformations.width,
        crop: defaultTransformations.crop
      },
      {
        quality: defaultTransformations.quality
      },
      {
        fetch_format: defaultTransformations.fetch_format
      }
    ]
  });
};

// Generate thumbnail URLs for product listings
const getThumbnailUrl = (publicId, size = 300) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: size,
        height: size,
        crop: "fill",
        gravity: "center"
      },
      {
        quality: "auto"
      },
      {
        fetch_format: "auto"
      }
    ]
  });
};

// Delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('🗑️ Cloudinary delete result:', result);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedImageUrl,
  getThumbnailUrl,
}; 