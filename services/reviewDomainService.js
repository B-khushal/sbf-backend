const Product = require("../models/Product");
const Order = require("../models/Order");
const Review = require("../models/Review");
const ReviewImage = require("../models/ReviewImage");
const ReviewLike = require("../models/ReviewLike");
const ReviewReply = require("../models/ReviewReply");
const { slugify } = require("../utils/slugify");

const MAX_REVIEW_IMAGES = 6;

const sanitizeStringArray = (values, options = {}) => {
  const { maxItems = 10, maxLength = 240 } = options;

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((value) => value.slice(0, maxLength));
};

const sanitizeImageUrls = (values) =>
  sanitizeStringArray(values, {
    maxItems: MAX_REVIEW_IMAGES,
    maxLength: 2000,
  }).filter((url) => /^https?:\/\//i.test(url) || url.startsWith("/uploads/"));

const buildReviewPublicUrl = (product, orderId) => {
  let frontendUrl = (process.env.FRONTEND_URL || "https://sbflorist.in").replace(/\/$/, "");
  if (frontendUrl.includes("onrender.com")) {
    frontendUrl = "https://sbflorist.in";
  }
  const productSlug = slugify(product?.title || product?.name || "product");
  const query = orderId ? `?orderId=${orderId}` : "";

  return `${frontendUrl}/products/${product._id}/reviews/${productSlug}${query}`;
};

const getEligibleDeliveredOrders = async (userId, productId) => {
  const deliveredOrders = await Order.find({
    user: userId,
    status: "delivered",
    "items.product": productId,
  })
    .select("_id orderNumber status items createdAt shippingDetails.deliveryDate")
    .sort({ createdAt: -1 })
    .lean();

  if (!deliveredOrders.length) {
    return [];
  }

  const reviewedOrderIds = await Review.find({
    user: userId,
    product: productId,
    orderId: { $in: deliveredOrders.map((order) => order._id) },
  })
    .select("orderId status rating createdAt")
    .lean();

  const reviewMap = new Map(
    reviewedOrderIds.map((review) => [
      String(review.orderId),
      {
        reviewId: review._id,
        status: review.status,
        rating: review.rating,
        createdAt: review.createdAt,
      },
    ])
  );

  return deliveredOrders.map((order) => ({
    ...order,
    hasReview: reviewMap.has(String(order._id)),
    review: reviewMap.get(String(order._id)) || null,
  }));
};

const resolveEligibleReviewOrder = async ({ userId, productId, requestedOrderId }) => {
  const eligibleOrders = await getEligibleDeliveredOrders(userId, productId);

  if (!eligibleOrders.length) {
    return {
      eligibleOrders: [],
      selectedOrder: null,
      reason: "NO_DELIVERED_ORDER",
    };
  }

  if (requestedOrderId) {
    const requestedOrder = eligibleOrders.find(
      (order) => String(order._id) === String(requestedOrderId)
    );

    if (!requestedOrder) {
      return {
        eligibleOrders,
        selectedOrder: null,
        reason: "ORDER_NOT_ELIGIBLE",
      };
    }

    if (requestedOrder.hasReview) {
      return {
        eligibleOrders,
        selectedOrder: null,
        reason: "DUPLICATE_REVIEW",
      };
    }

    return {
      eligibleOrders,
      selectedOrder: requestedOrder,
      reason: null,
    };
  }

  const firstUnreviewedOrder = eligibleOrders.find((order) => !order.hasReview);

  return {
    eligibleOrders,
    selectedOrder: firstUnreviewedOrder || null,
    reason: firstUnreviewedOrder ? null : "DUPLICATE_REVIEW",
  };
};

const syncReviewImages = async ({ reviewId, productId, imageUrls, productTitle = "" }) => {
  await ReviewImage.deleteMany({ review: reviewId });

  if (!imageUrls.length) {
    await Review.findByIdAndUpdate(reviewId, {
      images: [],
      imageCount: 0,
    });
    return [];
  }

  const createdImages = await ReviewImage.insertMany(
    imageUrls.map((url, index) => ({
      review: reviewId,
      product: productId,
      url,
      alt: productTitle ? `${productTitle} review image ${index + 1}` : "",
      sortOrder: index,
    }))
  );

  await Review.findByIdAndUpdate(reviewId, {
    images: createdImages.map((image) => image.url),
    imageCount: createdImages.length,
  });

  return createdImages;
};

const buildReplyTree = (replies) => {
  const replyMap = new Map();
  const roots = [];

  replies.forEach((reply) => {
    replyMap.set(String(reply._id), {
      _id: reply._id,
      review: reply.review,
      parentReply: reply.parentReply || null,
      message: reply.message,
      authorRole: reply.authorRole,
      authorName: reply.authorName,
      isAdminReply: reply.isAdminReply,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: reply.user
        ? {
            _id: reply.user._id,
            name: reply.user.name,
            role: reply.user.role,
          }
        : null,
      children: [],
    });
  });

  replyMap.forEach((reply) => {
    if (reply.parentReply && replyMap.has(String(reply.parentReply))) {
      replyMap.get(String(reply.parentReply)).children.push(reply);
    } else {
      roots.push(reply);
    }
  });

  return roots;
};

const enrichReviews = async (reviews, viewerId = null) => {
  if (!reviews.length) {
    return [];
  }

  const reviewIds = reviews.map((review) => review._id);

  const [images, replies, viewerLikes] = await Promise.all([
    ReviewImage.find({ review: { $in: reviewIds } })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean(),
    ReviewReply.find({ review: { $in: reviewIds }, isVisible: true })
      .sort({ createdAt: 1 })
      .populate("user", "name role")
      .lean(),
    viewerId
      ? ReviewLike.find({ review: { $in: reviewIds }, user: viewerId }).select("review").lean()
      : Promise.resolve([]),
  ]);

  const imageMap = new Map();
  images.forEach((image) => {
    const key = String(image.review);
    const current = imageMap.get(key) || [];
    current.push({
      _id: image._id,
      url: image.url,
      publicId: image.publicId,
      alt: image.alt,
      sortOrder: image.sortOrder,
    });
    imageMap.set(key, current);
  });

  const replyMap = new Map();
  replies.forEach((reply) => {
    const key = String(reply.review);
    const current = replyMap.get(key) || [];
    current.push(reply);
    replyMap.set(key, current);
  });

  const likedReviewIds = new Set(viewerLikes.map((like) => String(like.review)));

  return reviews.map((review) => {
    const reviewObject = typeof review.toObject === "function" ? review.toObject() : { ...review };
    const imageEntries = imageMap.get(String(reviewObject._id)) || [];
    const replyEntries = replyMap.get(String(reviewObject._id)) || [];
    const replyTree = buildReplyTree(replyEntries);
    const latestAdminReply = [...replyEntries]
      .reverse()
      .find((reply) => reply.isAdminReply || ["admin", "vendor"].includes(reply.authorRole));

    return {
      ...reviewObject,
      helpfulVotes: reviewObject.helpfulVotes || 0,
      totalVotes: reviewObject.totalVotes || 0,
      imageCount: reviewObject.imageCount ?? imageEntries.length,
      replyCount: reviewObject.replyCount ?? replyEntries.length,
      images: imageEntries.map((image) => image.url),
      imageEntries,
      replies: replyTree,
      likedByViewer: likedReviewIds.has(String(reviewObject._id)),
      response: latestAdminReply
        ? {
            text: latestAdminReply.message,
            respondedAt: latestAdminReply.createdAt,
            respondedBy: latestAdminReply.user
              ? {
                  _id: latestAdminReply.user._id,
                  name: latestAdminReply.user.name,
                  role: latestAdminReply.user.role,
                }
              : {
                  name: latestAdminReply.authorName,
                  role: latestAdminReply.authorRole,
                },
          }
        : reviewObject.response,
    };
  });
};

const enrichSingleReview = async (review, viewerId = null) => {
  const [enriched] = await enrichReviews([review], viewerId);
  return enriched || null;
};

const deleteReviewRelations = async (reviewId) => {
  await Promise.all([
    ReviewReply.deleteMany({ review: reviewId }),
    ReviewImage.deleteMany({ review: reviewId }),
    ReviewLike.deleteMany({ review: reviewId }),
  ]);
};

const updateProductReviewStats = async (productId) => {
  const stats = await Review.getProductReviewStats(productId);

  await Product.findByIdAndUpdate(productId, {
    rating: stats.averageRating || 0,
    numReviews: stats.totalReviews || 0,
  });

  return stats;
};

const getProductGalleryImages = async (productId, limit = 18) => {
  const images = await ReviewImage.find({ product: productId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return images.map((image) => ({
    _id: image._id,
    url: image.url,
    alt: image.alt,
  }));
};

module.exports = {
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
};
