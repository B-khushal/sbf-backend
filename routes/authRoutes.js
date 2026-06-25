const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  googleAuth,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Rate limiter for auth endpoints (5 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many auth attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zod schemas for input validation
const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(254).trim(),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
  email: z.string().email('Invalid email format').max(254).trim(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
  role: z.enum(['user', 'admin', 'vendor']).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const firstErrorMessage = Object.values(errors).flat()[0] || 'Validation error';
    return res.status(400).json({ 
      message: firstErrorMessage,
      errors 
    });
  }
  req.body = result.data;
  next();
};

// Verify token - ensures user is authenticated
router.get('/verify-token', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.post('/login', authLimiter, validateRequest(loginSchema), loginUser);
router.post('/register', authLimiter, validateRequest(registerSchema), registerUser);
router.post('/google', authLimiter, googleAuth);
router.post('/logout', protect, logoutUser);

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

module.exports = router; // ✅ Ensure this is correctly exported
