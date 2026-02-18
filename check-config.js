/**
 * Configuration Checker Script
 * Run this to verify your authentication setup is correct
 *
 * Usage: node check-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 PMS Authentication Configuration Checker\n');
console.log('='.repeat(50));

const checks = [];
let passed = 0;
let failed = 0;

// Helper function to check file exists
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  checks.push({
    description,
    status: exists ? '✅ PASS' : '❌ FAIL',
    details: exists ? `File found: ${filePath}` : `File missing: ${filePath}`,
  });
  if (exists) passed++;
  else failed++;
  return exists;
}

// Helper function to check content
function checkFileContent(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const found = content.includes(searchString);
    checks.push({
      description,
      status: found ? '✅ PASS' : '⚠️  WARN',
      details: found ? `Found "${searchString}"` : `Missing "${searchString}"`,
    });
    if (found) passed++;
    return found;
  } catch (error) {
    checks.push({
      description,
      status: '❌ FAIL',
      details: `Error reading file: ${error.message}`,
    });
    failed++;
    return false;
  }
}

console.log('\n📁 Checking File Structure...\n');

// Check backend files
checkFile(path.join(__dirname, 'src', 'server.js'), 'Backend server file');
checkFile(path.join(__dirname, 'src', 'routes', 'auth.js'), 'Auth routes file');
checkFile(path.join(__dirname, 'src', 'controllers', 'authController.js'), 'Auth controller');
checkFile(path.join(__dirname, 'src', 'middleware', 'authMiddleware.js'), 'Auth middleware');

// Check frontend files
checkFile(path.join(__dirname, 'Frontend', 'comp', 'Login.html'), 'Login page');
checkFile(path.join(__dirname, 'Frontend', 'comp', 'Signup.html'), 'Signup page');
checkFile(path.join(__dirname, 'Frontend', 'js', 'auth.js'), 'Auth utilities script');
checkFile(path.join(__dirname, 'Frontend', 'js', 'login.js'), 'Login handler script');
checkFile(path.join(__dirname, 'Frontend', 'js', 'signup.js'), 'Signup handler script');
checkFile(path.join(__dirname, 'Frontend', 'css', 'notifications.css'), 'Notifications CSS');
checkFile(path.join(__dirname, 'Frontend', 'test-auth.html'), 'Auth test page');

console.log('\n🔧 Checking Configuration...\n');

// Check server.js configuration
checkFileContent(
  path.join(__dirname, 'src', 'server.js'),
  'app.use(cors())',
  'CORS middleware enabled'
);

checkFileContent(
  path.join(__dirname, 'src', 'server.js'),
  "app.use('/api/auth', authRoutes)",
  'Auth routes mounted'
);

checkFileContent(
  path.join(__dirname, 'src', 'server.js'),
  'app.use(express.json())',
  'JSON body parser enabled'
);

// Check frontend script includes
checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Login.html'),
  '<script src="../js/auth.js"></script>',
  'Login page includes auth.js'
);

checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Login.html'),
  '<script src="../js/login.js"></script>',
  'Login page includes login.js'
);

checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Signup.html'),
  '<script src="../js/auth.js"></script>',
  'Signup page includes auth.js'
);

checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Signup.html'),
  '<script src="../js/signup.js"></script>',
  'Signup page includes signup.js'
);

// Check CSS includes
checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Login.html'),
  'notifications.css',
  'Login page includes notifications.css'
);

checkFileContent(
  path.join(__dirname, 'Frontend', 'comp', 'Signup.html'),
  'notifications.css',
  'Signup page includes notifications.css'
);

// Check environment file
const envExists = checkFile(path.join(__dirname, '.env'), 'Environment file (.env)');
if (envExists) {
  checkFileContent(path.join(__dirname, '.env'), 'MONGO_URI', 'MongoDB URI configured');
  checkFileContent(path.join(__dirname, '.env'), 'JWT_SECRET', 'JWT secret configured');
}

// Check package.json dependencies
checkFileContent(path.join(__dirname, 'package.json'), '"cors"', 'CORS package installed');

checkFileContent(path.join(__dirname, 'package.json'), '"express"', 'Express package installed');

checkFileContent(path.join(__dirname, 'package.json'), '"jsonwebtoken"', 'JWT package installed');

console.log('\n' + '='.repeat(50));
console.log('\n📊 Results Summary:\n');

// Display all checks
checks.forEach((check) => {
  console.log(`${check.status} ${check.description}`);
  if (check.status.includes('FAIL') || check.status.includes('WARN')) {
    console.log(`   └─ ${check.details}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Total checks: ${checks.length}\n`);

if (failed === 0) {
  console.log('🎉 All critical checks passed! Your setup looks good.\n');
  console.log('Next steps:');
  console.log('1. Make sure MongoDB is running');
  console.log('2. Run: npm start');
  console.log('3. Open Frontend/test-auth.html in your browser\n');
} else {
  console.log('⚠️  Some checks failed. Please review the issues above.\n');
  console.log('Common fixes:');
  console.log('- Run: npm install (to install missing packages)');
  console.log('- Create .env file with MONGO_URI and JWT_SECRET');
  console.log('- Verify all files are in the correct locations\n');
}

console.log('📚 For detailed documentation, see:');
console.log('   - Frontend/AUTH_INTEGRATION.md');
console.log('   - TESTING_GUIDE.md\n');
