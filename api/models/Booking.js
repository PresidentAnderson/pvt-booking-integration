const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'checked_in', 'checked_out', 'no_show'],
    default: 'pending',
    required: true,
    index: true
  },
  checkInDate: {
    type: Date,
    required: true,
    index: true
  },
  checkOutDate: {
    type: Date,
    required: true,
    index: true
  },
  actualCheckIn: {
    type: Date
  },
  actualCheckOut: {
    type: Date
  },
  guestCount: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  guestDetails: {
    primaryGuest: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
      dateOfBirth: Date,
      nationality: String,
      idType: { type: String, enum: ['passport', 'license', 'id_card'] },
      idNumber: String
    },
    additionalGuests: [{
      firstName: String,
      lastName: String,
      dateOfBirth: Date,
      relationship: String
    }]
  },
  pricing: {
    baseAmount: { type: Number, required: true, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    fees: {
      cleaning: { type: Number, default: 0, min: 0 },
      service: { type: Number, default: 0, min: 0 },
      deposit: { type: Number, default: 0, min: 0 }
    },
    discounts: {
      amount: { type: Number, default: 0, min: 0 },
      type: { type: String, enum: ['percentage', 'fixed'] },
      code: String,
      reason: String
    },
    currency: { type: String, default: 'USD', uppercase: true },
    totalAmount: { type: Number, required: true, min: 0 }
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded', 'failed'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['card', 'bank_transfer', 'cash', 'paypal', 'other']
    },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    stripePaymentIntentId: String,
    transactions: [{
      amount: Number,
      type: { type: String, enum: ['payment', 'refund'] },
      method: String,
      reference: String,
      processedAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'completed', 'failed'] }
    }]
  },
  specialRequests: [{
    type: { type: String, enum: ['dietary', 'accessibility', 'room_preference', 'other'] },
    description: String,
    fulfilled: { type: Boolean, default: false }
  }],
  source: {
    type: String,
    enum: ['direct', 'booking_com', 'airbnb', 'hostelworld', 'phone', 'walk_in', 'api'],
    default: 'direct'
  },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    refundAmount: { type: Number, default: 0 },
    refundProcessed: { type: Boolean, default: false }
  },
  notes: [{
    content: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['general', 'housekeeping', 'maintenance', 'guest_request'] }
  }],
  checkInProcess: {
    documentsVerified: { type: Boolean, default: false },
    depositCollected: { type: Boolean, default: false },
    keyIssued: { type: Boolean, default: false },
    orientationCompleted: { type: Boolean, default: false },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  checkOutProcess: {
    roomInspected: { type: Boolean, default: false },
    damagesNoted: String,
    depositReturned: { type: Boolean, default: false },
    keyReturned: { type: Boolean, default: false },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

// Compound indexes for performance
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ room: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ status: 1, checkInDate: 1 });
bookingSchema.index({ bookingReference: 1 });
bookingSchema.index({ 'guestDetails.primaryGuest.email': 1 });

// Virtual for number of nights
bookingSchema.virtual('nights').get(function() {
  const diffTime = Math.abs(this.checkOutDate - this.checkInDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days until check-in
bookingSchema.virtual('daysUntilCheckIn').get(function() {
  const today = new Date();
  const diffTime = this.checkInDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for booking duration in days
bookingSchema.virtual('duration').get(function() {
  if (!this.actualCheckIn || !this.actualCheckOut) return 0;
  const diffTime = Math.abs(this.actualCheckOut - this.actualCheckIn);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to generate booking reference
bookingSchema.pre('save', async function(next) {
  if (this.isNew && !this.bookingReference) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.bookingReference = `PVT${timestamp}${random}`;
  }
  
  // Calculate remaining amount
  this.payment.remainingAmount = Math.max(0, this.pricing.totalAmount - this.payment.paidAmount);
  
  next();
});

// Pre-save validation for dates
bookingSchema.pre('save', function(next) {
  if (this.checkInDate >= this.checkOutDate) {
    return next(new Error('Check-out date must be after check-in date'));
  }
  
  // Check-in date cannot be in the past (except for existing bookings)
  if (this.isNew && this.checkInDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    return next(new Error('Check-in date cannot be in the past'));
  }
  
  next();
});

// Instance method to check if booking is active
bookingSchema.methods.isActive = function() {
  return ['confirmed', 'checked_in'].includes(this.status);
};

// Instance method to check if booking is modifiable
bookingSchema.methods.canModify = function() {
  const now = new Date();
  const checkIn = new Date(this.checkInDate);
  const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);
  
  return ['pending', 'confirmed'].includes(this.status) && hoursUntilCheckIn > 24;
};

// Instance method to calculate cancellation fee
bookingSchema.methods.calculateCancellationFee = function() {
  const now = new Date();
  const checkIn = new Date(this.checkInDate);
  const hoursUntilCheckIn = (checkIn - now) / (1000 * 60 * 60);
  
  let feePercentage = 0;
  
  if (hoursUntilCheckIn < 24) {
    feePercentage = 100; // No refund
  } else if (hoursUntilCheckIn < 48) {
    feePercentage = 50;  // 50% fee
  } else if (hoursUntilCheckIn < 168) { // 7 days
    feePercentage = 25;  // 25% fee
  } else {
    feePercentage = 10;  // 10% processing fee
  }
  
  return (this.pricing.totalAmount * feePercentage) / 100;
};

// Static method to find overlapping bookings
bookingSchema.statics.findOverlapping = function(roomId, checkIn, checkOut, excludeId = null) {
  const query = {
    room: roomId,
    status: { $in: ['confirmed', 'checked_in'] },
    $or: [
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query);
};

// Static method for booking analytics
bookingSchema.statics.getAnalytics = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        checkInDate: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        averageStay: { $avg: { $divide: [{ $subtract: ['$checkOutDate', '$checkInDate'] }, 86400000] } },
        statusBreakdown: {
          $push: '$status'
        }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Booking', bookingSchema);