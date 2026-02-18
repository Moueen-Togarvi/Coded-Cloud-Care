const mongoose = require('mongoose');

/**
 * Centralized Tenant Schemas
 * These schemas are used by both tenantService.js and tenantMiddleware.js
 * to ensure consistency across the application
 */

// Core Schemas
const patientSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: String,
    phone: String,
    dateOfBirth: Date,
    address: String,
    medicalHistory: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const appointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    appointmentDate: { type: Date, required: true },
    appointmentType: String,
    duration: Number,
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
        default: 'scheduled',
    },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const staffSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
        type: String,
        enum: ['admin', 'doctor', 'therapist', 'nurse', 'receptionist'],
        default: 'staff',
    },
    phone: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const settingsSchema = new mongoose.Schema({
    clinicName: { type: String, required: true },
    clinicAddress: String,
    clinicPhone: String,
    clinicEmail: String,
    taxId: String,
    clinicLogo: String, // Base64 or URL
    businessHours: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String },
    },
    timezone: { type: String, default: 'UTC' },
    isOnboardingComplete: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
});

// Pharmacy Schemas
const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    sku: { type: String, unique: true, sparse: true },
    category: { type: String, default: 'general' },
    manufacturer: String,
    batchNumber: String,
    barcode: String,
    quantity: { type: Number, default: 0 },
    costPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    profitMargin: { type: Number },
    taxRate: { type: Number, default: 0 },
    expiryDate: Date,
    supplier: String,
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    lowStockThreshold: { type: Number, default: 10 },
    prescriptionRequired: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'discontinued', 'out-of-stock'], default: 'active' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const saleSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    medicineName: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    profit: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'insurance', 'other'], default: 'cash' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    customerName: String,
    soldBy: String,
    saleDate: { type: Date, default: Date.now },
    invoiceNumber: String,
    status: { type: String, enum: ['paid', 'voided', 'returned', 'partially_returned'], default: 'paid' },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

const supplierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contactPerson: String,
    email: String,
    phone: { type: String, required: true },
    address: String,
    city: String,
    state: String,
    country: String,
    taxId: String,
    paymentTerms: String,
    bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        ifscCode: String
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const stockMovementSchema = new mongoose.Schema({
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    medicineName: String,
    type: {
        type: String,
        enum: ['purchase', 'sale', 'adjustment', 'return', 'expired', 'damaged'],
        required: true
    },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    referenceType: String,
    performedBy: String,
    date: { type: Date, default: Date.now },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

const purchaseOrderSchema = new mongoose.Schema({
    poNumber: { type: String, unique: true, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: String,
    items: [{
        medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        medicineName: String,
        quantity: { type: Number, required: true },
        unitCost: { type: Number, required: true },
        totalCost: { type: Number, required: true },
        batchNumber: String,
        expiryDate: Date
    }],
    totalAmount: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'received', 'partially_received', 'cancelled'],
        default: 'pending'
    },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: Date,
    receivedDate: Date,
    invoiceNumber: String,
    paymentStatus: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
    paidAmount: { type: Number, default: 0 },
    notes: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Accounting Schemas
const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, unique: true, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    customerName: String,
    type: { type: String, enum: ['patient', 'pharmacy', 'other'], default: 'patient' },
    items: [{
        description: String,
        amount: Number,
        quantity: { type: Number, default: 1 },
        totalAmount: Number
    }],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'partially_paid', 'unpaid', 'overdue'], default: 'unpaid' },
    dueDate: Date,
    paymentMethod: String,
    paymentTerms: String,
    paymentHistory: [{
        amount: Number,
        paymentMethod: String,
        paymentDate: Date,
        transactionId: String,
        receivedBy: String
    }],
    notes: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
    paymentNumber: { type: String, unique: true, required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: String,
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', 'upi', 'cheque', 'other'], required: true },
    paymentDate: { type: Date, default: Date.now },
    transactionId: String,
    referenceNumber: String,
    notes: String,
    receivedBy: String,
    status: { type: String, enum: ['completed', 'pending', 'failed', 'refunded'], default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const revenueSchema = new mongoose.Schema({
    source: {
        type: String,
        enum: ['patient-consultation', 'pharmacy-sales', 'lab-tests', 'procedures', 'other'],
        required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    category: String,
    description: String,
    referenceType: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    paymentMethod: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
    expenseNumber: { type: String, unique: true, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: {
        type: String,
        enum: ['rent', 'utilities', 'supplies', 'salary', 'maintenance', 'inventory', 'marketing', 'insurance', 'taxes', 'other'],
        default: 'other'
    },
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', 'cheque', 'other'] },
    recipient: String,
    receiptUrl: String,
    receiptNumber: String,
    approvedBy: String,
    tags: [String],
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'approved' },
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const accountLedgerSchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['debit', 'credit'], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: String,
    referenceType: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    referenceNumber: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const taxRecordSchema = new mongoose.Schema({
    period: { type: String, required: true },
    periodType: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    totalRevenue: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'filed', 'paid'], default: 'pending' },
    filedDate: Date,
    paidDate: Date,
    paymentReference: String,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = {
    // Core
    patientSchema,
    appointmentSchema,
    staffSchema,
    settingsSchema,
    // Pharmacy
    inventorySchema,
    saleSchema,
    supplierSchema,
    stockMovementSchema,
    purchaseOrderSchema,
    // Accounting
    invoiceSchema,
    paymentSchema,
    revenueSchema,
    expenseSchema,
    accountLedgerSchema,
    taxRecordSchema
};
