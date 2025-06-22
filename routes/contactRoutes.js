const express = require('express');
const router = express.Router();
const {
  submitContactForm,
  getContactInfo
} = require('../controllers/contactController');

// @route   POST /api/contact
// @desc    Submit contact form
// @access  Public
router.post('/', submitContactForm);

// @route   GET /api/contact/info
// @desc    Get contact information
// @access  Public
router.get('/info', getContactInfo);

module.exports = router; 