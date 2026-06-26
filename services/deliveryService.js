const Order = require('../models/Order');
const Settings = require('../models/settings');
const DeliveryPartner = require('../models/DeliveryPartner');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const DeliverySetting = require('../models/DeliverySetting');
const DeliveryZone = require('../models/DeliveryZone');
const deliveryNotificationService = require('./deliveryNotificationService');

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
    const cleanPhone = phone.trim().replace(/[\s-+]/g, '');
    const last10 = cleanPhone.slice(-10);
    if (last10.length >= 10) {
      queryConditions.push({ 'shippingDetails.phone': { $regex: new RegExp(`${last10}$`) } });
    } else {
      queryConditions.push({ 'shippingDetails.phone': phone.trim() });
    }
  }
  
  if (queryConditions.length === 0) {
    return true; 
  }
  
  const existingOrder = await Order.findOne({
    $or: queryConditions,
    status: { $ne: 'cancelled' }
  });
  
  return !existingOrder;
};

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
  const isFirstOrderFreeEnabled = deliverySettings.firstOrderFree !== false; 
  
  const timeSlots = deliverySettings.timeSlots || [];
  const activeSlot = timeSlots.find(s => s.time === timeSlot && s.enabled);
  const slotExtraCharge = activeSlot ? (activeSlot.extraCharge || 0) : (timeSlot === 'midnight' ? 150 : 0);

  const rules = deliverySettings.deliveryChargeRules || [
    { minOrderAmount: 0, charge: 150 },
    { minOrderAmount: 999, charge: 0 }
  ];
  
  const sortedRules = [...rules].sort((a, b) => b.minOrderAmount - a.minOrderAmount);
  const matchingRule = sortedRules.find(r => subtotal >= r.minOrderAmount);
  let baseCharge = matchingRule ? matchingRule.charge : 150;

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

  if (deliverySettings.rushDelivery?.enabled) {
    deliveryCharge += (deliverySettings.rushDelivery.charge || 0);
  }

  return {
    deliveryCharge,
    isFirstOrderFreeDelivery: isEligible,
    standardFee: baseCharge + slotExtraCharge
  };
};

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Finds the best delivery partner for a given order using the priority formula:
 * Nearest + Available + Highest Rating + Lowest Active Load
 * 
 * Formula Score = (Distance * 1.0) + (Active Orders * 5.0) - (Rating * 3.0)
 * Low score is better.
 */
const findBestPartnerForOrder = async (order, config) => {
  // Store default location (Rethi Bowli, Mehdipatnam, Hyderabad)
  const storeLat = 17.3912;
  const storeLng = 78.4326;

  // 1. Get all online and available (activeOrders < maxOrdersPerPartner) partners
  const partners = await DeliveryPartner.find({
    status: 'online',
    availability: 'available',
    isSuspended: false,
    activeOrders: { $lt: config.maxOrdersPerPartner }
  });

  if (partners.length === 0) return null;

  // 2. Rank partners based on the formula
  const rankedPartners = partners.map(partner => {
    // Calculate distance from store
    const distance = calculateHaversineDistance(
      partner.currentLatitude,
      partner.currentLongitude,
      storeLat,
      storeLng
    );

    // Apply score formula
    const score = (distance * 1.5) + (partner.activeOrders * 4.0) - (partner.rating * 3.0);

    return { partner, distance, score };
  });

  // Filter partners within maximum assignment radius
  const eligiblePartners = rankedPartners.filter(item => item.distance <= config.assignmentRadius);

  if (eligiblePartners.length === 0) return null;

  // Sort by lowest score
  eligiblePartners.sort((a, b) => a.score - b.score);

  return eligiblePartners[0];
};

/**
 * Automatically assigns a delivery partner to an order.
 * If a partner is found, creates an assignment and sets a reassignment timer.
 */
