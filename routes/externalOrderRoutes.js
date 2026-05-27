const express = require('express');
const {
  changeOrderStatus,
  getHealth,
  getOrderById,
  listOrders,
} = require('../modules/externalOrders/controller');
const {
  validateListOrdersQuery,
  validateOrderIdParam,
  validateStatusUpdateBody,
} = require('../modules/externalOrders/validation');
const { externalOrdersErrorHandler } = require('../modules/externalOrders/errorHandler');

const router = express.Router();

router.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.info(`[external-orders] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

router.get('/health', getHealth);
router.get('/orders', validateListOrdersQuery, listOrders);
router.get('/orders/:id', validateOrderIdParam, getOrderById);
router.put('/orders/:id/status', validateOrderIdParam, validateStatusUpdateBody, changeOrderStatus);

router.use(externalOrdersErrorHandler);

module.exports = router;