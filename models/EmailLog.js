const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      required: true,
      trim: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
    },
    emailType: {
      type: String,
      required: true,
      // e.g. 'order_confirmation', 'delivery_confirmation', 'review_request', 'contact_form_reply', etc.
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    smtpResponse: {
      type: String,
      default: "",
    },
    errorMessage: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

emailLogSchema.index({ recipient: 1, status: 1 });
emailLogSchema.index({ emailType: 1, status: 1 });
emailLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
