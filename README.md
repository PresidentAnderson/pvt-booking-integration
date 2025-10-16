# PVT Booking Integration API

Enterprise-grade booking integration API for hostels/hotels with payment processing, real-time availability checking, and comprehensive analytics.

## Features

### Core Functionality
- **User Management**: JWT-based authentication with role-based access control (Guest, Staff, Admin)
- **Room Management**: Full CRUD operations with availability checking and occupancy tracking
- **Booking System**: Complete booking lifecycle management (Create, Read, Update, Cancel, Check-in, Check-out)
- **Payment Processing**: Stripe integration with webhooks, refunds, and comprehensive payment tracking
- **Real-time Analytics**: Dashboard metrics, revenue tracking, and occupancy analytics
- **Email Notifications**: Automated booking confirmations, reminders, and payment receipts

### Technical Features
- **Database**: MongoDB with Mongoose ODM + Optional Neon PostgreSQL integration
- **Security**: Rate limiting, input validation, CORS, helmet security headers
- **Error Handling**: Comprehensive error handling with detailed logging
- **Testing**: Unit and integration tests with Jest
- **Documentation**: Complete API documentation with examples
- **Deployment**: Netlify Functions compatible with serverless architecture
- **MCP Integration**: Claude Code Model Context Protocol support for database operations

## Quick Start

### Prerequisites
- Node.js 18.x or higher
- MongoDB (local or cloud) OR Neon PostgreSQL
- Stripe account for payments
- SMTP server for emails (optional)
- Claude Code with MCP integration (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pvt-booking-integration
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/pvt-booking
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   
   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   
   # Email Configuration (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=noreply@pvthostel.com
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Visit the API**
   - API: http://localhost:3000/api
   - Health Check: http://localhost:3000/api/health
   - Documentation: http://localhost:3000/api/docs

## API Documentation

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.netlify.app/api`

### Authentication
All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `POST /auth/refresh` - Refresh access token

#### Rooms
- `GET /rooms` - List all rooms
- `GET /rooms/search` - Search available rooms
- `GET /rooms/:id` - Get room details
- `GET /rooms/:id/availability` - Check room availability
- `POST /rooms` - Create room (Admin only)
- `PUT /rooms/:id` - Update room (Admin only)

#### Bookings
- `GET /bookings` - List bookings (filtered by user role)
- `POST /bookings` - Create new booking
- `GET /bookings/:id` - Get booking details
- `PUT /bookings/:id` - Update booking
- `DELETE /bookings/:id` - Cancel booking
- `POST /bookings/:id/checkin` - Check-in guest (Staff only)
- `POST /bookings/:id/checkout` - Check-out guest (Staff only)

#### Payments
- `POST /payments/create-intent` - Create payment intent
- `GET /payments` - List payments
- `GET /payments/:id` - Get payment details
- `POST /payments/:id/refund` - Process refund (Staff only)
- `POST /payments/webhook` - Stripe webhook handler

#### Analytics & Metrics
- `GET /metrics/dashboard` - Dashboard metrics (Staff only)
- `GET /metrics/custom` - Custom metrics with date ranges (Staff only)

### Request/Response Examples

#### Create a Booking
```bash
POST /api/bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "roomId": "64a1b2c3d4e5f6789abcdef0",
  "checkInDate": "2024-12-01",
  "checkOutDate": "2024-12-03",
  "guestCount": 2,
  "guestDetails": {
    "primaryGuest": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890"
    }
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Resource created successfully",
  "data": {
    "booking": {
      "_id": "64a1b2c3d4e5f6789abcdef1",
      "bookingReference": "PVT123456ABC",
      "status": "pending",
      "checkInDate": "2024-12-01T00:00:00.000Z",
      "checkOutDate": "2024-12-03T00:00:00.000Z",
      "guestCount": 2,
      "pricing": {
        "baseAmount": 100,
        "taxes": 15,
        "totalAmount": 115
      }
    }
  }
}
```

#### Create Payment Intent
```bash
POST /api/payments/create-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingId": "64a1b2c3d4e5f6789abcdef1",
  "amount": 115,
  "currency": "USD"
}
```

Response:
```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "paymentIntent": {
      "id": "pi_1234567890abcdef",
      "clientSecret": "pi_1234567890abcdef_secret_xyz",
      "amount": 115,
      "currency": "usd",
      "status": "requires_payment_method"
    }
  }
}
```

## Database Schema

### User Model
```javascript
{
  firstName: String (required),
  lastName: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  phone: String (optional),
  role: String (guest|staff|admin),
  isActive: Boolean,
  preferences: Object,
  profile: Object,
  timestamps: true
}
```

### Room Model
```javascript
{
  roomNumber: String (required, unique),
  type: String (private|shared|dorm|suite),
  capacity: Number (required),
  basePrice: Number (required),
  amenities: [String],
  status: String (available|occupied|maintenance|cleaning),
  isActive: Boolean,
  images: [Object],
  description: String,
  timestamps: true
}
```

### Booking Model
```javascript
{
  bookingReference: String (auto-generated),
  user: ObjectId (ref: User),
  room: ObjectId (ref: Room),
  status: String (pending|confirmed|cancelled|checked_in|checked_out),
  checkInDate: Date,
  checkOutDate: Date,
  guestCount: Number,
  guestDetails: Object,
  pricing: Object,
  payment: Object,
  timestamps: true
}
```

### Payment Model
```javascript
{
  booking: ObjectId (ref: Booking),
  user: ObjectId (ref: User),
  amount: Number,
  currency: String,
  status: String (pending|succeeded|failed|refunded),
  stripePaymentIntentId: String,
  paymentMethod: Object,
  refunds: [Object],
  timestamps: true
}
```

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test -- --watch
```

