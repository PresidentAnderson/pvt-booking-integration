const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate, adminOnly, validateRefreshToken, optionalAuth } = require('../middleware/auth');
const {
  validateUserRegistration,
  validateUserLogin,
  validateEmail,
  validatePassword,
  validateListingQuery,
  handleValidationErrors
} = require('../middleware/validation');
const { body } = require('express-validator');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public (but staff/admin creation requires admin auth)
 */
router.post(
  '/register',
  optionalAuth, // Optional auth to check if admin is creating staff/admin
  validateUserRegistration,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  validateUserLogin,
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private (requires valid refresh token)
 */
router.post(
  '/refresh',
  validateRefreshToken,
  authController.refreshToken
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    
    body('phone')
      .optional()
      .matches(/^\+?[\d\s\-\(\)]+$/)
      .withMessage('Please provide a valid phone number'),
    
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    
    handleValidationErrors
  ],
  authController.updateProfile
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    handleValidationErrors
  ],
  authController.changePassword
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  validateEmail,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    
    handleValidationErrors
  ],
  authController.resetPassword
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route   GET /api/auth/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get(
  '/users',
  authenticate,
  adminOnly,
  validateListingQuery,
  authController.getAllUsers
);

module.exports = router;