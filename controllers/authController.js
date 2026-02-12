const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Ensure email and password are provided
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    // ✅ Check if user exists and password matches
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Update last login and last active timestamps
    user.lastLogin = new Date();
    user.lastActive = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

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
    const { name, email, password, confirmPassword, role } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
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
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
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
      await user.updateLastActive();
      
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        vendorStatus: user.vendorStatus,
        phone: user.phone,
        address: user.address,
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
      user.email = req.body.email || user.email;
      user.phone = req.body.phone || user.phone;
      
      if (req.body.address) {
        user.address = {
          ...user.address,
          ...req.body.address,
        };
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
        await user.updateLastActive();
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

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { email: email },
        { googleId: googleId }
      ]
    });

    let isNewUser = false;

    if (user) {
      // User exists, update their info and log them in
      user.name = name;
      user.googleId = googleId;
      user.photoURL = picture;
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