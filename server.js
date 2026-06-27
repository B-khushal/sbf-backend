const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const net = require('net');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '.env') });
  console.log('📝 Development environment detected: loaded local .env file.');
} else {
  console.log('🌐 Production environment (VPS) detected: reading environment variables directly from system/process env.');
}

// Global Safety Nets to prevent background library errors from crashing the Express server
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception caught to prevent server crash:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const checkPort = (host, port, timeout = 1500) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'closed';
    
    socket.setTimeout(timeout);
    
    socket.connect(port, host, () => {
      status = 'open';
      socket.end();
    });
    
    socket.on('timeout', () => {
      status = 'timeout (possibly blocked by firewall)';
      socket.destroy();
    });
    
    socket.on('error', (err) => {
      status = `error: ${err.message}`;
      socket.destroy();
    });
    
    socket.on('close', () => {
      resolve({ port, status });
    });
  });
};

const runSMTPDiagnostics = async () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER || '2006sbf@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  
  console.log('\n📧 ===================================================');
  console.log('📧 SMTP CONFIGURATION DIAGNOSTICS & AUDIT');
  console.log('📧 ===================================================');
  console.log(`📧 Host: ${host}`);
  console.log(`📧 Port: ${port}`);
  console.log(`📧 Secure: ${secure}`);
  console.log(`📧 User: ${user}`);
  console.log(`📧 Password: ${pass ? '******** (configured)' : 'NOT CONFIGURED'}`);
  console.log(`📧 Email From: ${process.env.EMAIL_FROM || 'NOT CONFIGURED'}`);
  console.log(`📧 Frontend URL: ${process.env.FRONTEND_URL || 'NOT CONFIGURED'}`);
  console.log('📧 ===================================================');

  // Verify SMTP Connection
  let primarySuccess = false;
  try {
    const { getTransporter } = require('./services/emailService');
    console.log(`🔌 Verifying SMTP transporter connection on configured Port ${port}...`);
    const transporter = getTransporter();
    
    await new Promise((resolve) => {
      transporter.verify((error, success) => {
        if (error) {
          console.error(`❌ SMTP Connection Failed on primary configured Port ${port} during startup verification:`, error.message);
          primarySuccess = false;
        } else {
          console.log(`✅ SMTP Server Ready on primary configured Port ${port} & verified successfully!`);
          primarySuccess = true;
        }
        resolve();
      });
    });
  } catch (err) {
    console.error('❌ Failed to initialize/verify SMTP transporter during startup:', err);
    console.error('Error stack:', err.stack);
  }

  // If primary verification failed, test fallback port immediately to help developers configure production VPS correctly
  if (!primarySuccess) {
    const fallbackPort = port === 587 ? 465 : 587;
    const fallbackSecure = fallbackPort === 465;
    console.log(`\n🔌 Primary Port ${port} failed. Auto-testing fallback Port ${fallbackPort} (Secure=${fallbackSecure})...`);
    
    try {
      const nodemailer = require('nodemailer');
      const fallbackTransporter = nodemailer.createTransport({
        host,
        port: fallbackPort,
        secure: fallbackSecure,
        auth: {
          user,
          pass: pass || ""
        }
      });
      
      await new Promise((resolve) => {
        fallbackTransporter.verify((error, success) => {
          if (error) {
            console.error(`❌ Fallback SMTP Connection on Port ${fallbackPort} also failed:`, error.message);
          } else {
            console.log(`💡 SUCCESS! Fallback SMTP connection succeeded on Port ${fallbackPort}!`);
            console.log(`💡 RECOMMENDATION: Set VPS environment variables to SMTP_PORT=${fallbackPort} and SMTP_SECURE=${fallbackSecure}\n`);
          }
          resolve();
        });
      });
    } catch (err) {
      console.error(`❌ Failed to test fallback SMTP Port ${fallbackPort}:`, err.message);
    }
  }

  // Firewall Test on Ports 465, 587, 2525
  console.log('🛡️ Testing firewall connectivity to SMTP host:', host);
  const testPorts = [465, 587, 2525];
  for (const portToCheck of testPorts) {
    console.log(`🛡️ Checking port ${portToCheck}...`);
    const result = await checkPort(host, portToCheck);
    if (result.status === 'open') {
      console.log(`🛡️ Port ${portToCheck}: ✅ OPEN`);
    } else {
      console.warn(`🛡️ Port ${portToCheck}: ❌ CLOSED or BLOCKED (${result.status})`);
    }
  }
  console.log('📧 ===================================================\n');
};

