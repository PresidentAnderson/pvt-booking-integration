const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeUtils {
  constructor() {
    this.stripe = stripe;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create payment intent
   * @param {Object} options - Payment options
   * @returns {Object} Payment intent
   */
  async createPaymentIntent({
    amount,
    currency = 'usd',
    customerId = null,
    description = '',
    metadata = {},
    paymentMethodTypes = ['card']
  }) {
    try {
      const paymentIntentData = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method_types: paymentMethodTypes,
        description,
        metadata: {
          ...metadata,
          source: 'pvt-booking-api'
        },
        capture_method: 'automatic'
      };

      if (customerId) {
        paymentIntentData.customer = customerId;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);
      return paymentIntent;

    } catch (error) {
      console.error('Stripe create payment intent error:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm payment intent
   * @param {String} paymentIntentId - Payment intent ID
   * @param {String} paymentMethodId - Payment method ID
   * @returns {Object} Confirmed payment intent
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });
      return paymentIntent;

    } catch (error) {
      console.error('Stripe confirm payment intent error:', error);
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent
   * @param {String} paymentIntentId - Payment intent ID
   * @returns {Object} Payment intent
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Stripe retrieve payment intent error:', error);
      throw new Error(`Payment retrieval failed: ${error.message}`);
    }
  }

  /**
   * Cancel payment intent
   * @param {String} paymentIntentId - Payment intent ID
   * @returns {Object} Cancelled payment intent
   */
  async cancelPaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      console.error('Stripe cancel payment intent error:', error);
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  /**
   * Create customer
   * @param {Object} customerData - Customer data
   * @returns {Object} Stripe customer
   */
  async createCustomer({ email, name, phone, metadata = {} }) {
    try {
      return await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          ...metadata,
          source: 'pvt-booking-api'
        }
      });
    } catch (error) {
      console.error('Stripe create customer error:', error);
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve customer
   * @param {String} customerId - Customer ID
   * @returns {Object} Stripe customer
   */
  async retrieveCustomer(customerId) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      console.error('Stripe retrieve customer error:', error);
      throw new Error(`Customer retrieval failed: ${error.message}`);
    }
  }

  /**
   * Create refund
   * @param {Object} refundData - Refund data
   * @returns {Object} Refund
   */
  async createRefund({
    paymentIntentId,
    amount = null,
    reason = 'requested_by_customer',
    metadata = {}
  }) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason,
        metadata: {
          ...metadata,
          source: 'pvt-booking-api'
        }
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      return await this.stripe.refunds.create(refundData);

    } catch (error) {
      console.error('Stripe create refund error:', error);
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }

  /**
   * Retrieve refund
   * @param {String} refundId - Refund ID
   * @returns {Object} Refund
   */
  async retrieveRefund(refundId) {
    try {
      return await this.stripe.refunds.retrieve(refundId);
    } catch (error) {
      console.error('Stripe retrieve refund error:', error);
      throw new Error(`Refund retrieval failed: ${error.message}`);
    }
  }

  /**
   * List payment methods for customer
   * @param {String} customerId - Customer ID
   * @param {String} type - Payment method type
   * @returns {Array} Payment methods
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Stripe list payment methods error:', error);
      throw new Error(`Payment methods retrieval failed: ${error.message}`);
    }
  }

  /**
   * Construct webhook event
   * @param {String} payload - Webhook payload
   * @param {String} signature - Webhook signature
   * @returns {Object} Webhook event
   */
  constructWebhookEvent(payload, signature) {
    try {
      if (!this.webhookSecret) {
        throw new Error('Webhook secret not configured');
      }

      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      console.error('Stripe webhook construction error:', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Calculate application fee
   * @param {Number} amount - Transaction amount
   * @param {Number} feePercentage - Fee percentage (default 2.9%)
   * @param {Number} fixedFee - Fixed fee in currency units (default 0.30)
   * @returns {Object} Fee calculation
   */
  calculateFees(amount, feePercentage = 2.9, fixedFee = 0.30) {
    const percentageFee = (amount * feePercentage) / 100;
    const totalFees = percentageFee + fixedFee;
    const netAmount = amount - totalFees;

    return {
      amount,
      percentageFee: Math.round(percentageFee * 100) / 100,
      fixedFee,
      totalFees: Math.round(totalFees * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100
    };
  }

  /**
   * Format amount for Stripe (convert to cents)
   * @param {Number} amount - Amount in currency units
   * @returns {Number} Amount in cents
   */
  formatAmountForStripe(amount) {
    return Math.round(amount * 100);
  }

  /**
   * Format amount from Stripe (convert from cents)
   * @param {Number} amount - Amount in cents
   * @returns {Number} Amount in currency units
   */
  formatAmountFromStripe(amount) {
    return amount / 100;
  }

  /**
   * Get payment method details
   * @param {Object} paymentMethod - Stripe payment method
   * @returns {Object} Formatted payment method details
   */
  formatPaymentMethodDetails(paymentMethod) {
    if (!paymentMethod) return null;

    const details = {
      id: paymentMethod.id,
      type: paymentMethod.type
    };

    if (paymentMethod.card) {
      details.card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
        funding: paymentMethod.card.funding,
        country: paymentMethod.card.country
      };
    }

    return details;
  }

  /**
   * Handle common Stripe errors
   * @param {Error} error - Stripe error
   * @returns {Object} Formatted error response
   */
  handleStripeError(error) {
    const errorResponse = {
      type: error.type || 'stripe_error',
      message: error.message || 'An error occurred while processing payment',
      code: error.code,
      decline_code: error.decline_code,
      param: error.param
    };

    switch (error.type) {
      case 'StripeCardError':
        errorResponse.userMessage = 'Your card was declined. Please try a different payment method.';
        break;
      case 'StripeInvalidRequestError':
        errorResponse.userMessage = 'Invalid payment information provided.';
        break;
      case 'StripeAPIError':
        errorResponse.userMessage = 'Payment processing is temporarily unavailable. Please try again.';
        break;
      case 'StripeConnectionError':
        errorResponse.userMessage = 'Network error. Please check your connection and try again.';
        break;
      case 'StripeAuthenticationError':
        errorResponse.userMessage = 'Payment processing configuration error.';
        break;
      default:
        errorResponse.userMessage = 'An unexpected error occurred. Please try again.';
    }

    return errorResponse;
  }
}

module.exports = new StripeUtils();