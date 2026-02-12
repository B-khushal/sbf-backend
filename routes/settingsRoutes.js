const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');

// Get all settings at once (public)
router.get('/all', settingsController.getAllSettings);

// Update all settings at once (admin only)
router.put('/all', protect, admin, settingsController.updateAllSettings);

// Hero slides routes
router.get('/hero-slides', settingsController.getHeroSlides);
router.put('/hero-slides', protect, admin, settingsController.updateHeroSlides);

// Get all home sections (public)
router.get('/home-sections', settingsController.getHomeSections);

// Protected admin routes for home sections
router.put('/home-sections', protect, admin, settingsController.updateHomeSections);
router.put('/home-sections/:sectionId', protect, admin, settingsController.updateHomeSection);
router.put('/home-sections/reorder', protect, admin, settingsController.reorderHomeSections);
router.put('/home-sections/:sectionId/content', protect, admin, settingsController.updateSectionContent);

// Categories management routes
router.get('/categories', settingsController.getCategories);
router.put('/categories', protect, admin, settingsController.updateCategories);

// Shop Categories management routes
router.get('/shop-categories', settingsController.getShopCategories);
router.put('/shop-categories', protect, admin, settingsController.updateShopCategories);

// Header settings routes
router.get('/header', settingsController.getHeaderSettings);
router.put('/header', protect, admin, settingsController.updateHeaderSettings);

// Footer settings routes
router.get('/footer', settingsController.getFooterSettings);
router.put('/footer', protect, admin, settingsController.updateFooterSettings);

module.exports = router;
