const User = require('../models/User');
const Role = require('../models/Role');
const Store = require('../models/Store');
const DeliveryPartner = require('../models/DeliveryPartner');
const DeliveryDocument = require('../models/DeliveryDocument');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// Seed default roles if not present
const seedDefaultRoles = async () => {
  const defaults = [
    {
      name: 'Platform Admin',
      code: 'platform_admin',
      permissions: ['*'],
      isCustom: false
    },
    {
      name: 'Store Owner',
      code: 'store_owner',
      permissions: [
        'dashboard:view', 'products:view', 'products:create', 'products:edit', 'products:delete',
        'orders:view', 'orders:create', 'orders:edit', 'orders:delete', 'orders:assign',
        'customers:view', 'customers:edit', 'delivery:view', 'delivery:manage_partners',
        'delivery:zones', 'delivery:settings', 'staff:view', 'staff:create', 'staff:edit',
        'staff:delete', 'staff:schedule', 'analytics:view', 'offers:view', 'offers:manage',
        'settings:view'
      ],
      isCustom: false
    },
    {
      name: 'Store Manager',
      code: 'store_manager',
      permissions: [
        'dashboard:view', 'orders:view', 'orders:edit', 'orders:assign',
        'customers:view', 'customers:edit', 'delivery:view', 'delivery:manage_partners',
        'staff:view', 'staff:schedule', 'analytics:view'
      ],
      isCustom: false
    },
    {
      name: 'Delivery Manager',
      code: 'delivery_manager',
      permissions: [
        'dashboard:view', 'delivery:view', 'delivery:manage_partners', 'delivery:zones',
        'delivery:settings', 'orders:view', 'orders:assign', 'analytics:view'
      ],
      isCustom: false
    },
    {
      name: 'Delivery Partner',
      code: 'delivery_partner',
      permissions: ['orders:view'],
      isCustom: false
    },
    {
      name: 'Support Staff',
      code: 'support_staff',
      permissions: ['dashboard:view', 'orders:view', 'customers:view'],
      isCustom: false
    },
    {
      name: 'Inventory Staff',
      code: 'inventory_staff',
      permissions: ['dashboard:view', 'products:view', 'products:edit'],
      isCustom: false
    },
    {
      name: 'Finance Staff',
      code: 'finance_staff',
      permissions: ['dashboard:view', 'finance:view', 'finance:payouts', 'finance:refunds'],
      isCustom: false
    }
  ];

  for (const role of defaults) {
    const exists = await Role.findOne({ code: role.code });
    if (!exists) {
      await Role.create(role);
    }
  }
};

// Seed default stores if not present
const seedDefaultStores = async () => {
  const defaults = [
    { name: 'Hyderabad Main Hub', code: 'HYD01', city: 'Hyderabad', address: 'Banjara Hills, Road No 12, Hyderabad', isActive: true },
    { name: 'Secunderabad Express Store', code: 'SEC01', city: 'Secunderabad', address: 'Sindhi Colony, Secunderabad', isActive: true },
    { name: 'Gachibowli Boutique', code: 'GAC01', city: 'Hyderabad', address: 'Gachibowli, Hyderabad', isActive: true }
  ];

  for (const store of defaults) {
    const exists = await Store.findOne({ code: store.code });
    if (!exists) {
      await Store.create(store);
    }
  }
};

// Seed default roles and stores on load
seedDefaultRoles()
  .then(() => seedDefaultStores())
  .catch(err => console.error('Failed to seed defaults:', err));

