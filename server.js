const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize email service
const { initEmailService, testEmailService } = require('./services/emailNotificationService');

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    console.log('✅ Database connected successfully');

    // Initialize email service
    initEmailService();

    const app = express();

    // --- Comprehensive CORS Configuration ---
    const corsOptions = {
      origin: function(origin, callback) {
        const allowedOrigins = [
          // Production domains
          'https://sbflorist.in',
          'https://www.sbflorist.in',
          // Render deployment URLs
          'https://sbf-frontend.onrender.com',
          'https://sbf-backend.onrender.com',
          // Local development
          'http://localhost:8080',
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:8080',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173'
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          console.warn(`⚠️ Blocked request from unauthorized origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400 // 24 hours
    };

    app.use(cors(corsOptions));

    // Handle preflight OPTIONS requests explicitly
    app.options('*', cors(corsOptions));

    // Middleware
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(morgan('dev', {
      // Reduce noise from high-frequency notification polling.
      skip: (req) => req.method === 'GET' && req.originalUrl.startsWith('/api/notifications'),
    }));

    // Routes
    app.use('/api/products', require('./routes/productRoutes'));
    app.use('/api/users', require('./routes/userRoutes'));
    app.use('/api/orders', require('./routes/orderRoutes'));
    app.use('/api/auth', require('./routes/authRoutes'));
    app.use('/api/uploads', require('./routes/uploadRoutes'));
    app.use('/api/notifications', require('./routes/notificationRoutes'));
    app.use('/api/cart', require('./routes/cartRoutes'));
    app.use('/api/wishlist', require('./routes/wishlistRoutes'));
    const settingsRoutes = require('./routes/settingsRoutes');
    const newsletterRoutes = require('./routes/newsletterRoutes');
    app.use('/api/dashboard', require('./routes/dashboardRoutes'));
    app.use('/api/analytics', require('./routes/analyticsRoutes'));
    app.use('/api/contact', require('./routes/contactRoutes'));
    app.use('/api/promocodes', require('./routes/promoCodeRoutes'));
    app.use('/api/offers', require('./routes/offerRoutes'));
    app.use('/api/vendors', require('./routes/vendorRoutes'));
    app.use('/api/reviews', require('./routes/reviewRoutes')); // Review system enabled
    app.use('/api/holidays', require('./routes/holidayRoutes')); // Holiday management
    app.use('/api/device-tokens', require('./routes/deviceTokenRoutes')); // FCM Push Notifications
    app.use('/wake-up', require('./routes/wakeUpRoutes'));
    app.use('/api/settings', settingsRoutes);
    app.use('/api/newsletter', newsletterRoutes);

    // Root endpoint
    app.get('/', (req, res) => {
      const origin = req.get('Origin');
      console.log(`🏠 Root endpoint accessed from origin: ${origin || 'no-origin'}`);
      
      res.status(200).json({
        message: 'SBF Backend API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        origin: origin || 'no-origin',
        corsEnabled: true,
        endpoints: {
          health: '/health',
          api: '/api',
          corsTest: '/cors-test'
        }
      });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      const allowedOrigins = [
        'https://sbflorist.in',
        'https://www.sbflorist.in',
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:5173'
      ];

      res.status(200).json({
        status: 'OK',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cors: {
          enabled: true,
          origin: req.get('Origin') || 'No Origin',
          allowedOrigins: allowedOrigins
        }
      });
    });

    // CORS test endpoint
    app.get('/cors-test', (req, res) => {
      const origin = req.get('Origin');
      console.log(`🧪 CORS test accessed from origin: ${origin || 'no-origin'}`);
      
      res.status(200).json({
        success: true,
        message: 'CORS is working correctly',
        origin: origin || 'No Origin',
        timestamp: new Date().toISOString(),
        allowedOrigins: corsOptions.origin,
        headers: {
          'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
          'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers')
        },
        requestHeaders: req.headers
      });
    });

    // Add CORS debugging middleware
    app.use((req, res, next) => {
      const origin = req.get('Origin');
      if (origin) {
        console.log(`🌐 Request from origin: ${origin} to ${req.method} ${req.path}`);
        // Add Vary header to prevent caching issues
        res.vary('Origin');
      }
      next();
    });

    // Serve uploaded files with proper CORS headers
    app.use('/uploads', (req, res, next) => {
      const origin = req.get('Origin');
      const allowedOrigins = [
        'https://sbflorist.in',
        'https://www.sbflorist.in',
        'http://localhost:8080',
        'http://localhost:3000',
        'http://localhost:5173'
      ];

      if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
      next();
    }, express.static(path.join(__dirname, 'uploads')));

    // Serve static frontend files (React build)
    app.use(express.static(path.join(__dirname, 'dist'))); // or 'build'

    // SPA Routing - Catch all handler: send back React's index.html file for any non-API routes
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }
      
      console.log(`🌐 Serving React app for route: ${req.path}`);
      res.sendFile(path.join(__dirname, 'dist', 'index.html')); // or 'build'
    });

    // Error handler middleware
    app.use((err, req, res, next) => {
      console.error("🔥 ERROR:", err.stack);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    const PORT = process.env.PORT || 5001;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 CORS enabled for production domains`);
      console.log(`🗄️ Database: Connected to MongoDB Atlas`);
      console.log(`Access the server from other devices using: http://YOUR_IP:${PORT}`);
    }).on('error', (err) => {
      console.error('❌ Server failed to start:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
