const DeliveryPartner = require('../models/DeliveryPartner');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const DeliveryLocation = require('../models/DeliveryLocation');
const DeliveryProof = require('../models/DeliveryProof');
const DeliveryEarning = require('../models/DeliveryEarning');
const DeliveryDocument = require('../models/DeliveryDocument');
const DeliveryZone = require('../models/DeliveryZone');
const DeliverySetting = require('../models/DeliverySetting');
const Order = require('../models/Order');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const deliveryService = require('../services/deliveryService');
const deliveryNotificationService = require('../services/deliveryNotificationService');
const { sendDeliveryConfirmationWithInvoice } = require('../services/emailNotificationService');

// --- PARTNER AUTHENTICATION ---

exports.registerPartner = async (req, res) => {
  try {
    const { name, email, phone, password, vehicleType, aadhaarNumber, panNumber, licenseNumber } = req.body;

    const partnerExists = await DeliveryPartner.findOne({ email });
    if (partnerExists) {
      return res.status(400).json({ message: 'Delivery partner already exists with this email' });
    }

    const partner = await DeliveryPartner.create({
      name,
      email,
      phone,
      password,
      vehicleType,
      status: 'offline',
      availability: 'available'
    });

    // Create verification document record
    await DeliveryDocument.create({
      partnerId: partner._id,
      aadhaarNumber,
      panNumber,
      licenseNumber,
      verificationStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      token: generateToken({ _id: partner._id, role: 'driver', email: partner.email }),
      partner: {
        _id: partner._id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        vehicleType: partner.vehicleType,
        status: partner.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering partner', error: error.message });
  }
};

exports.loginPartner = async (req, res) => {
  try {
    const { email, password } = req.body;

    const partner = await DeliveryPartner.findOne({ email });
    if (!partner) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (partner.isSuspended) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
    }

    const isMatch = await partner.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last active
    partner.lastActiveTime = new Date();
    await partner.save();

    res.json({
      success: true,
      token: generateToken({ _id: partner._id, role: 'driver', email: partner.email }),
      partner: {
        _id: partner._id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        vehicleType: partner.vehicleType,
        status: partner.status,
        availability: partner.availability,
        rating: partner.rating,
        todayDeliveries: partner.todayDeliveries,
        todayEarnings: partner.todayEarnings
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

// --- STATUS & LOCATION UPDATES ---

exports.updatePartnerStatus = async (req, res) => {
  try {
    const { status, availability } = req.body;
    const partner = await DeliveryPartner.findById(req.partner._id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    if (status) partner.status = status;
    if (availability) partner.availability = availability;
    partner.lastActiveTime = new Date();

    await partner.save();
    res.json({ success: true, partner });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
};

exports.updatePartnerLocation = async (req, res) => {
  try {
    const { latitude, longitude, assignmentId } = req.body;
    const partner = await DeliveryPartner.findById(req.partner._id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    partner.currentLatitude = latitude;
    partner.currentLongitude = longitude;
    partner.lastActiveTime = new Date();
    await partner.save();

    // Log in time-series coordinates table
    await DeliveryLocation.create({
      partnerId: partner._id,
      assignmentId: assignmentId || null,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude] // GeoJSON format: [lng, lat]
      }
    });

    // If active assignment, append to its route history
    if (assignmentId) {
      const assignment = await DeliveryAssignment.findById(assignmentId);
      if (assignment && ['accepted', 'reached_store', 'picked_up', 'out_for_delivery', 'reached_customer'].includes(assignment.status)) {
        assignment.routeHistory.push({ latitude, longitude });
        
        // Recalculate distance dynamically if out for delivery
        if (assignment.status === 'out_for_delivery') {
          const storeLat = 17.3912;
          const storeLng = 78.4326;
          const currentDist = deliveryService.calculateHaversineDistance(latitude, longitude, storeLat, storeLng);
          assignment.eta = Math.max(2, Math.round(currentDist * 3));
        }
        
        await assignment.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error updating location', error: error.message });
  }
};

// --- DRIVER CONTEXT ACTIONS ---

exports.getPartnerOrders = async (req, res) => {
  try {
    const active = await DeliveryAssignment.findOne({
      partnerId: req.partner._id,
      status: { $nin: ['delivered', 'failed_delivery', 'cancelled'] }
    }).populate('orderId');

    const history = await DeliveryAssignment.find({
      partnerId: req.partner._id,
      status: { $in: ['delivered', 'failed_delivery', 'cancelled'] }
    }).populate('orderId').sort({ updatedAt: -1 }).limit(10);

    res.json({ success: true, active, history });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

exports.acceptOrder = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await DeliveryAssignment.findById(assignmentId).populate('orderId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.partnerId.toString() !== req.partner._id.toString()) {
      return res.status(403).json({ message: 'Not assigned to you' });
    }

    if (assignment.status !== 'assigned') {
      return res.status(400).json({ message: `Cannot accept order in status: ${assignment.status}` });
    }

    assignment.status = 'accepted';
    assignment.history.push({
      status: 'accepted',
      updatedBy: 'partner',
      remarks: `Order accepted by partner: ${req.partner.name}`
    });
    await assignment.save();

    // Trigger Notification
    await deliveryNotificationService.sendDeliveryNotification('partner_accepted', assignment, assignment.orderId, req.partner);

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting order', error: error.message });
  }
};

exports.updateOrderDeliveryState = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status, failReason } = req.body;
    const assignment = await DeliveryAssignment.findById(assignmentId).populate('orderId');

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.partnerId.toString() !== req.partner._id.toString()) {
      return res.status(403).json({ message: 'Not authorized for this order' });
    }

    const partner = await DeliveryPartner.findById(req.partner._id);

    // Validate state transitions
    const validStates = ['reached_store', 'picked_up', 'out_for_delivery', 'reached_customer', 'delivered', 'failed_delivery'];
    if (!validStates.includes(status)) {
      return res.status(400).json({ message: 'Invalid delivery state request' });
    }

    // Custom guards
    if (status === 'delivered') {
      if (!assignment.otpVerified) {
        // Allow fallback if proof image uploaded
        const proofExists = await DeliveryProof.findOne({ assignmentId: assignment._id });
        if (!proofExists) {
          return res.status(400).json({ message: 'Delivered state requires customer OTP verification or delivery proof photo' });
        }
      }
      assignment.deliveryTime = new Date();
    }

    if (status === 'picked_up') {
      assignment.pickupTime = new Date();
    }

    assignment.status = status;
    if (status === 'failed_delivery' && failReason) {
      assignment.failReason = failReason;
    }

    assignment.history.push({
      status,
      updatedBy: 'partner',
      remarks: `Delivery state updated to: ${status.replace(/_/g, ' ')}`
    });
    await assignment.save();

    // Sync order state
    const order = await Order.findById(assignment.orderId._id);
    if (order) {
      if (status === 'out_for_delivery' || status === 'picked_up') {
        order.status = 'out_for_delivery';
      } else if (status === 'delivered') {
        order.status = 'delivered';
      } else if (status === 'failed_delivery') {
        // Keep as received or marked failed
        order.status = 'received'; // returned to pool/admin for retry
      }
      await order.save();
    }

    // Calculations on Delivered
    if (status === 'delivered') {
      const config = await DeliverySetting.getSettings();
      const earningsAmount = config.baseDeliveryEarning + (assignment.distance * config.earningPerKm) * config.peakHourMultiplier;
      
      assignment.earnings = parseFloat(earningsAmount.toFixed(2));
      await assignment.save();

      // Log earnings record
      await DeliveryEarning.create({
        partnerId: partner._id,
        assignmentId: assignment._id,
        orderId: order._id,
        amount: parseFloat(earningsAmount.toFixed(2)),
        basePay: config.baseDeliveryEarning,
        deliveryChargeShare: order.deliveryCharge || 0
      });

      // Update partner metrics
      partner.activeOrders = Math.max(0, partner.activeOrders - 1);
      partner.availability = 'available';
      partner.totalDeliveries += 1;
      partner.todayDeliveries += 1;
      partner.todayEarnings += parseFloat(earningsAmount.toFixed(2));
      partner.totalEarnings += parseFloat(earningsAmount.toFixed(2));
      await partner.save();

      // Trigger Delivered email notification with invoice PDF attachment (using the user's matrix)
      try {
        const proofDoc = await DeliveryProof.findOne({ assignmentId: assignment._id });
        await sendDeliveryConfirmationWithInvoice({
          customer: {
            name: order.shippingDetails?.fullName,
            email: order.shippingDetails?.email,
            phone: order.shippingDetails?.phone
          },
          order,
          partner,
          proofImageUrl: proofDoc ? proofDoc.imageUrl : null
        });
      } catch (invoiceErr) {
        console.error('Invoice Delivery Email Error:', invoiceErr);
      }
    }

    // Calculations on Failure
    if (status === 'failed_delivery') {
      partner.activeOrders = Math.max(0, partner.activeOrders - 1);
      partner.availability = 'available';
      await partner.save();
    }

    // Trigger customer notification matrix (Email, SMS, WhatsApp, Push)
    await deliveryNotificationService.sendDeliveryNotification(status, assignment, order, partner);

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating delivery state', error: error.message });
  }
};

exports.verifyCustomerOtp = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { otp } = req.body;
    const assignment = await DeliveryAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.customerOtp === otp.trim()) {
      assignment.otpVerified = true;
      assignment.history.push({
        status: assignment.status,
        updatedBy: 'partner',
        remarks: 'Customer OTP verified successfully'
      });
      await assignment.save();
      res.json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

exports.uploadDeliveryProof = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { imageUrl, latitude, longitude } = req.body;

    const assignment = await DeliveryAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const proof = await DeliveryProof.create({
      assignmentId,
      imageUrl,
      verificationType: 'photo',
      latitude,
      longitude
    });

    res.json({ success: true, proof });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading proof', error: error.message });
  }
};

// --- ADMIN SIDE ACTIONS ---

exports.getAdminDeliveryPartners = async (req, res) => {
  try {
    const { status, availability, city, vehicleType } = req.query;
    const query = {};

    if (status) query.status = status;
    if (availability) query.availability = availability;
    if (city) query.city = city;
    if (vehicleType) query.vehicleType = vehicleType;

    const partners = await DeliveryPartner.find(query).populate('zone');
    res.json({ success: true, partners });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching partners list', error: error.message });
  }
};

exports.getAdminDeliveryPartnerDetails = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const partner = await DeliveryPartner.findById(partnerId).populate('zone');
    if (!partner) return res.status(404).json({ message: 'Partner not found' });

    const documents = await DeliveryDocument.findOne({ partnerId });
    const earnings = await DeliveryEarning.find({ partnerId }).populate('orderId');
    const assignments = await DeliveryAssignment.find({ partnerId }).populate('orderId').sort({ createdAt: -1 });

    res.json({
      success: true,
      partner,
      documents,
      earnings,
      assignments
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching partner details', error: error.message });
  }
};

exports.getAdminActiveDeliveries = async (req, res) => {
  try {
    const active = await DeliveryAssignment.find({
      status: { $in: ['assigned', 'accepted', 'reached_store', 'picked_up', 'out_for_delivery', 'reached_customer'] }
    }).populate('partnerId').populate('orderId');

    res.json({ success: true, active });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active deliveries', error: error.message });
  }
};

exports.getAdminDeliveryZones = async (req, res) => {
  try {
    const zones = await DeliveryZone.find({});
    res.json({ success: true, zones });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching zones', error: error.message });
  }
};

exports.createAdminDeliveryZone = async (req, res) => {
  try {
    const { name, city, coordinates, baseDeliveryCharge } = req.body;
    const zone = await DeliveryZone.create({
      name,
      city,
      boundary: {
        type: 'Polygon',
        coordinates: [coordinates] // [[ [lng, lat], [lng, lat], ... ]]
      },
      baseDeliveryCharge
    });
    res.status(201).json({ success: true, zone });
  } catch (error) {
    res.status(500).json({ message: 'Error creating zone', error: error.message });
  }
};

exports.updateAdminDeliveryZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, city, coordinates, baseDeliveryCharge, isActive } = req.body;

    const zone = await DeliveryZone.findById(zoneId);
    if (!zone) return res.status(404).json({ message: 'Zone not found' });

    if (name) zone.name = name;
    if (city) zone.city = city;
    if (baseDeliveryCharge) zone.baseDeliveryCharge = baseDeliveryCharge;
    if (isActive !== undefined) zone.isActive = isActive;
    if (coordinates) {
      zone.boundary = {
        type: 'Polygon',
        coordinates: [coordinates]
      };
    }

    await zone.save();
    res.json({ success: true, zone });
  } catch (error) {
    res.status(500).json({ message: 'Error updating zone', error: error.message });
  }
};

exports.deleteAdminDeliveryZone = async (req, res) => {
  try {
    await DeliveryZone.findByIdAndDelete(req.params.zoneId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting zone', error: error.message });
  }
};

exports.getAdminDeliverySettings = async (req, res) => {
  try {
    const settings = await DeliverySetting.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery settings', error: error.message });
  }
};

exports.updateAdminDeliverySettings = async (req, res) => {
  try {
    const settings = await DeliverySetting.findOne();
    if (!settings) {
      await DeliverySetting.create(req.body);
    } else {
      Object.assign(settings, req.body);
      await settings.save();
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
};

exports.manuallyAssignOrder = async (req, res) => {
  try {
    const { orderId, partnerId } = req.body;
    const order = await Order.findById(orderId);
    const partner = await DeliveryPartner.findById(partnerId);

    if (!order || !partner) {
      return res.status(404).json({ message: 'Order or Partner not found' });
    }

    // Cancel any current active assignment
    await DeliveryAssignment.updateMany(
      { orderId, status: { $nin: ['delivered', 'failed_delivery', 'cancelled'] } },
      { status: 'cancelled', $push: { history: { status: 'cancelled', remarks: 'Replaced by manual admin assignment' } } }
    );

    const customerOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const assignment = await DeliveryAssignment.create({
      orderId: order._id,
      partnerId: partner._id,
      status: 'assigned',
      customerOtp,
      history: [{
        status: 'assigned',
        remarks: 'Order manually assigned by Admin'
      }]
    });

    partner.activeOrders += 1;
    await partner.save();

    // Push Notification
    await deliveryNotificationService.sendDeliveryNotification('order_assigned', assignment, order, partner);
    await deliveryNotificationService.sendDeliveryNotification('partner_assigned', assignment, order, partner);

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error assigning order', error: error.message });
  }
};

exports.forceCompleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await DeliveryAssignment.findById(assignmentId).populate('orderId');

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const partner = await DeliveryPartner.findById(assignment.partnerId);

    assignment.status = 'delivered';
    assignment.otpVerified = true;
    assignment.deliveryTime = new Date();
    assignment.history.push({
      status: 'delivered',
      updatedBy: 'admin',
      remarks: 'Delivery force completed by Admin override'
    });
    await assignment.save();

    // Sync order status
    const order = await Order.findById(assignment.orderId._id);
    if (order) {
      order.status = 'delivered';
      await order.save();
    }

    // Calculate payouts
    const config = await DeliverySetting.getSettings();
    const earningsAmount = config.baseDeliveryEarning + (assignment.distance * config.earningPerKm) * config.peakHourMultiplier;
    assignment.earnings = parseFloat(earningsAmount.toFixed(2));
    await assignment.save();

    if (partner) {
      partner.activeOrders = Math.max(0, partner.activeOrders - 1);
      partner.availability = 'available';
      partner.totalDeliveries += 1;
      partner.todayDeliveries += 1;
      partner.todayEarnings += parseFloat(earningsAmount.toFixed(2));
      partner.totalEarnings += parseFloat(earningsAmount.toFixed(2));
      await partner.save();
    }

    // Log earnings
    await DeliveryEarning.create({
      partnerId: assignment.partnerId,
      assignmentId: assignment._id,
      orderId: order._id,
      amount: parseFloat(earningsAmount.toFixed(2)),
      basePay: config.baseDeliveryEarning,
      deliveryChargeShare: order.deliveryCharge || 0
    });

    // Notify customer
    await deliveryNotificationService.sendDeliveryNotification('delivered', assignment, order, partner);

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ message: 'Error force completing order', error: error.message });
  }
};

