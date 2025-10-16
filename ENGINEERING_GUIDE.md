# PVT Booking Integration - Engineering Guide

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.0.0
- **MongoDB** (local or Atlas)
- **npm** or **yarn**
- **Stripe Account** (for payments)
- **SMTP Email Service** (Gmail, SendGrid, etc.)

### Initial Setup

#### 1. Clone and Install
```bash
git clone https://github.com/PresidentAnderson/pvt-booking-integration.git
cd pvt-booking-integration
npm install
```

#### 2. Environment Configuration
Copy the example environment file and configure:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/pvt-booking
# or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/pvt-booking

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="PVT Booking <noreply@pvthostel.com>"

# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000

# Security
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX=100    # requests per window
```

#### 3. Database Setup
Start MongoDB locally or ensure Atlas connection, then:
```bash
# The application will auto-create collections on first run
npm run dev
```

#### 4. Stripe Webhook Setup
1. Install Stripe CLI: `stripe login`
2. Forward webhooks to local development:
```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```
3. Copy the webhook secret to your `.env` file

### Development Commands

#### Start Development Server
```bash
npm run dev        # Starts with nodemon (auto-restart)
npm start         # Production start
```

#### Run Tests
```bash
npm test          # Run all tests
npm test -- --watch  # Watch mode
npm test -- --coverage  # With coverage report
```

#### Code Quality
```bash
npm run lint      # Check code standards
npm run lint:fix  # Auto-fix linting issues
```

#### Build & Deploy
```bash
npm run build     # Build for production
```

## 🏗️ Architecture Deep Dive

### Request Flow
```
Client Request → Middleware Stack → Route Handler → Controller → Service → Database
                                                               ↓
