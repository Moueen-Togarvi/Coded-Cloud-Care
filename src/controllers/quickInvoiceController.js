const mongoose = require('mongoose');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const toPositiveNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const buildNumber = (prefix) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
};

const getDashboardSummary = async (req, res) => {
  try {
    const { Invoice, Patient } = req.tenantModels;
    const tenantId = new mongoose.Types.ObjectId(req.user.userId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [salesTodayAgg, salesMonthAgg, totalInvoices, paidInvoices, unpaidInvoices, totalCustomers, recentInvoices] = await Promise.all([
      Invoice.aggregate([
        { $match: { tenantId, type: 'other', createdAt: { $gte: startOfToday, $lte: endOfToday } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Invoice.aggregate([
        { $match: { tenantId, type: 'other', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Invoice.countDocuments({ tenantId, type: 'other', isActive: { $ne: false } }),
      Invoice.countDocuments({ tenantId, type: 'other', status: 'paid', isActive: { $ne: false } }),
      Invoice.countDocuments({ tenantId, type: 'other', status: { $in: ['unpaid', 'partially_paid', 'overdue'] }, isActive: { $ne: false } }),
      Patient.countDocuments({ tenantId, isActive: true }),
      Invoice.find({ tenantId, type: 'other', isActive: { $ne: false } })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('invoiceNumber customerName totalAmount status createdAt dueDate'),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          salesToday: salesTodayAgg[0]?.total || 0,
          salesMonth: salesMonthAgg[0]?.total || 0,
          totalInvoices,
          paidInvoices,
          unpaidInvoices,
          totalCustomers,
        },
        recentInvoices,
      },
    });
  } catch (error) {
    console.error('QuickInvoice summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message,
    });
  }
};

const getCustomers = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { search = '', page = 1, limit = 50 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const query = { tenantId: req.user.userId, isActive: true };
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }, { patientCode: re }];
    }

    const [total, items] = await Promise.all([
      Patient.countDocuments(query),
      Patient.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('-__v'),
    ]);

    return res.status(200).json({
      success: true,
      count: items.length,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit) || 1,
      },
      data: items,
    });
  } catch (error) {
    console.error('QuickInvoice customers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message,
    });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { firstName, lastName, email, phone, address, gender, age, patientCode } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
      });
    }

    if (patientCode) {
      const duplicate = await Patient.findOne({
        tenantId: req.user.userId,
        patientCode: String(patientCode).trim(),
        isActive: true,
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Customer code already exists',
        });
      }
    }

    const created = await Patient.create({
      tenantId: req.user.userId,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email,
      phone,
      address,
      gender,
      age,
      patientCode: patientCode ? String(patientCode).trim() : undefined,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: created,
    });
  } catch (error) {
    console.error('QuickInvoice create customer error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Customer code already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message,
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };

    if (update.patientCode) {
      const duplicate = await Patient.findOne({
        tenantId: req.user.userId,
        patientCode: String(update.patientCode).trim(),
        _id: { $ne: id },
        isActive: true,
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Customer code already exists',
        });
      }
    }

    const item = await Patient.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      update,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('QuickInvoice update customer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message,
    });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { id } = req.params;

    const item = await Patient.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer removed successfully',
    });
  } catch (error) {
    console.error('QuickInvoice delete customer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove customer',
      error: error.message,
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const { Inventory } = req.tenantModels;
    const { search = '', page = 1, limit = 50 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const query = { tenantId: req.user.userId, isActive: true };
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ name: re }, { sku: re }, { category: re }];
    }

    const [total, items] = await Promise.all([
      Inventory.countDocuments(query),
      Inventory.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('-__v'),
    ]);

    return res.status(200).json({
      success: true,
      count: items.length,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit) || 1,
      },
      data: items,
    });
  } catch (error) {
    console.error('QuickInvoice products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const { Inventory } = req.tenantModels;
    const {
      name,
      description,
      sku,
      category = 'general',
      quantity = 0,
      sellingPrice,
      costPrice,
      taxRate = 0,
      lowStockThreshold = 5,
    } = req.body;

    if (!name || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and selling price are required',
      });
    }

    const salePriceNum = Number(sellingPrice);
    if (!Number.isFinite(salePriceNum) || salePriceNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Selling price must be a positive number',
      });
    }

    const item = await Inventory.create({
      tenantId: req.user.userId,
      name: String(name).trim(),
      description,
      sku: sku ? String(sku).trim() : undefined,
      category,
      quantity: toPositiveNumber(quantity, 0),
      sellingPrice: salePriceNum,
      costPrice: Number.isFinite(Number(costPrice)) ? Number(costPrice) : salePriceNum,
      taxRate: toPositiveNumber(taxRate, 0),
      lowStockThreshold: toPositiveNumber(lowStockThreshold, 5),
      status: 'active',
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: item,
    });
  } catch (error) {
    console.error('QuickInvoice create product error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'SKU already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { Inventory } = req.tenantModels;
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };

    if (update.sellingPrice !== undefined && (!Number.isFinite(Number(update.sellingPrice)) || Number(update.sellingPrice) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Selling price must be a positive number',
      });
    }

    if (update.costPrice !== undefined && (!Number.isFinite(Number(update.costPrice)) || Number(update.costPrice) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Cost price must be a positive number',
      });
    }

    if (update.quantity !== undefined) {
      update.quantity = toPositiveNumber(update.quantity, 0);
    }

    const item = await Inventory.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      update,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('QuickInvoice update product error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'SKU already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { Inventory } = req.tenantModels;
    const { id } = req.params;

    const item = await Inventory.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      { isActive: false, status: 'discontinued', updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product removed successfully',
    });
  } catch (error) {
    console.error('QuickInvoice delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove product',
      error: error.message,
    });
  }
};

