const mongoose = require('mongoose');
const { ExternalApiError } = require('./errors');
const {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  EXTERNAL_STATUS_ALIASES,
  EXTERNAL_STATUS_VALUES,
  MAX_LIMIT,
  SORT_FIELD_MAP,
} = require('./constants');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeStatusToken = (value) => normalizeString(value).toUpperCase().replace(/[\s-]+/g, '_');

const toCanonicalExternalStatus = (value) => {
  const token = normalizeStatusToken(value);
  if (!token) {
    return '';
  }

  if (EXTERNAL_STATUS_VALUES.includes(token)) {
    return token;
  }

  return EXTERNAL_STATUS_ALIASES[token] || '';
};

const parseInteger = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : NaN;
};

const buildValidationError = (details) => new ExternalApiError(
  400,
  'VALIDATION_ERROR',
  'Request validation failed',
  details
);

const validateListOrdersQuery = (req, res, next) => {
  const details = {};

  const page = parseInteger(req.query.page, DEFAULT_PAGE);
  const limit = parseInteger(req.query.limit, DEFAULT_LIMIT);

  if (!Number.isInteger(page) || page < 1) {
    details.page = 'page must be a positive integer';
  }

  if (!Number.isInteger(limit) || limit < 1) {
    details.limit = 'limit must be a positive integer';
  } else if (limit > MAX_LIMIT) {
    details.limit = `limit must not exceed ${MAX_LIMIT}`;
  }

  const status = toCanonicalExternalStatus(req.query.status);
  if (normalizeString(req.query.status) && !status) {
    details.status = `status must be one of: ${EXTERNAL_STATUS_VALUES.join(', ')}`;
  }

  const search = normalizeString(req.query.search);
  if (search.length > 120) {
    details.search = 'search must not exceed 120 characters';
  }

  const date = normalizeString(req.query.date);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    details.date = 'date must use YYYY-MM-DD format';
  } else if (date) {
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      details.date = 'date must be a valid calendar day';
    }
  }

  const sortBy = normalizeString(req.query.sortBy) || 'created_at';
  if (!Object.prototype.hasOwnProperty.call(SORT_FIELD_MAP, sortBy)) {
    details.sortBy = `sortBy must be one of: ${Object.keys(SORT_FIELD_MAP).join(', ')}`;
  }

  const sortOrder = normalizeString(req.query.sortOrder).toLowerCase() || 'desc';
  if (!['asc', 'desc'].includes(sortOrder)) {
    details.sortOrder = 'sortOrder must be asc or desc';
  }

  if (Object.keys(details).length > 0) {
    return next(buildValidationError(details));
  }

  req.externalOrderQuery = {
    page,
    limit,
    status: status || undefined,
    search: search || undefined,
    date: date || undefined,
    sortBy,
    sortOrder,
  };

  return next();
};

const validateOrderIdParam = (req, res, next) => {
  const orderId = normalizeString(req.params.id);

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return next(buildValidationError({ id: 'id must be a valid MongoDB ObjectId' }));
  }

  req.externalOrderId = orderId;
  return next();
};

const validateStatusUpdateBody = (req, res, next) => {
  const status = toCanonicalExternalStatus(req.body?.status);

  if (!isNonEmptyString(req.body?.status)) {
    return next(buildValidationError({ status: 'status is required' }));
  }

  if (!status) {
    return next(buildValidationError({ status: `status must be one of: ${EXTERNAL_STATUS_VALUES.join(', ')}` }));
  }

  req.externalOrderStatus = status;
  return next();
};

module.exports = {
  buildValidationError,
  validateListOrdersQuery,
  validateOrderIdParam,
  validateStatusUpdateBody,
};