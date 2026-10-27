const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', faqController.getFaqs);
router.get('/categories', faqController.getFaqCategories);
router.get('/by-slug/:slug', faqController.getFaqBySlug);
router.post('/:id/vote', faqController.voteHelpful);

// Protected Admin routes
router.get('/admin/all', protect, admin, faqController.getAdminFaqs);
router.post('/admin', protect, admin, faqController.createFaq);
router.put('/admin/reorder', protect, admin, faqController.reorderFaqs);
router.put('/admin/:id', protect, admin, faqController.updateFaq);
router.delete('/admin/:id', protect, admin, faqController.deleteFaq);
router.patch('/admin/:id/publish', protect, admin, faqController.togglePublishFaq);

// Category Admin routes
router.post('/admin/categories', protect, admin, faqController.createFaqCategory);
router.put('/admin/categories/:id', protect, admin, faqController.updateFaqCategory);
router.delete('/admin/categories/:id', protect, admin, faqController.deleteFaqCategory);

module.exports = router;
