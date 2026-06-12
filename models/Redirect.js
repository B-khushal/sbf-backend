const mongoose = require('mongoose');

const redirectSchema = new mongoose.Schema(
  {
    fromUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    toUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Redirect = mongoose.model('Redirect', redirectSchema);
module.exports = Redirect;
