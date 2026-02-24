const cloudinary = require('cloudinary').v2;

// Debug environment variables
console.log('ðŸ”§ Cloudinary Configuration Check:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'âœ… Set' : 'âŒ Missing',
  api_key: process.env.CLOUDINARY_API_KEY ? 'âœ… Set' : 'âŒ Missing',
  api_secret: process.env.CLOUDINARY_API_SECRET ? 'âœ… Set' : 'âŒ Missing',
  node_env: process.env.NODE_ENV || 'development'
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableUploadError = (error) => {
  if (!error) return false;

  const retryableCodes = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'EPIPE',
    'ECONNABORTED',
  ]);

  if (error.code && retryableCodes.has(error.code)) return true;
  if (typeof error.http_code === 'number' && error.http_code >= 500) return true;

  const message = String(error.message || '').toLowerCase();
  return message.includes('timeout') || message.includes('socket hang up');
};

const uploadToCloudinaryOnce = (buffer, filename, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder,
        public_id: filename.split('.')[0],
        transformation: [
          {
            width: 1200,
            crop: "scale",
          },
          {
            quality: "auto:best",
          },
          {
            fetch_format: "auto",
          },
        ],
        timeout: 60000,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });

// Upload image to Cloudinary with retry for transient network failures
const uploadToCloudinary = async (buffer, filename, folder = 'sbf-products') => {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await uploadToCloudinaryOnce(buffer, filename, folder);
      console.log('Cloudinary upload success:', result.secure_url);
      return result;
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < maxAttempts && isRetryableUploadError(error);

      console.error(`Cloudinary upload attempt ${attempt}/${maxAttempts} failed:`, {
        code: error?.code,
        message: error?.message,
        http_code: error?.http_code,
        retrying: shouldRetry,
      });

      if (!shouldRetry) throw error;
      await sleep(700 * attempt);
    }
  }

  throw lastError;
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
    console.log('ðŸ—‘ï¸ Cloudinary delete result:', result);
    return result;
  } catch (error) {
    console.error('âŒ Cloudinary delete error:', error);
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
