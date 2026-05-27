class ExternalApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ExternalApiError';
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExternalApiError);
    }
  }
}

const isExternalApiError = (error) => error instanceof ExternalApiError;

module.exports = {
  ExternalApiError,
  isExternalApiError,
};