// SYSTEM PERMISSIONS LIST
const SYSTEM_PERMISSIONS = [
  { code: 'dashboard:view', name: 'View Dashboard', module: 'Dashboard' },
  { code: 'orders:view', name: 'View Orders', module: 'Orders' },
  { code: 'orders:create', name: 'Create Orders', module: 'Orders' },
  { code: 'orders:edit', name: 'Edit/Manage Orders', module: 'Orders' },
  { code: 'orders:delete', name: 'Delete Orders', module: 'Orders' },
  { code: 'orders:assign', name: 'Assign Delivery Partners', module: 'Orders' },
  { code: 'products:view', name: 'View Products', module: 'Products' },
  { code: 'products:create', name: 'Create Products', module: 'Products' },
  { code: 'products:edit', name: 'Edit Products', module: 'Products' },
  { code: 'products:delete', name: 'Delete Products', module: 'Products' },
  { code: 'customers:view', name: 'View Customers', module: 'Customers' },
  { code: 'customers:edit', name: 'Edit Customers', module: 'Customers' },
  { code: 'delivery:view', name: 'View Deliveries', module: 'Delivery' },
  { code: 'delivery:manage_partners', name: 'Manage Delivery Partners', module: 'Delivery' },
  { code: 'delivery:zones', name: 'Manage Zones', module: 'Delivery' },
  { code: 'delivery:settings', name: 'Manage Delivery Settings', module: 'Delivery' },
  { code: 'staff:view', name: 'View Staff', module: 'Staff' },
  { code: 'staff:create', name: 'Create Staff', module: 'Staff' },
  { code: 'staff:edit', name: 'Edit Staff', module: 'Staff' },
  { code: 'staff:delete', name: 'Delete Staff', module: 'Staff' },
  { code: 'staff:schedule', name: 'Manage Schedules', module: 'Staff' },
  { code: 'finance:view', name: 'View Financial Metrics', module: 'Finance' },
  { code: 'finance:payouts', name: 'Manage Payouts', module: 'Finance' },
  { code: 'finance:refunds', name: 'Process Refunds', module: 'Finance' },
  { code: 'analytics:view', name: 'View Analytics', module: 'Analytics' },
  { code: 'offers:view', name: 'View Offers/Promo Codes', module: 'Offers' },
  { code: 'offers:manage', name: 'Manage Offers/Promo Codes', module: 'Offers' },
  { code: 'settings:view', name: 'View Settings', module: 'Settings' },
  { code: 'settings:manage', name: 'Manage Platform Settings', module: 'Settings' }
];

// GET /api/permissions
exports.getPermissions = (req, res) => {
  res.json(SYSTEM_PERMISSIONS);
};

// GET /api/staff/stores
exports.getStores = async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true });
    res.json(stores);
  } catch (error) {
    console.error('Fetch stores error:', error);
    res.status(500).json({ message: 'Server error retrieving stores' });
  }
};

// GET /api/staff
exports.getStaff = async (req, res) => {
  try {
    const { role, status, store, zone } = req.query;
    
    // Base filter to only get staff members (ignore standard customers)
    const filter = {
      role: { $ne: 'user' }
    };

    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.status = status;
    if (store && store !== 'all') filter.assigned_store = store;
    if (zone && zone !== 'all') filter.assigned_zone = zone;

    const staff = await User.find(filter)
      .populate('assigned_store')
      .populate('assigned_zone')
      .select('-password');

    res.json(staff);
  } catch (error) {
    console.error('Get Staff Error:', error);
    res.status(500).json({ message: 'Server error retrieving staff' });
  }
};

// POST /api/staff
exports.createStaff = async (req, res) => {
  try {
    const { name, email, phone, role, password, assigned_store, assigned_zone, permissions, profilePhoto } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Auto-generate employeeId and staffCode
    const staffCount = await User.countDocuments({ role: { $ne: 'user' } });
    const employeeId = `EMP${String(staffCount + 1).padStart(4, '0')}`;
    const staffCode = `SBF-${String(staffCount + 1).padStart(3, '0')}`;

    // Create staff user
    const newUser = await User.create({
      name,
      email,
      phone,
      role,
      password,
      assigned_store: (assigned_store && assigned_store !== 'none') ? assigned_store : null,
      assigned_zone: (assigned_zone && assigned_zone !== 'none') ? assigned_zone : null,
      permissions: permissions || [],
      employeeId,
      staffCode,
      photoURL: profilePhoto || '',
      created_by: req.user._id,
      status: 'active'
    });

    // If role is delivery partner, also create DeliveryPartner record and DeliveryDocument record
    if (role === 'delivery_partner') {
      const partner = await DeliveryPartner.create({
        name,
        email,
        phone,
        password, // Pre-hashed by User model schema hooks?
        userId: newUser._id,
        zone: assigned_zone || null,
        status: 'offline',
        availability: 'available',
        approvalStatus: 'created'
      });

      // Create linked document record
      await DeliveryDocument.create({
        partnerId: partner._id,
        verificationStatus: 'pending'
      });

      // Link partner profile to user
      newUser.deliveryPartnerProfile = partner._id;
      await newUser.save();
    }

    res.status(201).json({
      message: 'Staff member created successfully',
      staff: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        employeeId,
        staffCode
      }
    });
  } catch (error) {
    console.error('Create Staff Error:', error);
    res.status(500).json({ message: 'Server error creating staff member' });
  }
};

