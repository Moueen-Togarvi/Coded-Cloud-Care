const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { connectMasterDB } = require('./config/database');

// Multi-tenant routes
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const patientsRoutes = require('./routes/patients');
const appointmentsRoutes = require('./routes/appointments');
const staffRoutes = require('./routes/staff');
const pharmacyRoutes = require('./routes/pharmacy');
const accountingRoutes = require('./routes/accounting');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');

// Hospital PMS routes
const hospitalAuthRoutes = require('./routes/hospitalAuth');
const hospitalUsersRoutes = require('./routes/hospitalUsers');
const hospitalPatientsRoutes = require('./routes/hospitalPatients');
const hospitalDashboardRoutes = require('./routes/hospitalDashboard');
const hospitalCanteenRoutes = require('./routes/hospitalCanteen');
const hospitalExpensesRoutes = require('./routes/hospitalExpenses');
const hospitalOverheadsRoutes = require('./routes/hospitalOverheads');
const hospitalAccountsRoutes = require('./routes/hospitalAccounts');
const hospitalCallMeetingRoutes = require('./routes/hospitalCallMeeting');
const hospitalUtilityBillsRoutes = require('./routes/hospitalUtilityBills');
const hospitalEmployeesRoutes = require('./routes/hospitalEmployees');
const hospitalExportRoutes = require('./routes/hospitalExport');
const hospitalReportsRoutes = require('./routes/hospitalReports');
const hospitalPsychSessionsRoutes = require('./routes/hospitalPsychSessions');
const hospitalAttendanceRoutes = require('./routes/hospitalAttendance');
const hospitalEmergencyRoutes = require('./routes/hospitalEmergency');
const hospitalSettingsRoutes = require('./routes/hospitalSettings');
const hospitalOldBalancesRoutes = require('./routes/hospitalOldBalances');

// Initialize Express app
const app = express();

// ─── Security Hardening (Helmet) ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      "img-src": ["'self'", "data:", "https:", "http:"],
    },
  },
}));

// ─── Cookie Parser ───────────────────────────────────────────────────────────
app.use(cookieParser());

app.set('trust proxy', 1); // Trust first proxy (Render/Vercel) to allow secure cookies

// Session middleware for Hospital PMS (must be before routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hospital-pms-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: '__Host-pms-sid', // More secure cookie name
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Limit login/register to 10 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Please wait 15 minutes.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Middleware
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://dashboard-site-qbgb.onrender.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
      ];
      // Allow requests with no origin (like mobile apps or curl) or if in allowed list
      if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && origin === 'null')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Hospital PMS API Aliases ────────────────────────────────────────────────
// The Hospital PMS index.html calls /api/auth/*, /api/patients/*, etc.
// (without the /hospital/ prefix). These aliases forward them correctly.
// app.use('/api/auth', hospitalAuthRoutes); // REMOVED: Conflicts with unified SaaS auth

// Conditional Auth Alias (Session/Logout)
app.use('/api/auth', (req, res, next) => {
  // Only interrupt for Hospital PMS if it's SPECIFICALLY a session or logout request
  // and the user has a hospital session active.
  if (req.session && req.session.hospitalUserId) {
    if (req.path === '/session' || req.path === '/logout') {
      return hospitalAuthRoutes(req, res, next);
    }
  }
  next();
});

// Alias for Change Password (frontend calls /api/users/change_password)
app.use('/api/users/change_password', (req, res, next) => {
  if (req.session && req.session.hospitalUserId) {
    req.url = '/change_password';
    return hospitalAuthRoutes(req, res, next);
  }
  next();
});

