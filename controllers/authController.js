const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { OAuth2Client } = require('google-auth-library');
const { logActivity } = require('../utils/activityLogger');
const { normalizeEmail } = require('../utils/emailNormalizer');
const { sanitizeText, normalizeIndianPhone, normalizePincode } = require('../data/serviceablePincodes');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const normalizeAddresses = (addresses = []) => {
  if (!Array.isArray(addresses)) {
    return [];
  }

  const normalized = addresses
    .filter((address) => address && typeof address === 'object')
    .map((address, index) => {
      const rawName = sanitizeText(address.fullName || `${address.firstName || ''} ${address.lastName || ''}`, 120);
      const nameParts = rawName.split(/\s+/).filter(Boolean);
      const firstName = sanitizeText(address.firstName || nameParts[0] || '', 60);
      const lastName = sanitizeText(address.lastName || nameParts.slice(1).join(' ') || '', 60);
      const streetAddr = sanitizeText(address.address || address.street || address.addressLine1 || address.formattedAddress || '', 240);
      const apt = sanitizeText(address.apartment || address.addressLine2 || '', 160);
      const houseNo = sanitizeText(address.houseNo || '', 120);
      const zip = normalizePincode(address.zipCode || address.pincode || '');
      const addrType = ['home', 'work', 'other'].includes(String(address.type || '').toLowerCase())
        ? String(address.type).toLowerCase()
        : 'home';
      const instructions = sanitizeText(address.deliveryInstructions || address.deliverySpecialInstructions || address.notes || '', 250);

      return {
        id: String(address.id || `addr_${Date.now()}_${index}`),
        firstName,
        lastName,
        fullName: rawName || `${firstName} ${lastName}`.trim(),
        address: streetAddr,
        street: streetAddr,
        addressLine1: streetAddr,
        apartment: apt,
        addressLine2: apt,
        houseNo,
        floor: sanitizeText(address.floor || '', 60),
        city: sanitizeText(address.city || 'Hyderabad', 80) || 'Hyderabad',
        state: sanitizeText(address.state || 'Telangana', 80) || 'Telangana',
        zipCode: zip,
        pincode: zip,
        country: sanitizeText(address.country || 'India', 60) || 'India',
        phone: normalizeIndianPhone(address.phone || '') || sanitizeText(address.phone || '', 20),
        alternatePhone: normalizeIndianPhone(address.alternatePhone || ''),
        email: sanitizeText(address.email || '', 180),
        type: addrType,
        notes: sanitizeText(address.notes || '', 250),
        deliveryInstructions: instructions,
        deliverySpecialInstructions: instructions,
        deliveryOption: address.deliveryOption === 'gift' ? 'gift' : 'self',
        isDefault: !!address.isDefault,
        cardMessage: sanitizeText(address.cardMessage || address.giftMessage || '', 200),
        giftMessage: sanitizeText(address.giftMessage || address.cardMessage || '', 200),
        receiverFirstName: sanitizeText(address.receiverFirstName || '', 60),
        receiverLastName: sanitizeText(address.receiverLastName || '', 60),
        receiverEmail: sanitizeText(address.receiverEmail || '', 180),
        receiverPhone: sanitizeText(address.receiverPhone || '', 20),
        receiverAddress: sanitizeText(address.receiverAddress || '', 240),
        receiverApartment: sanitizeText(address.receiverApartment || '', 160),
        receiverCity: sanitizeText(address.receiverCity || '', 80),
        receiverState: sanitizeText(address.receiverState || '', 80),
        receiverZipCode: normalizePincode(address.receiverZipCode || ''),
        latitude: typeof address.latitude === 'number' ? address.latitude : null,
        longitude: typeof address.longitude === 'number' ? address.longitude : null,
        formattedAddress: sanitizeText(address.formattedAddress || streetAddr, 300),
        landmark: sanitizeText(address.landmark || '', 160),
      };
    });

  if (normalized.length > 0 && !normalized.some((a) => a.isDefault)) {
    normalized[0].isDefault = true;
  }

  return normalized.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    const email = normalizeEmail(rawEmail);
    const { password } = req.body;

    // ✅ Ensure email and password are provided
    if (!email || !password) {
      await logActivity({
        req,
        actionType: 'Login',
        method: 'POST',
        status: 'Failed',
        metadata: { reason: 'Missing credentials', email },
      });
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    // ✅ Check if user exists and password matches
    if (!user) {
      await logActivity({
        req,
        actionType: 'Login',
        method: 'POST',
        status: 'Failed',
        metadata: { reason: 'User not found', email },
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      await logActivity({
        req,
        actionType: 'Login',
        method: 'POST',
        status: 'Failed',
        userId: user._id,
        userName: user.name,
        email: user.email,
        metadata: { reason: 'Password mismatch' },
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Update last login and last active timestamps
    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    await logActivity({
      req,
      actionType: 'Login',
      method: 'POST',
      status: 'Success',
      userId: user._id,
      userName: user.name,
      email: user.email,
      metadata: { role: user.role },
    });

    // ✅ Return user details with a token
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      token,
      lastActive: user.lastActive,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, password, confirmPassword, role } = req.body;
    const email = normalizeEmail(req.body.email);

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      console.warn("Registration failed: Missing required fields", { name: !!name, email: !!email, password: !!password, confirmPassword: !!confirmPassword });
      return res.status(400).json({ 
        message: "All fields are required",
        fields: {
          name: !name ? "Name is required" : null,
          email: !email ? "Email is required" : null,
          password: !password ? "Password is required" : null,
          confirmPassword: !confirmPassword ? "Please confirm your password" : null
        }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn(`Registration failed: Invalid email format: ${email}`);
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Password validation
    if (password.length < 6) {
      console.warn("Registration failed: Password too short");
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Password confirmation
    if (password !== confirmPassword) {
      console.warn("Registration failed: Password mismatch");
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.warn(`Registration failed: User with email ${email} already exists`);
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role: role || "user",
      lastActive: new Date(),
      lastLogin: new Date(),
      status: 'active'
    });

    if (user) {
      const token = generateToken(user);
      console.log(`User registered successfully: ${email} (${user._id})`);
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        token,
        lastActive: user.lastActive,
        lastLogin: user.lastLogin
      });
    } else {
      console.warn("Registration failed: Mongoose user creation failed");
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Registration Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "User with this email already exists" });
    }
    res.status(500).json({ message: error.message || "Server error during registration" });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (user) {
      // Update last active timestamp
      if (typeof user.updateLastActive === 'function') {
        await user.updateLastActive();
      }
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        vendorStatus: user.vendorStatus,
        phone: user.phone,
        address: user.address,
        addresses: user.addresses || [],
        lastActive: user.lastActive,
        lastLogin: user.lastLogin
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email ? normalizeEmail(req.body.email) : user.email;
      user.phone = req.body.phone || user.phone;
      
      if (req.body.address) {
        user.address = {
          ...user.address,
          ...req.body.address,
        };
      }

      if (req.body.addresses !== undefined) {
        user.addresses = normalizeAddresses(req.body.addresses);
      }
      
      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      const token = generateToken(updatedUser);

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        phone: updatedUser.phone,
        address: updatedUser.address,
        addresses: updatedUser.addresses || [],
        lastActive: updatedUser.lastActive,
        lastLogin: updatedUser.lastLogin,
        token
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    // Update last active timestamp before logout
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        if (typeof user.updateLastActive === 'function') {
          await user.updateLastActive();
        }

        await logActivity({
          req,
          actionType: 'Logout',
          method: 'POST',
          status: 'Success',
          userId: user._id,
          userName: user.name,
          email: user.email,
        });
      }
    }
    res.json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error during logout" });
  }
};

// @desc    Google OAuth authentication
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { credential, agreedToTerms } = req.body;
    
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user already exists (by email first, then googleId)
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user && googleId) {
      user = await User.findOne({ googleId });
    }

    let isNewUser = false;

    if (user) {
      // User exists, update their info and log them in
      if (name && (!user.name || user.name.startsWith('User'))) {
        user.name = name;
      }
      user.googleId = googleId;
      if (picture) user.photoURL = picture;
      user.provider = 'google';
      user.lastLogin = new Date();
      user.lastActive = new Date();
      await user.save();
    } else {
      // For new users, require terms acceptance
      if (!agreedToTerms) {
        return res.json({ 
          isNewUser: true,
          tempCredentials: {
            name,
            email,
            googleId,
            photoURL: picture
          }
        });
      }
      
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        photoURL: picture,
        provider: 'google',
        role: 'user',
        status: 'active',
        lastLogin: new Date(),
        lastActive: new Date(),
        agreedToTerms: true,
        // Set a default password (they won't use it for Google auth)
        password: Math.random().toString(36).slice(-8)
      });
      isNewUser = true;
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      provider: user.provider,
      photoURL: user.photoURL,
      token,
      lastActive: user.lastActive,
      lastLogin: user.lastLogin,
      isNewUser
    });

  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
};

module.exports = {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  logoutUser,
  googleAuth,
};