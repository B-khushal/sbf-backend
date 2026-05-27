const Order = require('../../models/Order');
const {
  EXTERNAL_STATUS_TO_INTERNAL_STATUS,
  INTERNAL_STATUS_TO_EXTERNAL_STATUS,
  ORDER_DETAIL_POPULATE,
  SORT_FIELD_MAP,
  VALID_EXTERNAL_STATUS_TRANSITIONS,
} = require('./constants');
const { ExternalApiError } = require('./errors');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeDateRange = (date) => {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  return { start, end };
};

const getCanonicalStatus = (internalStatus) => INTERNAL_STATUS_TO_EXTERNAL_STATUS[internalStatus] || String(internalStatus || '').toUpperCase();

const getInternalStatus = (externalStatus) => {
  const internalStatuses = EXTERNAL_STATUS_TO_INTERNAL_STATUS[externalStatus];
  return internalStatuses ? internalStatuses[0] : null;
};

const isValidTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return true;
  }

  const allowedNextStatuses = VALID_EXTERNAL_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedNextStatuses.includes(nextStatus);
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const mapProduct = (product) => {
  if (!product) {
    return null;
  }

  return {
    id: String(product._id || product.id || ''),
    title: product.title || '',
    price: product.price ?? null,
    images: Array.isArray(product.images) ? product.images : [],
  };
};

const mapOrderItem = (item) => ({
  product: mapProduct(item.product),
  title: item.title || item.product?.title || '',
  image: item.image || item.product?.images?.[0] || '',
  images: Array.isArray(item.images) ? item.images : Array.isArray(item.product?.images) ? item.product.images : [],
  selectedVariant: item.selectedVariant ?? null,
  quantity: item.quantity ?? 0,
  price: item.price ?? 0,
  finalPrice: item.finalPrice ?? 0,
  customizations: item.customizations ?? null,
});

const mapCustomer = (shippingDetails = {}) => ({
  fullName: shippingDetails.fullName || '',
  email: shippingDetails.email || '',
  phone: shippingDetails.phone || '',
  address: shippingDetails.address || '',
  apartment: shippingDetails.apartment || '',
  city: shippingDetails.city || '',
  state: shippingDetails.state || '',
  zipCode: shippingDetails.zipCode || '',
  notes: shippingDetails.notes || '',
  deliveryDate: toIsoString(shippingDetails.deliveryDate),
  timeSlot: shippingDetails.timeSlot || '',
});

const toOrderSummary = (order) => {
  const document = typeof order?.toObject === 'function' ? order.toObject({ versionKey: false }) : order;
  const shippingDetails = document?.shippingDetails || {};

  return {
    id: String(document?._id || document?.id || ''),
    orderNumber: document?.orderNumber || '',
    status: getCanonicalStatus(document?.status),
    customer: mapCustomer(shippingDetails),
    totalAmount: document?.totalAmount ?? 0,
    currency: document?.currency || 'INR',
    currencyRate: document?.currencyRate ?? 1,
    originalCurrency: document?.originalCurrency || 'INR',
    itemCount: Array.isArray(document?.items) ? document.items.length : 0,
    deliveryDate: toIsoString(shippingDetails.deliveryDate),
    createdAt: toIsoString(document?.createdAt),
    updatedAt: toIsoString(document?.updatedAt),
  };
};

const toOrderDetail = (order) => {
  const document = typeof order?.toObject === 'function' ? order.toObject({ versionKey: false }) : order;
  const shippingDetails = document?.shippingDetails || {};
  const user = document?.user;
  const items = Array.isArray(document?.items) ? document.items.map(mapOrderItem) : [];

  return {
    id: String(document?._id || document?.id || ''),
    orderNumber: document?.orderNumber || '',
    status: getCanonicalStatus(document?.status),
    customer: mapCustomer(shippingDetails),
    user: user
      ? {
          id: String(user._id || user.id || ''),
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
        }
      : null,
    shippingDetails: {
      ...mapCustomer(shippingDetails),
      deliveryDate: toIsoString(shippingDetails.deliveryDate),
    },
    paymentDetails: document?.paymentDetails || {},
    items,
    totalAmount: document?.totalAmount ?? 0,
    currency: document?.currency || 'INR',
    currencyRate: document?.currencyRate ?? 1,
    originalCurrency: document?.originalCurrency || 'INR',
    giftDetails: document?.giftDetails || null,
    createdAt: toIsoString(document?.createdAt),
    updatedAt: toIsoString(document?.updatedAt),
  };
};

const buildOrderQuery = ({ status, search, date }) => {
  const query = {};

  if (status) {
    const internalStatuses = EXTERNAL_STATUS_TO_INTERNAL_STATUS[status];
    if (!internalStatuses) {
      throw new ExternalApiError(400, 'VALIDATION_ERROR', 'Unsupported status filter', { status });
    }

    query.status = { $in: internalStatuses };
  }

  if (search) {
    const escapedSearch = escapeRegex(search);
    query.$or = [
      {
        'shippingDetails.fullName': {
          $regex: escapedSearch,
          $options: 'i',
        },
      },
      {
        'shippingDetails.phone': {
          $regex: escapedSearch,
          $options: 'i',
        },
      },
    ];
  }

  if (date) {
    const range = normalizeDateRange(date);
    query.createdAt = {
      $gte: range.start,
      $lte: range.end,
    };
  }

  return query;
};

const listExternalOrders = async ({ page, limit, status, search, date, sortBy, sortOrder }) => {
  const query = buildOrderQuery({ status, search, date });
  const sortField = SORT_FIELD_MAP[sortBy] || 'createdAt';
  const direction = sortOrder === 'asc' ? 1 : -1;
  const skip = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort({ [sortField]: direction })
      .skip(skip)
      .limit(limit)
      .exec(),
  ]);

  return {
    data: orders.map(toOrderSummary),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

const getExternalOrderById = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate(ORDER_DETAIL_POPULATE)
    .exec();

  if (!order) {
    throw new ExternalApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  return toOrderDetail(order);
};

const updateExternalOrderStatus = async (orderId, nextStatus) => {
  const order = await Order.findById(orderId)
    .populate(ORDER_DETAIL_POPULATE)
    .exec();

  if (!order) {
    throw new ExternalApiError(404, 'ORDER_NOT_FOUND', 'Order not found');
  }

  const currentStatus = getCanonicalStatus(order.status);

  if (!isValidTransition(currentStatus, nextStatus)) {
    throw new ExternalApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot transition order from ${currentStatus} to ${nextStatus}`, {
      currentStatus,
      nextStatus,
      allowedTransitions: VALID_EXTERNAL_STATUS_TRANSITIONS[currentStatus] || [],
    });
  }

  const previousStatus = currentStatus;
  const internalStatus = getInternalStatus(nextStatus);

  if (nextStatus !== currentStatus) {
    order.status = internalStatus;
    await order.save();
  }

  await order.populate(ORDER_DETAIL_POPULATE);

  return {
    order: toOrderDetail(order),
    previousStatus,
    nextStatus,
    changed: nextStatus !== currentStatus,
  };
};

const getExternalOrdersHealth = () => ({
  status: 'ok',
  service: 'external-orders',
  timestamp: new Date().toISOString(),
});

module.exports = {
  buildOrderQuery,
  getCanonicalStatus,
  getExternalOrderById,
  getExternalOrdersHealth,
  isValidTransition,
  listExternalOrders,
  mapOrderItem,
  toOrderDetail,
  toOrderSummary,
  updateExternalOrderStatus,
};