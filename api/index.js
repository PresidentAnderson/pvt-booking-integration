const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import middleware
const { 
  errorHandler, 
  notFound, 
  requestLogger, 
  securityHeaders, 
  validateRequest, 
  responseTime 
} = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiting');

// Import database connection
const database = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const roomRoutes = require('./routes/rooms');
const paymentRoutes = require('./routes/payments');
const metricsRoutes = require('./routes/metrics');

const app = express();

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));
app.use(securityHeaders);
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://pvt-booking-integration.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature']
};

app.use(cors(corsOptions));

// Request processing middleware
app.use(responseTime);
app.use(requestLogger);
app.use(validateRequest);

// Body parsing middleware (with raw body for webhooks)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting
app.use('/api', generalLimiter);

// Connect to database
database.connect().catch(console.error);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    
    res.json({ 
      success: true,
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime()),
      database: dbHealth,
      services: {
        api: 'healthy',
        database: dbHealth.status,
        stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured',
        email: process.env.SMTP_HOST ? 'configured' : 'not configured'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/metrics', metricsRoutes);

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'PVT Booking Integration API',
      version: '2.0.0',
      description: 'Enterprise-grade booking integration API with payment processing',
      environment: process.env.NODE_ENV || 'development',
      baseUrl: req.protocol + '://' + req.get('host'),
      endpoints: {
        // Authentication
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'User login',
        'POST /api/auth/refresh': 'Refresh access token',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'POST /api/auth/change-password': 'Change password',
        'POST /api/auth/forgot-password': 'Request password reset',
        'POST /api/auth/reset-password': 'Reset password with token',
        'GET /api/auth/users': 'Get all users (Admin only)',
        
        // Bookings
        'GET /api/bookings': 'Get all bookings',
        'POST /api/bookings': 'Create new booking',
        'GET /api/bookings/:id': 'Get booking by ID',
        'PUT /api/bookings/:id': 'Update booking',
        'DELETE /api/bookings/:id': 'Cancel booking',
        'POST /api/bookings/:id/checkin': 'Check-in guest',
        'POST /api/bookings/:id/checkout': 'Check-out guest',
        'GET /api/bookings/analytics': 'Get booking analytics',
        
        // Rooms
        'GET /api/rooms': 'Get all rooms',
        'POST /api/rooms': 'Create new room (Admin only)',
        'GET /api/rooms/search': 'Search available rooms',
        'GET /api/rooms/stats': 'Get room statistics',
        'GET /api/rooms/:id': 'Get room by ID',
        'PUT /api/rooms/:id': 'Update room (Admin only)',
        'DELETE /api/rooms/:id': 'Delete room (Admin only)',
        'GET /api/rooms/:id/availability': 'Check room availability',
        
        // Payments
        'POST /api/payments/create-intent': 'Create payment intent',
        'GET /api/payments': 'Get all payments',
        'GET /api/payments/:id': 'Get payment by ID',
        'POST /api/payments/:id/refund': 'Create refund',
        'POST /api/payments/webhook': 'Stripe webhook handler',
        'GET /api/payments/analytics': 'Get payment analytics',
        
        // Metrics
        'GET /api/metrics/dashboard': 'Get dashboard metrics',
        'GET /api/metrics/custom': 'Get custom metrics',
        
        // System
        'GET /api/health': 'Health check',
        'GET /api/docs': 'API documentation'
      },
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>',
        endpoints: {
          login: 'POST /api/auth/login',
          refresh: 'POST /api/auth/refresh'
        }
      },
      rateLimit: {
        general: '100 requests per 15 minutes',
        auth: '5 requests per 15 minutes',
        booking: '10 requests per hour',
        payment: '10 requests per 15 minutes'
      }
    }
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'PVT Booking Integration API',
      version: '2.0.0',
      description: 'Enterprise-grade booking integration API with payment processing',
      status: 'active',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        docs: '/api/docs',
        auth: '/api/auth',
        bookings: '/api/bookings',
        rooms: '/api/rooms',
        payments: '/api/payments',
        metrics: '/api/metrics'
      }
    }
  });
});

// Serve HTML for browsers
app.get('/', (req, res) => {
  if (req.accepts('html') && !req.headers['x-api-request']) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.redirect('/api');
  }
});

// 404 handler for undefined routes
app.use('*', notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;