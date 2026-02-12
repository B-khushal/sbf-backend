const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");

// @desc    Create new review
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
      requestBody: req.body
    });

    // Enhanced validation
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

    // Validate additional ratings if provided
    const additionalRatings = [qualityRating, valueRating, deliveryRating];
    for (const additionalRating of additionalRatings) {
      if (additionalRating !== null && additionalRating !== undefined) {
        if (additionalRating < 1 || additionalRating > 5) {
          return res.status(400).json({ 
            message: "All ratings must be between 1 and 5" 
          });
        }
      }
    }

    // Validate images count
    if (images.length > 5) {
      return res.status(400).json({ 
        message: "Maximum 5 images allowed per review" 
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Check if product is hidden
    if (product.hidden) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: req.params.id
    });

    if (existingReview) {
      return res.status(400).json({ 
        message: "You have already reviewed this product" 
      });
    }

    // Check for verified purchase
    let isVerifiedPurchase = false;
    let orderId = null;

    const userOrders = await Order.find({
      user: req.user._id,
      "orderItems.product": req.params.id,
      orderStatus: "delivered"
    }).sort({ createdAt: -1 });

    if (userOrders.length > 0) {
      isVerifiedPurchase = true;
      orderId = userOrders[0]._id; // Most recent order
    }

    // Get user's IP address and device info
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const deviceInfo = req.headers['user-agent'] || '';

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
      images: images.filter(img => img && img.trim().length > 0),
      pros: pros.filter(pro => pro && pro.trim().length > 0),
      cons: cons.filter(con => con && con.trim().length > 0),
      qualityRating: qualityRating ? Number(qualityRating) : null,
      valueRating: valueRating ? Number(valueRating) : null,
      deliveryRating: deliveryRating ? Number(deliveryRating) : null,
      ipAddress,
      deviceInfo: deviceInfo.substring(0, 500), // Limit length
    };

    console.log("✅ Creating review with data:", {
      ...reviewData,
      deviceInfo: deviceInfo.substring(0, 50) + '...',
      ipAddress: ipAddress?.substring(0, 15) + '...'
    });

    const review = new Review(reviewData);
    await review.save();

    console.log("✅ Enhanced review created successfully");
    console.log("📋 Review saved with ID:", review._id);
    console.log("📊 Review data summary:", {
      id: review._id,
      product: review.product,
      user: review.user,
      rating: review.rating,
      title: review.title,
      status: review.status
    });

    // Populate user data for response
    await review.populate('user', 'name');

    res.status(201).json({
      message: "Review submitted successfully!",
      review: review,
      isVerifiedPurchase
    });

  } catch (error) {
    console.error("❌ Error creating review:", error);
    res.status(500).json({ 
      message: "Error creating review: " + error.message 
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

    // Build filter object
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

    // Build sort object
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

    // Get reviews with pagination
    const reviews = await Review.find(filter)
      .populate('user', 'name')
      .populate('response.respondedBy', 'name role')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    console.log("📋 Found reviews:", reviews.length);
    console.log("📊 Review sample:", reviews.slice(0, 2));

    // Get total count for pagination
    const totalReviews = await Review.countDocuments(filter);

    console.log("📊 Total reviews count:", totalReviews);

    // Get review statistics
    const stats = await Review.getProductReviewStats(productId);

    console.log("📊 Review stats:", stats);

    // Get helpful reviews (separate from paginated results)
    const helpfulReviews = await Review.getHelpfulReviews(productId, 3);

    console.log("✅ Reviews fetched successfully:", {
      count: reviews.length,
      total: totalReviews,
      stats: { ...stats, helpfulReviews: helpfulReviews.length }
    });

    res.json({
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

    console.log("🗳️ Voting on review:", { reviewId, userId, vote });

    if (!['helpful', 'not_helpful'].includes(vote)) {
      return res.status(400).json({ 
        message: "Vote must be 'helpful' or 'not_helpful'" 
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user is the review author
    if (review.user.toString() === userId.toString()) {
      return res.status(400).json({ 
        message: "You cannot vote on your own review" 
      });
    }

    // Check if user already voted
    const existingVoteIndex = review.votedUsers.findIndex(
      v => v.user.toString() === userId.toString()
    );

    let message = "";

    if (existingVoteIndex > -1) {
      const existingVote = review.votedUsers[existingVoteIndex];
      
      if (existingVote.vote === vote) {
        // Remove vote if same vote clicked again
        review.votedUsers.splice(existingVoteIndex, 1);
        if (vote === 'helpful') {
          review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
        }
        review.totalVotes = Math.max(0, review.totalVotes - 1);
        message = "Vote removed";
      } else {
        // Update existing vote
        existingVote.vote = vote;
        if (vote === 'helpful') {
          review.helpfulVotes += 1;
        } else {
          review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
        }
        message = "Vote updated";
      }
    } else {
      // Add new vote
      review.votedUsers.push({ user: userId, vote });
      review.totalVotes += 1;
      if (vote === 'helpful') {
        review.helpfulVotes += 1;
      }
      message = "Vote recorded";
    }

    await review.save();

    console.log("✅ Vote processed successfully:", {
      helpfulVotes: review.helpfulVotes,
      totalVotes: review.totalVotes
    });

    res.json({
      message,
      helpfulVotes: review.helpfulVotes,
      totalVotes: review.totalVotes,
      helpfulnessPercentage: review.helpfulnessPercentage,
      userVote: existingVoteIndex > -1 ? review.votedUsers[existingVoteIndex]?.vote : null
    });

  } catch (error) {
    console.error("❌ Error voting on review:", error);
    res.status(500).json({ 
      message: "Error processing vote: " + error.message 
    });
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
      pros = [],
      cons = [],
      images = []
    } = req.body;

    console.log("📝 Updating review:", { reviewId, userId });

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: "You can only update your own reviews" 
      });
    }

    // Validate input if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ 
        message: "Rating must be between 1 and 5" 
      });
    }

    if (title && (title.trim().length < 5 || title.trim().length > 100)) {
      return res.status(400).json({ 
        message: "Title must be between 5 and 100 characters" 
      });
    }

    if (comment && (comment.trim().length < 10 || comment.trim().length > 1000)) {
      return res.status(400).json({ 
        message: "Comment must be between 10 and 1000 characters" 
      });
    }

    // Update fields
    if (rating) review.rating = Number(rating);
    if (title) review.title = title.trim();
    if (comment) review.comment = comment.trim();
    if (qualityRating !== undefined) review.qualityRating = qualityRating ? Number(qualityRating) : null;
    if (valueRating !== undefined) review.valueRating = valueRating ? Number(valueRating) : null;
    if (deliveryRating !== undefined) review.deliveryRating = deliveryRating ? Number(deliveryRating) : null;
    
    review.pros = pros.filter(pro => pro && pro.trim().length > 0);
    review.cons = cons.filter(con => con && con.trim().length > 0);
    review.images = images.filter(img => img && img.trim().length > 0);

    await review.save();

    // Update product stats if rating changed
    if (rating) {
      await updateProductReviewStats(review.product);
    }

    console.log("✅ Review updated successfully");

    await review.populate('user', 'name');

    res.json({
      message: "Review updated successfully",
      review
    });

  } catch (error) {
    console.error("❌ Error updating review:", error);
    res.status(500).json({ 
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

    console.log("🗑️ Deleting review:", { reviewId, userId });

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user owns the review or is admin
    const isOwner = review.user.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        message: "You can only delete your own reviews" 
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(reviewId);

    // Update product stats
    await updateProductReviewStats(productId);

    console.log("✅ Review deleted successfully");

    res.json({ message: "Review deleted successfully" });

  } catch (error) {
    console.error("❌ Error deleting review:", error);
    res.status(500).json({ 
      message: "Error deleting review: " + error.message 
    });
  }
};

// @desc    Respond to review (Admin/Vendor)
// @route   POST /api/reviews/:id/respond
// @access  Private/Admin
const respondToReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const { responseText } = req.body;
    const userId = req.user._id;

    console.log("💬 Responding to review:", { reviewId, userId });

    if (!responseText || responseText.trim().length < 5) {
      return res.status(400).json({ 
        message: "Response must be at least 5 characters long" 
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if user is admin or vendor
    if (!['admin', 'vendor'].includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Only admins and vendors can respond to reviews" 
      });
    }

    review.response = {
      text: responseText.trim(),
      respondedBy: userId,
      respondedAt: new Date()
    };

    await review.save();
    await review.populate('response.respondedBy', 'name role');

    console.log("✅ Response added to review");

    res.json({
      message: "Response added successfully",
      response: review.response
    });

  } catch (error) {
    console.error("❌ Error responding to review:", error);
    res.status(500).json({ 
      message: "Error responding to review: " + error.message 
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

    console.log("👤 Fetching user reviews:", { userId });

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await Review.find({ user: userId })
      .populate('product', 'title images price')
      .populate('response.respondedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const totalReviews = await Review.countDocuments({ user: userId });

    console.log("✅ User reviews fetched:", { count: reviews.length });

    res.json({
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
    console.error("❌ Error fetching user reviews:", error);
    res.status(500).json({ 
      message: "Error fetching reviews: " + error.message 
    });
  }
};

// Helper function to update product review statistics
const updateProductReviewStats = async (productId) => {
  try {
    const stats = await Review.getProductReviewStats(productId);
    
    await Product.findByIdAndUpdate(productId, {
      rating: stats.averageRating || 0,
      numReviews: stats.totalReviews || 0
    });

    console.log("📊 Product stats updated:", {
      productId: productId.toString().substring(0, 8),
      rating: stats.averageRating,
      numReviews: stats.totalReviews
    });

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