exports.getDeliveryAnalytics = async (req, res) => {
  try {
    const deliveredCount = await DeliveryAssignment.countDocuments({ status: 'delivered' });
    const failedCount = await DeliveryAssignment.countDocuments({ status: 'failed_delivery' });
    const totalCount = await DeliveryAssignment.countDocuments({});

    const finishedAssignments = await DeliveryAssignment.find({
      status: 'delivered',
      pickupTime: { $exists: true },
      deliveryTime: { $exists: true }
    });

    let totalDurationMin = 0;
    let onTimeCount = 0;

    finishedAssignments.forEach(asg => {
      const dur = (new Date(asg.deliveryTime) - new Date(asg.pickupTime)) / (1000 * 60);
      totalDurationMin += dur;
      if (dur <= (asg.eta || 30)) {
        onTimeCount++;
      }
    });

    const averageDeliveryTime = finishedAssignments.length ? Math.round(totalDurationMin / finishedAssignments.length) : 0;
    const onTimePercentage = finishedAssignments.length ? Math.round((onTimeCount / finishedAssignments.length) * 100) : 100;

    // Monthly stats group
    const earningsSum = await DeliveryEarning.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalEarningSum = earningsSum.length ? earningsSum[0].total : 0;

    res.json({
      success: true,
      analytics: {
        averageDeliveryTime,
        onTimePercentage,
        totalDeliveries: deliveredCount,
        failedDeliveries: failedCount,
        successRate: totalCount ? Math.round((deliveredCount / totalCount) * 100) : 100,
        totalEarningSum
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// --- CUSTOMER FACING ENQUIRIES ---

exports.getCustomerTrackingDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const assignment = await DeliveryAssignment.findOne({
      orderId: order._id,
      status: { $ne: 'cancelled' }
    }).populate('partnerId');

    res.json({
      success: true,
      orderStatus: order.status,
      trackingHistory: order.trackingHistory,
      assignment: assignment ? {
        status: assignment.status,
        eta: assignment.eta,
        distance: assignment.distance,
        pickupTime: assignment.pickupTime,
        deliveryTime: assignment.deliveryTime,
        partner: assignment.partnerId ? {
          name: assignment.partnerId.name,
          profilePhoto: assignment.partnerId.profilePhoto,
          vehicleType: assignment.partnerId.vehicleType,
          currentLatitude: assignment.partnerId.currentLatitude,
          currentLongitude: assignment.partnerId.currentLongitude
        } : null
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer tracking details', error: error.message });
  }
};
