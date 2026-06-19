const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize email service
const { initEmailService } = require('./services/emailNotificationService');

const STATIC_ALLOWED_ORIGINS = [
  'https://sbflorist.in',
  'https://www.sbflorist.in',
  'https://sbf-frontend.onrender.com',
  'https://sbf-backend.onrender.com',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://192.168.1.7:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_APP_URL
].filter(Boolean);

const allowedOrigins = new Set([...STATIC_ALLOWED_ORIGINS, ...configuredOrigins]);
const frontendDistPath = path.join(__dirname, 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

const parseAbsoluteUrl = (value) => {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== 'production';
};

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully');

    // Initialize default seasonal campaigns
    try {
      const SeasonalCampaign = require('./models/SeasonalCampaign');
      await SeasonalCampaign.seedDefaultCampaigns();
    } catch (campaignSeedErr) {
      console.error('⚠️ Seasonal Campaign seeding failed:', campaignSeedErr);
    }

    // Initialize default categories if none exist in Category collection
    try {
      const Category = require('./models/Category');
      const count = await Category.countDocuments();
      if (count === 0) {
        console.log('🌱 Seeding default categories into Category collection...');
        
        // Define default category taxonomy matching categoryTaxonomy.ts and settings defaults
        const defaultTaxonomy = [
          // Primary Categories
          { name: "Flowers", slug: "flowers", description: "Fresh blooms for every occasion", image: "/images/roses-1.png", sortOrder: 0 },
          { name: "Chocolate", slug: "chocolate", description: "Delicious chocolate arrangements", image: "/images/p-orchid.png", sortOrder: 1 },
          { name: "Birthday", slug: "birthday", description: "Celebrate special moments", image: "/images/p-lilly.png", sortOrder: 2 },
          { name: "Anniversary", slug: "anniversary", description: "Romantic gestures made perfect", image: "/images/roses-1.png", sortOrder: 3 },
          { name: "Baskets", slug: "baskets", description: "Elegant gift baskets", image: "/images/p-carnation.png", sortOrder: 4 },
          { name: "Combos", slug: "combos", description: "Perfect combo packages", image: "/images/p-sunflower.png", sortOrder: 5 },
          { name: "Plants", slug: "plants", description: "Indoor & outdoor plants", image: "/images/p-sunflower.png", sortOrder: 6 },
          { name: "Sympathy", slug: "sympathy", description: "Comforting arrangements", image: "/images/p-lilly.png", sortOrder: 7 },
          { name: "Occasions", slug: "occasions", description: "Special celebrations", image: "/images/p-carnation.png", sortOrder: 8 },
        ];

        const savedParents = {};

        // Seed parents
        for (let item of defaultTaxonomy) {
          const parent = await Category.create({
            name: item.name,
            slug: item.slug,
            description: item.description,
            image: item.image,
            categoryUrl: `/${item.slug}`,
            sortOrder: item.sortOrder,
            status: 'active',
            parentId: null
          });
          savedParents[item.slug] = parent._id;
        }

        // Subcategories definitions
        const subcategories = {
          flowers: [
            { name: "Roses", slug: "roses", description: "Fresh premium roses", image: "/images/roses-1.png", sortOrder: 0 },
            { name: "Lilies", slug: "lilies", description: "Elegant graceful lilies", image: "/images/p-lilly.png", sortOrder: 1 },
            { name: "Tulips", slug: "tulips", description: "Colorful fresh tulips", image: "/images/roses-1.png", sortOrder: 2 },
            { name: "Orchids", slug: "orchids", description: "Sophisticated exotic orchids", image: "/images/p-orchid.png", sortOrder: 3 },
            { name: "Sunflowers", slug: "sunflowers", description: "Vibrant happy sunflowers", image: "/images/p-sunflower.png", sortOrder: 4 },
            { name: "Bouquets", slug: "bouquets", description: "Beautiful custom flower bouquets", image: "/images/roses-1.png", sortOrder: 5 }
          ],
          chocolate: [
            { name: "Chocolate Baskets", slug: "chocolate-baskets", description: "Premium chocolate gift baskets", image: "/images/p-orchid.png", sortOrder: 0 },
            { name: "Chocolate Bouquets", slug: "chocolate-bouquets", description: "Artistic chocolate arrangements", image: "/images/roses-1.png", sortOrder: 1 },
            { name: "Chocolate Gift Sets", slug: "chocolate-gift-sets", description: "Curated chocolate selections", image: "/images/p-lilly.png", sortOrder: 2 },
            { name: "Premium Chocolates", slug: "premium-chocolates", description: "Imported and hand-made chocolates", image: "/images/p-orchid.png", sortOrder: 3 }
          ],
          birthday: [
            { name: "Birthday Bouquets", slug: "birthday-bouquets", description: "Vibrant birthday arrangements", image: "/images/roses-1.png", sortOrder: 0 },
            { name: "Party Arrangements", slug: "party-arrangements", description: "Celebration floral décor", image: "/images/p-sunflower.png", sortOrder: 1 },
            { name: "Kids Birthday", slug: "kids-birthday", description: "Fun designs for children", image: "/images/roses-1.png", sortOrder: 2 },
            { name: "Birthday Cakes", slug: "birthday-cakes", description: "Delicious fresh birthday cakes", image: "/images/p-lilly.png", sortOrder: 3 },
            { name: "Birthday Combos", slug: "birthday-combos", description: "Perfect birthday gift combos", image: "/images/p-sunflower.png", sortOrder: 4 }
          ],
          anniversary: [
            { name: "Romantic Bouquets", slug: "romantic-bouquets", description: "Express love with romance", image: "/images/roses-1.png", sortOrder: 0 },
            { name: "Premium Roses", slug: "premium-roses", description: "Symbol of everlasting love", image: "/images/roses-1.png", sortOrder: 1 },
            { name: "Love Arrangements", slug: "love-arrangements", description: "Special anniversary arrangements", image: "/images/p-orchid.png", sortOrder: 2 },
            { name: "Anniversary Gifts", slug: "anniversary-gifts", description: "Heartfelt anniversary gifts", image: "/images/p-lilly.png", sortOrder: 3 },
            { name: "Anniversary Combos", slug: "anniversary-combos", description: "Love & cake combinations", image: "/images/roses-1.png", sortOrder: 4 }
          ],
          baskets: [
            { name: "Fruit Baskets", slug: "fruit-baskets", description: "Healthy fresh fruit baskets", image: "/images/p-orchid.png", sortOrder: 0 },
            { name: "Flower Baskets", slug: "flower-baskets", description: "Beautiful flower baskets", image: "/images/p-lilly.png", sortOrder: 1 },
            { name: "Mixed Baskets", slug: "mixed-baskets", description: "Assorted flowers and fruits", image: "/images/p-sunflower.png", sortOrder: 2 },
            { name: "Gift Hampers", slug: "gift-hampers", description: "Premium luxury gift hampers", image: "/images/roses-1.png", sortOrder: 3 }
          ],
          combos: [
            { name: "Combo Packs", slug: "combo-packs", description: "Great discount combo packs", image: "/images/p-sunflower.png", sortOrder: 0 },
            { name: "Birthday Combos", slug: "birthday-combos", description: "Birthday cake & bouquet combos", image: "/images/p-sunflower.png", sortOrder: 1 },
            { name: "Anniversary Combos", slug: "anniversary-combos", description: "Anniversary gift packages", image: "/images/roses-1.png", sortOrder: 2 },
            { name: "Romantic Combos", slug: "romantic-combos", description: "Love bouquets & cakes", image: "/images/roses-1.png", sortOrder: 3 },
            { name: "Special Occasion Combos", slug: "special-occasion-combos", description: "Festive celebration combos", image: "/images/p-orchid.png", sortOrder: 4 }
          ],
          plants: [
            { name: "Indoor Plants", slug: "indoor-plants", description: "Lush green indoor plants", image: "/images/p-sunflower.png", sortOrder: 0 },
            { name: "Succulents", slug: "succulents", description: "Hardy low-maintenance succulents", image: "/images/roses-1.png", sortOrder: 1 },
            { name: "Garden Plants", slug: "garden-plants", description: "Beautiful garden plants", image: "/images/p-sunflower.png", sortOrder: 2 },
            { name: "Air Purifying", slug: "air-purifying", description: "Natural air purifying plants", image: "/images/p-lilly.png", sortOrder: 3 }
          ],
          sympathy: [
            { name: "Sympathy Bouquets", slug: "sympathy-bouquets", description: "Comforting sympathy flowers", image: "/images/p-lilly.png", sortOrder: 0 },
            { name: "Condolence", slug: "condolence", description: "Peaceful condolence arrangements", image: "/images/p-lilly.png", sortOrder: 1 },
            { name: "Condolence Arrangements", slug: "condolence-arrangements", description: "Condolence arrangements", image: "/images/p-lilly.png", sortOrder: 2 },
            { name: "Memorial Flowers", slug: "memorial-flowers", description: "Loving memorial flower tributes", image: "/images/p-lilly.png", sortOrder: 3 },
            { name: "Peaceful Arrangements", slug: "peaceful-arrangements", description: "Peaceful arrangements", image: "/images/p-lilly.png", sortOrder: 4 }
          ],
          occasions: [
            { name: "Wedding", slug: "wedding", description: "Beautiful wedding arrangements", image: "/images/p-carnation.png", sortOrder: 0 },
            { name: "Graduation", slug: "graduation", description: "Joyful graduation bouquets", image: "/images/roses-1.png", sortOrder: 1 },
            { name: "Baby Shower", slug: "baby-shower", description: "Delightful baby shower flowers", image: "/images/roses-1.png", sortOrder: 2 },
            { name: "Housewarming", slug: "housewarming", description: "Welcoming housewarming gifts", image: "/images/p-sunflower.png", sortOrder: 3 },
            { name: "Congratulations", slug: "congratulations", description: "Celebratory arrangements", image: "/images/p-carnation.png", sortOrder: 4 }
          ]
        };

        // Seed children
        for (let parentSlug in subcategories) {
          const parentId = savedParents[parentSlug];
          if (parentId) {
            for (let sub of subcategories[parentSlug]) {
              await Category.create({
                name: sub.name,
                slug: sub.slug,
                description: sub.description,
                image: sub.image,
                categoryUrl: `/${parentSlug}/${sub.slug}`,
                sortOrder: sub.sortOrder,
                status: 'active',
                parentId: parentId
              });
            }
          }
        }
        console.log('Category Seeding: Default categories seeded successfully!');
      }
    } catch (err) {
      console.error('⚠️ Category seeding failed:', err);
    }

    // Update existing settings document with the new phone number if it contains the old one
    try {
      const Settings = require('./models/settings');
      const settingsDoc = await Settings.findOne();
      if (settingsDoc) {
        let updated = false;
        if (settingsDoc.footerSettings && settingsDoc.footerSettings.contactInfo && settingsDoc.footerSettings.contactInfo.phone === '+91 9849589710') {
          settingsDoc.footerSettings.contactInfo.phone = '+91 9949683222';
          settingsDoc.markModified('footerSettings.contactInfo');
          updated = true;
        }
        if (!settingsDoc.mobileBanners || settingsDoc.mobileBanners.length === 0) {
          settingsDoc.mobileBanners = [
            {
              id: "mb-1",
              title: "FREE DELIVERY!!",
              subtitle: "On eligible delivery slots",
              image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=800",
              link: "/shop",
              enabled: true,
              order: 0,
              schedulePublishStart: null,
              schedulePublishEnd: null
            },
            {
              id: "mb-2",
              title: "SAME DAY DELIVERY",
              subtitle: "Order before 6 PM",
              image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=800",
              link: "/shop",
              enabled: true,
              order: 1,
              schedulePublishStart: null,
              schedulePublishEnd: null
            }
          ];
          settingsDoc.markModified('mobileBanners');
          updated = true;
        }
        if (updated) {
          await settingsDoc.save();
          console.log('⚙️ Database Migration: Updated settings database configuration successfully');
        }
      }
    } catch (migErr) {
      console.error('⚠️ Database migration failed:', migErr);
    }

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
      // Allow custom headers used by the frontend (e.g. x-session-id)
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Session-Id', 'x-session-id'],
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
    app.use('/api/categories', require('./routes/categoryRoutes'));
    app.use('/api/social-feed', require('./routes/socialFeedRoutes'));
    app.use('/api/addons', require('./routes/addonRoutes'));
    app.use('/api/users', require('./routes/userRoutes'));
    app.use('/api/orders', require('./routes/orderRoutes'));
    app.use('/api/external', require('./routes/externalOrderRoutes'));
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
    app.use('/api/activity', require('./routes/activityRoutes'));
    app.use('/api/valentine', require('./routes/valentineRoutes'));
    app.use('/api/seasonal-campaigns', require('./routes/seasonalCampaignRoutes'));
    app.use('/api/admin', require('./routes/adminRoutes'));
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
          allowedOrigins: [...allowedOrigins]
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
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id, x-session-id');
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

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Frontend build available: ${hasFrontendBuild}`);
      console.log('CORS enabled for configured domains');
      console.log('Database: Connected to MongoDB Atlas');
      console.log(`Access the server from other devices using: http://YOUR_IP:${PORT}`);

      // Keep-alive ping to reduce Render free instance spin-down.
      const rawKeepAliveUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
      const keepAliveBaseUrl = parseAbsoluteUrl(rawKeepAliveUrl);

      if (keepAliveBaseUrl) {
        const pingUrl = new URL('/health', keepAliveBaseUrl);
        console.log(`Keep-alive service initialized for: ${keepAliveBaseUrl.origin}`);

        const pingClient = keepAliveBaseUrl.protocol === 'https:' ? https : http;
        setInterval(() => {
          pingClient.get(pingUrl, (res) => {
            if (res.statusCode === 200) {
              console.log(`[KEEP_ALIVE] Successful ping to ${pingUrl}`);
            } else {
              console.warn(`[KEEP_ALIVE] Ping to ${pingUrl} returned status: ${res.statusCode}`);
            }

            // Drain response data so sockets can be reused/closed cleanly.
            res.resume();
          }).on('error', (err) => {
            console.error(`[KEEP_ALIVE_ERROR] Ping failed for ${pingUrl}: ${err.message}`);
          });
        }, 9 * 60 * 1000); // Ping every 9 minutes
      } else if (rawKeepAliveUrl) {
        console.warn(`Keep-alive service skipped due to invalid URL: ${rawKeepAliveUrl}`);
      } else {
        console.log('Keep-alive service skipped (no RENDER_EXTERNAL_URL or APP_URL found)');
      }
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
