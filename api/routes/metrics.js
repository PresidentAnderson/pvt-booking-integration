const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metricsController');
const { authenticate, staffOrAdmin } = require('../middleware/auth');
const { validateDateRange } = require('../middleware/validation');

// Apply authentication to all routes - only staff and admin can access metrics
router.use(authenticate);
router.use(staffOrAdmin);

/**
 * @route   GET /api/metrics/dashboard
 * @desc    Get comprehensive dashboard metrics
 * @access  Private (Staff and Admin only)
 */
router.get(
  '/dashboard',
  metricsController.getDashboardMetrics
);

/**
 * @route   GET /api/metrics/custom
 * @desc    Get custom metrics for specific date range and types
 * @access  Private (Staff and Admin only)
 */
router.get(
  '/custom',
  validateDateRange,
  metricsController.getCustomMetrics
);

module.exports = router;