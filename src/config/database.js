const mongoose = require('mongoose');
require('dotenv').config();

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
    const tenantDbUri = `${process.env.MONGO_TENANT_BASE_URI}/${tenantDbName}`;
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
  connectMasterDB,
  connectTenantDB,
};
