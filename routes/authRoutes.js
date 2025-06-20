const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  googleAuth,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Verify token - ensures user is authenticated
router.get('/verify-token', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});


router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/google', googleAuth);
router.post('/logout', protect, logoutUser);

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

module.exports = router; // ✅ Ensure this is correctly exported
