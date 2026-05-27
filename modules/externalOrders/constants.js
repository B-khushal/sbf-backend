const EXTERNAL_STATUS_VALUES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const EXTERNAL_STATUS_ALIASES = {
  ORDER_PLACED: 'PENDING',
  RECEIVED: 'PROCESSING',
  BEING_MADE: 'PROCESSING',
  OUT_FOR_DELIVERY: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

const EXTERNAL_STATUS_TO_INTERNAL_STATUS = {
  PENDING: ['order_placed'],
  PROCESSING: ['received', 'being_made'],
  SHIPPED: ['out_for_delivery'],
  DELIVERED: ['delivered'],
  CANCELLED: ['cancelled'],
};

const INTERNAL_STATUS_TO_EXTERNAL_STATUS = {
  order_placed: 'PENDING',
  received: 'PROCESSING',
  being_made: 'PROCESSING',
  out_for_delivery: 'SHIPPED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

const VALID_EXTERNAL_STATUS_TRANSITIONS = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const SORT_FIELD_MAP = {
  created_at: 'createdAt',
  total_amount: 'totalAmount',
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ORDER_DETAIL_POPULATE = [
  {
    path: 'user',
    select: 'name email phone',
  },
  {
    path: 'items.product',
    select: 'title images price',
  },
];

module.exports = {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  EXTERNAL_STATUS_ALIASES,
  EXTERNAL_STATUS_TO_INTERNAL_STATUS,
  EXTERNAL_STATUS_VALUES,
  INTERNAL_STATUS_TO_EXTERNAL_STATUS,
  MAX_LIMIT,
  ORDER_DETAIL_POPULATE,
  SORT_FIELD_MAP,
  VALID_EXTERNAL_STATUS_TRANSITIONS,
};