require('dotenv').config();

const { buildTenantDbUri } = require('./src/config/database');

const REQUIRED_KEYS = [
  'MONGO_MASTER_URI',
  'MONGO_TENANT_BASE_URI',
  'JWT_SECRET',
];

const OPTIONAL_KEYS = [
  'SESSION_SECRET',
  'SESSION_COOKIE_NAME',
  'PORT',
  'NODE_ENV',
  'PAYFAST_MERCHANT_ID',
  'PAYFAST_SECURED_KEY',
  'PAYFAST_TOKEN_URL',
  'PAYFAST_CHECKOUT_URL',
  'PAYFAST_SUCCESS_URL',
  'PAYFAST_FAILURE_URL',
  'PAYFAST_CANCEL_URL',
  'APP_BASE_URL',
];

const missing = REQUIRED_KEYS.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if (missing.length) {
  console.error('Configuration check failed. Missing required variables:');
  missing.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

try {
  const sampleTenantUri = buildTenantDbUri(process.env.MONGO_TENANT_BASE_URI, 'tenant_healthcheck');
  if (!sampleTenantUri || !sampleTenantUri.includes('tenant_healthcheck')) {
    throw new Error('Generated tenant URI is invalid');
  }
} catch (error) {
  console.error(`Configuration check failed. Invalid MONGO_TENANT_BASE_URI: ${error.message}`);
  process.exit(1);
}

console.log('Configuration check passed.');
console.log('Required variables: OK');
console.log(`Optional variables set: ${OPTIONAL_KEYS.filter((key) => process.env[key]).length}/${OPTIONAL_KEYS.length}`);
