const buckets = new Map();

const getClientKey = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]) ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown";

  const userId = req.user?._id ? String(req.user._id) : "guest";
  return `${userId}:${ip}`;
};

const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 30,
  keyGenerator = getClientKey,
  message = "Too many requests. Please try again in a moment.",
} = {}) => {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      return res.status(429).json({
        message,
        retryAfterSeconds: Math.ceil((current.expiresAt - now) / 1000),
      });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
};

module.exports = {
  createRateLimiter,
};
