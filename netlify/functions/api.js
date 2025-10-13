const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    platform: 'netlify'
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
      },
      {
        id: '2',
        guestName: 'Jane Smith',
        checkIn: '2024-10-20',
        checkOut: '2024-10-22',
        status: 'pending'
      }
    ],
    total: 2,
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
    occupancyRate: 0.89,
    platform: 'netlify'
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'PVT Booking Integration API',
    version: '1.0.0',
    description: 'Enterprise-grade booking integration API',
    platform: 'netlify',
    endpoints: {
      '/api/health': 'Health check endpoint',
      '/api/bookings': 'Booking management',
      '/api/metrics': 'System metrics',
      '/api/docs': 'API documentation'
    }
  });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'PVT Booking Integration API',
    version: '1.0.0',
    description: 'Enterprise-grade booking integration API with payment processing',
    status: 'active',
    platform: 'netlify',
    endpoints: {
      health: '/api/health',
      bookings: '/api/bookings',
      metrics: '/api/metrics',
      docs: '/api/docs'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', platform: 'netlify' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', platform: 'netlify' });
});

exports.handler = serverless(app);