### Code Quality
```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint -- --fix
```

### Database Seeding (Development)
```javascript
// Create sample data for development
const { User, Room } = require('./api/models');

// Create admin user
const admin = new User({
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@pvthostel.com',
  password: 'Admin123!',
  role: 'admin'
});
await admin.save();

// Create sample rooms
const rooms = [
  {
    roomNumber: '101',
    type: 'private',
    capacity: 2,
    basePrice: 80,
    amenities: ['wifi', 'ac', 'bathroom', 'tv']
  },
  {
    roomNumber: '201',
    type: 'dorm',
    capacity: 6,
    basePrice: 25,
    amenities: ['wifi', 'shared_bathroom', 'locker']
  }
];

for (const roomData of rooms) {
  const room = new Room(roomData);
  await room.save();
}
```

## Deployment

### Netlify Functions

1. **Build Configuration**
   ```json
   {
     "build": {
       "functions": "netlify/functions",
       "publish": "public"
     },
     "redirects": [
       {
         "from": "/api/*",
         "to": "/.netlify/functions/api/:splat",
         "status": 200
       }
     ]
   }
   ```

2. **Environment Variables**
   Set these in your Netlify dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - Email configuration variables

3. **Deploy**
   ```bash
   # Build and deploy
   npm run build
   netlify deploy --prod
   ```

### Traditional Server

1. **Using PM2**
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start application
   pm2 start api/index.js --name pvt-booking-api
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

2. **Using Docker**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

## Security Considerations

### Production Checklist
- [ ] Change all default secrets and passwords
- [ ] Use HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Set up proper database access controls
- [ ] Enable MongoDB authentication
- [ ] Configure rate limiting appropriately
- [ ] Set up monitoring and logging
- [ ] Regular security updates
- [ ] Backup strategy implemented

### Rate Limits
- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Booking creation: 10 requests per hour
- Payment processing: 10 requests per 15 minutes

## Monitoring & Analytics

### Health Check
The API provides a comprehensive health check at `/api/health`:
- Database connectivity
- Service status
- Environment information
- Uptime metrics

### Metrics Dashboard
Staff and admin users can access real-time metrics:
- Total bookings and revenue
- Room occupancy rates
- User registration trends
- Payment analytics
- System performance metrics

### Logging
- Request/response logging in development
- Error logging with stack traces
- Performance monitoring
- Security event logging

## Support & Contributing

### Common Issues

**Database Connection Issues**
```bash
# Check MongoDB connection
mongosh "mongodb://localhost:27017/pvt-booking"

# Verify environment variables
echo $MONGODB_URI
```

**Payment Processing Issues**
- Verify Stripe keys are correct
- Check webhook endpoint configuration
- Test with Stripe's test cards

**Authentication Issues**
- Verify JWT secret is set
- Check token expiration
- Validate user roles and permissions

### API Response Format
All API responses follow this structure:
```json
{
  "success": boolean,
  "message": string,
  "data": object,
  "error": string,
  "errors": array
}
```

### Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## License

MIT License - see LICENSE file for details.

---

For technical support or questions, contact: support@pvthostel.com