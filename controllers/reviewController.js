const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");

// @desc    Create new enhanced product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    const { 
      rating, 
      title, 
      comment, 
      qualityRating, 
      valueRating, 
      deliveryRating,
      pros = [],
      cons = [],
      images = []
    } = req.body;

    console.log("🔍 Creating enhanced product review:", {
      productId: req.params.id,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      rating,
      title: title?.substring(0, 20),
      hasAdditionalRatings: !!(qualityRating || valueRating || deliveryRating),
      prosCount: Array.isArray(pros) ? pros.length : 0,
      consCount: Array.isArray(cons) ? cons.length : 0,
      imagesCount: Array.isArray(images) ? images.length : 0
    });

    // 🔒 Enhanced validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        message: "Please provide a valid rating between 1 and 5" 
      });
    }

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ 
        message: "Please provide a review title (minimum 3 characters)" 
      });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ 
        message: "Please provide a detailed comment (minimum 10 characters)" 
      });
    }

    // 📦 Validate product exists
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log("❌ Product not found:", req.params.id);
      return res.status(404).json({ message: "Product not found" });
    }

    // 🔍 Check for existing review by this user
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: req.params.id
    });

    if (existingReview) {
      console.log("❌ User already reviewed this product");
      return res.status(400).json({ 
        message: "You have already reviewed this product. You can edit your existing review." 
      });
    }

    // 🔍 Check if user has purchased this product (optional verification)
    let isVerifiedPurchase = false;
    let orderId = null;
    
    try {
      const userOrder = await Order.findOne({
        user: req.user._id,
        'items.product': req.params.id,
        status: { $in: ['delivered', 'completed'] }
      });
      
      if (userOrder) {
        isVerifiedPurchase = true;
        orderId = userOrder._id;
        console.log("✅ Verified purchase found for review");
      }
    } catch (orderCheckError) {
      console.log("⚠️ Could not verify purchase:", orderCheckError.message);
      // Continue without verification - allow all reviews
    }

    // 🔧 Clean and validate additional data
    const cleanPros = Array.isArray(pros) 
      ? pros.filter(pro => pro && typeof pro === 'string' && pro.trim().length > 0)
        .map(pro => pro.trim()).slice(0, 5) // Limit to 5 pros
      : [];

    const cleanCons = Array.isArray(cons) 
      ? cons.filter(con => con && typeof con === 'string' && con.trim().length > 0)
        .map(con => con.trim()).slice(0, 5) // Limit to 5 cons
      : [];

    const cleanImages = Array.isArray(images) 
      ? images.filter(img => img && typeof img === 'string' && img.trim().length > 0)
        .slice(0, 5) // Limit to 5 images
      : [];

    // 📝 Create new review document
    const reviewData = {
      user: req.user._id,
      product: req.params.id,
      name: req.user.name,
      email: req.user.email,
      rating: Number(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase,
      orderId,
      pros: cleanPros,
      cons: cleanCons,
      images: cleanImages,
      // Additional ratings (optional)
      qualityRating: qualityRating ? Number(qualityRating) : null,
      valueRating: valueRating ? Number(valueRating) : null,
      deliveryRating: deliveryRating ? Number(deliveryRating) : null,
      // Metadata
      deviceInfo: req.get('User-Agent') || '',
      ipAddress: req.ip || req.connection.remoteAddress || ''
    };

    console.log("💾 Saving review to database...");
    const review = new Review(reviewData);
    const savedReview = await review.save();
    
    console.log("✅ Review saved successfully:", savedReview._id);

    // 📊 Update product review statistics
    await updateProductReviewStats(req.params.id);

    // 🔄 Populate user data for response
    const populatedReview = await Review.findById(savedReview._id)
      .populate('user', 'name email')
      .lean();

    console.log("🎉 Review process completed successfully");

    res.status(201).json({ 
      success: true,
      message: "Review added successfully! Thank you for your feedback.",
      review: populatedReview,
      stats: {
        totalReviews: (await Review.countDocuments({ product: req.params.id, status: 'approved' })),
        isVerifiedPurchase,
        hasAdditionalRatings: !!(qualityRating || valueRating || deliveryRating)
      }
    });

  } catch (error) {
    console.error("❌ Error creating review:", error);
    
    // Enhanced error reporting
    let errorMessage = "Error adding review. Please try again.";
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      errorMessage = `Validation error: ${validationErrors.join(', ')}`;
    } else if (error.code === 11000) {
      errorMessage = "You have already reviewed this product.";
    } else if (error.message.includes('Cast to ObjectId')) {
      errorMessage = "Invalid product ID.";
    }

    res.status(500).json({ 
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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