const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Build a tenant-specific MongoDB URI safely.
 * Handles base URIs that already include a database name and/or query params.
 */
const buildTenantDbUri = (baseUri, tenantDbName) => {
  if (!baseUri) {
    throw new Error('MONGO_TENANT_BASE_URI is not configured');
  }
  if (!tenantDbName) {
    throw new Error('Tenant database name is required');
  }

  try {
    const parsed = new URL(baseUri);
    parsed.pathname = `/${tenantDbName}`;
    return parsed.toString();
  } catch (error) {
    // Fallback for non-standard URIs: preserve query string, replace path/db segment
    const queryIndex = baseUri.indexOf('?');
    const beforeQuery = queryIndex >= 0 ? baseUri.slice(0, queryIndex) : baseUri;
    const queryPart = queryIndex >= 0 ? baseUri.slice(queryIndex) : '';
    const normalizedBase = beforeQuery.replace(/\/+$/, '');
    return `${normalizedBase}/${tenantDbName}${queryPart}`;
  }
};

/**
 * Connect to the master database
 * This database stores users, plans, and tenant metadata
 */
const connectMasterDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_MASTER_URI);
    console.log('✓ Connected to Master Database');
  } catch (error) {
    console.error('✗ Master Database connection error:', error.message);
    process.exit(1);
  }
};

/**
 * Create a connection to a tenant-specific database
 * Each tenant gets their own isolated MongoDB database
 * @param {string} tenantDbName - The name of the tenant database
 * @returns {mongoose.Connection} - Mongoose connection instance
 */
const connectTenantDB = (tenantDbName) => {
  try {
    const tenantDbUri = buildTenantDbUri(process.env.MONGO_TENANT_BASE_URI, tenantDbName);
    const tenantConnection = mongoose.createConnection(tenantDbUri);

    tenantConnection.on('connected', () => {
      console.log(`✓ Connected to Tenant Database: ${tenantDbName}`);
    });

    tenantConnection.on('error', (error) => {
      console.error(`✗ Tenant Database connection error (${tenantDbName}):`, error.message);
    });

    return tenantConnection;
  } catch (error) {
    console.error('Error creating tenant connection:', error.message);
    throw error;
  }
};

module.exports = {
  buildTenantDbUri,
  connectMasterDB,
  connectTenantDB,
};
