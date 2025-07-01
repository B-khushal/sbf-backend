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

// ⚡ PERFORMANCE: Body parser middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔧 FIXED: Complete CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://sbflorist.in',
      'https://www.sbflorist.in', // ✅ Production domain
      'https://sbf-backend.onrender.com',
      'https://sbf-main.netlify.app',
      'https://sbf-main.vercel.app'
    ];
    
    // Allow any localhost port for development
    if (origin.includes('localhost:') || origin.includes('127.0.0.1:')) {
      return callback(null, true);
    }
    
    // Allow Netlify and Vercel preview URLs
    if (origin.includes('.netlify.app') || origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// 🔧 Additional CORS headers for preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Always set these headers for CORS
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ CORS preflight: ${req.method} ${req.url} from ${origin}`);
    return res.status(200).end();
  }
  
  next();
});

// ⚡ PERFORMANCE: Security and optimization headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // ⚡ Performance headers for static assets
  if (req.url.includes('/uploads/') || req.url.includes('/images/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    res.setHeader('ETag', 'true');
  }
  
  // ⚡ API response compression
  res.setHeader('Content-Encoding', 'gzip');
  
  next();
});

// Middleware
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
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/promocodes', require('./routes/promoCodeRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/wake-up', require('./routes/wakeUpRoutes'));

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
  const healthCheck = {
    uptime: process.uptime(),
    message: 'Server is running smoothly',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    database: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected',
    cors: {
      origin: req.get('Origin') || 'No Origin',
      allowed: true
    }
  };
  
  res.status(200).json(healthCheck);
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

// ⚡ PERFORMANCE: API response timing middleware
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) { // Log slow requests
        console.log(`🐌 Slow request: ${req.method} ${req.url} - ${duration}ms`);
      }
    });
    next();
  });
}

// ⚡ Error handling middleware with performance logging
app.use((err, req, res, next) => {
  console.error('❌ Server error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Ensure CORS headers are still set for error responses
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url} from ${req.get('Origin')}`);
  
  // Ensure CORS headers for 404s
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.status(404).json({ 
    message: 'Route not found',
    path: req.url,
    method: req.method
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 CORS enabled for production domains`);
  console.log(`🗄️ Database: ${process.env.MONGO_URI ? 'Connected' : 'Using default connection'}`);
  console.log(`Access the server from other devices using: http://YOUR_IP:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});

// ⚡ PERFORMANCE: Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    require('mongoose').connection.close(false, () => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;
