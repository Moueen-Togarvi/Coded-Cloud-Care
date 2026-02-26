const mongoose = require('mongoose');
const { connectTenantDB } = require('../config/database');
const schemas = require('../models/tenantSchemas');

/**
 * ConnectionManager
 * Manages per-tenant MongoDB connections and their associated models.
 * Includes a cache to avoid redundant connections.
 */
class ConnectionManager {
    constructor() {
        this.connections = new Map(); // tenantDbName -> connection
        this.models = new Map(); // tenantDbName -> { ModelName -> Model }
    }

    /**
     * Get or create a connection for a specific tenant
     * @param {string} tenantDbName 
     * @returns {mongoose.Connection}
     */
    getConnection(tenantDbName) {
        if (!tenantDbName) return mongoose.connection;

        const existing = this.connections.get(tenantDbName);
        if (existing) {
            // 1 = connected, 2 = connecting
            if (existing.readyState === 1 || existing.readyState === 2) {
                return existing;
            }
            // If disconnected/error, cleanup and reconnect
            this.connections.delete(tenantDbName);
            this.models.delete(tenantDbName);
        }

        console.log(`[ConnectionManager] Creating new connection for tenant: ${tenantDbName}`);
        const connection = connectTenantDB(tenantDbName);
        this.connections.set(tenantDbName, connection);

        // Register models for this connection
        this.registerModels(tenantDbName, connection);

        return connection;
    }

    /**
     * Register all tenant-specific models on the given connection
     * @param {string} tenantDbName 
     * @param {mongoose.Connection} connection 
     */
    registerModels(tenantDbName, connection) {
        const tenantModels = {};

        // Core Models
        tenantModels.Patient = connection.model('Patient', schemas.patientSchema);
        tenantModels.Appointment = connection.model('Appointment', schemas.appointmentSchema);
        tenantModels.Staff = connection.model('Staff', schemas.staffSchema);
        tenantModels.Settings = connection.model('Settings', schemas.settingsSchema);

        // Pharmacy Models
        tenantModels.Inventory = connection.model('Inventory', schemas.inventorySchema);
        tenantModels.Sale = connection.model('Sale', schemas.saleSchema);
        tenantModels.Supplier = connection.model('Supplier', schemas.supplierSchema);
        tenantModels.StockMovement = connection.model('StockMovement', schemas.stockMovementSchema);
        tenantModels.PurchaseOrder = connection.model('PurchaseOrder', schemas.purchaseOrderSchema);

        // Accounting Models
        tenantModels.Invoice = connection.model('Invoice', schemas.invoiceSchema);
        tenantModels.Payment = connection.model('Payment', schemas.paymentSchema);
        tenantModels.Revenue = connection.model('Revenue', schemas.revenueSchema);
        tenantModels.Expense = connection.model('Expense', schemas.expenseSchema);
        tenantModels.AccountLedger = connection.model('AccountLedger', schemas.accountLedgerSchema);
        tenantModels.TaxRecord = connection.model('TaxRecord', schemas.taxRecordSchema);

        this.models.set(tenantDbName, tenantModels);
    }

    /**
     * Get a specific model for a tenant
     * @param {string} tenantDbName 
     * @param {string} modelName 
     * @returns {mongoose.Model}
     */
    getModel(tenantDbName, modelName) {
        const connection = this.getConnection(tenantDbName);
        const tenantModels = this.models.get(tenantDbName);
        if (!tenantModels || !tenantModels[modelName]) {
            throw new Error(`Model ${modelName} not registered for tenant ${tenantDbName}`);
        }
        return tenantModels[modelName];
    }

    /**
     * Close all cached connections
     */
    async closeAll() {
        console.log('[ConnectionManager] Closing all tenant connections...');
        const closures = [];
        for (const [name, conn] of this.connections.entries()) {
            closures.push(conn.close());
        }
        await Promise.all(closures);
        this.connections.clear();
        this.models.clear();
    }
}

// Export a singleton instance
module.exports = new ConnectionManager();
