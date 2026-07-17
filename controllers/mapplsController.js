const mapplsService = require('../services/mapplsService');

// @desc    Get autocomplete suggestions
// @route   GET /api/mappls/autocomplete
// @access  Public
const getAutocomplete = async (req, res) => {
  try {
    const { query, location } = req.query;
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }
    const suggestions = await mapplsService.autosuggest(query, location);
    res.json(suggestions);
  } catch (error) {
    console.error('Error in mapplsAutocomplete controller:', error);
    res.status(500).json({ message: error.message || 'Error fetching autocomplete suggestions' });
  }
};

// @desc    Get place details by eLoc
// @route   GET /api/mappls/place-details
// @access  Public
const getPlaceDetails = async (req, res) => {
  try {
    const { eLoc } = req.query;
    if (!eLoc) {
      return res.status(400).json({ message: 'eLoc parameter is required' });
    }
    const details = await mapplsService.getPlaceDetails(eLoc);
    res.json(details);
  } catch (error) {
    console.error('Error in mapplsPlaceDetails controller:', error);
    res.status(500).json({ message: error.message || 'Error fetching place details' });
  }
};

// @desc    Reverse geocode coordinates
// @route   GET /api/mappls/reverse-geocode
// @access  Public
const getReverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and Longitude parameters are required' });
    }
    const address = await mapplsService.reverseGeocode(Number(lat), Number(lng));
    res.json(address);
  } catch (error) {
    console.error('Error in mapplsReverseGeocode controller:', error);
    res.status(500).json({ message: error.message || 'Error performing reverse geocoding' });
  }
};

module.exports = {
  getAutocomplete,
  getPlaceDetails,
  getReverseGeocode
};
