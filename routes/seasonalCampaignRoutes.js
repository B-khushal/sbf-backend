const express = require('express');
const router = express.Router();
const { protect, admin, optionalProtect } = require('../middleware/authMiddleware');
const seasonalCampaignController = require('../controllers/seasonalCampaignController');

// ============================================================
//  PUBLIC ROUTES
// ============================================================
router.get('/status', seasonalCampaignController.getActiveCampaignsStatus);
router.get('/settings/:slug', optionalProtect, seasonalCampaignController.getCampaignSettings);
router.post('/view/:id', seasonalCampaignController.trackCampaignView);

// ============================================================
//  ADMIN ROUTES (Protected)
// ============================================================
router.get('/admin/all', protect, admin, seasonalCampaignController.adminGetAllCampaigns);
router.post('/admin', protect, admin, seasonalCampaignController.adminCreateCampaign);
router.put('/admin/:id', protect, admin, seasonalCampaignController.adminUpdateCampaign);
router.delete('/admin/:id', protect, admin, seasonalCampaignController.adminDeleteCampaign);
router.get('/admin/:id/analytics', protect, admin, seasonalCampaignController.adminGetCampaignAnalytics);

module.exports = router;
