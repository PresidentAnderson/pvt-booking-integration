const { API_MESSAGES } = require('../config/constants');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('\n=== ERROR ===');
  console.error('Time:', new Date().toISOString());
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('User:', req.user ? req.user._id : 'Anonymous');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('=============\n');

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: API_MESSAGES.VALIDATION_ERROR,
      errors: message
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    return res.status(400).json({
      success: false,
      message: API_MESSAGES.BAD_REQUEST,
      error: `Duplicate value for ${field}: ${value}. Please use a different value.`
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(404).json({
      success: false,
      message: API_MESSAGES.NOT_FOUND,
      error: 'Resource not found'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: API_MESSAGES.UNAUTHORIZED,
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: API_MESSAGES.UNAUTHORIZED,
      error: 'Token expired'
    });
  }

  // Stripe errors
  if (err.type && err.type.includes('Stripe')) {
    return res.status(400).json({
      success: false,
      message: 'Payment processing error',
      error: err.message || 'Payment failed'
    });
  }

  // Mongoose connection errors
  if (err.name === 'MongoNetworkError') {
    return res.status(500).json({
      success: false,
      message: 'Database connection error',
      error: 'Unable to connect to database'
    });
  }

  // Custom API errors
  if (err.name === 'APIError') {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      error: err.error || err.message
    });
  }

  // Default server error
  res.status(error.statusCode || 500).json({
    success: false,
    message: API_MESSAGES.SERVER_ERROR,
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : error.message
  });
};

/**
 * 404 handler for undefined routes
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: API_MESSAGES.NOT_FOUND,
    error: `Route ${req.originalUrl} not found`,
    method: req.method,
    path: req.path
  });
};

/**
 * Async error wrapper to catch async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom API Error class
 */
class APIError extends Error {
  constructor(message, statusCode, error = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Override res.json to capture response data
  const originalJson = res.json;
  let responseData = null;
  
  res.json = function(data) {
    responseData = data;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    
    console.log(`[${logLevel}] ${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query:', req.query);
      console.log('Body:', req.body);
      console.log('User:', req.user ? req.user._id : 'Anonymous');
      
      if (res.statusCode >= 400 && responseData) {
        console.log('Response:', responseData);
      }
    }
  });

  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS header for HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * Request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: API_MESSAGES.BAD_REQUEST,
        error: 'Content-Type header is required'
      });
    }
    
    if (!contentType.includes('application/json') && !req.path.includes('webhook')) {
      return res.status(400).json({
        success: false,
        message: API_MESSAGES.BAD_REQUEST,
        error: 'Content-Type must be application/json'
      });
    }
  }

  // Sanitize request data
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Sanitize object to prevent NoSQL injection
 */
const sanitizeObject = (obj) => {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Remove objects that look like MongoDB operators
        if (key.startsWith('$') || key.startsWith('.')) {
          delete obj[key];
        } else {
          obj[key] = sanitizeObject(obj[key]);
        }
      } else if (typeof obj[key] === 'string') {
        // Basic XSS protection
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    }
  }
  return obj;
};

/**
 * Response time middleware
 */
const responseTime = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  APIError,
  requestLogger,
  securityHeaders,
  validateRequest,
  responseTime,
  sanitizeObject
};