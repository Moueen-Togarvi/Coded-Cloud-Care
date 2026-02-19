const mongoose = require('mongoose');
const { connectTenantDB } = require('../config/database');
const schemas = require('../models/tenantSchemas');

/**
 * Generate a unique tenant database name
 * @param {string} companyName - The company name
 * @returns {string} - Sanitized database name
 */
const generateTenantDbName = (companyName) => {
  // Sanitize company name: lowercase, remove special chars, replace spaces with underscores
  const sanitized = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30); // Limit length

  // Add timestamp for uniqueness
  const timestamp = Date.now();
  return `tenant_${sanitized}_${timestamp}`;
};

/**
 * Create a new tenant database with initial schema
 * Uses centralized schemas from tenantSchemas.js to avoid duplication
 * @param {string} tenantDbName - The name of the tenant database
 * @returns {Object} - Contains connection info
 */
const createTenantDatabase = async (tenantDbName) => {
  try {
    // Create connection to the new tenant database
    const tenantConnection = connectTenantDB(tenantDbName);

    // Create models using centralized schemas from tenantSchemas.js
    // Core Models
    const Patient = tenantConnection.model('Patient', schemas.patientSchema);
    const Appointment = tenantConnection.model('Appointment', schemas.appointmentSchema);
    const Staff = tenantConnection.model('Staff', schemas.staffSchema);
    const Settings = tenantConnection.model('Settings', schemas.settingsSchema);

    // Pharmacy Models
    const Inventory = tenantConnection.model('Inventory', schemas.inventorySchema);
    const Sale = tenantConnection.model('Sale', schemas.saleSchema);
    const Supplier = tenantConnection.model('Supplier', schemas.supplierSchema);
    const StockMovement = tenantConnection.model('StockMovement', schemas.stockMovementSchema);
    const PurchaseOrder = tenantConnection.model('PurchaseOrder', schemas.purchaseOrderSchema);

    // Accounting Models
    const Invoice = tenantConnection.model('Invoice', schemas.invoiceSchema);
    const Payment = tenantConnection.model('Payment', schemas.paymentSchema);
    const Revenue = tenantConnection.model('Revenue', schemas.revenueSchema);
    const Expense = tenantConnection.model('Expense', schemas.expenseSchema);
    const AccountLedger = tenantConnection.model('AccountLedger', schemas.accountLedgerSchema);
    const TaxRecord = tenantConnection.model('TaxRecord', schemas.taxRecordSchema);

    // Wait for connection to be established
    await new Promise((resolve, reject) => {
      tenantConnection.once('open', resolve);
      tenantConnection.once('error', reject);
    });

    // Explicitly create collections by inserting and removing a dummy document
    // This ensures the database and collections are physically created in MongoDB
    console.log(`✓ Creating collections for tenant: ${tenantDbName}`);

    // Core collections
    await Patient.createCollection();
    await Appointment.createCollection();
    await Staff.createCollection();
    await Settings.createCollection();

    // Pharmacy collections
    await Inventory.createCollection();
    await Sale.createCollection();
    await Supplier.createCollection();
    await StockMovement.createCollection();
    await PurchaseOrder.createCollection();

    // Accounting collections
    await Invoice.createCollection();
    await Payment.createCollection();
    await Revenue.createCollection();
    await Expense.createCollection();
    await AccountLedger.createCollection();
    await TaxRecord.createCollection();

    const tenantDbUrl = `${process.env.MONGO_TENANT_BASE_URI}/${tenantDbName}`;

    console.log(`✓ Tenant database created: ${tenantDbName}`);

    // Close the connection after initialization
    await tenantConnection.close();

    return {
      tenantDbName,
      tenantDbUrl,
      success: true,
    };
  } catch (error) {
    console.error('Error creating tenant database:', error.message);
    throw new Error(`Failed to create tenant database: ${error.message}`);
  }
};

/**
 * Provision a new tenant (create database and return connection info)
 * @param {string} companyName - The company name
 * @returns {Object} - Tenant database information
 */
const provisionTenant = async (companyName) => {
  try {
    const tenantDbName = generateTenantDbName(companyName);
    const tenantInfo = await createTenantDatabase(tenantDbName);

    return tenantInfo;
  } catch (error) {
    console.error('Error provisioning tenant:', error.message);
    throw error;
  }
};

/**
 * Get a connection to an existing tenant database
 * UPDATED: Returns the main connection to satisfy "one database" requirement
 * @param {string} tenantDbName - The name of the tenant database (kept for signature compatibility)
 * @returns {mongoose.Connection} - Mongoose connection instance
 */
const getTenantConnection = (tenantDbName) => {
  return mongoose.connection;
};

module.exports = {
  generateTenantDbName,
  createTenantDatabase,
  provisionTenant,
  getTenantConnection,
};
