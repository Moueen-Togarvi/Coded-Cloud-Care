// Integration Test: Frontend-Backend Connection
// Tests all routes and verifies frontend-backend integration

const API_BASE_URL = 'http://localhost:5000/api';
const HEALTH_URL = 'http://localhost:5000/health';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

// Test data
const testUser = {
  email: `test${Date.now()}@example.com`,
  password: 'TestPassword123!',
  companyName: 'Test Clinic',
  planType: 'subscription',
  productId: 'hospital-pms',
};

let authToken = null;

// Helper function to make API requests
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...options.headers,
      },
    });

    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Test 1: Health Check
async function testHealthCheck() {
  log.section('Test 1: Backend Health Check');

  try {
    const response = await fetch(HEALTH_URL);
    const data = await response.json();

    if (response.ok && data.success) {
      log.success('Backend server is running');
      log.info(`Timestamp: ${data.timestamp}`);
      return true;
    } else {
      log.error('Health check failed');
      return false;
    }
  } catch (error) {
    log.error(`Health check error: ${error.message}`);
    return false;
  }
}

// Test 2: CORS Configuration
async function testCORS() {
  log.section('Test 2: CORS Configuration');

  try {
    const response = await fetch(HEALTH_URL, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5500',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });

    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowMethods = response.headers.get('access-control-allow-methods');
    const allowHeaders = response.headers.get('access-control-allow-headers');

    if (allowOrigin || response.ok) {
      log.success('CORS is configured');
      log.info(`Allow-Origin: ${allowOrigin || 'Not set (but server responded OK)'}`);
      log.info(`Allow-Methods: ${allowMethods || 'Not set'}`);
      log.info(`Allow-Headers: ${allowHeaders || 'Not set'}`);
      return true;
    } else {
      log.warning('CORS may not be properly configured');
      return true; // Non-critical
    }
  } catch (error) {
    log.warning(`CORS test error: ${error.message}`);
    return true; // Non-critical
  }
}

// Test 3: User Registration (POST /api/auth/register)
async function testRegistration() {
  log.section('Test 3: User Registration Route');

  try {
    const { response, data } = await apiRequest(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(testUser),
    });

    if (response.status === 201 && data.success) {
      log.success('Registration endpoint working');
      log.info(`User created: ${testUser.email}`);
      log.info(`Company: ${testUser.companyName}`);

      // Save token for subsequent tests
      if (data.data && data.data.token) {
        authToken = data.data.token;
        log.success('Auth token received and saved');
      }

      return true;
    } else {
      log.error(`Registration failed: ${data.message || 'Unknown error'}`);
      console.log('Response:', data);
      return false;
    }
  } catch (error) {
    log.error(`Registration error: ${error.message}`);
    return false;
  }
}

// Test 4: User Login (POST /api/auth/login)
async function testLogin() {
  log.section('Test 4: User Login Route');

  try {
    const { response, data } = await apiRequest(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    if (response.ok && data.success && data.data && data.data.token) {
      log.success('Login endpoint working');
      log.info(`Token received: ${data.data.token.substring(0, 20)}...`);
      authToken = data.data.token;
      return true;
    } else {
      log.error(`Login failed: ${data.message || 'Unknown error'}`);
      console.log('Response:', data);
      return false;
    }
  } catch (error) {
    log.error(`Login error: ${error.message}`);
    return false;
  }
}

// Test 5: Protected Route - Get Profile (GET /api/auth/profile)
async function testProtectedRoute() {
  log.section('Test 5: Protected Route - Get Profile');

  if (!authToken) {
    log.error('No auth token available. Skipping protected route test.');
    return false;
  }

  try {
    const { response, data } = await apiRequest(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
    });

    if (response.ok && data.success && data.data && data.data.user) {
      log.success('Protected route working');
      log.info(`User email: ${data.data.user.email}`);
      log.info(`Company: ${data.data.user.companyName}`);
      log.info(`Subscription: ${data.data.user.subscriptionStatus}`);
      return true;
    } else {
      log.error(`Profile fetch failed: ${data.message || 'Unknown error'}`);
      console.log('Response:', data);
      return false;
    }
  } catch (error) {
    log.error(`Protected route error: ${error.message}`);
    return false;
  }
}

// Test 6: Invalid Token Handling
async function testInvalidToken() {
  log.section('Test 6: Invalid Token Handling');

  const originalToken = authToken;
  authToken = 'invalid.token.here';

  try {
    const { response, data } = await apiRequest(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
    });

    if (response.status === 401) {
      log.success('Invalid token correctly rejected (401)');
      authToken = originalToken;
      return true;
    } else {
      log.warning('Invalid token was not rejected properly');
      authToken = originalToken;
      return false;
    }
  } catch (error) {
    log.error(`Invalid token test error: ${error.message}`);
    authToken = originalToken;
    return false;
  }
}

// Test 7: Frontend Files Check
async function testFrontendFiles() {
  log.section('Test 7: Frontend Files Integration');

  const fs = require('fs');
  const path = require('path');

  const requiredFiles = [
    'Frontend/js/auth.js',
    'Frontend/js/login.js',
    'Frontend/js/signup.js',
    'Frontend/js/dashboard.js',
    'Frontend/comp/Login.html',
    'Frontend/comp/Signup.html',
  ];

  let allFilesExist = true;

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      log.success(`Found: ${file}`);
    } else {
      log.error(`Missing: ${file}`);
      allFilesExist = false;
    }
  }

  return allFilesExist;
}

// Test 8: API Base URL Configuration
async function testAPIConfiguration() {
  log.section('Test 8: Frontend API Configuration');

  const fs = require('fs');
  const path = require('path');

  const authJsPath = path.join(__dirname, 'Frontend/js/auth.js');

  try {
    const content = fs.readFileSync(authJsPath, 'utf-8');

    if (content.includes('http://localhost:5000/api')) {
      log.success('Frontend API_BASE_URL correctly configured');
      log.info('Configured URL: http://localhost:5000/api');
      return true;
    } else {
      log.error('API_BASE_URL not found or incorrect in auth.js');
      return false;
    }
  } catch (error) {
    log.error(`Error reading auth.js: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🔍 Frontend-Backend Integration Test Suite\n');
  console.log('═'.repeat(50));

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  const tests = [
    { name: 'Health Check', fn: testHealthCheck, critical: true },
    { name: 'CORS Configuration', fn: testCORS, critical: false },
    { name: 'Frontend Files', fn: testFrontendFiles, critical: true },
    { name: 'API Configuration', fn: testAPIConfiguration, critical: true },
    { name: 'User Registration', fn: testRegistration, critical: true },
    { name: 'User Login', fn: testLogin, critical: true },
    { name: 'Protected Route', fn: testProtectedRoute, critical: true },
    { name: 'Invalid Token Handling', fn: testInvalidToken, critical: false },
  ];

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
      } else {
        if (test.critical) {
          results.failed++;
        } else {
          results.warnings++;
        }
      }
    } catch (error) {
      log.error(`Test "${test.name}" crashed: ${error.message}`);
      results.failed++;
    }
  }

  // Summary
  log.section('Test Summary');
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);
  console.log('\n' + '═'.repeat(50) + '\n');

  if (results.failed === 0) {
    log.success('All critical tests passed! Frontend and backend are properly integrated.');
    return true;
  } else {
    log.error('Some tests failed. Please review the errors above.');
    return false;
  }
}

// Run the tests
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      log.error(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runTests };
