const Review = require("../models/Review");
const ReviewImage = require("../models/ReviewImage");
const ReviewLike = require("../models/ReviewLike");
const ReviewReply = require("../models/ReviewReply");
const ReviewEmailLog = require("../models/ReviewEmailLog");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { createAdminNotification } = require("./notificationController");
const {
  MAX_REVIEW_IMAGES,
  buildReviewPublicUrl,
  deleteReviewRelations,
  enrichReviews,
  enrichSingleReview,
  getEligibleDeliveredOrders,
  getProductGalleryImages,
  resolveEligibleReviewOrder,
  sanitizeImageUrls,
  sanitizeStringArray,
  syncReviewImages,
  updateProductReviewStats,
} = require("../services/reviewDomainService");
const {
  sendReviewReplyNotification,
  sendReviewRequestEmail,
} = require("../services/reviewEmailService");

const REVIEW_SORTS = {
  latest: { pinned: -1, featured: -1, createdAt: -1 },
  newest: { pinned: -1, featured: -1, createdAt: -1 },
  highest_rating: { pinned: -1, featured: -1, rating: -1, createdAt: -1 },
  lowest_rating: { pinned: -1, featured: -1, rating: 1, createdAt: -1 },
  most_helpful: { pinned: -1, featured: -1, helpfulVotes: -1, createdAt: -1 },
};

const validateReviewPayload = ({
  rating,
  title,
  comment,
  qualityRating,
  valueRating,
  deliveryRating,
  pros,
  cons,
  images,
}) => {
  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    return "Rating must be between 1 and 5.";
  }

  if (!title || title.trim().length < 4 || title.trim().length > 100) {
    return "Title must be between 4 and 100 characters.";
  }

  if (!comment || comment.trim().length < 10 || comment.trim().length > 1500) {
    return "Review text must be between 10 and 1500 characters.";
  }

  const extraRatings = [qualityRating, valueRating, deliveryRating];
  const hasInvalidExtraRating = extraRatings.some(
    (value) => value !== null && value !== undefined && (Number(value) < 1 || Number(value) > 5)
  );

  if (hasInvalidExtraRating) {
    return "Additional ratings must be between 1 and 5.";
  }

  if (Array.isArray(images) && images.length > MAX_REVIEW_IMAGES) {
    return `You can upload up to ${MAX_REVIEW_IMAGES} review images.`;
  }

  if (Array.isArray(pros) && pros.length > 8) {
    return "You can add up to 8 highlights.";
  }

  if (Array.isArray(cons) && cons.length > 8) {
    return "You can add up to 8 concerns.";
  }

  return null;
};

