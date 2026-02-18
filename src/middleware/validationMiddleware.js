/**
 * Validation Middleware
 * Provides input validation and sanitization for API endpoints
 */

/**
 * Sanitize string input - remove HTML tags and trim whitespace
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (basic validation - allows various formats)
 */
const isValidPhone = (phone) => {
  if (!phone) return true; // Optional field
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Validate date format
 */
const isValidDate = (date) => {
  if (!date) return true; // Optional field
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

/**
 * Validate MongoDB ObjectId format
 */
const isValidObjectId = (id) => {
  return /^[a-f\d]{24}$/i.test(id);
};

/**
 * Validate numeric value
 */
const isValidNumber = (value, min = null, max = null) => {
  const num = Number(value);
  if (isNaN(num)) return false;
  if (min !== null && num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

/**
 * Validate patient input
 */
const validatePatientInput = (req, res, next) => {
  const { firstName, lastName, email, phone, dateOfBirth } = req.body;

  // Required fields
  if (!firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: 'First name and last name are required',
    });
  }

  // Sanitize strings
  if (firstName) req.body.firstName = sanitizeString(firstName);
  if (lastName) req.body.lastName = sanitizeString(lastName);
  if (req.body.address) req.body.address = sanitizeString(req.body.address);
  if (req.body.medicalHistory) req.body.medicalHistory = sanitizeString(req.body.medicalHistory);

  // Validate email if provided
  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
    });
  }

  // Validate phone if provided
  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format',
    });
  }

  // Validate date of birth if provided
  if (dateOfBirth && !isValidDate(dateOfBirth)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format',
    });
  }

  next();
};

/**
 * Validate staff input
 */
const validateStaffInput = (req, res, next) => {
  const { firstName, lastName, email, phone, role } = req.body;

  // Required fields
  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      success: false,
      message: 'First name, last name, and email are required',
    });
  }

  // Sanitize strings
  if (firstName) req.body.firstName = sanitizeString(firstName);
  if (lastName) req.body.lastName = sanitizeString(lastName);

  // Validate email
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format',
    });
  }

  // Validate phone if provided
  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format',
    });
  }

  // Validate role if provided
  const validRoles = ['admin', 'doctor', 'therapist', 'nurse', 'receptionist', 'staff'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be one of: ' + validRoles.join(', '),
    });
  }

  next();
};

/**
 * Validate appointment input
 */
const validateAppointmentInput = (req, res, next) => {
  const { patientId, appointmentDate } = req.body;

  // Required fields
  if (!patientId || !appointmentDate) {
    return res.status(400).json({
      success: false,
      message: 'Patient ID and appointment date are required',
    });
  }

  // Validate patient ID
  if (!isValidObjectId(patientId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid patient ID format',
    });
  }

  // Validate appointment date
  if (!isValidDate(appointmentDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format',
    });
  }

  // Validate duration if provided
  if (req.body.duration && !isValidNumber(req.body.duration, 1, 480)) {
    return res.status(400).json({
      success: false,
      message: 'Duration must be between 1 and 480 minutes',
    });
  }

  // Sanitize notes if provided
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
};

/**
 * Validate inventory/pharmacy item input
 */
const validateInventoryInput = (req, res, next) => {
  const { name, costPrice, sellingPrice, quantity } = req.body;

  // Required fields
  if (!name || costPrice === undefined || sellingPrice === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Name, cost price, and selling price are required',
    });
  }

  // Sanitize strings
  if (name) req.body.name = sanitizeString(name);
  if (req.body.sku) {
    req.body.sku = sanitizeString(req.body.sku);
    if (req.body.sku === '') {
      delete req.body.sku; // Let it be undefined so sparse index works
    }
  }
  if (req.body.description) req.body.description = sanitizeString(req.body.description);

  // Validate prices
  if (!isValidNumber(costPrice, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Cost price must be a positive number',
    });
  }

  if (!isValidNumber(sellingPrice, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Selling price must be a positive number',
    });
  }

  // Validate quantity if provided
  if (quantity !== undefined && !isValidNumber(quantity, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Quantity must be a positive number',
    });
  }

  // Validate expiry date if provided
  if (req.body.expiryDate && !isValidDate(req.body.expiryDate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid expiry date format',
    });
  }

  next();
};

/**
 * Validate invoice input
 */
const validateInvoiceInput = (req, res, next) => {
  const { subtotal, totalAmount } = req.body;

  // Required fields
  if (subtotal === undefined || totalAmount === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Subtotal and total amount are required',
    });
  }

  // Validate amounts
  if (!isValidNumber(subtotal, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Subtotal must be a positive number',
    });
  }

  if (!isValidNumber(totalAmount, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Total amount must be a positive number',
    });
  }

  // Validate patient ID if provided
  if (req.body.patientId && !isValidObjectId(req.body.patientId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid patient ID format',
    });
  }

  // Sanitize customer name if provided
  if (req.body.customerName) req.body.customerName = sanitizeString(req.body.customerName);
  if (req.body.notes) req.body.notes = sanitizeString(req.body.notes);

  next();
};

/**
 * Validate expense input
 */
const validateExpenseInput = (req, res, next) => {
  const { description, amount } = req.body;

  // Required fields
  if (!description || amount === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Description and amount are required',
    });
  }

  // Sanitize description
  req.body.description = sanitizeString(description);
  if (req.body.recipient) req.body.recipient = sanitizeString(req.body.recipient);

  // Validate amount
  if (!isValidNumber(amount, 0)) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive number',
    });
  }

  // Validate date if provided
  if (req.body.date && !isValidDate(req.body.date)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format',
    });
  }

  next();
};

/**
 * Validate ObjectId parameter
 */
const validateObjectIdParam = (req, res, next) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }

  next();
};

module.exports = {
  validatePatientInput,
  validateStaffInput,
  validateAppointmentInput,
  validateInventoryInput,
  validateInvoiceInput,
  validateExpenseInput,
  validateObjectIdParam,
  // Export utility functions for use in other modules
  sanitizeString,
  isValidEmail,
  isValidPhone,
  isValidDate,
  isValidObjectId,
  isValidNumber,
};
