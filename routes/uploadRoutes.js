const express = require("express");
const multer = require("multer");
const path = require("path");
const { protect, admin } = require("../middleware/authMiddleware");
const { uploadToCloudinary } = require("../config/cloudinary");

const router = express.Router();

// Configure multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

// Validate file type
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });
  
  const filetypes = /jpg|jpeg|png|webp/;
  const isValid = filetypes.test(path.extname(file.originalname).toLowerCase()) && filetypes.test(file.mimetype);
  
  if (isValid) {
    console.log('✅ File type is valid');
    cb(null, true);
  } else {
    console.log('❌ File type is invalid');
    cb("Images only! (jpg, jpeg, png, webp)");
  }
};

const upload = multer({ 
  storage, 
  fileFilter, 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// @route   GET /api/uploads/test
// @desc    Test upload endpoint without authentication
// @access  Public (for debugging)
router.get("/test", (req, res) => {
  res.json({ 
    message: "Upload endpoint is accessible",
    timestamp: new Date().toISOString(),
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Configured' : 'Missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Configured' : 'Missing'
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
// @access  Private/Admin
router.post("/", protect, admin, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({ 
        message: "File upload error", 
        error: err.message 
      });
    } else if (err) {
      console.error('❌ File filter error:', err);
      return res.status(400).json({ 
        message: "File validation error", 
        error: err 
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📸 Upload request received:', {
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

    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log('📸 Starting Cloudinary upload:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Generate unique filename
    const filename = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, filename);
    
    console.log('✅ Cloudinary upload successful:', {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    });

    res.json({ 
      imageUrl: result.secure_url,
      publicId: result.public_id,
      filename: result.public_id,
      originalName: req.file.originalname,
      size: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      message: "Failed to upload image", 
      error: error.message 
    });
  }
});

// @route   DELETE /api/uploads/:publicId
// @desc    Delete an image from Cloudinary
// @access  Private/Admin
router.delete("/:publicId", protect, admin, async (req, res) => {
  try {
    const { publicId } = req.params;
    
    console.log('🗑️ Deleting image from Cloudinary:', publicId);
    
    const { deleteFromCloudinary } = require("../config/cloudinary");
    const result = await deleteFromCloudinary(publicId);
    
    console.log('✅ Image deleted successfully:', result);
    
    res.json({ 
      message: "Image deleted successfully", 
      result 
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      message: "Failed to delete image", 
      error: error.message 
    });
  }
});

module.exports = router;