// PUT /api/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const { name, email, phone, role, status, assigned_store, assigned_zone, permissions, profilePhoto } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Protect platform_admin modifications (only platform_admin can change role/permissions of platform_admin)
    if (user.role === 'platform_admin' && req.user.role !== 'platform_admin') {
      return res.status(403).json({ message: 'Access denied: Cannot modify platform admin accounts' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.role = role || user.role;
    user.status = status || user.status;
    user.assigned_store = (assigned_store !== undefined) ? (assigned_store && assigned_store !== 'none' ? assigned_store : null) : user.assigned_store;
    user.assigned_zone = (assigned_zone !== undefined) ? (assigned_zone && assigned_zone !== 'none' ? assigned_zone : null) : user.assigned_zone;
    user.permissions = permissions || user.permissions;
    if (profilePhoto !== undefined) user.photoURL = profilePhoto;

    await user.save();

    // If role is delivery_partner, check if linked DeliveryPartner profile exists and sync
    if (user.role === 'delivery_partner') {
      let partner = await DeliveryPartner.findOne({ userId: user._id });
      if (!partner) {
        partner = await DeliveryPartner.create({
          name: user.name,
          email: user.email,
          phone: user.phone,
          password: 'Password123!', // fallback password
          userId: user._id,
          zone: user.assigned_zone || null,
          status: 'offline',
          availability: 'available',
          approvalStatus: 'created'
        });
        await DeliveryDocument.create({
          partnerId: partner._id,
          verificationStatus: 'pending'
        });
      } else {
        partner.name = user.name;
        partner.email = user.email;
        partner.phone = user.phone;
        partner.zone = user.assigned_zone || null;
        await partner.save();
      }
    }

    res.json({ message: 'Staff member updated successfully', staff: user });
  } catch (error) {
    console.error('Update Staff Error:', error);
    res.status(500).json({ message: 'Server error updating staff member' });
  }
};

// DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    if (user.role === 'platform_admin' && req.user.role !== 'platform_admin') {
      return res.status(403).json({ message: 'Forbidden: Platform admins cannot be deleted' });
    }

    // Delete driver records if they exist
    const partner = await DeliveryPartner.findOne({ userId: user._id });
    if (partner) {
      await DeliveryDocument.deleteMany({ partnerId: partner._id });
      await partner.deleteOne();
    }

    await user.deleteOne();
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete Staff Error:', error);
    res.status(500).json({ message: 'Server error deleting staff member' });
  }
};

// GET /api/roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json(roles);
  } catch (error) {
    console.error('Get Roles Error:', error);
    res.status(500).json({ message: 'Server error retrieving roles' });
  }
};

// POST /api/roles
exports.createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    const code = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existingRole = await Role.findOne({ code });
    if (existingRole) {
      return res.status(400).json({ message: 'Role with this name/code already exists' });
    }

    const newRole = await Role.create({
      name,
      code,
      permissions: permissions || [],
      isCustom: true
    });

    res.status(201).json(newRole);
  } catch (error) {
    console.error('Create Role Error:', error);
    res.status(500).json({ message: 'Server error creating role' });
  }
};

// PUT /api/roles/:id
exports.updateRole = async (req, res) => {
  try {
    const { permissions } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    role.permissions = permissions || role.permissions;
    await role.save();

    res.json(role);
  } catch (error) {
    console.error('Update Role Error:', error);
    res.status(500).json({ message: 'Server error updating role' });
  }
};

// GET /api/activity-logs
exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find({})
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    console.error('Get Activity Logs Error:', error);
    res.status(500).json({ message: 'Server error retrieving logs' });
  }
};

