const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.get('/all', settingsController.getAllSettings);
router.get('/hero-slides', settingsController.getHeroSlides);
router.get('/home-sections', settingsController.getHomeSections);
router.get('/categories', settingsController.getCategories);

// Protected admin routes
router.put('/all', protect, admin, settingsController.updateAllSettings);
router.put('/hero-slides', protect, admin, settingsController.updateHeroSlides);
router.put('/home-sections', protect, admin, settingsController.updateHomeSections);
router.put('/home-sections/:sectionId', protect, admin, settingsController.updateHomeSection);

// Category management routes
router.post('/categories', protect, admin, settingsController.addCategory);
router.put('/categories', protect, admin, settingsController.updateCategories);
router.put('/categories/:categoryId', protect, admin, settingsController.updateCategory);
router.delete('/categories/:categoryId', protect, admin, settingsController.deleteCategory);

// General Settings Routes
router.get('/', settingsController.getAllSettings);
router.put('/', protect, admin, settingsController.updateAllSettings);

// Protected admin routes for home sections
router.put('/home-sections/reorder', protect, admin, settingsController.reorderHomeSections);
router.put('/home-sections/:sectionId/content', protect, admin, settingsController.updateSectionContent);

// Header settings routes
router.get('/header', settingsController.getHeaderSettings);
router.put('/header', protect, admin, settingsController.updateHeaderSettings);

// Footer settings routes
router.get('/footer', settingsController.getFooterSettings);
router.put('/footer', protect, admin, settingsController.updateFooterSettings);

module.exports = router;
