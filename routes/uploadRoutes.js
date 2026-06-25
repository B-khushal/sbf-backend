const express = require("express");
const multer = require("multer");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { protect, admin, adminOrVendor } = require("../middleware/authMiddleware");
const { uploadToCloudinary, uploadToCloudinarySecure } = require("../config/cloudinary");

const router = express.Router();

// Upload rate limiter: 5 uploads per minute
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many upload attempts. Please try again after a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

// Validate file type (supports images and vertical video formats)
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });
  
  const filetypes = /jpg|jpeg|png|webp|mp4|webm|mov|quicktime/;
  const isValid = filetypes.test(path.extname(file.originalname).toLowerCase()) && (filetypes.test(file.mimetype) || file.mimetype.startsWith('video/'));
  
  if (isValid) {
    console.log('✅ File type is valid');
    cb(null, true);
  } else {
    console.log('❌ File type is invalid');
    cb("Allowed formats: images (jpg, jpeg, png, webp) and videos (mp4, webm, mov)");
  }
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB Multer hard limit (actual dynamic limit checked in controller)
});

const enforceUploadRole = (req, res, next) => {
  const uploadType = String(req.query.type || "product").toLowerCase();

  if (uploadType === "review") {
    return next();
  }

  return adminOrVendor(req, res, next);
};

// @route   GET /api/uploads
// @desc    Test upload endpoint with authentication
// @access  Private/Admin
router.get("/", protect, admin, (req, res) => {
  const { type } = req.query;
  
  res.json({ 
    message: "Upload endpoint is accessible",
    timestamp: new Date().toISOString(),
    type: type || 'general',
    limits: {
      fileSize: type === 'product' ? "50MB" : "10MB",
      allowedTypes: ["jpg", "jpeg", "png", "webp"]
    },
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Configured' : 'Missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Configured' : 'Missing'
    },
    server: {
      bodyLimit: "50MB",
      uploadTimeout: "60s"
    }
  });
});

// @route   GET /api/uploads/test
// @desc    Test upload endpoint without authentication
// @access  Public (for debugging)
router.get("/test", (req, res) => {
  res.json({ 
    message: "Upload endpoint is accessible",
    timestamp: new Date().toISOString(),
    limits: {
      fileSize: "50MB",
      allowedTypes: ["jpg", "jpeg", "png", "webp"]
    },
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Configured' : 'Missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Configured' : 'Missing'
    },
    server: {
      bodyLimit: "50MB",
      uploadTimeout: "60s"
    }
  });
});



