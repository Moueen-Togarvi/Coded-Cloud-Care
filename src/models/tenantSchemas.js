const mongoose = require('mongoose');

/**
 * Centralized Tenant Schemas
 * These schemas are used by both tenantService.js and tenantMiddleware.js
 * to ensure consistency across the application
 */

// Core Schemas
const patientSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientCode: { type: String, trim: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: String,
    phone: String,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    age: Number,
    dateOfBirth: Date,
    cnic: String,
    bloodGroup: String,
    referredBy: String,
    address: String,
    medicalHistory: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const appointmentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
        type: String,
        enum: ['admin', 'doctor', 'therapist', 'nurse', 'receptionist', 'staff'],
        default: 'staff',
    },
    phone: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const settingsSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
    // General/Hospital Settings
    clinicName: { type: String, required: true },
    clinicAddress: String,
    clinicPhone: String,
    clinicEmail: String,
    taxId: String,
    clinicLogo: String, // Base64 or URL
    clinicTagline: { type: String, default: 'Medical & Health Services' },

    // Pharmacy Specific Settings
    pharmacyName: String,
    pharmacyAddress: String,
    pharmacyPhone: String,
    pharmacyEmail: String,
    pharmacyTaxId: String,
    pharmacyLogo: String, // Base64 or URL
    pharmacyTagline: { type: String, default: 'Your Trusted Pharmacy' },

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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    medicineName: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    costPrice: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    profit: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'insurance', 'jazzcash', 'easypaisa', 'other'], default: 'cash' },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invoiceNumber: { type: String, unique: true, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    customerName: String,
    type: { type: String, enum: ['patient', 'pharmacy', 'lab', 'other'], default: 'patient' },
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
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentNumber: { type: String, unique: true, required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    invoiceNumber: String,
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', 'upi', 'cheque', 'jazzcash', 'easypaisa', 'other'], required: true },
    paymentDate: { type: Date, default: Date.now },
    transactionId: String,
    referenceNumber: String,
    notes: String,
    receivedBy: String,
    status: { type: String, enum: ['completed', 'pending', 'failed', 'refunded'], default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const revenueSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const accountLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

// Lab Management Schemas
const labTestSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    sampleType: { type: String, default: 'Blood' },
    price: { type: Number, required: true, min: 0 },
    turnaroundHours: { type: Number, default: 24, min: 1 },
    normalRange: String,
    unit: String,
    description: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

labTestSchema.index({ tenantId: 1, code: 1 }, { unique: true });
labTestSchema.index({ tenantId: 1, name: 1 });

const labOrderSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, trim: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    patientName: { type: String, required: true },
    tests: [{
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest', required: true },
        code: String,
        name: String,
        sampleType: String,
        price: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'cancelled'],
            default: 'pending',
        },
        notes: String,
    }],
    priority: { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
    orderDate: { type: Date, default: Date.now },
    sampleCollectedAt: Date,
    status: {
        type: String,
        enum: ['registered', 'sample_collected', 'processing', 'completed', 'reported', 'cancelled'],
        default: 'registered',
    },
    reportStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'ready', 'delivered'],
        default: 'not_started',
    },
    billingStatus: {
        type: String,
        enum: ['unbilled', 'unpaid', 'partially_paid', 'paid', 'cancelled'],
        default: 'unbilled',
    },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    subtotal: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    referredBy: String,
    notes: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

labOrderSchema.index({ tenantId: 1, orderDate: -1 });
labOrderSchema.index({ tenantId: 1, status: 1 });

const labReportSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportNumber: { type: String, required: true, unique: true, trim: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabOrder', required: true, unique: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientName: String,
    tests: [{
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabTest' },
        code: String,
        name: String,
        resultValue: String,
        resultText: String,
        unit: String,
        normalRange: String,
        flag: {
            type: String,
            enum: ['normal', 'high', 'low', 'critical', 'abnormal'],
            default: 'normal',
        },
        remarks: String,
    }],
    summary: String,
    interpretation: String,
    recommendations: String,
    verifiedBy: String,
    verifiedAt: Date,
    deliveredAt: Date,
    status: {
        type: String,
        enum: ['draft', 'finalized', 'delivered'],
        default: 'draft',
    },
    attachments: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

labReportSchema.index({ tenantId: 1, createdAt: -1 });
labReportSchema.index({ tenantId: 1, status: 1 });

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
    taxRecordSchema,
    // Lab
    labTestSchema,
    labOrderSchema,
    labReportSchema,
};