const getInvoices = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const { status, search = '', page = 1, limit = 50 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

    const query = { tenantId: req.user.userId, type: 'other', isActive: { $ne: false } };
    if (status) query.status = status;
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ invoiceNumber: re }, { customerName: re }];
    }

    const [total, items] = await Promise.all([
      Invoice.countDocuments(query),
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('-__v'),
    ]);

    return res.status(200).json({
      success: true,
      count: items.length,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit) || 1,
      },
      data: items,
    });
  } catch (error) {
    console.error('QuickInvoice get invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message,
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const { id } = req.params;
    const item = await Invoice.findOne({
      _id: id,
      tenantId: req.user.userId,
      type: 'other',
      isActive: { $ne: false },
    }).select('-__v');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('QuickInvoice get invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message,
    });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { Invoice, Inventory, Patient } = req.tenantModels;
    const {
      customerId,
      customerName,
      items = [],
      taxAmount = 0,
      discountAmount = 0,
      dueDate,
      paymentTerms,
      notes,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one invoice item is required',
      });
    }

    let customerLabel = String(customerName || '').trim();
    let patientId = null;

    if (customerId) {
      if (!isValidObjectId(customerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid customerId',
        });
      }
      const customer = await Patient.findOne({
        _id: customerId,
        tenantId: req.user.userId,
        isActive: true,
      });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }
      patientId = customer._id;
      customerLabel = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }

    if (!customerLabel) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required',
      });
    }

    const normalizedItems = [];
    const stockUpdates = [];

    for (const rawItem of items) {
      const quantity = Math.max(1, parseInt(rawItem.quantity, 10) || 1);

      if (rawItem.productId && isValidObjectId(rawItem.productId)) {
        const product = await Inventory.findOne({
          _id: rawItem.productId,
          tenantId: req.user.userId,
          isActive: true,
        });
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${rawItem.productId}`,
          });
        }

        if (Number(product.quantity || 0) < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`,
          });
        }

        const amount = Number(product.sellingPrice || 0);
        normalizedItems.push({
          description: product.name,
          amount,
          quantity,
          totalAmount: amount * quantity,
        });
        stockUpdates.push({ productId: product._id, quantity });
        continue;
      }

      const description = String(rawItem.description || '').trim();
      const amount = Number(rawItem.amount || rawItem.rate || 0);
      if (!description || !Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item requires valid description and amount',
        });
      }

      normalizedItems.push({
        description,
        amount,
        quantity,
        totalAmount: amount * quantity,
      });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const tax = toPositiveNumber(taxAmount, 0);
    const discount = toPositiveNumber(discountAmount, 0);
    const totalAmount = Math.max(0, subtotal + tax - discount);

    const invoice = await Invoice.create({
      tenantId: req.user.userId,
      invoiceNumber: buildNumber('QIINV'),
      patientId,
      customerName: customerLabel,
      type: 'other',
      items: normalizedItems,
      subtotal,
      taxAmount: tax,
      discountAmount: discount,
      totalAmount,
      paidAmount: 0,
      balance: totalAmount,
      status: totalAmount <= 0 ? 'paid' : 'unpaid',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      paymentTerms,
      notes: notes ? `[QuickInvoice] ${String(notes)}` : '[QuickInvoice]',
      createdBy: req.user.email,
      isActive: true,
    });

    if (stockUpdates.length) {
      await Promise.all(stockUpdates.map((u) => Inventory.updateOne(
        { _id: u.productId, tenantId: req.user.userId },
        { $inc: { quantity: -u.quantity }, updatedAt: new Date() }
      )));
    }

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    });
  } catch (error) {
    console.error('QuickInvoice create invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message,
    });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const { id } = req.params;
    const { customerName, dueDate, paymentTerms, notes, status } = req.body;

    const update = { updatedAt: new Date() };
    if (customerName !== undefined) update.customerName = customerName;
    if (dueDate !== undefined) update.dueDate = dueDate ? new Date(dueDate) : null;
    if (paymentTerms !== undefined) update.paymentTerms = paymentTerms;
    if (notes !== undefined) update.notes = notes;
    if (status !== undefined) {
      const allowed = ['paid', 'partially_paid', 'unpaid', 'overdue'];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${allowed.join(', ')}`,
        });
      }
      update.status = status;
    }

    const item = await Invoice.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, type: 'other', isActive: { $ne: false } },
      update,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invoice updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('QuickInvoice update invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message,
    });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const { id } = req.params;

    const item = await Invoice.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, type: 'other', isActive: { $ne: false } },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invoice removed successfully',
    });
  } catch (error) {
    console.error('QuickInvoice delete invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove invoice',
      error: error.message,
    });
  }
};

const addInvoicePayment = async (req, res) => {
  try {
    const { Invoice, Payment, Revenue } = req.tenantModels;
    const { id } = req.params;
    const { amount, paymentMethod = 'cash', transactionId, notes } = req.body;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required',
      });
    }

    const invoice = await Invoice.findOne({
      _id: id,
      tenantId: req.user.userId,
      type: 'other',
      isActive: { $ne: false },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    if (numericAmount > invoice.balance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount exceeds balance (${invoice.balance})`,
      });
    }

    invoice.paidAmount = toPositiveNumber(invoice.paidAmount) + numericAmount;
    invoice.balance = Math.max(0, toPositiveNumber(invoice.totalAmount) - invoice.paidAmount);
    invoice.status = invoice.balance <= 0 ? 'paid' : (invoice.paidAmount > 0 ? 'partially_paid' : 'unpaid');
    invoice.paymentMethod = paymentMethod;
    invoice.paymentHistory = invoice.paymentHistory || [];
    invoice.paymentHistory.push({
      amount: numericAmount,
      paymentMethod,
      paymentDate: new Date(),
      transactionId,
      receivedBy: req.user.email,
    });
    invoice.updatedAt = new Date();
    await invoice.save();

    const payment = await Payment.create({
      tenantId: req.user.userId,
      paymentNumber: buildNumber('QIPAY'),
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      amount: numericAmount,
      paymentMethod,
      paymentDate: new Date(),
      transactionId,
      notes,
      receivedBy: req.user.email,
      status: 'completed',
    });

    await Revenue.create({
      tenantId: req.user.userId,
      source: 'other',
      amount: numericAmount,
      date: new Date(),
      category: 'Quick Invoice',
      description: `Payment for ${invoice.invoiceNumber}`,
      referenceType: 'invoice',
      referenceId: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      paymentMethod,
      createdBy: req.user.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        invoice,
        payment,
      },
    });
  } catch (error) {
    console.error('QuickInvoice add payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardSummary,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addInvoicePayment,
};