const getViewerReviewState = async (userId, productId) => {
  if (!userId) {
    return {
      canReview: false,
      eligibleOrders: [],
      ownReviews: [],
    };
  }

  const [eligibleOrders, ownReviews] = await Promise.all([
    getEligibleDeliveredOrders(userId, productId),
    Review.find({ user: userId, product: productId })
      .select("orderId status rating createdAt updatedAt title")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return {
    canReview: eligibleOrders.some((order) => !order.hasReview),
    eligibleOrders,
    ownReviews,
  };
};

const createProductReview = async (req, res) => {
  try {
    const {
      rating,
      title,
      comment,
      qualityRating,
      valueRating,
      deliveryRating,
      orderId,
      source = "product_page",
    } = req.body;

    const pros = sanitizeStringArray(req.body.pros, { maxItems: 8, maxLength: 180 });
    const cons = sanitizeStringArray(req.body.cons, { maxItems: 8, maxLength: 180 });
    const images = sanitizeImageUrls(req.body.images);

    const validationMessage = validateReviewPayload({
      rating,
      title,
      comment,
      qualityRating,
      valueRating,
      deliveryRating,
      pros,
      cons,
      images,
    });

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const product = await Product.findById(req.params.id).select("title hidden");
    if (!product || product.hidden) {
      return res.status(404).json({ message: "Product not found." });
    }

    const reviewOrder = await resolveEligibleReviewOrder({
      userId: req.user._id,
      productId: req.params.id,
      requestedOrderId: orderId,
    });

    if (!reviewOrder.selectedOrder) {
      const reasonMessages = {
        NO_DELIVERED_ORDER: "Only customers with a delivered purchase can review this product.",
        ORDER_NOT_ELIGIBLE: "That order is not eligible for reviewing this product.",
        DUPLICATE_REVIEW: "You have already reviewed this order for this product.",
      };

      return res.status(403).json({
        message: reasonMessages[reviewOrder.reason] || "You are not allowed to review this product.",
        eligibleOrders: reviewOrder.eligibleOrders,
      });
    }

    const duplicateReview = await Review.findOne({
      user: req.user._id,
      product: req.params.id,
      orderId: reviewOrder.selectedOrder._id,
    }).select("_id");

    if (duplicateReview) {
      return res.status(409).json({
        message: "A review already exists for this order and product.",
      });
    }

    const review = await Review.create({
      user: req.user._id,
      product: req.params.id,
      orderId: reviewOrder.selectedOrder._id,
      name: req.user.name,
      email: req.user.email,
      rating: Number(rating),
      title: title.trim(),
      comment: comment.trim(),
      isVerifiedPurchase: true,
      status: "pending",
      images,
      imageCount: images.length,
      pros,
      cons,
      qualityRating: qualityRating ? Number(qualityRating) : null,
      valueRating: valueRating ? Number(valueRating) : null,
      deliveryRating: deliveryRating ? Number(deliveryRating) : null,
      deviceInfo: String(req.headers["user-agent"] || "").slice(0, 500),
      ipAddress: String(req.ip || req.connection?.remoteAddress || "").slice(0, 120),
      source: ["product_page", "product_reviews_page", "order_history", "review_email"].includes(source)
        ? source
        : "product_page",
      lastActivityAt: new Date(),
    });

    await syncReviewImages({
      reviewId: review._id,
      productId: review.product,
      imageUrls: images,
      productTitle: product.title,
    });

    const savedReview = await Review.findById(review._id).populate("user", "name role");
    const enrichedReview = await enrichSingleReview(savedReview, req.user._id);
    const viewer = await getViewerReviewState(req.user._id, req.params.id);

    await createAdminNotification({
      type: "admin",
      title: "New Review Awaiting Approval",
      message: `${req.user.name} submitted a ${rating}-star review for ${product.title}.`,
      metadata: {
        reviewId: review._id,
        productId: product._id,
        productTitle: product.title,
        orderId: review.orderId,
        customerId: req.user._id,
      },
    });

    return res.status(201).json({
      message: "Review submitted successfully and is now awaiting approval.",
      review: enrichedReview,
      viewer,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return res.status(500).json({
      message: "Unable to submit the review right now.",
      error: error.message,
    });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      page = 1,
      limit = 10,
      sort = "latest",
      rating,
      verified,
      withImages,
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(20, Math.max(1, Number(limit) || 10));
    const skip = (numericPage - 1) * pageSize;

    const product = await Product.findById(productId).select("title images rating numReviews hidden");
    if (!product || product.hidden) {
      return res.status(404).json({ message: "Product not found." });
    }

    const filter = {
      product: productId,
      status: "approved",
    };

    if (rating) {
      filter.rating = Number(rating);
    }

    if (verified === "true") {
      filter.isVerifiedPurchase = true;
    }

    if (withImages === "true") {
      filter.imageCount = { $gt: 0 };
    }

    const totalReviews = await Review.countDocuments(filter);

    const reviews = await Review.find(filter)
      .populate("user", "name role")
      .sort(REVIEW_SORTS[sort] || REVIEW_SORTS.latest)
      .skip(skip)
      .limit(pageSize);

    const [enrichedReviews, featuredRawReviews, helpfulRawReviews, stats, galleryImages, viewer] =
      await Promise.all([
        enrichReviews(reviews, req.user?._id),
        Review.find({
          product: productId,
          status: "approved",
          $or: [{ pinned: true }, { featured: true }],
        })
          .populate("user", "name role")
          .sort({ pinned: -1, featured: -1, helpfulVotes: -1, createdAt: -1 })
          .limit(4),
        Review.find({
          product: productId,
          status: "approved",
        })
          .populate("user", "name role")
          .sort({ helpfulVotes: -1, createdAt: -1 })
          .limit(4),
        Review.getProductReviewStats(productId),
        getProductGalleryImages(productId),
        req.user ? getViewerReviewState(req.user._id, productId) : Promise.resolve(null),
      ]);

    const [featuredReviews, helpfulReviews] = await Promise.all([
      enrichReviews(featuredRawReviews, req.user?._id),
      enrichReviews(helpfulRawReviews, req.user?._id),
    ]);

    return res.json({
      product: {
        _id: product._id,
        title: product.title,
        primaryImage: product.images?.[0] || "",
      },
      stats,
      galleryImages,
      featuredReviews,
      helpfulReviews,
      reviews: enrichedReviews,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.max(1, Math.ceil(totalReviews / pageSize)),
        totalReviews,
        pageSize,
        hasNext: skip + enrichedReviews.length < totalReviews,
        hasPrev: numericPage > 1,
      },
      viewer,
      filters: {
        applied: {
          sort,
          rating: rating ? Number(rating) : null,
          verified: verified === "true",
          withImages: withImages === "true",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return res.status(500).json({
      message: "Unable to load product reviews right now.",
      error: error.message,
    });
  }
};

const getReviewEligibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select("title hidden");
    if (!product || product.hidden) {
      return res.status(404).json({ message: "Product not found." });
    }

    const viewer = await getViewerReviewState(req.user._id, req.params.id);
    return res.json({
      product: {
        _id: product._id,
        title: product.title,
      },
      viewer,
    });
  } catch (error) {
    console.error("Error fetching review eligibility:", error);
    return res.status(500).json({
      message: "Unable to load review eligibility right now.",
      error: error.message,
    });
  }
};

const toggleReviewLike = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).select(
      "_id user status helpfulVotes totalVotes"
    );

    if (!review || !["approved", "pending", "rejected"].includes(review.status)) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (String(review.user) === String(req.user._id)) {
      return res.status(400).json({
        message: "You cannot mark your own review as helpful.",
      });
    }

    const existingLike = await ReviewLike.findOne({
      review: review._id,
      user: req.user._id,
    });

    let liked = false;
    if (existingLike) {
      await existingLike.deleteOne();
      review.helpfulVotes = Math.max(0, (review.helpfulVotes || 0) - 1);
      review.totalVotes = Math.max(0, (review.totalVotes || 0) - 1);
    } else {
      await ReviewLike.create({
        review: review._id,
        user: req.user._id,
        reactionType: "helpful",
      });
      review.helpfulVotes = (review.helpfulVotes || 0) + 1;
      review.totalVotes = (review.totalVotes || 0) + 1;
      liked = true;
    }

    await review.save();

    return res.json({
      message: liked ? "Marked as helpful." : "Helpful reaction removed.",
      liked,
      helpfulVotes: review.helpfulVotes,
      totalVotes: review.totalVotes,
      helpfulnessPercentage: review.helpfulnessPercentage,
    });
  } catch (error) {
    console.error("Error toggling review like:", error);
    return res.status(500).json({
      message: "Unable to update helpful reaction right now.",
      error: error.message,
    });
  }
};

const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("user", "name role");
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    const isOwner = String(review.user._id || review.user) === String(req.user._id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to edit this review.",
      });
    }

    const nextRating = req.body.rating !== undefined ? req.body.rating : review.rating;
    const nextTitle = req.body.title !== undefined ? req.body.title : review.title;
    const nextComment = req.body.comment !== undefined ? req.body.comment : review.comment;
    const nextQualityRating =
      req.body.qualityRating !== undefined ? req.body.qualityRating : review.qualityRating;
    const nextValueRating =
      req.body.valueRating !== undefined ? req.body.valueRating : review.valueRating;
    const nextDeliveryRating =
      req.body.deliveryRating !== undefined ? req.body.deliveryRating : review.deliveryRating;

    const pros = req.body.pros !== undefined
      ? sanitizeStringArray(req.body.pros, { maxItems: 8, maxLength: 180 })
      : review.pros;
    const cons = req.body.cons !== undefined
      ? sanitizeStringArray(req.body.cons, { maxItems: 8, maxLength: 180 })
      : review.cons;
    const images = req.body.images !== undefined
      ? sanitizeImageUrls(req.body.images)
      : review.images;

    const validationMessage = validateReviewPayload({
      rating: nextRating,
      title: nextTitle,
      comment: nextComment,
      qualityRating: nextQualityRating,
      valueRating: nextValueRating,
      deliveryRating: nextDeliveryRating,
      pros,
      cons,
      images,
    });

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    review.rating = Number(nextRating);
    review.title = String(nextTitle).trim();
    review.comment = String(nextComment).trim();
    review.qualityRating = nextQualityRating ? Number(nextQualityRating) : null;
    review.valueRating = nextValueRating ? Number(nextValueRating) : null;
    review.deliveryRating = nextDeliveryRating ? Number(nextDeliveryRating) : null;
    review.pros = pros;
    review.cons = cons;
    review.images = images;
    review.imageCount = images.length;
    review.editedAt = new Date();
    review.lastActivityAt = new Date();

    if (!isAdmin && review.status === "approved") {
      review.status = "pending";
      review.moderationReason = "Edited by customer and resubmitted for approval.";
    }

    await review.save();
    await syncReviewImages({
      reviewId: review._id,
      productId: review.product,
      imageUrls: images,
    });

    await updateProductReviewStats(review.product);

    const updatedReview = await Review.findById(review._id).populate("user", "name role");
    const enrichedReview = await enrichSingleReview(updatedReview, req.user._id);

    return res.json({
      message: isAdmin
        ? "Review updated successfully."
        : review.status === "pending"
          ? "Your review was updated and sent back for approval."
          : "Review updated successfully.",
      review: enrichedReview,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    return res.status(500).json({
      message: "Unable to update the review right now.",
      error: error.message,
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    const isOwner = String(review.user) === String(req.user._id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to delete this review.",
      });
    }

    const productId = review.product;
    await deleteReviewRelations(review._id);
    await review.deleteOne();
    await updateProductReviewStats(productId);

    return res.json({
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({
      message: "Unable to delete the review right now.",
      error: error.message,
    });
  }
};

const createReplyRecord = async ({ req, review, message, parentReplyId = null }) => {
  const authorRole = ["admin", "vendor"].includes(req.user.role) ? req.user.role : "user";
  const reply = await ReviewReply.create({
    review: review._id,
    parentReply: parentReplyId || null,
    user: req.user._id,
    authorName: req.user.name,
    authorRole,
    message: message.trim(),
    isAdminReply: authorRole !== "user",
  });

  const visibleReplyCount = await ReviewReply.countDocuments({
    review: review._id,
    isVisible: true,
  });

  review.replyCount = visibleReplyCount;
  review.lastActivityAt = new Date();

  if (reply.isAdminReply) {
    review.response = {
      text: reply.message,
      respondedBy: req.user._id,
      respondedAt: reply.createdAt,
    };
  }

  await review.save();

  return reply;
};

const addReviewReply = async (req, res) => {
  try {
    const message = String(req.body.message || req.body.text || req.body.responseText || "").trim();
    const parentReplyId = req.body.parentReplyId || null;

    if (!message || message.length < 3 || message.length > 1500) {
      return res.status(400).json({
        message: "Reply text must be between 3 and 1500 characters.",
      });
    }

    const review = await Review.findById(req.params.id)
      .populate("product", "title images")
      .populate("user", "name email");

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    const isAdminReply = ["admin", "vendor"].includes(req.user.role);
    const isOwner = String(review.user._id || review.user) === String(req.user._id);

    if (!isAdminReply) {
      if (!isOwner) {
        return res.status(403).json({
          message: "Only the review author can reply to review threads.",
        });
      }

      const hasAdminReply = await ReviewReply.exists({
        review: review._id,
        isAdminReply: true,
      });

      if (!hasAdminReply) {
        return res.status(400).json({
          message: "You can reply after an admin has responded to your review.",
        });
      }
    }

    if (parentReplyId) {
      const parentReply = await ReviewReply.findOne({
        _id: parentReplyId,
        review: review._id,
      }).select("_id");

      if (!parentReply) {
        return res.status(404).json({
          message: "The reply you are responding to was not found.",
        });
      }
    }

    const reply = await createReplyRecord({
      req,
      review,
      message,
      parentReplyId,
    });

    if (reply.isAdminReply && review.user?.email) {
      await sendReviewReplyNotification({
        customer: {
          name: review.user.name || review.name,
          email: review.user.email || review.email,
        },
        product: {
          _id: review.product._id || review.product,
          title: review.product.title,
        },
        review: {
          orderId: review.orderId,
        },
        replyMessage: reply.message,
      });
    }

    if (!reply.isAdminReply) {
      await createAdminNotification({
        type: "admin",
        title: "Customer Replied To Review Thread",
        message: `${review.user?.name || review.name} replied on ${review.product.title}.`,
        metadata: {
          reviewId: review._id,
          productId: review.product._id || review.product,
          orderId: review.orderId,
        },
      });
    }

    const refreshedReview = await Review.findById(review._id).populate("user", "name role");
    const enrichedReview = await enrichSingleReview(refreshedReview, req.user._id);

    return res.status(201).json({
      message: "Reply added successfully.",
      review: enrichedReview,
      reply,
    });
  } catch (error) {
    console.error("Error adding review reply:", error);
    return res.status(500).json({
      message: "Unable to add the reply right now.",
      error: error.message,
    });
  }
};

const respondToReview = async (req, res) => addReviewReply(req, res);

const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const numericPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(20, Math.max(1, Number(limit) || 10));
    const skip = (numericPage - 1) * pageSize;

    const filter = { user: req.user._id };
    if (status && ["pending", "approved", "rejected", "spam"].includes(status)) {
      filter.status = status;
    }

    const totalReviews = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .populate("user", "name role")
      .populate("product", "title images category")
      .populate("orderId", "orderNumber status createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const enrichedReviews = await enrichReviews(reviews, req.user._id);

    return res.json({
      reviews: enrichedReviews,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.max(1, Math.ceil(totalReviews / pageSize)),
        totalReviews,
        hasNext: skip + enrichedReviews.length < totalReviews,
        hasPrev: numericPage > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    return res.status(500).json({
      message: "Unable to load your reviews right now.",
      error: error.message,
    });
  }
};

const buildAdminReviewFilter = async (query) => {
  const filter = {};

  if (query.product) {
    filter.product = query.product;
  }

  if (query.customer) {
    filter.user = query.customer;
  }

  if (query.rating) {
    filter.rating = Number(query.rating);
  }

  if (query.status && ["pending", "approved", "rejected", "spam"].includes(query.status)) {
    filter.status = query.status;
  }

  if (query.withImages === "true") {
    filter.imageCount = { $gt: 0 };
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      filter.createdAt.$gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      const endDate = new Date(query.dateTo);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = endDate;
    }
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), "i");
    const [matchingProducts, matchingUsers] = await Promise.all([
      Product.find({ title: regex }).select("_id").lean(),
      User.find({
        $or: [{ name: regex }, { email: regex }],
      })
        .select("_id")
        .lean(),
    ]);

    filter.$or = [
      { title: regex },
      { comment: regex },
      { name: regex },
      { email: regex },
      { product: { $in: matchingProducts.map((product) => product._id) } },
      { user: { $in: matchingUsers.map((user) => user._id) } },
    ];
  }

  return filter;
};

const getAdminReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "latest",
    } = req.query;

    const numericPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (numericPage - 1) * pageSize;
    const filter = await buildAdminReviewFilter(req.query);

    const totalReviews = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .populate("user", "name email role")
      .populate("product", "title images category")
      .populate("orderId", "orderNumber status createdAt")
      .sort(REVIEW_SORTS[sort] || REVIEW_SORTS.latest)
      .skip(skip)
      .limit(pageSize);

    const [enrichedReviews, summary] = await Promise.all([
      enrichReviews(reviews, req.user._id),
      Promise.all([
        Review.countDocuments({ ...filter, status: "pending" }),
        Review.countDocuments({ ...filter, status: "approved" }),
        Review.countDocuments({ ...filter, status: "rejected" }),
        Review.countDocuments({ ...filter, status: "spam" }),
      ]),
    ]);

    return res.json({
      reviews: enrichedReviews,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.max(1, Math.ceil(totalReviews / pageSize)),
        totalReviews,
        hasNext: skip + enrichedReviews.length < totalReviews,
        hasPrev: numericPage > 1,
        pageSize,
      },
      summary: {
        pending: summary[0],
        approved: summary[1],
        rejected: summary[2],
        spam: summary[3],
      },
    });
  } catch (error) {
    console.error("Error fetching admin reviews:", error);
    return res.status(500).json({
      message: "Unable to load admin reviews right now.",
      error: error.message,
    });
  }
};

const moderateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("user", "name email");
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    const {
      status,
      moderatorNotes,
      moderationReason,
      featured,
      pinned,
      title,
      comment,
      rating,
    } = req.body;

    const previousStatus = review.status;

    if (status && ["pending", "approved", "rejected", "spam"].includes(status)) {
      review.status = status;
    }

    if (typeof moderatorNotes === "string") {
      review.moderatorNotes = moderatorNotes.trim().slice(0, 800);
    }

    if (typeof moderationReason === "string") {
      review.moderationReason = moderationReason.trim().slice(0, 240);
    }

    if (typeof featured === "boolean") {
      review.featured = featured;
      review.featuredAt = featured ? new Date() : null;
    }

    if (typeof pinned === "boolean") {
      review.pinned = pinned;
      review.pinnedAt = pinned ? new Date() : null;
    }

    if (title && typeof title === "string") {
      review.title = title.trim().slice(0, 100);
    }

    if (comment && typeof comment === "string") {
      review.comment = comment.trim().slice(0, 1500);
    }

    if (rating !== undefined && Number(rating) >= 1 && Number(rating) <= 5) {
      review.rating = Number(rating);
    }

    review.lastActivityAt = new Date();
    await review.save();

    if (previousStatus !== review.status || rating !== undefined) {
      await updateProductReviewStats(review.product);
    }

    const updatedReview = await Review.findById(review._id)
      .populate("user", "name email role")
      .populate("product", "title images category")
      .populate("orderId", "orderNumber status createdAt");
    const enrichedReview = await enrichSingleReview(updatedReview, req.user._id);

    return res.json({
      message: "Review moderation updated successfully.",
      review: enrichedReview,
    });
  } catch (error) {
    console.error("Error moderating review:", error);
    return res.status(500).json({
      message: "Unable to update review moderation right now.",
      error: error.message,
    });
  }
};

