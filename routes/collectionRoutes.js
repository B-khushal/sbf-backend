const express = require('express');
const router = express.Router();
const {
  getCollections,
  getCollectionByIdOrSlug,
  createCollection,
  updateCollection,
  deleteCollection,
} = require('../controllers/collectionController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(getCollections)
  .post(protect, admin, createCollection);

router.route('/:idOrSlug')
  .get(getCollectionByIdOrSlug);

router.route('/:id')
  .put(protect, admin, updateCollection)
  .delete(protect, admin, deleteCollection);

module.exports = router;
