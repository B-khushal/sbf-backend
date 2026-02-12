const cloudinary = require('cloudinary').v2;

// Debug environment variables
console.log('🔧 Cloudinary Configuration Check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing',
  node_env: process.env.NODE_ENV || 'development'
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to Cloudinary with optimization transformations
const uploadToCloudinary = async (buffer, filename, folder = 'sbf-products') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: folder, // Organize uploads in folders
        public_id: filename.split('.')[0], // Use filename without extension
        transformation: [
          {
            width: 1200,
            crop: "scale"
          },
          {
            quality: "auto:best"
          },
          {
            fetch_format: "auto"
          }
        ],
        // Add timeout and retry options
        timeout: 60000, // 60 seconds timeout
        chunk_size: 6000000, // 6MB chunks for large files
      },
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('✅ Cloudinary upload success:', result.secure_url);
          console.log('📐 Image transformations applied: width=1200, quality=auto, format=auto');
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

// Generate square images with AI generative fill background
const getSquareImageUrl = (publicId, size = 400) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        aspect_ratio: "1:1",
        gravity: "center",
        background: "gen_fill",
        crop: "pad"
      },
      {
        width: size,
        height: size,
        crop: "scale"
      },
      {
        quality: "auto:best"
      },
      {
        fetch_format: "auto"
      }
    ]
  });
};

// Generate enhanced product images with generative fill for consistent ratios
const getEnhancedProductImageUrl = (publicId, options = {}) => {
  const {
    width = 800,
    height = 600,
    aspectRatio = "4:3",
    useGenFill = true
  } = options;

  const transformations = [];

  // First transformation: Apply generative fill if requested
  if (useGenFill) {
    transformations.push({
      aspect_ratio: aspectRatio,
      gravity: "center",
      background: "gen_fill",
      crop: "pad"
    });
  }

  // Second transformation: Resize to target dimensions
  transformations.push({
    width: width,
    height: height,
    crop: "scale"
  });

  // Third transformation: Optimize quality and format
  transformations.push({
    quality: "auto:best"
  });

  transformations.push({
    fetch_format: "auto"
  });

  return cloudinary.url(publicId, {
    transformation: transformations
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
  getSquareImageUrl,
  getEnhancedProductImageUrl,
}; 