const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const { connectMasterDB } = require('./config/database');
const { connectHospitalDB } = require('./config/hospitalDatabase');

// Multi-tenant routes
const authRoutes = require('./routes/auth');
const patientsRoutes = require('./routes/patients');
const appointmentsRoutes = require('./routes/appointments');
const staffRoutes = require('./routes/staff');
const pharmacyRoutes = require('./routes/pharmacy');
const accountingRoutes = require('./routes/accounting');
const settingsRoutes = require('./routes/settings');

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

// Initialize Express app
const app = express();

// Session middleware for Hospital PMS (must be before routes)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hospital-pms-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Middleware
app.use(
  cors({
    origin: [
      'https://dashboard-site-qbgb.onrender.com', // Production frontend
      'http://localhost:3000', // Local development
      'http://127.0.0.1:3000', // Local development alternative
      'http://localhost:5500', // Live Server default port
      'http://127.0.0.1:5500', // Live Server alternative
      'null', // Opening HTML files directly (file://)
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Multi-tenant SaaS routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/settings', settingsRoutes);

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

// ─── Hospital PMS API Aliases ────────────────────────────────────────────────
// The Hospital PMS index.html calls /api/auth/*, /api/patients/*, etc.
// (without the /hospital/ prefix). These aliases forward them correctly.
app.use('/api/auth', hospitalAuthRoutes);
app.use('/api/patients', (req, res, next) => {
  // Only forward if this looks like a Hospital PMS request (has hospital session)
  if (req.session && req.session.hospitalUserId) {
    return hospitalPatientsRoutes(req, res, next);
  }
  next();
});
app.use('/api/canteen', hospitalCanteenRoutes);
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

// Serve static files for Hospital PMS (must be before the HTML route)
app.use('/static', express.static(path.join(__dirname, '../Rooh adding in the coed cloud/static')));

// Serve Hospital PMS frontend - handle multiple variations
app.get(['/hospital-pms', '/Hosptial', '/hospital', '/pms'], (req, res) => {
  res.sendFile(path.join(__dirname, '../Rooh adding in the coed cloud/templates/index.html'));
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
    // Connect to master database (multi-tenant SaaS)
    await connectMasterDB();

    // Connect to Hospital PMS database
    await connectHospitalDB();

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
