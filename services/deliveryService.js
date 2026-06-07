const Order = require('../models/Order');

/**
 * Checks if a customer is eligible for first-order free delivery.
 * Eligibility is determined by checking if there are any successful (non-cancelled) orders
 * associated with the user's ID, email, or phone.
 * 
 * @param {Object} params
 * @param {string} [params.userId]
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @returns {Promise<boolean>} True if eligible for free delivery, false otherwise.
 */
const checkFirstOrderEligibility = async ({ userId, email, phone }) => {
  const queryConditions = [];
  
  if (userId) {
    queryConditions.push({ user: userId });
  }
  if (email && email.trim()) {
    queryConditions.push({ 'shippingDetails.email': { $regex: new RegExp(`^${email.trim()}$`, 'i') } });
  }
  if (phone && phone.trim()) {
    // Clean phone number to handle formatting differences (e.g., spaces, +91)
    const cleanPhone = phone.trim().replace(/[\s-+]/g, '');
    const last10 = cleanPhone.slice(-10);
    if (last10.length >= 10) {
      queryConditions.push({ 'shippingDetails.phone': { $regex: new RegExp(`${last10}$`) } });
    } else {
      queryConditions.push({ 'shippingDetails.phone': phone.trim() });
    }
  }
  
  if (queryConditions.length === 0) {
    return true; // No customer identification provided (e.g. initial empty cart), assume eligible by default
  }
  
  // Find any order that is NOT cancelled
  const existingOrder = await Order.findOne({
    $or: queryConditions,
    status: { $ne: 'cancelled' }
  });
  
  return !existingOrder;
};

const Settings = require('../models/settings');

/**
 * Calculates delivery fee based on subtotal, time slot, and customer details.
 * 
 * @param {Object} params
 * @param {number} params.subtotal
 * @param {string} [params.timeSlot]
 * @param {string} [params.userId]
 * @param {string} [params.email]
 * @param {string} [params.phone]
 * @returns {Promise<Object>} The delivery fee details: { deliveryCharge, isFirstOrderFreeDelivery, standardFee }
 */
const calculateDeliveryFee = async ({ subtotal, timeSlot, userId, email, phone }) => {
  let settings = await Settings.findOne();
  if (!settings) {
    await Settings.initializeDefaultSettings();
    settings = await Settings.findOne();
  }

  const deliverySettings = settings.deliverySettings || {};
  const isFirstOrderFreeEnabled = deliverySettings.firstOrderFree !== false; // default true
  
  // Find appropriate time slot extra charge
  const timeSlots = deliverySettings.timeSlots || [];
  const activeSlot = timeSlots.find(s => s.time === timeSlot && s.enabled);
  const slotExtraCharge = activeSlot ? (activeSlot.extraCharge || 0) : (timeSlot === 'midnight' ? 150 : 0);

  // Find standard shipping charge from rules
  const rules = deliverySettings.deliveryChargeRules || [
    { minOrderAmount: 0, charge: 150 },
    { minOrderAmount: 999, charge: 0 }
  ];
  
  // Sort rules descending by minOrderAmount to find the highest matching threshold
  const sortedRules = [...rules].sort((a, b) => b.minOrderAmount - a.minOrderAmount);
  const matchingRule = sortedRules.find(r => subtotal >= r.minOrderAmount);
  let baseCharge = matchingRule ? matchingRule.charge : 150;

  // First order free delivery check
  let isEligible = false;
  if (isFirstOrderFreeEnabled) {
    isEligible = await checkFirstOrderEligibility({ userId, email, phone });
  }

  let deliveryCharge = 0;
  if (isEligible) {
    deliveryCharge = 0;
  } else {
    deliveryCharge = baseCharge + slotExtraCharge;
  }

  // Rush delivery charge support
  if (deliverySettings.rushDelivery?.enabled) {
    deliveryCharge += (deliverySettings.rushDelivery.charge || 0);
  }

  return {
    deliveryCharge,
    isFirstOrderFreeDelivery: isEligible,
    standardFee: baseCharge + slotExtraCharge
  };
};

module.exports = {
  checkFirstOrderEligibility,
  calculateDeliveryFee
};
