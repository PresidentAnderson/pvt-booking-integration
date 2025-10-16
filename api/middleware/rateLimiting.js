const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config/constants');

/**
 * General rate limiter for all API endpoints
 */
const generalLimiter = rateLimit({
  windowMs: RATE_LIMITS.GENERAL.windowMs,
  max: RATE_LIMITS.GENERAL.max,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil(RATE_LIMITS.GENERAL.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later',
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(RATE_LIMITS.GENERAL.windowMs / 1000)
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTH.windowMs,
  max: RATE_LIMITS.AUTH.max,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: 'Authentication rate limit exceeded',
    retryAfter: Math.ceil(RATE_LIMITS.AUTH.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts from this IP, please try again later',
      error: 'Authentication rate limit exceeded',
      retryAfter: Math.ceil(RATE_LIMITS.AUTH.windowMs / 1000)
    });
  }
});

/**
 * Rate limiter for booking operations
 */
const bookingLimiter = rateLimit({
  windowMs: RATE_LIMITS.BOOKING.windowMs,
  max: RATE_LIMITS.BOOKING.max,
  message: {
    success: false,
    message: 'Too many booking requests, please try again later',
    error: 'Booking rate limit exceeded',
    retryAfter: Math.ceil(RATE_LIMITS.BOOKING.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many booking requests, please try again in an hour',
      error: 'Booking rate limit exceeded',
      retryAfter: Math.ceil(RATE_LIMITS.BOOKING.windowMs / 1000)
    });
  }
});

/**
 * Rate limiter for payment operations
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 payment attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later',
    error: 'Payment rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many payment attempts, please try again in 15 minutes',
      error: 'Payment rate limit exceeded',
      retryAfter: 900 // 15 minutes in seconds
    });
  }
});

/**
 * Rate limiter for password reset requests
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
    error: 'Password reset rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts, please try again in an hour',
      error: 'Password reset rate limit exceeded',
      retryAfter: 3600 // 1 hour in seconds
    });
  }
});

/**
 * Rate limiter for search operations
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 searches per minute
  message: {
    success: false,
    message: 'Too many search requests, please slow down',
    error: 'Search rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many search requests, please try again in a minute',
      error: 'Search rate limit exceeded',
      retryAfter: 60
    });
  }
});

/**
 * Custom rate limiter factory
 */
const createCustomLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: 'Rate limit exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

/**
 * Dynamic rate limiter based on user role
 */
const dynamicRateLimiter = (guestMax, userMax, staffMax, adminMax = 1000) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      if (!req.user) return guestMax;
      
      switch (req.user.role) {
        case 'admin': return adminMax;
        case 'staff': return staffMax;
        case 'guest': return userMax;
        default: return guestMax;
      }
    },
    keyGenerator: (req) => {
      return req.user ? `${req.user._id}_${req.user.role}` : req.ip;
    },
    message: {
      success: false,
      message: 'Rate limit exceeded for your user level',
      error: 'Dynamic rate limit exceeded'
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Rate limit exceeded for your user level',
        error: 'Dynamic rate limit exceeded',
        retryAfter: 900
      });
    }
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  bookingLimiter,
  paymentLimiter,
  passwordResetLimiter,
  searchLimiter,
  createCustomLimiter,
  dynamicRateLimiter
};