const testPDFGenerationOnStartup = async () => {
  console.log('📄 Testing PDF invoice generation functionality...');
  try {
    const { generateInvoiceHTML, generateInvoicePDF } = require('./services/emailNotificationService');
    const sampleOrderData = {
      order: {
        orderNumber: 'TEST-STARTUP',
        totalAmount: 100,
        currency: 'INR',
        createdAt: new Date(),
        items: []
      },
      customer: {
        name: 'Startup Test',
        email: 'test@example.com'
      }
    };
    const html = generateInvoiceHTML(sampleOrderData);
    await generateInvoicePDF(html, 'TEST-STARTUP');
    console.log('✅ PDF invoice generation verified successfully on this machine!');
  } catch (err) {
    console.error('❌ PDF invoice generation FAILED on startup check:', err.message);
    if (err.stack) {
      console.error('❌ PDF Error Stack:', err.stack);
    }
  }
};

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

    // Run SMTP Diagnostics & Firewall check
    try {
      await runSMTPDiagnostics();
    } catch (smtpDiagErr) {
      console.error('❌ Failed to run SMTP diagnostics:', smtpDiagErr);
    }

    // Run PDF Generation Test
    try {
      await testPDFGenerationOnStartup();
    } catch (pdfTestErr) {
      console.error('❌ Failed to run startup PDF check:', pdfTestErr);
    }

    // Initialize default seasonal campaigns
    try {
      const SeasonalCampaign = require('./models/SeasonalCampaign');
      await SeasonalCampaign.seedDefaultCampaigns();
    } catch (campaignSeedErr) {
      console.error('⚠️ Seasonal Campaign seeding failed:', campaignSeedErr);
    }

    // Initialize default delivery settings and zones
    try {
      const DeliverySetting = require('./models/DeliverySetting');
      await DeliverySetting.getSettings();
      
      const DeliveryZone = require('./models/DeliveryZone');
      const zoneCount = await DeliveryZone.countDocuments();
      if (zoneCount === 0) {
        console.log('🌱 Seeding default delivery zones...');
        await DeliveryZone.create({
          name: 'Mehdipatnam Core',
          city: 'Hyderabad',
          boundary: {
            type: 'Polygon',
            coordinates: [[
              [78.4200, 17.3850],
              [78.4500, 17.3850],
              [78.4500, 17.4050],
              [78.4200, 17.4050],
              [78.4200, 17.3850]
            ]]
          },
          baseDeliveryCharge: 150,
          isActive: true
        });
        console.log('✅ Default delivery zone seeded successfully');
      }
    } catch (deliverySeedErr) {
      console.error('⚠️ Delivery settings seeding failed:', deliverySeedErr.message);
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
        // Migration to add default video_section if missing
        if (settingsDoc.homeSections && !settingsDoc.homeSections.some(s => s.type === 'video_section')) {
          console.log('🌱 Migrating database: Adding video_section to homeSections...');
          settingsDoc.homeSections.push({
            id: 'video_section',
            type: 'video_section',
            enabled: true,
            order: 4.5,
            title: '🎥 Premium Floral Showcase',
            subtitle: 'Experience the art of floristry and gifting through our vertical showcase reels',
            visibility: { desktop: true, tablet: true, mobile: true },
            styling: { background: '', padding: 'py-16', spacing: 'mb-0', animation: 'fadeIn' }
          });
          settingsDoc.homeSections.sort((a, b) => a.order - b.order);
          settingsDoc.markModified('homeSections');
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

    // Seed default vertical videos if none exist in HomepageVideo collection
    try {
      const HomepageVideo = require('./models/HomepageVideo');
      const videoCount = await HomepageVideo.countDocuments({ deletedAt: null });
      if (videoCount === 0) {
        console.log('🌱 Seeding default vertical videos...');
        await HomepageVideo.create([
          {
            title: "Art of Bouquet Making",
            description: "Watch our master florists assemble our signature luxury rose arrangements with meticulous attention.",
            videoUrl: "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c0227e339d3328e1d51c144fb6b45f47&profile_id=139&oauth2_token_id=57447761",
            thumbnailUrl: "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&auto=format&fit=crop&q=80",
            ctaText: "Order Bouquet",
            ctaLink: "/shop?category=bouquets",
            displayOrder: 0,
            isFeatured: true,
            isActive: true
          },
          {
            title: "Premium Gifting Experience",
            description: "Discover our luxurious gift wrapping, custom greeting cards, and secure signature delivery boxes.",
            videoUrl: "https://player.vimeo.com/external/435674703.sd.mp4?s=7fdf1eb105d1c2512f455325c898a12e2c56a2ff&profile_id=139&oauth2_token_id=57447761",
            thumbnailUrl: "https://images.unsplash.com/photo-1520763185298-1b434c919102?w=600&auto=format&fit=crop&q=80",
            ctaText: "Shop Gifts",
            ctaLink: "/shop",
            displayOrder: 1,
            isFeatured: false,
            isActive: true
          },
          {
            title: "Midnight Anniversary Delivery",
            description: "Double the surprise right at 12:00 AM. Delivering sweet memories and fresh red roses across Hyderabad.",
            videoUrl: "https://player.vimeo.com/external/403823616.sd.mp4?s=d00af45c928e11a2f643e9c9cfa7b3e1d1373e2d&profile_id=139&oauth2_token_id=57447761",
            thumbnailUrl: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=600&auto=format&fit=crop&q=80",
            ctaText: "Surprise Now",
            ctaLink: "/shop?category=roses",
            displayOrder: 2,
            isFeatured: true,
            isActive: true
          }
        ]);
        console.log('✅ Vertical videos seeded successfully');
      }
    } catch (videoSeedErr) {
      console.error('⚠️ Video seeding failed:', videoSeedErr);
    }

    initEmailService();

    const app = express();
    app.set('trust proxy', 1);

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

    // Security headers via helmet
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "https:", "http:"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://accounts.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com", "https:", "http:"],
          frameSrc: ["'self'", "https://checkout.razorpay.com", "https://player.vimeo.com", "https://accounts.google.com"],
          connectSrc: ["'self'", "https:", "http:", "wss:", "ws:"],
        }
      },
      frameguard: { action: 'deny' },
    }));

    // Global Rate Limiter: 60 requests per minute
    const globalLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      message: { message: 'Too many requests. Please try again in a minute.' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', globalLimiter);

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(morgan('dev', {
      skip: (req) => req.method === 'GET' && req.originalUrl.startsWith('/api/notifications'),
    }));

    app.use('/api/products', require('./routes/productRoutes'));
    app.use('/api/categories', require('./routes/categoryRoutes'));
    app.use('/api/social-feed', require('./routes/socialFeedRoutes'));
    app.use('/api/homepage-videos', require('./routes/homepageVideoRoutes'));
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
    app.use('/api/delivery', require('./routes/deliveryRoutes'));
    app.use('/api/staff', require('./routes/staffRoutes'));
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

    app.get('*', async (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }

      // Intercept product routes to inject dynamic preview metadata
      const productRoutePattern = /^\/(product|products|valentine-product)\/([^/]+)$/;
      const match = req.path.match(productRoutePattern);
      
      if (match) {
        try {
          const { getSharePreview } = require('./controllers/productController');
          req.params.type = match[1];
          req.params.idOrSlug = match[2];
          return await getSharePreview(req, res);
        } catch (err) {
          console.error('Error redirecting to getSharePreview in server.js:', err);
        }
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