Client Response ← Response Format ← Controller ← Service Response ← Database
```

### Middleware Stack
1. **Security Headers** (Helmet)
2. **CORS Configuration**
3. **Rate Limiting**
4. **Request Logging**
5. **Body Parsing**
6. **Authentication** (protected routes)
7. **Request Validation**
8. **Error Handling**

### Database Schema

#### User Model
```javascript
{
  email: String (unique, required),
  password: String (hashed),
  firstName: String,
  lastName: String,
  phone: String,
  role: Enum ['Guest', 'Staff', 'Admin'],
  isActive: Boolean,
  emailVerified: Boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Room Model
```javascript
{
  number: String (unique, required),
  type: Enum ['Dormitory', 'Private', 'Suite'],
  capacity: Number,
  pricePerNight: Number,
  amenities: [String],
  description: String,
  isAvailable: Boolean,
  floor: Number,
  images: [String],
  createdAt: Date,
  updatedAt: Date
}
```

#### Booking Model
```javascript
{
  bookingNumber: String (unique),
  user: ObjectId (ref: User),
  room: ObjectId (ref: Room),
  guestDetails: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    idNumber: String
  },
  checkInDate: Date,
  checkOutDate: Date,
  numberOfGuests: Number,
  status: Enum ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled'],
  pricing: {
    baseAmount: Number,
    taxAmount: Number,
    serviceAmount: Number,
    discountAmount: Number,
    totalAmount: Number
  },
  payment: ObjectId (ref: Payment),
  specialRequests: String,
  cancellationReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Payment Model
```javascript
{
  booking: ObjectId (ref: Booking),
  stripePaymentIntentId: String,
  amount: Number,
  currency: String,
  status: Enum ['Pending', 'Succeeded', 'Failed', 'Cancelled', 'Refunded'],
  paymentMethod: String,
  refunds: [{
    amount: Number,
    reason: String,
    processedAt: Date
  }],
  stripeData: Object,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔐 Security Implementation

### Authentication Flow
1. **Login**: Verify credentials → Generate JWT + Refresh Token
2. **Request**: Include `Authorization: Bearer <token>`
3. **Middleware**: Verify JWT → Extract user → Add to `req.user`
4. **Refresh**: Exchange refresh token for new access token

### Authorization Levels
- **Guest**: Own bookings, profile management
- **Staff**: All bookings, room management, guest check-in/out
- **Admin**: Full system access, user management, room CRUD

### Rate Limiting
- **General API**: 100 requests/15 minutes
- **Authentication**: 5 requests/15 minutes  
- **Booking Creation**: 10 requests/hour
- **Payment Processing**: 10 requests/15 minutes

## 🧪 Testing Strategy

### Test Structure
```
tests/
├── unit/              # Unit tests
│   ├── models/        # Model validation tests
│   ├── services/      # Business logic tests
│   └── utils/         # Utility function tests
├── integration/       # API endpoint tests
│   ├── auth.test.js
│   ├── bookings.test.js
│   ├── payments.test.js
│   └── rooms.test.js
└── fixtures/          # Test data
    └── testData.js
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test tests/integration/auth.test.js

# Run with coverage
npm test -- --coverage

# Watch mode during development
npm test -- --watch
```

### Test Database
Tests use MongoDB Memory Server for isolated testing:
```javascript
// Automatic setup in jest.config.js
// No manual database setup required for testing
```

## 🚀 Deployment Guide

### Environment Setup

#### Production Environment Variables
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://prod-user:password@cluster.mongodb.net/pvt-booking
JWT_SECRET=super-secure-production-secret
STRIPE_SECRET_KEY=sk_live_your_live_key
FRONTEND_URL=https://your-domain.com
```

### Netlify Deployment

#### Automatic Deploy (Recommended)
1. Connect GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy automatically on git push

#### Manual Deploy
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod --dir public --functions netlify/functions
```

### Database Migration
```bash
# Create indexes for performance
# Run in MongoDB shell or Compass
db.bookings.createIndex({ "user": 1, "checkInDate": -1 })
db.bookings.createIndex({ "status": 1, "checkInDate": 1 })
db.rooms.createIndex({ "isAvailable": 1, "type": 1 })
db.users.createIndex({ "email": 1 }, { unique: true })
```

## 🔧 Configuration Management

### Key Configuration Files

#### `api/config/database.js`
- MongoDB connection management
- Connection pooling
- Health check implementation

#### `api/config/email.js`
- SMTP configuration
- Email templates
- Delivery settings

#### `netlify.toml`
- Netlify build settings
- Function configuration
- Redirect rules

## 🐛 Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check MongoDB status
mongosh --eval "db.runCommand({connectionStatus: 1})"

# Test connection string
mongosh "your_connection_string"
```

#### Environment Variables
```bash
# Check if variables are loaded
node -e "console.log(process.env.JWT_SECRET)"
```

#### Stripe Webhooks
```bash
# Test webhook endpoint
stripe listen --forward-to localhost:3000/api/payments/webhook
```

### Debugging
```bash
# Enable debug logging
DEBUG=app:* npm run dev

# View application logs
tail -f logs/app.log
```

## 📊 Monitoring & Maintenance

### Health Checks
- **Endpoint**: `GET /api/health`
- **Database**: Connection status
- **Services**: Stripe, Email availability

### Performance Monitoring
- Response time tracking
- Database query optimization
- Memory usage monitoring

### Backup Strategy
- **Database**: Daily automated backups
- **Code**: Git repository backups
- **Environment**: Secure credential storage

## 🔄 Development Workflow

### Git Workflow
1. **Feature Branch**: `git checkout -b feature/new-feature`
2. **Development**: Make changes, write tests
3. **Testing**: `npm test` - ensure all tests pass
4. **Code Quality**: `npm run lint` - fix any issues
5. **Commit**: `git commit -m "feat: description"`
6. **Push**: `git push origin feature/new-feature`
7. **Deploy**: Merge to main triggers auto-deploy

### Code Standards
- **ESLint**: Enforced code standards
- **Prettier**: Code formatting
- **Commit Messages**: Conventional commits
- **Testing**: Minimum 80% coverage

### Adding New Features

#### 1. Database Model
```javascript
// api/models/NewModel.js
const mongoose = require('mongoose');
const newSchema = new mongoose.Schema({...});
module.exports = mongoose.model('NewModel', newSchema);
```

#### 2. Routes
```javascript
// api/routes/newRoute.js
const router = require('express').Router();
router.get('/', controller.getAll);
module.exports = router;
```

#### 3. Controller
```javascript
// api/controllers/newController.js
exports.getAll = async (req, res, next) => {
  try {
    const result = await service.getAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

#### 4. Service
```javascript
// api/services/newService.js
exports.getAll = async () => {
  return await NewModel.find();
};
```

#### 5. Tests
```javascript
// tests/integration/new.test.js
describe('New Feature', () => {
  test('should get all items', async () => {
    const res = await request(app).get('/api/new');
    expect(res.status).toBe(200);
  });
});
```

This engineering guide provides everything needed to understand, develop, and maintain the PVT Booking Integration system.