app.use('/api/patients', (req, res, next) => {
  // Only forward if this looks like a Hospital PMS request (has hospital session)
  if (req.session && req.session.hospitalUserId) {
    return hospitalPatientsRoutes(req, res, next);
  }
  next();
});
app.use('/api/dashboard', (req, res, next) => {
  if (req.session && req.session.hospitalUserId) {
    return hospitalDashboardRoutes(req, res, next);
  }
  next();
});
app.use('/api/canteen', hospitalCanteenRoutes);
app.use('/api/expenses', hospitalExpensesRoutes); // Fix for missing expenses visibility
app.use('/api/old-balances', hospitalOldBalancesRoutes); // Fix for missing recovery records
app.use('/api/overheads', hospitalOverheadsRoutes);
app.use('/api/accounts', hospitalAccountsRoutes);
app.use('/api/call_meeting_tracker', hospitalCallMeetingRoutes);
app.use('/api/utility_bills', hospitalUtilityBillsRoutes);
app.use('/api/employees', hospitalEmployeesRoutes);
app.use('/api/export', hospitalExportRoutes);
app.use('/api/payment-records', hospitalExportRoutes);
app.use('/api/reports', hospitalReportsRoutes);
app.use('/api/psych-sessions', hospitalPsychSessionsRoutes);
app.use('/api/attendance', hospitalAttendanceRoutes);
app.use('/api/emergency', hospitalEmergencyRoutes);
app.use('/api/users', hospitalUsersRoutes);

// Alias for Settings (frontend calls /api/settings)
app.use('/api/settings', (req, res, next) => {
  if (req.session && req.session.hospitalUserId) {
    // return hospitalSettingsRoutes(req, res, next); -> Need to import it first!
    // I will add the import next.
    return hospitalSettingsRoutes(req, res, next);
  }
  next();
});

// Multi-tenant SaaS routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentsRoutes);

// Hospital PMS routes (prefixed)
app.use('/api/hospital/auth', hospitalAuthRoutes);
app.use('/api/hospital/users', hospitalUsersRoutes);
app.use('/api/hospital/patients', hospitalPatientsRoutes);
app.use('/api/hospital/dashboard', hospitalDashboardRoutes);
app.use('/api/hospital/canteen', hospitalCanteenRoutes);
app.use('/api/hospital/expenses', hospitalExpensesRoutes);
app.use('/api/hospital/overheads', hospitalOverheadsRoutes);
app.use('/api/hospital/accounts', hospitalAccountsRoutes);
app.use('/api/hospital/call_meeting_tracker', hospitalCallMeetingRoutes);
app.use('/api/hospital/utility_bills', hospitalUtilityBillsRoutes);
app.use('/api/hospital/employees', hospitalEmployeesRoutes);
app.use('/api/hospital/export', hospitalExportRoutes);
app.use('/api/hospital/payment-records', hospitalExportRoutes);
app.use('/api/hospital/reports', hospitalReportsRoutes);
app.use('/api/hospital/psych-sessions', hospitalPsychSessionsRoutes);
app.use('/api/hospital/attendance', hospitalAttendanceRoutes);
app.use('/api/hospital/emergency', hospitalEmergencyRoutes);

// Serve static files for Hospital PMS
app.use('/hospital/static', express.static(path.join(__dirname, '../Frontend/hospital/static')));

// Serve Hospital PMS frontend
app.get(['/hospital-pms', '/hospital', '/pms'], (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/hospital/index.html'));
});

// --- Secure Admin Portal URL Obfuscation ---
app.get('/portal-secure-admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/admin/login.html'));
});

// Block direct access to the plain HTML file for security
app.use('/Frontend/admin/login.html', (req, res) => {
  res.status(404).send('Not Found');
});

// Serve Frontend directory for Pharmacy and other apps
app.use('/Frontend', express.static(path.join(__dirname, '../Frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    services: {
      multiTenantSaaS: 'active',
      hospitalPMS: 'active',
    },
    timestamp: new Date().toISOString(),
  });
});

// Serve static files from Frontend directory only (security: don't expose root)
// Serve static files from root directory (to include index.html)
app.use(express.static(path.join(__dirname, '../')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Connect to databases and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to master database (SaaS and unified products)
    await connectMasterDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✓ Server is running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ Multi-tenant SaaS: Active`);
      console.log(`✓ Hospital PMS: Active`);
      console.log(`✓ Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
