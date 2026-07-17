const express = require('express');
const router = express.Router();
const { getAutocomplete, getPlaceDetails, getReverseGeocode } = require('../controllers/mapplsController');

router.get('/autocomplete', getAutocomplete);
router.get('/place-details', getPlaceDetails);
router.get('/reverse-geocode', getReverseGeocode);

module.exports = router;
