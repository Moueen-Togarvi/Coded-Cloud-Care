const mongoose = require('mongoose');
const { getTenantConnection } = require('../services/tenantService');
const schemas = require('../models/tenantSchemas');

/**
 * Middleware to establish tenant database context
 * This middleware should be used AFTER authentication middleware
 * It extracts the tenant database name from the authenticated user
 * and attaches tenant-specific models to the request object
 */
const attachTenantModels = async (req, res, next) => {
    try {
        // Ensure user is authenticated (should be set by authenticate middleware)
        if (!req.user || !req.user.tenantDbName) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to access tenant resources',
            });
        }

        const tenantDbName = req.user.tenantDbName;

        // Get connection to tenant database
        const tenantConnection = getTenantConnection(tenantDbName);

        // Create models using the tenant connection and centralized schemas
        req.tenantModels = {
            // Core Models
            Patient: tenantConnection.model('Patient', schemas.patientSchema),
            Appointment: tenantConnection.model('Appointment', schemas.appointmentSchema),
            Staff: tenantConnection.model('Staff', schemas.staffSchema),
            Settings: tenantConnection.model('Settings', schemas.settingsSchema),

            // Pharmacy Models
            Inventory: tenantConnection.model('Inventory', schemas.inventorySchema),
            Sale: tenantConnection.model('Sale', schemas.saleSchema),
            Supplier: tenantConnection.model('Supplier', schemas.supplierSchema),
            StockMovement: tenantConnection.model('StockMovement', schemas.stockMovementSchema),
            PurchaseOrder: tenantConnection.model('PurchaseOrder', schemas.purchaseOrderSchema),

            // Accounting Models
            Invoice: tenantConnection.model('Invoice', schemas.invoiceSchema),
            Payment: tenantConnection.model('Payment', schemas.paymentSchema),
            Revenue: tenantConnection.model('Revenue', schemas.revenueSchema),
            Expense: tenantConnection.model('Expense', schemas.expenseSchema),
            AccountLedger: tenantConnection.model('AccountLedger', schemas.accountLedgerSchema),
            TaxRecord: tenantConnection.model('TaxRecord', schemas.taxRecordSchema),
        };

        // Store connection for cleanup
        req.tenantConnection = tenantConnection;

        next();
    } catch (error) {
        console.error('Tenant middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to establish tenant database context',
            error: error.message,
        });
    }
};

module.exports = {
    attachTenantModels,
};
