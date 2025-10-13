const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Bookings endpoint (mock data for now)
app.get('/api/bookings', (req, res) => {
  res.json({
    bookings: [
      {
        id: '1',
        guestName: 'John Doe',
        checkIn: '2024-10-15',
        checkOut: '2024-10-18',
        status: 'confirmed'
      }
    ],
    total: 1,
    page: 1
  });
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    totalBookings: 1247,
    activeBookings: 23,
    revenue: 45678.90,
    averageStay: 2.3,
    occupancyRate: 0.89
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'PVT Booking Integration API',
    version: '1.0.0',
    description: 'Enterprise-grade booking integration API',
    endpoints: {
      '/api/health': 'Health check endpoint',
      '/api/bookings': 'Booking management',
      '/api/metrics': 'System metrics',
      '/api/docs': 'API documentation'
    }
  });
});

// Serve HTML for browsers, JSON for API requests
app.get('/', (req, res) => {
  if (req.accepts('html') && !req.headers['x-api-request']) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.json({
      name: 'PVT Booking Integration API',
      version: '1.0.0',
      description: 'Enterprise-grade booking integration API with payment processing',
      status: 'active',
      endpoints: {
        health: '/api/health',
        bookings: '/api/bookings',
        metrics: '/api/metrics',
        docs: '/api/docs'
      }
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;