const jwtUtils = require('../utils/jwt');
const { User } = require('../models');
const { USER_ROLES, API_MESSAGES } = require('../config/constants');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'No token provided'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwtUtils.verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: error.message
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'User not found or inactive'
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: API_MESSAGES.SERVER_ERROR,
      error: error.message
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const decoded = jwtUtils.verifyToken(token);
        const user = await User.findById(decoded.userId);
        
        if (user && user.isActive) {
          req.user = user;
          req.token = token;
        }
      } catch (error) {
        // Ignore token errors for optional auth
        console.log('Optional auth token error:', error.message);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Authorization middleware factory
 * Checks if user has required role(s)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: API_MESSAGES.FORBIDDEN,
        error: `Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Admin only middleware
 */
const adminOnly = authorize(USER_ROLES.ADMIN);

/**
 * Staff or admin middleware
 */
const staffOrAdmin = authorize(USER_ROLES.STAFF, USER_ROLES.ADMIN);

/**
 * Check if user can access resource
 * User can access their own resources, staff/admin can access all
 */
const canAccessResource = (resourceUserId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'Authentication required'
      });
    }

    const userId = typeof resourceUserId === 'function' 
      ? resourceUserId(req) 
      : req.params.userId || req.body.userId || resourceUserId;

    // Admin and staff can access any resource
    if ([USER_ROLES.ADMIN, USER_ROLES.STAFF].includes(req.user.role)) {
      return next();
    }

    // Users can only access their own resources
    if (req.user._id.toString() === userId.toString()) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: API_MESSAGES.FORBIDDEN,
      error: 'Access denied to this resource'
    });
  };
};

/**
 * Validate API key middleware
 * For external integrations
 */
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'API key required'
      });
    }

    // In production, validate against database
    const validApiKey = process.env.API_KEY || 'pvt-booking-api-key-change-in-production';
    
    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'Invalid API key'
      });
    }

    // Attach API client info to request
    req.apiClient = {
      type: 'external',
      key: apiKey,
      permissions: ['read', 'write'] // Configure based on API key
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: API_MESSAGES.SERVER_ERROR,
      error: error.message
    });
  }
};

/**
 * Refresh token middleware
 * Validates refresh token for token refresh endpoint
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'Refresh token required'
      });
    }

    let decoded;
    try {
      decoded = jwtUtils.verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: error.message
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: API_MESSAGES.UNAUTHORIZED,
        error: 'User not found or inactive'
      });
    }

    req.user = user;
    req.refreshToken = refreshToken;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: API_MESSAGES.SERVER_ERROR,
      error: error.message
    });
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  adminOnly,
  staffOrAdmin,
  canAccessResource,
  validateApiKey,
  validateRefreshToken
};