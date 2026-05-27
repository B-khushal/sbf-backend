const { isExternalApiError } = require('./errors');

const externalOrdersErrorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = isExternalApiError(err) ? err.statusCode : (err.statusCode || 500);
  const code = isExternalApiError(err)
    ? err.code
    : (statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');

  const payload = {
    success: false,
    error: {
      code,
      message: err.message || 'Something went wrong',
    },
  };

  if (isExternalApiError(err) && err.details !== undefined) {
    payload.error.details = err.details;
  }

  if (!isExternalApiError(err) && process.env.NODE_ENV === 'development' && err.stack) {
    payload.error.details = {
      stack: err.stack,
    };
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  externalOrdersErrorHandler,
};