// GET /api/login-history
exports.getLoginHistory = async (req, res) => {
  try {
    // Find all users who have non-empty login_history arrays and aggregate sessions
    const users = await User.find({ 'login_history.0': { $exists: true } })
      .select('name email role employeeId login_history');

    const flatHistory = [];
    users.forEach(u => {
      u.login_history.forEach(session => {
        flatHistory.push({
          sessionId: session._id,
          userId: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          employeeId: u.employeeId || 'N/A',
          loginTime: session.loginTime,
          logoutTime: session.logoutTime || null,
          device: session.device || 'Unknown',
          browser: session.browser || 'Unknown',
          location: session.location || 'Unknown',
          ipAddress: session.ipAddress || 'Unknown',
          status: session.status
        });
      });
    });

    // Sort by loginTime desc
    flatHistory.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

    res.json(flatHistory.slice(0, 100)); // Limit to 100 recent sessions
  } catch (error) {
    console.error('Get Login History Error:', error);
    res.status(500).json({ message: 'Server error retrieving login history' });
  }
};

// POST /api/auth/revoke-session
exports.revokeSession = async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const session = user.login_history.id(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.status = 'revoked';
    session.logoutTime = new Date();
    await user.save();

    res.json({ message: 'Session revoked successfully. User forced to logout.' });
  } catch (error) {
    console.error('Revoke Session Error:', error);
    res.status(500).json({ message: 'Server error revoking session' });
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify token signature
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Find the session and verify it is still active
    const session = user.login_history.find(s => s.token === refreshToken && s.status === 'active');
    if (!session) {
      return res.status(401).json({ message: 'Session revoked or expired' });
    }

    // Generate new Access Token
    const token = generateToken(user);
    res.json({ token });
  } catch (error) {
    console.error('Token Refresh Error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// GET /api/delivery-partners/:id/docs
exports.getPartnerDocs = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    let docs = await DeliveryDocument.findOne({ partnerId: partner._id });
    if (!docs) {
      docs = await DeliveryDocument.create({
        partnerId: partner._id,
        verificationStatus: 'pending'
      });
    }

    res.json(docs);
  } catch (error) {
    console.error('Get Partner Docs Error:', error);
    res.status(500).json({ message: 'Server error retrieving partner documents' });
  }
};

// PUT /api/delivery-partners/:id/verify-docs
exports.verifyPartnerDocs = async (req, res) => {
  try {
    const { verificationStatus, aadhaarNumber, panNumber, licenseNumber, vehicleRcNumber, insuranceNumber, bankAccountNumber, bankIfscCode, bankAccountHolder } = req.body;

    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    let docs = await DeliveryDocument.findOne({ partnerId: partner._id });
    if (!docs) {
      docs = new DeliveryDocument({ partnerId: partner._id });
    }

    docs.verificationStatus = verificationStatus || docs.verificationStatus;
    if (aadhaarNumber) docs.aadhaarNumber = aadhaarNumber;
    if (panNumber) docs.panNumber = panNumber;
    if (licenseNumber) docs.licenseNumber = licenseNumber;
    if (vehicleRcNumber) docs.vehicleRcNumber = vehicleRcNumber;
    if (insuranceNumber) docs.insuranceNumber = insuranceNumber;
    if (bankAccountNumber) docs.bankAccountNumber = bankAccountNumber;
    if (bankIfscCode) docs.bankIfscCode = bankIfscCode;
    if (bankAccountHolder) docs.bankAccountHolder = bankAccountHolder;

    await docs.save();

    // Update partner status based on verification status
    if (verificationStatus === 'verified') {
      partner.approvalStatus = 'approved';
      
      // Also update linked user status if active
      const user = await User.findById(partner.userId);
      if (user) {
        user.status = 'active';
        await user.save();
      }
    } else if (verificationStatus === 'rejected') {
      partner.approvalStatus = 'created'; // Reset back
    }
    
    await partner.save();

    res.json({ message: 'Documents updated and verified successfully', docs, partner });
  } catch (error) {
    console.error('Verify Docs Error:', error);
    res.status(500).json({ message: 'Server error verifying partner documents' });
  }
};
