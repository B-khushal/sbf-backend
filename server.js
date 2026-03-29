const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize email service
const { initEmailService } = require('./services/emailNotificationService');

const NGROK_HOST_PATTERN = /^https:\/\/[a-z0-9-]+\.ngrok(?:-free)?\.app$/i;
const STATIC_ALLOWED_ORIGINS = [
  'https://sbflorist.in',
  'https://www.sbflorist.in',
  'https://sbf-frontend.onrender.com',
  'https://sbf-backend.onrender.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://192.168.1.7:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_APP_URL,
  process.env.NGROK_URL
].filter(Boolean);

const allowedOrigins = new Set([...STATIC_ALLOWED_ORIGINS, ...configuredOrigins]);
const frontendDistPath = path.join(__dirname, 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (NGROK_HOST_PATTERN.test(origin)) return true;
  return process.env.NODE_ENV !== 'production';
};

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully');

    initEmailService();

    const app = express();

    const corsOptions = {
      origin(origin, callback) {
        if (!origin) return callback(null, true);

        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          console.warn(`Blocked request from unauthorized origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'ngrok-skip-browser-warning'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400
    };

    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(morgan('dev', {
      skip: (req) => req.method === 'GET' && req.originalUrl.startsWith('/api/notifications'),
    }));

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
    app.use('/api/reviews', require('./routes/reviewRoutes'));
    app.use('/api/holidays', require('./routes/holidayRoutes'));
    app.use('/api/device-tokens', require('./routes/deviceTokenRoutes'));
    app.use('/wake-up', require('./routes/wakeUpRoutes'));
    app.use('/api/settings', settingsRoutes);
    app.use('/api/newsletter', newsletterRoutes);

    app.get('/', (req, res) => {
      const origin = req.get('Origin');
      const acceptsHtml = (req.headers.accept || '').includes('text/html');

      if (acceptsHtml && hasFrontendBuild) {
        return res.sendFile(frontendIndexPath);
      }

      console.log(`Root endpoint accessed from origin: ${origin || 'no-origin'}`);

      return res.status(200).json({
        message: 'SBF Backend API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        origin: origin || 'no-origin',
        corsEnabled: true,
        endpoints: {
          health: '/health',
          api: '/api',
          corsTest: '/cors-test'
        },
        frontendBuildAvailable: hasFrontendBuild
      });
    });

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
          allowedOrigins: [...allowedOrigins],
          dynamicOrigins: ['https://*.ngrok-free.app', 'https://*.ngrok.app']
        }
      });
    });

    app.get('/cors-test', (req, res) => {
      const origin = req.get('Origin');
      console.log(`CORS test accessed from origin: ${origin || 'no-origin'}`);

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

    app.use((req, res, next) => {
      const origin = req.get('Origin');
      if (origin) {
        console.log(`Request from origin: ${origin} to ${req.method} ${req.path}`);
        res.vary('Origin');
      }
      next();
    });

    app.use('/uploads', (req, res, next) => {
      const origin = req.get('Origin');

      if (origin && isAllowedOrigin(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
      next();
    }, express.static(path.join(__dirname, 'uploads')));

    if (hasFrontendBuild) {
      app.use(express.static(frontendDistPath));
    }

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }

      if (hasFrontendBuild) {
        console.log(`Serving React app for route: ${req.path}`);
        return res.sendFile(frontendIndexPath);
      }

      if (req.path === '/favicon.ico') {
        return res.status(204).end();
      }

      return res.status(404).json({
        error: 'Not Found',
        message: 'Frontend build is not available on this backend server.',
        requestedPath: req.path
      });
    });

    app.use((err, req, res, next) => {
      console.error('ERROR:', err.stack);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    const PORT = process.env.PORT || 5001;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Frontend build available: ${hasFrontendBuild}`);
      console.log('CORS enabled for configured domains');
      console.log('Database: Connected to MongoDB Atlas');
      console.log(`Access the server from other devices using: http://YOUR_IP:${PORT}`);
    }).on('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
