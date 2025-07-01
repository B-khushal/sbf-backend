const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const mongoose = require('mongoose');

// @desc    Create new enhanced product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    console.log('🔍 Review creation started:', {
      productId: req.params.id,
      userId: req.user?._id,
      userEmail: req.user?.email,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // 🔧 DATABASE CONNECTION CHECK
    if (mongoose.connection.readyState !== 1) {
      console.log('❌ Database not connected, state:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable. Please try again in a moment.',
        error: 'DATABASE_NOT_READY'
      });
    }

    const { title, comment, rating, qualityRating, valueRating, deliveryRating, pros, cons } = req.body;
    const productId = req.params.id;

    // 🔧 COMPREHENSIVE INPUT VALIDATION
    const validationErrors = [];
    
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      validationErrors.push('Invalid product ID');
    }
    
    if (!req.user || !req.user._id) {
      validationErrors.push('User authentication required');
    }
    
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      validationErrors.push('Review title must be at least 3 characters long');
    }
    
    if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
      validationErrors.push('Review comment must be at least 3 characters long');
    }
    
    if (!rating || rating < 1 || rating > 5) {
      validationErrors.push('Rating must be between 1 and 5');
    }
    
    if (validationErrors.length > 0) {
      console.log('❌ Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    console.log('✅ Validation passed, checking product existence...');

    // Check if product exists with timeout
    const product = await Product.findById(productId)
      .maxTimeMS(5000)
      .session(session);
      
    if (!product) {
      console.log('❌ Product not found:', productId);
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    console.log('✅ Product found:', product.title);

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: req.user._id
    }).maxTimeMS(5000).session(session);

    if (existingReview) {
      console.log('❌ User already reviewed this product');
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    console.log('✅ No existing review found, creating new review...');

    // Create the review with comprehensive data
    const reviewData = {
      product: productId,
      user: req.user._id,
      name: req.user.name,
      title: title.trim(),
      comment: comment.trim(),
      rating: Number(rating),
      qualityRating: qualityRating ? Number(qualityRating) : undefined,
      valueRating: valueRating ? Number(valueRating) : undefined,
      deliveryRating: deliveryRating ? Number(deliveryRating) : undefined,
      pros: Array.isArray(pros) ? pros.filter(p => p && p.trim()) : [],
      cons: Array.isArray(cons) ? cons.filter(c => c && c.trim()) : [],
      status: 'pending', // Reviews need approval
      isVerifiedPurchase: false, // TODO: Check if user purchased this product
      helpfulVotes: 0,
      totalVotes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📝 Creating review with data:', reviewData);

    const review = new Review(reviewData);
    const savedReview = await review.save({ session });

    console.log('✅ Review saved to database:', savedReview._id);

    await session.commitTransaction();
    console.log('✅ Transaction committed successfully');

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully and is pending approval',
      review: {
        _id: savedReview._id,
        title: savedReview.title,
        comment: savedReview.comment,
        rating: savedReview.rating,
        status: savedReview.status,
        createdAt: savedReview.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Review creation error:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      productId: req.params.id,
      userId: req.user?._id,
      timestamp: new Date().toISOString()
    });

    // Rollback transaction
    try {
      await session.abortTransaction();
    } catch (rollbackError) {
      console.error('❌ Transaction rollback failed:', rollbackError);
    }

    // Handle specific error types
    let statusCode = 500;
    let message = 'Failed to create review';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Invalid review data';
    } else if (error.name === 'MongoTimeoutError') {
      statusCode = 503;
      message = 'Database timeout. Please try again.';
    } else if (error.name === 'MongoNetworkError') {
      statusCode = 503;
      message = 'Database connection issue. Please try again.';
    } else if (error.code === 11000) {
      statusCode = 400;
      message = 'Duplicate review detected';
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error.name || 'UnknownError',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message 
      })
    });
  } finally {
    await session.endSession();
  }
};