const assignOrderAutomatically = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.error(`Order ${orderId} not found for auto-assignment`);
      return false;
    }

    // Check if there is already an active (non-failed/non-cancelled/non-delivered) assignment
    const existingAssignment = await DeliveryAssignment.findOne({
      orderId,
      status: { $nin: ['delivered', 'failed_delivery', 'cancelled'] }
    });

    if (existingAssignment) {
      console.log(`Order ${order.orderNumber} already has active assignment: ${existingAssignment.status}`);
      return true;
    }

    const config = await DeliverySetting.getSettings();
    if (!config.autoAssign) {
      console.log(`Auto-assignment is turned OFF in system settings`);
      return false;
    }

    const bestPartnerMatch = await findBestPartnerForOrder(order, config);

    // Generate Verification OTP for Customer (4 digits)
    const customerOtp = Math.floor(1000 + Math.random() * 9000).toString();

    if (bestPartnerMatch) {
      const { partner, distance } = bestPartnerMatch;
      
      const newAssignment = await DeliveryAssignment.create({
        orderId: order._id,
        partnerId: partner._id,
        status: 'assigned',
        distance: parseFloat(distance.toFixed(2)),
        eta: Math.max(15, Math.round(distance * 3 + 10)), // Simple ETA logic: 3 mins per km + 10 mins store prep
        customerOtp,
        history: [{
          status: 'assigned',
          remarks: `Order auto-assigned to partner: ${partner.name} (Score Rank Match)`
        }]
      });

      // Update partner active orders count
      partner.activeOrders += 1;
      if (partner.activeOrders >= config.maxOrdersPerPartner) {
        partner.availability = 'busy';
      }
      await partner.save();

      // Trigger Notifications
      // 1. Send push to Partner (MATRIX: Push - Partner Only)
      await deliveryNotificationService.sendDeliveryNotification('order_assigned', newAssignment, order, partner);
      
      // 2. Send assignment notification to Customer (MATRIX: Email - YES, Push - Customer)
      await deliveryNotificationService.sendDeliveryNotification('partner_assigned', newAssignment, order, partner);

      // Set timeout for Reassignment (timeout in seconds converted to ms)
      setTimeout(async () => {
        try {
          const checkAssign = await DeliveryAssignment.findById(newAssignment._id);
          if (checkAssign && checkAssign.status === 'assigned') {
            console.log(`⏱️ Assignment ${newAssignment._id} timed out. Reassigning...`);
            await rejectOrTimeoutAssignment(newAssignment._id, 'timeout');
          }
        } catch (err) {
          console.error('Error handling assignment timeout:', err);
        }
      }, config.reassignmentTimeout * 1000);

      console.log(`✅ Order ${order.orderNumber} successfully auto-assigned to ${partner.name}`);
      return true;
    } else {
      console.log(`⚠️ No suitable delivery partner found within assignment radius for Order ${order.orderNumber}. Marked as pending_assignment.`);
      
      // Create pending assignment record so admins can assign manually
      await DeliveryAssignment.create({
        orderId: order._id,
        status: 'pending_assignment',
        customerOtp,
        history: [{
          status: 'pending_assignment',
          remarks: 'No active partners available in range. Waiting for manual assignment.'
        }]
      });
      return false;
    }
  } catch (error) {
    console.error('Error in auto-assignment:', error);
    return false;
  }
};

/**
 * Handles driver rejection or timeout by clearing current assignment and re-triggering search.
 */
const rejectOrTimeoutAssignment = async (assignmentId, actionType = 'reject') => {
  const assignment = await DeliveryAssignment.findById(assignmentId);
  if (!assignment) return false;

  // Only assigned orders can be rejected/timeout (once accepted, they can't be timed out)
  if (assignment.status !== 'assigned') return false;

  const partnerId = assignment.partnerId;
  const orderId = assignment.orderId;

  // 1. Release the partner
  if (partnerId) {
    const partner = await DeliveryPartner.findById(partnerId);
    if (partner) {
      partner.activeOrders = Math.max(0, partner.activeOrders - 1);
      partner.availability = 'available';
      
      // Update partner acceptance statistics on rejection
      if (actionType === 'reject') {
        const currentRate = partner.acceptanceRate || 100;
        partner.acceptanceRate = Math.max(0, Math.round(currentRate * 0.9)); // decrement rate
      }
      await partner.save();
    }
  }

  // 2. Mark this assignment as cancelled/failed and archive it
  assignment.status = 'cancelled';
  assignment.history.push({
    status: 'cancelled',
    remarks: `Partner ${actionType === 'timeout' ? 'ignored (timeout)' : 'rejected'} the request.`
  });
  await assignment.save();

  // 3. Re-trigger Auto Assignment engine to find next partner
  console.log(`Re-assigning order ${orderId} after partner ${actionType}...`);
  return await assignOrderAutomatically(orderId);
};

module.exports = {
  checkFirstOrderEligibility,
  calculateDeliveryFee,
  calculateHaversineDistance,
  findBestPartnerForOrder,
  assignOrderAutomatically,
  rejectOrTimeoutAssignment
};
