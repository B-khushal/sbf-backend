const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://sbflorist.in',
    'https://www.sbflorist.in'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user'
  };
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Development server is healthy',
    timestamp: new Date().toISOString(),
    environment: 'development',
  });
});

// Mock review submission endpoint
app.post('/api/products/:id/reviews', mockAuth, (req, res) => {
  console.log('🔍 Mock Review Submission:', {
    productId: req.params.id,
    userId: req.user._id,
    userName: req.user.name,
    reviewData: req.body
  });

  const { rating, title, comment, qualityRating, valueRating, deliveryRating, pros, cons } = req.body;

  // Validate input
  if (!rating || !title || !comment) {
    return res.status(400).json({ 
      message: "Rating, title, and comment are required" 
    });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ 
      message: "Rating must be between 1 and 5" 
    });
  }

  if (title.trim().length < 5 || title.trim().length > 100) {
    return res.status(400).json({ 
      message: "Title must be between 5 and 100 characters" 
    });
  }

  if (comment.trim().length < 10 || comment.trim().length > 1000) {
    return res.status(400).json({ 
      message: "Comment must be between 10 and 1000 characters" 
    });
  }

  // Mock successful response
  const mockReview = {
    _id: Math.random().toString(36).substr(2, 9),
    user: req.user._id,
    product: req.params.id,
    name: req.user.name,
    rating: Number(rating),
    title: title.trim(),
    comment: comment.trim(),
    qualityRating: qualityRating ? Number(qualityRating) : null,
    valueRating: valueRating ? Number(valueRating) : null,
    deliveryRating: deliveryRating ? Number(deliveryRating) : null,
    pros: pros ? pros.filter(pro => pro && pro.trim().length > 0) : [],
    cons: cons ? cons.filter(con => con && con.trim().length > 0) : [],
    isVerifiedPurchase: true,
    helpfulVotes: 0,
    totalVotes: 0,
    createdAt: new Date().toISOString(),
    status: 'approved'
  };

  console.log('✅ Mock review created successfully:', mockReview);

  res.status(201).json({
    message: "Review submitted successfully! (Development Mode)",
    review: mockReview,
    isVerifiedPurchase: true,
    note: "This is a mock response for development testing"
  });
});

// Mock get reviews endpoint
app.get('/api/products/:id/reviews', (req, res) => {
  console.log('🔍 Mock Get Reviews for product:', req.params.id);

  const mockReviews = [
    {
      _id: 'mock-review-1',
      user: { _id: '507f1f77bcf86cd799439011', name: 'Previous Customer' },
      name: 'Previous Customer',
      rating: 5,
      title: 'Great product!',
      comment: 'Really loved this product. High quality and fast delivery.',
      isVerifiedPurchase: true,
      helpfulVotes: 3,
      totalVotes: 4,
      helpfulnessPercentage: 75,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      pros: ['Great quality', 'Fast delivery'],
      cons: []
    }
  ];

  const mockStats = {
    totalReviews: 1,
    averageRating: 5,
    verifiedPurchases: 1,
    verifiedPurchasePercentage: 100,
    ratingDistribution: {
      5: 1,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }
  };

  res.json({
    reviews: mockReviews,
    stats: mockStats,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalReviews: 1,
      hasNext: false,
      hasPrev: false
    }
  });
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  console.log(`🔍 Unhandled API route: ${req.method} ${req.path}`);
  res.status(404).json({ 
    message: 'API endpoint not found in development server',
    availableEndpoints: [
      'GET /health',
      'POST /api/products/:id/reviews',
      'GET /api/products/:id/reviews'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'SBF Development Server (No Database)',
    version: '1.0.0-dev',
    timestamp: new Date().toISOString(),
    note: 'This is a mock server for testing without MongoDB'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Development Server running on port ${PORT}`);
  console.log(`🔧 Environment: Development (No Database)`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 CORS enabled for development`);
  console.log(`✅ Ready to test review submission!`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
}); 