// @desc    Get reviews for a product with advanced filtering
// @route   GET /api/products/:id/reviews
// @access  Public
const getProductReviews = async (req, res) => {
  try {
    const productId = req.params.id;
    const { 
      page = 1, 
      limit = 10,
      sort = 'newest',
      rating,
      verified,
      withImages
    } = req.query;

    console.log("🔍 Fetching product reviews:", {
      productId,
      filters: { sort, rating, verified, withImages }
    });

    // 🔧 Build filter object
    const filter = { 
      product: productId, 
      status: 'approved' 
    };

    if (rating) {
      filter.rating = Number(rating);
    }

    if (verified === 'true') {
      filter.isVerifiedPurchase = true;
    }

    if (withImages === 'true') {
      filter.images = { $exists: true, $ne: [] };
    }

    // 🔧 Build sort object
    let sortObj = {};
    switch (sort) {
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'highest_rating':
        sortObj = { rating: -1, createdAt: -1 };
        break;
      case 'lowest_rating':
        sortObj = { rating: 1, createdAt: -1 };
        break;
      case 'most_helpful':
        sortObj = { helpfulVotes: -1, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    const skip = (Number(page) - 1) * Number(limit);

    console.log("🔍 Review filter:", filter);
    console.log("🔍 Review sort:", sortObj);

    // 📊 Get reviews with pagination
    const [reviews, totalReviews, stats] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name')
        .populate('response.respondedBy', 'name role')
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Review.countDocuments(filter),
      Review.getProductReviewStats(productId)
    ]);

    console.log("📋 Found reviews:", reviews.length);
    console.log("📊 Total reviews count:", totalReviews);

    // 🌟 Get helpful reviews (separate from paginated results)
    const helpfulReviews = await Review.getHelpfulReviews(productId, 3);

    console.log("✅ Reviews fetched successfully:", {
      count: reviews.length,
      total: totalReviews,
      stats: { ...stats, helpfulReviews: helpfulReviews.length }
    });

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / Number(limit)),
        totalReviews,
        hasNext: skip + reviews.length < totalReviews,
        hasPrev: Number(page) > 1
      },
      stats,
      helpfulReviews,
      filters: {
        available: {
          ratings: [5, 4, 3, 2, 1],
          verified: ['true', 'false'],
          withImages: ['true', 'false']
        },
        applied: { sort, rating, verified, withImages }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching reviews:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching reviews: " + error.message 
    });
  }
};