const getAdminReviewAnalytics = async (req, res) => {
  try {
    const days = Math.max(7, Math.min(365, Number(req.query.days) || 90));
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const [totals, trend, mostReviewed] = await Promise.all([
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            approvedReviews: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            spamReviews: {
              $sum: { $cond: [{ $eq: ["$status", "spam"] }, 1, 0] },
            },
            averageRating: {
              $avg: {
                $cond: [{ $eq: ["$status", "approved"] }, "$rating", null],
              },
            },
          },
        },
      ]),
      Review.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$rating" },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
            "_id.day": 1,
          },
        },
      ]),
      Review.aggregate([
        {
          $group: {
            _id: "$product",
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$rating" },
            approvedReviews: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
          },
        },
        { $sort: { totalReviews: -1, approvedReviews: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const products = await Product.find({
      _id: { $in: mostReviewed.map((item) => item._id) },
    })
      .select("title images category")
      .lean();

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    return res.json({
      overview: totals[0] || {
        totalReviews: 0,
        approvedReviews: 0,
        pendingReviews: 0,
        spamReviews: 0,
        averageRating: 0,
      },
      ratingTrends: trend.map((item) => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(
          item._id.day
        ).padStart(2, "0")}`,
        totalReviews: item.totalReviews,
        averageRating: Number((item.averageRating || 0).toFixed(2)),
      })),
      mostReviewedProducts: mostReviewed.map((item) => ({
        productId: item._id,
        title: productMap.get(String(item._id))?.title || "Unknown Product",
        image: productMap.get(String(item._id))?.images?.[0] || "",
        category: productMap.get(String(item._id))?.category || "",
        totalReviews: item.totalReviews,
        approvedReviews: item.approvedReviews,
        averageRating: Number((item.averageRating || 0).toFixed(2)),
      })),
    });
  } catch (error) {
    console.error("Error fetching review analytics:", error);
    return res.status(500).json({
      message: "Unable to load review analytics right now.",
      error: error.message,
    });
  }
};

const sendReviewRequestEmailForOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate({
        path: "items.product",
        select: "title images category",
      });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const { checkIsPlaceholderCustomer } = require('../utils/testCustomerHelper');
    const check = checkIsPlaceholderCustomer(order);
    if (check.isPlaceholder) {
      console.log(`Customer notifications skipped:\nReason: ${check.reason}\nOrder: ${order.orderNumber}\nEmail: ${order.shippingDetails?.email || 'N/A'}`);
      return res.status(200).json({
        success: true,
        message: "Skipped review email request for placeholder customer."
      });
    }

    if (order.status !== "delivered") {
      return res.status(400).json({
        message: "Review request emails can only be sent after delivery.",
      });
    }

    const customerEmail = order.user?.email || order.shippingDetails?.email;
    const customerName = order.user?.name || order.shippingDetails?.fullName || "Customer";

    if (!customerEmail) {
      return res.status(400).json({
        message: "Customer email is missing for this order.",
      });
    }

    const products = order.items
      .filter((item) => item.product && item.product._id)
      .map((item) => ({
        _id: item.product._id,
        title: item.product.title || item.title || "Product",
        image: item.product.images?.[0] || item.image || item.images?.[0] || "",
      }))
      .filter(
        (product, index, array) =>
          array.findIndex((candidate) => String(candidate._id) === String(product._id)) === index
      );

    if (!products.length) {
      return res.status(400).json({
        message: "No reviewable products were found for this order.",
      });
    }

    const productsWithUrls = products.map((product) => ({
      ...product,
      reviewUrl: buildReviewPublicUrl(product, order._id),
    }));

    const emailResult = await sendReviewRequestEmail({
      customer: {
        name: customerName,
        email: customerEmail,
      },
      order,
      products: productsWithUrls,
    });

    const logs = await Promise.all(
      productsWithUrls.map((product) =>
        ReviewEmailLog.create({
          order: order._id,
          product: product._id,
          customer: order.user?._id || null,
          requestedBy: req.user?._id || null,
          customerName,
          customerEmail,
          productName: product.title,
          reviewUrl: product.reviewUrl,
          status: emailResult.success ? "sent" : "failed",
          messageId: emailResult.messageId || "",
          errorMessage: emailResult.error || "",
          sentAt: emailResult.success ? new Date() : null,
          meta: {
            orderNumber: order.orderNumber,
          },
        })
      )
    );

    if (!emailResult.success) {
      return res.status(502).json({
        message: "The review request email could not be sent.",
        error: emailResult.error,
        logsCreated: logs.length,
      });
    }

    return res.json({
      message: "Review request email sent successfully.",
      summary: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerEmail,
        productCount: productsWithUrls.length,
        messageId: emailResult.messageId,
      },
    });
  } catch (error) {
    console.error("Error sending review request email:", error);
    return res.status(500).json({
      message: "Unable to send the review request email right now.",
      error: error.message,
    });
  }
};

module.exports = {
  addReviewReply,
  createProductReview,
  deleteReview,
  getAdminReviewAnalytics,
  getAdminReviews,
  getProductReviews,
  getReviewEligibility,
  getUserReviews,
  moderateReview,
  respondToReview,
  sendReviewRequestEmailForOrder,
  toggleReviewLike,
  updateProductReviewStats,
  updateReview,
};
