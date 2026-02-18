# PMS Backend - Multi-Tenant Patient Management System

A scalable SaaS backend for rehab clinic patient management software with multi-tenant architecture, supporting white-label partnerships, subscription-based, and one-time payment models.

## Features

- **Multi-Tenant Architecture**: Each client gets their own isolated MongoDB database
- **3-Day Free Trial**: Automatic trial activation on signup
- **Three Payment Plans**:
  - White Label Partnership (PKR 90,000/month)
  - Monthly Subscription (PKR 55,000/month)
  - Lifetime License (PKR 1,00,000 one-time)
- **JWT Authentication**: Secure token-based authentication
- **Trial Management**: Automatic trial expiry checking
- **Tenant Provisioning**: Automatic database creation on signup

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Master + Tenant databases)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs

## Project Structure

```
PMS/
├── src/
│   ├── config/
│   │   └── database.js          # Database connection configuration
│   ├── controllers/
│   │   └── authController.js    # Authentication logic
│   ├── middleware/
│   │   └── authMiddleware.js    # JWT verification and access control
│   ├── models/
│   │   ├── User.js              # User schema (master DB)
│   │   └── Plan.js              # Plan schema (master DB)
│   ├── routes/
│   │   └── auth.js              # Authentication routes
│   ├── seeds/
│   │   └── planSeeder.js        # Seed default payment plans
│   ├── services/
│   │   └── tenantService.js     # Tenant database provisioning
│   ├── utils/
│   │   └── jwt.js               # JWT helper functions
│   └── server.js                # Application entry point
├── .env.example                 # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher) - Local installation or MongoDB Atlas

### 2. Installation

```bash
# Install dependencies
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Master Database (stores users and plans)
MONGO_MASTER_URI=mongodb://localhost:27017/pms_master

# Tenant Database Base URI (for creating tenant databases)
MONGO_TENANT_BASE_URI=mongodb://localhost:27017

# JWT Configuration
JWT_SECRET=your_super_secure_secret_key_change_this
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Trial Configuration
TRIAL_DAYS=3
```

### 4. Seed the Database

Populate the master database with default payment plans:

```bash
npm run seed
```

This will create three plans:

- White Label Partnership (PKR 1,400,000/month)
- Monthly Subscription (PKR 55,000/month)
- Lifetime License (PKR 1,400,000 once)

### 5. Start the Server

**Development mode** (with auto-reload):

```bash
npm run dev
```

**Production mode**:

```bash
npm start
```

The server will start on `http://localhost:5000`

### 6. Verify Installation

Check if the server is running:

```bash
curl http://localhost:5000/health
```

## API Endpoints

### Authentication

#### Register New User (Clinic)

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "clinic@example.com",
  "password": "securePassword123",
  "companyName": "Sunshine Rehab Clinic",
  "phone": "+1234567890",
  "address": "123 Main St, City, State",
  "planType": "subscription"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful. Your 3-day free trial has started!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "email": "clinic@example.com",
      "companyName": "Sunshine Rehab Clinic",
      "planType": "subscription",
      "subscriptionStatus": "trial",
      "trialEndDate": "2026-01-09T...",
      "tenantDbName": "tenant_sunshine_rehab_clinic_1736179200000"
    }
  }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "clinic@example.com",
  "password": "securePassword123"
}
```

#### Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

## Database Schema

### Master Database Collections

#### Users Collection

Stores clinic information and subscription details:

```javascript
{
  email: String,              // Unique email
  passwordHash: String,       // Hashed password
  companyName: String,        // Clinic name
  contactInfo: {
    phone: String,
    address: String
  },
  planId: ObjectId,          // Reference to Plan
  tenantDbName: String,      // Name of tenant database
  tenantDbUrl: String,       // Connection URL for tenant DB
  subscriptionStatus: String, // 'trial', 'active', 'expired', 'cancelled'
  trialStartDate: Date,
  trialEndDate: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Plans Collection

Available subscription plans:

```javascript
{
  planType: String,          // 'white-label', 'subscription', 'one-time'
  planName: String,
  price: Number,             // In PKR
  billingCycle: String,      // 'monthly', 'yearly', 'once'
  features: [String],
  trialDays: Number,         // Default: 3
  isActive: Boolean
}
```

### Tenant Database Collections

Each tenant gets these collections automatically created:

- **Patients**: Patient records
- **Appointments**: Appointment scheduling
- **Staff**: Staff members
- **Settings**: Clinic-specific settings

## How Multi-Tenancy Works

1. **User Registration**: When a clinic signs up, a new MongoDB database is automatically created
2. **Database Naming**: `tenant_<sanitized_company_name>_<timestamp>`
3. **Isolation**: Each tenant's data is completely isolated in their own database
4. **Trial Period**: 3-day free trial starts automatically upon registration
5. **Access Control**: JWT tokens include tenant database information for routing requests

## Security Features

- Password hashing with bcryptjs (salt rounds: 10)
- JWT-based authentication with configurable expiry
- Token verification middleware
- Trial and subscription status checking on protected routes
- Input validation on registration and login

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` for automatic server restarts on file changes.

### Testing the API

Use tools like:

- **Postman**: Import the endpoints and test
- **cURL**: Command-line testing
- **Thunder Client**: VS Code extension

Example cURL test:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@clinic.com",
    "password": "test123",
    "companyName": "Test Clinic",
    "planType": "subscription"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@clinic.com",
    "password": "test123"
  }'
```

## Next Steps

This is the initial backend setup. Future development should include:

1. **Payment Gateway Integration**: Stripe/PayPal for subscription management
2. **Tenant API Routes**: CRUD operations for patients, appointments, staff
3. **Email Notifications**: Trial expiry warnings, payment reminders
4. **Admin Dashboard**: Super admin panel for managing all tenants
5. **White Label Customization**: Custom branding, domains, feature toggles
6. **Billing Management**: Invoice generation, payment history
7. **Analytics & Reporting**: Usage metrics, revenue tracking
8. **Backup & Recovery**: Automated tenant database backups

## Troubleshooting

### MongoDB Connection Issues

- Ensure MongoDB is running: `mongod --version`
- Check connection string in `.env`
- For MongoDB Atlas, whitelist your IP address

### Port Already in Use

Change the `PORT` in `.env` file or kill the process:

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

## License

ISC

## Support

For questions or issues, please contact the development team.
