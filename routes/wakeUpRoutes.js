const express = require('express');
const router = express.Router();

// @desc    Endpoint to keep the server from sleeping on free hosting tiers
// @route   GET /wake-up
// @access  Public
router.get('/', (req, res) => {
  const origin = req.get('Origin');
  console.log(`⏰ Wake-up ping from origin: ${origin || 'no-origin'}`);
  
  res.status(200).json({
    success: true,
    message: 'Server is awake and ready',
    origin: origin || 'No Origin',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router; 