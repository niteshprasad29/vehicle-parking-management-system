/**
 * 404 Not Found Middleware
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Resource not found - ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Centralized Application Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';
  let errors = [];

  // Mongoose bad ObjectId error (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid resource identifier format';
    errors = [`Resource with id '${err.value}' is not a valid ObjectId`];
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `Duplicate value error: A record with this ${field} already exists.`;
    errors = [`${field} '${value}' is already registered.`];
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((val) => val.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errors = ['Token signature is invalid'];
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
    errors = ['Please log in again to obtain a new token'];
  }

  // If no specific errors gathered, default to err.message
  if (errors.length === 0 && message) {
    errors = [message];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
