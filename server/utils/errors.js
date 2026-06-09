export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class OAuthError extends AppError {
  constructor(message) {
    super(message, 401, 'OAUTH_ERROR');
  }
}

export class SyncError extends AppError {
  constructor(message, retryable = false) {
    super(message, 502, 'SYNC_ERROR');
    this.retryable = retryable;
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryable = true;
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
