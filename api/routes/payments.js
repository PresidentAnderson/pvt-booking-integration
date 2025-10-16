const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { authenticate, staffOrAdmin } = require('../middleware/auth');
const {
  validatePayment,
  validateListingQuery,
  validateDateRange,
  validateMongoId
} = require('../middleware/validation');
const { body } = require('express-validator');

// Apply authentication to all routes except webhooks
router.use((req, res, next) => {
  if (req.path === '/webhook') {
    return next();
  }
  authenticate(req, res, next);
});

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create payment intent for booking
 * @access  Private
 */
router.post(
  '/create-intent',
  validatePayment,
  paymentController.createPaymentIntent
);

/**
 * @route   GET /api/payments
 * @desc    Get all payments with filtering
 * @access  Private
 */
router.get(
  '/',
  validateListingQuery,
  validateDateRange,
  paymentController.getAllPayments
);

/**
 * @route   GET /api/payments/analytics
 * @desc    Get payment analytics
 * @access  Private (Staff and Admin only)
 */
router.get(
  '/analytics',
  staffOrAdmin,
  validateDateRange,
  paymentController.getPaymentAnalytics
);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateMongoId('id'),
  paymentController.getPaymentById
);

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Create refund for payment
 * @access  Private (Staff and Admin only)
 */
router.post(
  '/:id/refund',
  validateMongoId('id'),
  staffOrAdmin,
  [
    body('amount')
      .optional()
      .isNumeric({ min: 0.01 })
      .withMessage('Refund amount must be greater than 0'),
    
    body('reason')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Reason must be between 1 and 200 characters')
  ],
  paymentController.createRefund
);

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public (but requires Stripe signature)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

module.exports = router;