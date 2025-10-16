const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD'
  },
  status: {
    type: String,
    enum: [
      'pending',
      'processing',
      'succeeded',
      'failed',
      'cancelled',
      'refunded',
      'partially_refunded'
    ],
    default: 'pending',
    required: true,
    index: true
  },
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'paypal', 'cash', 'crypto', 'other'],
      required: true
    },
    details: {
      // For card payments
      last4: String,
      brand: String, // visa, mastercard, etc.
      expMonth: Number,
      expYear: Number,
      
      // For bank transfers
      bankName: String,
      accountLast4: String,
      
      // For PayPal
      paypalEmail: String,
      
      // Generic details
      provider: String,
      fingerprint: String
    }
  },
  stripePaymentIntentId: {
    type: String,
    sparse: true,
    index: true
  },
  stripeChargeId: {
    type: String,
    sparse: true
  },
  externalTransactionId: {
    type: String,
    sparse: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  },
  fees: {
    platform: { type: Number, default: 0 }, // Stripe/payment processor fees
    processing: { type: Number, default: 0 }, // Our processing fees
    total: { type: Number, default: 0 }
  },
  refunds: [{
    amount: { type: Number, required: true },
    reason: String,
    stripeRefundId: String,
    processedAt: { type: Date, default: Date.now },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending'
    }
  }],
  failureDetails: {
    code: String,
    message: String,
    declineCode: String,
    networkStatus: String,
    reason: String,
    riskLevel: String,
    failedAt: Date
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receiptUrl: {
    type: String
  },
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  notes: [{
    content: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for performance
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ amount: 1 });

// Virtual for net amount (after fees)
paymentSchema.virtual('netAmount').get(function() {
  return this.amount - this.fees.total;
});

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds
    .filter(refund => refund.status === 'succeeded')
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for refundable amount
paymentSchema.virtual('refundableAmount').get(function() {
  if (this.status !== 'succeeded') return 0;
  return this.amount - this.totalRefunded;
});

// Pre-save middleware to generate receipt number
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber && this.status === 'succeeded') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString().slice(-4);
    
    this.receiptNumber = `PVT${year}${month}${day}${random}`;
  }
  
  // Calculate total fees
  this.fees.total = this.fees.platform + this.fees.processing;
  
  next();
});

// Instance method to process refund
paymentSchema.methods.processRefund = function(amount, reason, processedBy) {
  if (this.status !== 'succeeded') {
    throw new Error('Can only refund successful payments');
  }
  
  if (amount > this.refundableAmount) {
    throw new Error('Refund amount exceeds refundable amount');
  }
  
  this.refunds.push({
    amount,
    reason,
    processedBy,
    status: 'pending'
  });
  
  // Update payment status
  const totalRefunded = this.totalRefunded + amount;
  if (totalRefunded >= this.amount) {
    this.status = 'refunded';
  } else {
    this.status = 'partially_refunded';
  }
  
  return this.save();
};

// Instance method to mark as failed
paymentSchema.methods.markAsFailed = function(failureDetails) {
  this.status = 'failed';
  this.failureDetails = {
    ...failureDetails,
    failedAt: new Date()
  };
  return this.save();
};

// Static method for payment analytics
paymentSchema.statics.getAnalytics = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to find payments by date range
paymentSchema.statics.findByDateRange = function(startDate, endDate, status = null) {
  const query = {
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).populate('booking user', 'bookingReference firstName lastName email');
};

// Static method for daily revenue
paymentSchema.statics.getDailyRevenue = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        status: 'succeeded',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Payment', paymentSchema);