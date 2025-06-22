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

// Connect to database
connectDB().then(() => {
  console.log('Database connected successfully');
}).catch((error) => {
  console.error('Database connection error:', error);
});

// Initialize email service
initEmailService();

const app = express();

// CORS configuration - Enhanced for production
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',
      'https://sbflorist.in',
      'https://www.sbflorist.in',
      'https://sbf-backend.onrender.com',
      // Add additional variations for safety
      'https://sbf-florist.vercel.app',
      'https://sbf-florist.netlify.app'
    ];
    
    console.log(`🔍 CORS Check - Origin: ${origin}, Allowed: ${allowedOrigins.includes(origin)}`);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ CORS allowed for origin: ${origin}`);
      return callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      return callback(null, true); // Allow all origins for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Additional CORS headers for problematic requests - Enhanced
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://sbflorist.in',
    'https://www.sbflorist.in',
    'https://sbf-backend.onrender.com',
    'https://sbf-florist.vercel.app',
    'https://sbf-florist.netlify.app'
  ];

  // Always set CORS headers for debugging
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log(`🌐 Setting CORS headers for origin: ${origin}`);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
    console.log(`🌐 Setting CORS headers for no-origin request`);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log(`✅ Handling OPTIONS request from ${origin || 'no-origin'}`);
    res.sendStatus(200);
  } else {
    next();
  }
});

// Debug middleware for CORS
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'No Origin'}`);
  next();
});

// Middleware
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

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
      allowedOrigins: [
        'http://localhost:8080',
        'http://localhost:3000', 
        'http://localhost:5173',
        'https://sbflorist.in',
        'https://www.sbflorist.in',
        'https://sbf-backend.onrender.com'
      ]
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
    headers: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods')
    }
  });
});

// Wake-up endpoint to prevent server sleep
app.get('/wake-up', (req, res) => {
  const origin = req.get('Origin');
  console.log(`⏰ Wake-up ping from origin: ${origin || 'no-origin'}`);
  
  res.status(200).json({
    success: true,
    message: 'Server is awake and ready',
    origin: origin || 'No Origin',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Serve uploaded files with proper CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
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
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 CORS enabled for production domains`);
  console.log(`🗄️ Database: ${process.env.MONGO_URI ? 'Connected' : 'Using default connection'}`);
  console.log(`Access the server from other devices using: http://YOUR_IP:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});
