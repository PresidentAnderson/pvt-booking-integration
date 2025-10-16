const { Payment, Booking, User } = require('../models');
const stripeUtils = require('../utils/stripe');
const { API_MESSAGES, PAYMENT_STATUS } = require('../config/constants');

class PaymentController {
  /**
   * Create payment intent for booking
   */
  async createPaymentIntent(req, res) {
    try {
      const { bookingId, amount, currency = 'USD', description } = req.body;

      // Find booking
      const booking = await Booking.findById(bookingId)
        .populate('user', 'firstName lastName email')
        .populate('room', 'roomNumber type');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Check if user can pay for this booking
      if (req.user.role === 'guest' && booking.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Access denied to this booking'
        });
      }

      // Check if booking can be paid
      if (booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Cannot pay for cancelled booking'
        });
      }

      // Validate amount
      const requestedAmount = amount || booking.payment.remainingAmount;
      if (requestedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Invalid payment amount'
        });
      }

      if (requestedAmount > booking.payment.remainingAmount) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Amount exceeds remaining balance'
        });
      }

      // Create Stripe customer if needed
      let stripeCustomerId = booking.user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripeUtils.createCustomer({
          email: booking.user.email,
          name: booking.user.getFullName(),
          phone: booking.user.phone,
          metadata: {
            userId: booking.user._id.toString()
          }
        });
        
        stripeCustomerId = customer.id;
        // Update user with Stripe customer ID
        booking.user.stripeCustomerId = stripeCustomerId;
        await User.findByIdAndUpdate(booking.user._id, { stripeCustomerId });
      }

      // Create payment intent
      const paymentIntent = await stripeUtils.createPaymentIntent({
        amount: requestedAmount,
        currency: currency.toLowerCase(),
        customerId: stripeCustomerId,
        description: description || `Payment for booking ${booking.bookingReference} - Room ${booking.room.roomNumber}`,
        metadata: {
          bookingId: booking._id.toString(),
          userId: booking.user._id.toString(),
          bookingReference: booking.bookingReference,
          roomNumber: booking.room.roomNumber
        }
      });

      // Create payment record
      const payment = new Payment({
        booking: booking._id,
        user: booking.user._id,
        amount: requestedAmount,
        currency: currency.toUpperCase(),
        status: PAYMENT_STATUS.PENDING,
        paymentMethod: {
          type: 'card'
        },
        stripePaymentIntentId: paymentIntent.id,
        description: paymentIntent.description
      });

      await payment.save();

      res.json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: paymentIntent.status
          },
          payment: {
            id: payment._id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status
          },
          booking: {
            id: booking._id,
            reference: booking.bookingReference,
            remainingAmount: booking.payment.remainingAmount
          }
        }
      });

    } catch (error) {
      console.error('Create payment intent error:', error);
      
      // Handle Stripe errors
      if (error.type && error.type.startsWith('Stripe')) {
        const stripeError = stripeUtils.handleStripeError(error);
        return res.status(400).json({
          success: false,
          message: stripeError.userMessage,
          error: stripeError
        });
      }

      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Process successful payment
   */
  async processSuccessfulPayment(paymentIntentId) {
    try {
      // Find payment record
      const payment = await Payment.findOne({ 
        stripePaymentIntentId: paymentIntentId 
      }).populate('booking user');

      if (!payment) {
        console.error('Payment record not found for payment intent:', paymentIntentId);
        return;
      }

      // Update payment status
      payment.status = PAYMENT_STATUS.SUCCEEDED;
      payment.processedAt = new Date();
      
      // Calculate fees
      const feeCalculation = stripeUtils.calculateFees(payment.amount);
      payment.fees.platform = feeCalculation.totalFees;

      await payment.save();

      // Update booking payment status
      const booking = payment.booking;
      booking.payment.paidAmount += payment.amount;
      booking.payment.remainingAmount = Math.max(0, 
        booking.pricing.totalAmount - booking.payment.paidAmount
      );

      // Update payment status based on remaining amount
      if (booking.payment.remainingAmount <= 0) {
        booking.payment.status = 'paid';
        // Confirm booking if it was pending
        if (booking.status === 'pending') {
          booking.status = 'confirmed';
        }
      } else {
        booking.payment.status = 'partial';
      }

      // Add transaction record
      booking.payment.transactions.push({
        amount: payment.amount,
        type: 'payment',
        method: 'card',
        reference: paymentIntentId,
        processedAt: new Date(),
        status: 'completed'
      });

      await booking.save();

      // TODO: Send confirmation email
      console.log(`Payment processed successfully: ${payment.amount} for booking ${booking.bookingReference}`);

    } catch (error) {
      console.error('Process successful payment error:', error);
    }
  }

  /**
   * Process failed payment
   */
  async processFailedPayment(paymentIntentId, failureDetails) {
    try {
      // Find payment record
      const payment = await Payment.findOne({ 
        stripePaymentIntentId: paymentIntentId 
      });

      if (!payment) {
        console.error('Payment record not found for payment intent:', paymentIntentId);
        return;
      }

      // Update payment status
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failureDetails = {
        ...failureDetails,
        failedAt: new Date()
      };

      await payment.save();

      console.log(`Payment failed: ${paymentIntentId}`, failureDetails);

    } catch (error) {
      console.error('Process failed payment error:', error);
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;

      const payment = await Payment.findById(id)
        .populate('booking', 'bookingReference status checkInDate checkOutDate')
        .populate('user', 'firstName lastName email')
        .lean();

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Payment not found'
        });
      }

      // Check access permissions
      if (req.user.role === 'guest' && payment.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Access denied to this payment'
        });
      }

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: { payment }
      });

    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get all payments with filtering
   */
  async getAllPayments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        userId,
        bookingId,
        startDate,
        endDate,
        sort = '-createdAt'
      } = req.query;

      // Build filter
      const filter = {};
      
      if (status) filter.status = status;
      if (bookingId) filter.booking = bookingId;
      
      // Date range filtering
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // User role-based filtering
      if (req.user.role === 'guest') {
        filter.user = req.user._id;
      } else if (userId) {
        filter.user = userId;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const payments = await Payment.find(filter)
        .populate('booking', 'bookingReference status checkInDate checkOutDate')
        .populate('user', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await Payment.countDocuments(filter);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          payments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Create refund
   */
  async createRefund(req, res) {
    try {
      const { id } = req.params;
      const { amount, reason = 'requested_by_customer' } = req.body;

      const payment = await Payment.findById(id)
        .populate('booking', 'bookingReference status')
        .populate('user', 'firstName lastName email');

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Payment not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest') {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Only staff can process refunds'
        });
      }

      // Check if payment can be refunded
      if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Only successful payments can be refunded'
        });
      }

      const refundAmount = amount || payment.amount;
      if (refundAmount > payment.refundableAmount) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Refund amount exceeds refundable amount'
        });
      }

      // Create Stripe refund
      const stripeRefund = await stripeUtils.createRefund({
        paymentIntentId: payment.stripePaymentIntentId,
        amount: refundAmount,
        reason,
        metadata: {
          paymentId: payment._id.toString(),
          processedBy: req.user._id.toString()
        }
      });

      // Update payment with refund
      await payment.processRefund(refundAmount, reason, req.user._id);

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refund: {
            id: stripeRefund.id,
            amount: stripeRefund.amount / 100,
            currency: stripeRefund.currency,
            status: stripeRefund.status,
            reason: stripeRefund.reason
          },
          payment
        }
      });

    } catch (error) {
      console.error('Create refund error:', error);
      
      // Handle Stripe errors
      if (error.type && error.type.startsWith('Stripe')) {
        const stripeError = stripeUtils.handleStripeError(error);
        return res.status(400).json({
          success: false,
          message: stripeError.userMessage,
          error: stripeError
        });
      }

      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing stripe signature'
        });
      }

      // Construct webhook event
      const event = stripeUtils.constructWebhookEvent(req.body, signature);

      console.log('Stripe webhook event:', event.type);

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.processSuccessfulPayment(event.data.object.id);
          break;

        case 'payment_intent.payment_failed':
          await this.processFailedPayment(event.data.object.id, {
            code: event.data.object.last_payment_error?.code,
            message: event.data.object.last_payment_error?.message,
            declineCode: event.data.object.last_payment_error?.decline_code
          });
          break;

        case 'payment_intent.canceled':
          await this.processFailedPayment(event.data.object.id, {
            message: 'Payment was cancelled'
          });
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({
        success: false,
        message: 'Webhook error',
        error: error.message
      });
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const analytics = await Payment.getAnalytics(start, end);
      const dailyRevenue = await Payment.getDailyRevenue(start, end);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          summary: analytics,
          dailyRevenue,
          period: { start, end }
        }
      });

    } catch (error) {
      console.error('Payment analytics error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();