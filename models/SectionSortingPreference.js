const mongoose = require('mongoose');

const sectionSortingPreferenceSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      required: true,
      unique: true, // e.g. "featured", "shop", "newArrivals", "recommended", "valentine", "mothers-day", or "category:roses"
    },
    sortBy: {
      type: String,
      enum: ['custom', 'name', 'price', 'createdAt', 'updatedAt', 'stock', 'bestSelling', 'mostViewed'],
      default: 'custom',
    },
    sortDirection: {
      type: String,
      enum: ['asc', 'desc'],
      default: 'asc',
    }
  },
  {
    timestamps: true,
  }
);

const SectionSortingPreference = mongoose.model('SectionSortingPreference', sectionSortingPreferenceSchema);
module.exports = SectionSortingPreference;