// @desc    Vote on review helpfulness
// @route   POST /api/reviews/:id/vote
// @access  Private
const voteOnReview = async (req, res) => {
  try {
    const { vote } = req.body; // 'helpful' or 'not_helpful'
    const reviewId = req.params.id;
    const userId = req.user._id;

    if (!['helpful', 'not_helpful'].includes(vote)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user already voted
    const existingVote = review.votedUsers.find(v => v.user.toString() === userId.toString());
    
    if (existingVote) {
      // Update existing vote
      if (existingVote.vote === 'helpful' && vote === 'not_helpful') {
        review.helpfulVotes -= 1;
      } else if (existingVote.vote === 'not_helpful' && vote === 'helpful') {
        review.helpfulVotes += 1;
      }
      existingVote.vote = vote;
    } else {
      // Add new vote
      review.votedUsers.push({ user: userId, vote });
      review.totalVotes += 1;
      if (vote === 'helpful') {
        review.helpfulVotes += 1;
      }
    }

    await review.save();

    res.json({
      message: 'Vote recorded successfully',
      helpfulVotes: review.helpfulVotes,
      totalVotes: review.totalVotes,
      helpfulnessPercentage: review.helpfulnessPercentage
    });

  } catch (error) {
    console.error('Error voting on review:', error);
    res.status(500).json({ message: 'Error recording vote' });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
const updateReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user._id;
    const { 
      rating, 
      title, 
      comment, 
      qualityRating, 
      valueRating, 
      deliveryRating,
      pros,
      cons,
      images
    } = req.body;

    console.log("🔄 Updating review:", reviewId);

    const review = await Review.findOne({
      _id: reviewId,
      user: userId // Ensure user can only update their own review
    });

    if (!review) {
      return res.status(404).json({ 
        message: 'Review not found or you do not have permission to edit it' 
      });
    }

    // Update fields if provided
    if (rating) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      review.rating = Number(rating);
    }

    if (title) {
      if (title.trim().length < 3) {
        return res.status(400).json({ message: 'Title must be at least 3 characters' });
      }
      review.title = title.trim();
    }

    if (comment) {
      if (comment.trim().length < 10) {
        return res.status(400).json({ message: 'Comment must be at least 10 characters' });
      }
      review.comment = comment.trim();
    }

    if (qualityRating !== undefined) {
      review.qualityRating = qualityRating ? Number(qualityRating) : null;
    }

    if (valueRating !== undefined) {
      review.valueRating = valueRating ? Number(valueRating) : null;
    }

    if (deliveryRating !== undefined) {
      review.deliveryRating = deliveryRating ? Number(deliveryRating) : null;
    }

    if (pros) {
      review.pros = pros.filter(pro => pro && pro.trim().length > 0);
    }

    if (cons) {
      review.cons = cons.filter(con => con && con.trim().length > 0);
    }

    if (images) {
      review.images = images.filter(img => img && img.trim().length > 0);
    }

    await review.save();

    // Update product stats if rating changed
    if (rating) {
      await updateProductReviewStats(review.product);
    }

    console.log("✅ Review updated successfully");

    await review.populate('user', 'name');

    res.json({
      success: true,
      message: "Review updated successfully",
      review
    });

  } catch (error) {
    console.error("❌ Error updating review:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating review: " + error.message 
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
const deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user._id;

    console.log("🗑️ Deleting review:", reviewId);

    const review = await Review.findOne({
      _id: reviewId,
      user: userId // Ensure user can only delete their own review
    });

    if (!review) {
      return res.status(404).json({ 
        message: 'Review not found or you do not have permission to delete it' 
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    // Update product stats
    await updateProductReviewStats(productId);

    console.log("✅ Review deleted successfully");

    res.json({
      success: true,
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting review:", error);
    res.status(500).json({ 
      success: false,
      message: "Error deleting review: " + error.message 
    });
  }
};

// @desc    Respond to review (Admin/Vendor)
// @route   POST /api/reviews/:id/respond
// @access  Private/Admin
const respondToReview = async (req, res) => {
  try {
    const { responseText } = req.body;
    const reviewId = req.params.id;

    if (!responseText || responseText.trim().length < 10) {
      return res.status(400).json({ 
        message: 'Response must be at least 10 characters long' 
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.response = {
      text: responseText.trim(),
      respondedBy: req.user._id,
      respondedAt: new Date()
    };

    await review.save();
    await review.populate('response.respondedBy', 'name role');

    res.json({
      success: true,
      message: 'Response added successfully',
      response: review.response
    });

  } catch (error) {
    console.error('Error responding to review:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error adding response' 
    });
  }
};

// @desc    Get user's reviews
// @route   GET /api/reviews/my-reviews
// @access  Private
const getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, totalReviews] = await Promise.all([
      Review.find({ user: userId })
        .populate('product', 'title images price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Review.countDocuments({ user: userId })
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / Number(limit)),
        totalReviews,
        hasNext: skip + reviews.length < totalReviews,
        hasPrev: Number(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching your reviews' 
    });
  }
};

// 📊 Helper function to update product review statistics
const updateProductReviewStats = async (productId) => {
  try {
    console.log("📊 Updating product review stats for:", productId);
    
    const stats = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        numReviews: stats[0].totalReviews,
        rating: Math.round(stats[0].averageRating * 10) / 10 // Round to 1 decimal
      });
      console.log("✅ Product stats updated:", stats[0]);
    } else {
      // No approved reviews, reset stats
      await Product.findByIdAndUpdate(productId, {
        numReviews: 0,
        rating: 0
      });
      console.log("✅ Product stats reset (no reviews)");
    }
  } catch (error) {
    console.error("❌ Error updating product stats:", error);
  }
};

module.exports = {
  createProductReview,
  getProductReviews,
  voteOnReview,
  updateReview,
  deleteReview,
  respondToReview,
  getUserReviews,
  updateProductReviewStats
}; 