// @route   GET /api/uploads/auth-test
// @desc    Test authentication without file upload
// @access  Private/Admin
router.get("/auth-test", protect, admin, (req, res) => {
  res.json({ 
    message: "Authentication successful",
    user: {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email
    },
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/uploads
// @desc    Upload an image to Cloudinary
// @access  Private/Admin/Vendor
router.post("/", uploadLimiter, protect, enforceUploadRole, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('âŒ Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
          message: "File too large. Maximum size is 50MB.", 
          error: err.message 
        });
      }
      return res.status(400).json({ 
        message: "File upload error", 
        error: err.message 
      });
    } else if (err) {
      console.error('âŒ File filter error:', err);
      return res.status(400).json({ 
        message: "File validation error", 
        error: err 
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📷 Upload request received:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      user: req.user ? { id: req.user._id, role: req.user.role } : 'No user',
      file: req.file ? {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        fieldname: req.file.fieldname
      } : 'No file'
    });
    const Settings = require("../models/settings");
    const settings = await Settings.findOne();
    const isVideo = req.file.mimetype.startsWith('video/') || 
                    ['.mp4', '.webm', '.mov'].includes(path.extname(req.file.originalname).toLowerCase());

    // Enforce dynamic video upload limit from Admin settings
    if (isVideo) {
      const maxVideoSizeMB = settings?.globalSettings?.maxVideoUploadSize || 50;
      const maxVideoSizeBytes = maxVideoSizeMB * 1024 * 1024;
      if (req.file.size > maxVideoSizeBytes) {
        console.log(`❌ Video upload size ${req.file.size} bytes exceeds limit of ${maxVideoSizeMB}MB`);
        return res.status(413).json({ 
          message: `Video file too large. Maximum size configured is ${maxVideoSizeMB}MB.`, 
          error: "LIMIT_FILE_SIZE" 
        });
      }
    }

    console.log('📸 Starting Cloudinary upload:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      isVideo
    });

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const filename = `${isVideo ? 'video' : 'image'}-${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
    
    // Determine folder based on upload type (from query params or default to products)
    const uploadType = String(req.query.type || 'product').toLowerCase();
    const folderByType = {
      category: 'sbf-categories',
      logo: 'sbf-branding',
      header: 'sbf-branding',
      footer: 'sbf-branding',
      branding: 'sbf-branding',
      hero: 'sbf-hero',
      review: 'sbf-reviews',
      product: 'sbf-products',
      video: 'sbf-videos',
    };
    const folder = folderByType[uploadType] || (isVideo ? 'sbf-videos' : 'sbf-products');
    
    let result;
    let originalUrl = "";

    if (isVideo) {
      // Process video upload
      const { uploadVideoToCloudinary } = require("../config/cloudinary");
      result = await uploadVideoToCloudinary(req.file.buffer, filename, folder);
    } else {
      // Process image upload (with watermark if applicable)
      let imageBuffer = req.file.buffer;
      const imageProtection = settings?.imageProtectionSettings || { enableWatermark: true };

      if (uploadType === "product" && imageProtection.enableWatermark) {
        console.log("💧 Applying watermark to product image");
        // 1. Upload original image privately/authenticated
        try {
          const originalResult = await uploadToCloudinarySecure(req.file.buffer, `${filename}_original`, folder);
          originalUrl = originalResult.secure_url;
          console.log("✅ Cloudinary original secure upload successful:", originalUrl);
        } catch (secureErr) {
          console.error("❌ Failed secure upload of original image:", secureErr);
        }

        // 2. Apply watermark locally
        try {
          const { watermarkImage } = require("../utils/watermark");
          imageBuffer = await watermarkImage(req.file.buffer, imageProtection);
          console.log("✅ Watermark applied successfully to buffer");
        } catch (watermarkErr) {
          console.error("❌ Watermark application failed, falling back to original:", watermarkErr);
        }
      }

      result = await uploadToCloudinary(imageBuffer, filename, folder);
    }
    
    console.log('✅ Cloudinary upload successful:', {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      folder: folder
    });

    res.json({ 
      imageUrl: result.secure_url,
      videoUrl: isVideo ? result.secure_url : undefined,
      originalUrl: originalUrl || result.secure_url, // fallback to public url if secure failed
      publicId: result.public_id,
      filename: result.public_id,
      originalName: req.file.originalname,
      size: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
      folder: folder
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    const isRetryableNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPIPE', 'ECONNABORTED'].includes(error?.code);

    res.status(isRetryableNetworkError ? 503 : 500).json({
      message: isRetryableNetworkError
        ? "Upload temporarily failed due to network issue. Please retry."
        : "Failed to upload image",
      error: error.message,
      code: error?.code || null,
    });
  }
});

// @route   DELETE /api/uploads/:publicId
// @desc    Delete an image from Cloudinary
// @access  Private/Admin/Vendor
router.delete("/:publicId", protect, adminOrVendor, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    console.log('ðŸ—‘ï¸ Deleting image from Cloudinary:', publicId);
    
    const { deleteFromCloudinary } = require("../config/cloudinary");
    const result = await deleteFromCloudinary(publicId);
    
    console.log('âœ… Image deleted successfully:', result);
    
    res.json({ 
      message: "Image deleted successfully", 
      result 
    });

  } catch (error) {
    console.error('âŒ Delete error:', error);
    res.status(500).json({ 
      message: "Failed to delete image", 
      error: error.message 
    });
  }
});

module.exports = router;


