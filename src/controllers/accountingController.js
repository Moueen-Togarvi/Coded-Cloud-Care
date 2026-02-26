/**
 * Comprehensive Accounting Controller
 * Handles invoices, payments, revenue, expenses, financial reports, and tax calculations
 */

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique invoice number
 */
const generateInvoiceNumber = async (Invoice) => {
    const count = await Invoice.countDocuments();
    const timestamp = Date.now();
    return `INV-${timestamp}-${count + 1}`;
};

/**
 * Generate unique payment number
 */
const generatePaymentNumber = async (Payment) => {
    const count = await Payment.countDocuments();
    const timestamp = Date.now();
    return `PAY-${timestamp}-${count + 1}`;
};

/**
 * Generate unique expense number
 */
const generateExpenseNumber = async (Expense) => {
    const count = await Expense.countDocuments();
    const timestamp = Date.now();
    return `EXP-${timestamp}-${count + 1}`;
};

// ==================== INVOICE MANAGEMENT ====================

/**
 * Get all invoices
 */
const getAllInvoices = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;
        const { status, type, startDate, endDate } = req.query;

        let query = {};
        if (status) query.status = status;
        if (type) query.type = type;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const invoices = await Invoice.find(query)
            .populate('patientId', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const totalBalance = invoices.reduce((sum, inv) => sum + inv.balance, 0);

        res.status(200).json({
            success: true,
            count: invoices.length,
            summary: {
                totalAmount,
                totalPaid,
                totalBalance
            },
            data: invoices,
        });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message,
        });
    }
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;
        const { id } = req.params;

        const invoice = await Invoice.findById(id)
            .populate('patientId', 'firstName lastName email phone address');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice',
            error: error.message,
        });
    }
};

/**
 * Create new invoice
 */
const createInvoice = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;
        const { patientId, customerName, type, items, taxAmount = 0, discountAmount = 0, dueDate, paymentTerms, notes, createdBy } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invoice items are required',
            });
        }

        // Calculate amounts
        const subtotal = items.reduce((sum, item) => {
            item.totalAmount = item.amount * item.quantity;
            return sum + item.totalAmount;
        }, 0);

        const totalAmount = subtotal + taxAmount - discountAmount;
        const balance = totalAmount;

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(Invoice);

        if (totalAmount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Invoice total amount cannot be negative',
            });
        }

        const newInvoice = new Invoice({
            tenantId: req.user.userId,
            invoiceNumber,
            patientId,
            customerName,
            type,
            items,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paidAmount: 0,
            balance,
            status: 'unpaid',
            dueDate,
            paymentTerms,
            notes,
            createdBy,
            isActive: true
        });

        await newInvoice.save();

        res.status(201).json({
            success: true,
            message: 'Invoice created successfully',
            data: newInvoice,
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
            error: error.message,
        });
    }
};

/**
 * Update invoice
 */
const updateInvoice = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;
        const { id } = req.params;
        const updateData = req.body;

        // Recalculate if items changed
        if (updateData.items) {
            updateData.subtotal = updateData.items.reduce((sum, item) => {
                item.totalAmount = item.amount * item.quantity;
                return sum + item.totalAmount;
            }, 0);

            const taxAmount = updateData.taxAmount || 0;
            const discountAmount = updateData.discountAmount || 0;
            updateData.totalAmount = updateData.subtotal + taxAmount - discountAmount;
            updateData.balance = updateData.totalAmount - (updateData.paidAmount || 0);

            // Update status
            if (updateData.balance <= 0) {
                updateData.status = 'paid';
            } else if (updateData.paidAmount > 0) {
                updateData.status = 'partially_paid';
            }
        }

        updateData.updatedAt = new Date();

        const invoice = await Invoice.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('patientId', 'firstName lastName email');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Invoice updated successfully',
            data: invoice,
        });
    } catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice',
            error: error.message,
        });
    }
};

/**
 * Add payment to invoice
 */
const addPaymentToInvoice = async (req, res) => {
    try {
        const { Invoice, Payment } = req.tenantModels;
        const { id } = req.params;
        const { amount, paymentMethod, transactionId, receivedBy, notes } = req.body;

        if (!amount || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Amount and payment method are required',
            });
        }

        const invoice = await Invoice.findById(id);
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        // Validate payment amount
        if (amount > invoice.balance) {
            return res.status(400).json({
                success: false,
                message: `Payment amount exceeds balance. Balance: ${invoice.balance}`,
            });
        }

        // Update invoice
        invoice.paidAmount += amount;
        invoice.balance -= amount;

        // Update status
        if (invoice.balance <= 0) {
            invoice.status = 'paid';
        } else if (invoice.paidAmount > 0) {
            invoice.status = 'partially_paid';
        }

        // Add to payment history
        invoice.paymentHistory.push({
            amount,
            paymentMethod,
            paymentDate: new Date(),
            transactionId,
            receivedBy
        });

        await invoice.save();

        // Create payment record
        const paymentNumber = await generatePaymentNumber(Payment);
        const payment = new Payment({
            tenantId: req.user.userId,
            paymentNumber,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amount,
            paymentMethod,
            transactionId,
            receivedBy,
            notes,
            status: 'completed'
        });

        await payment.save();

        res.status(200).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                invoice,
                payment
            }
        });
    } catch (error) {
        console.error('Add payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment',
            error: error.message,
        });
    }
};

/**
 * Get overdue invoices
 */
const getOverdueInvoices = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;

        const overdueInvoices = await Invoice.find({
            dueDate: { $lt: new Date() },
            status: { $in: ['unpaid', 'partially_paid'] }
        }).populate('patientId', 'firstName lastName phone email');

        const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0);

        res.status(200).json({
            success: true,
            count: overdueInvoices.length,
            totalOverdue,
            data: overdueInvoices,
        });
    } catch (error) {
        console.error('Get overdue invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overdue invoices',
            error: error.message,
        });
    }
};

/**
 * Get invoices by date range
 */
const getInvoicesByDateRange = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const invoices = await Invoice.find({
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).populate('patientId', 'firstName lastName');

        const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

        res.status(200).json({
            success: true,
            count: invoices.length,
            totalAmount,
            totalPaid,
            data: invoices,
        });
    } catch (error) {
        console.error('Get invoices by date range error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message,
        });
    }
};

// ==================== PAYMENT MANAGEMENT ====================

/**
 * Record standalone payment
 */
const recordPayment = async (req, res) => {
    try {
        const Payment = req.tenantModels.Payment;
        const paymentData = req.body;

        if (!paymentData.amount || !paymentData.paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Amount and payment method are required',
            });
        }

        paymentData.paymentNumber = await generatePaymentNumber(Payment);

        const newPayment = new Payment({
            tenantId: req.user.userId,
            ...paymentData
        });
        await newPayment.save();

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: newPayment,
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment',
            error: error.message,
        });
    }
};

/**
 * Get all payments
 */
const getAllPayments = async (req, res) => {
    try {
        const Payment = req.tenantModels.Payment;
        const { startDate, endDate, paymentMethod, status } = req.query;

        let query = {};
        if (paymentMethod) query.paymentMethod = paymentMethod;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate) query.paymentDate.$gte = new Date(startDate);
            if (endDate) query.paymentDate.$lte = new Date(endDate);
        }

        const payments = await Payment.find(query)
            .populate('invoiceId', 'invoiceNumber totalAmount')
            .sort({ paymentDate: -1 });

        const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

        res.status(200).json({
            success: true,
            count: payments.length,
            totalAmount,
            data: payments,
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments',
            error: error.message,
        });
    }
};

/**
 * Get payments grouped by method
 */
const getPaymentsByMethod = async (req, res) => {
    try {
        const Payment = req.tenantModels.Payment;
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate) query.paymentDate.$gte = new Date(startDate);
            if (endDate) query.paymentDate.$lte = new Date(endDate);
        }

        const payments = await Payment.find(query);

        // Group by payment method
        const byMethod = {};
        payments.forEach(payment => {
            if (!byMethod[payment.paymentMethod]) {
                byMethod[payment.paymentMethod] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            byMethod[payment.paymentMethod].count += 1;
            byMethod[payment.paymentMethod].totalAmount += payment.amount;
        });

        res.status(200).json({
            success: true,
            data: byMethod,
        });
    } catch (error) {
        console.error('Get payments by method error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment statistics',
            error: error.message,
        });
    }
};

// ==================== REVENUE MANAGEMENT ====================

/**
 * Record revenue
 */
const recordRevenue = async (req, res) => {
    try {
        const Revenue = req.tenantModels.Revenue;
        const revenueData = req.body;

        if (!revenueData.source || !revenueData.amount) {
            return res.status(400).json({
                success: false,
                message: 'Source and amount are required',
            });
        }

        const newRevenue = new Revenue({
            tenantId: req.user.userId,
            ...revenueData
        });
        await newRevenue.save();

        res.status(201).json({
            success: true,
            message: 'Revenue recorded successfully',
            data: newRevenue,
        });
    } catch (error) {
        console.error('Record revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record revenue',
            error: error.message,
        });
    }
};

/**
 * Get revenue by source
 */
const getRevenueBySource = async (req, res) => {
    try {
        const Revenue = req.tenantModels.Revenue;
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const revenues = await Revenue.find(query);

        // Group by source
        const bySource = {};
        revenues.forEach(rev => {
            if (!bySource[rev.source]) {
                bySource[rev.source] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            bySource[rev.source].count += 1;
            bySource[rev.source].totalAmount += rev.amount;
        });

        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);

        res.status(200).json({
            success: true,
            totalRevenue,
            bySource,
        });
    } catch (error) {
        console.error('Get revenue by source error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue',
            error: error.message,
        });
    }
};

/**
 * Get revenue by date range
 */
const getRevenueByDateRange = async (req, res) => {
    try {
        const Revenue = req.tenantModels.Revenue;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const revenues = await Revenue.find({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ date: -1 });

        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);

        res.status(200).json({
            success: true,
            count: revenues.length,
            totalRevenue,
            data: revenues,
        });
    } catch (error) {
        console.error('Get revenue by date range error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue',
            error: error.message,
        });
    }
};

// ==================== EXPENSE MANAGEMENT ====================

/**
 * Get all expenses
 */
const getAllExpenses = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { category, status, startDate, endDate } = req.query;

        let query = {};
        if (category) query.category = category;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const expenses = await Expense.find(query).sort({ date: -1 });

        const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({
            success: true,
            count: expenses.length,
            totalAmount,
            data: expenses,
        });
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expenses',
            error: error.message,
        });
    }
};

/**
 * Create expense
 */
const createExpense = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const expenseData = req.body;

        if (!expenseData.description || !expenseData.amount) {
            return res.status(400).json({
                success: false,
                message: 'Description and amount are required',
            });
        }

        if (expenseData.amount < 0) {
            return res.status(400).json({
                success: false,
                message: 'Expense amount cannot be negative',
            });
        }

        expenseData.expenseNumber = await generateExpenseNumber(Expense);

        const newExpense = new Expense({
            tenantId: req.user.userId,
            ...expenseData,
            isActive: true
        });
        await newExpense.save();

        res.status(201).json({
            success: true,
            message: 'Expense recorded successfully',
            data: newExpense,
        });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create expense',
            error: error.message,
        });
    }
};

/**
 * Update expense
 */
const updateExpense = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { id } = req.params;
        const updateData = req.body;

        updateData.updatedAt = new Date();

        const expense = await Expense.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense updated successfully',
            data: expense,
        });
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update expense',
            error: error.message,
        });
    }
};

/**
 * Delete expense
 */
const deleteExpense = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { id } = req.params;

        // Soft delete for financial audit trail
        const expense = await Expense.findByIdAndUpdate(
            id,
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense deleted (archived) successfully',
        });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete expense',
            error: error.message,
        });
    }
};

/**
 * Get expenses by category
 */
const getExpensesByCategory = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const expenses = await Expense.find(query);

        // Group by category
        const byCategory = {};
        expenses.forEach(exp => {
            if (!byCategory[exp.category]) {
                byCategory[exp.category] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            byCategory[exp.category].count += 1;
            byCategory[exp.category].totalAmount += exp.amount;
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({
            success: true,
            totalExpenses,
            byCategory,
        });
    } catch (error) {
        console.error('Get expenses by category error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expense statistics',
            error: error.message,
        });
    }
};

/**
 * Get expenses by date range
 */
const getExpensesByDateRange = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const expenses = await Expense.find({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        }).sort({ date: -1 });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({
            success: true,
            count: expenses.length,
            totalExpenses,
            data: expenses,
        });
    } catch (error) {
        console.error('Get expenses by date range error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expenses',
            error: error.message,
        });
    }
};

// ==================== FINANCIAL REPORTS ====================

/**
 * Get Profit & Loss Statement
 */
const getProfitLossStatement = async (req, res) => {
    try {
        const { Revenue, Expense } = req.tenantModels;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const dateQuery = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

        // Get revenues
        const revenues = await Revenue.find({ date: dateQuery });
        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);

        // Get expenses
        const expenses = await Expense.find({ date: dateQuery });
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Calculate profit/loss
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            period: { startDate, endDate },
            summary: {
                totalRevenue,
                totalExpenses,
                netProfit,
                profitMargin: `${profitMargin}%`
            },
            revenues,
            expenses
        });
    } catch (error) {
        console.error('Get P&L statement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate P&L statement',
            error: error.message,
        });
    }
};

/**
 * Get Cash Flow Statement
 */
const getCashFlowStatement = async (req, res) => {
    try {
        const { Payment, Expense } = req.tenantModels;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const dateQuery = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

        // Cash inflows (payments received)
        const payments = await Payment.find({
            paymentDate: dateQuery,
            status: 'completed'
        });
        const cashInflow = payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Cash outflows (expenses paid)
        const expenses = await Expense.find({
            date: dateQuery,
            status: 'paid'
        });
        const cashOutflow = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Net cash flow
        const netCashFlow = cashInflow - cashOutflow;

        res.status(200).json({
            success: true,
            period: { startDate, endDate },
            summary: {
                cashInflow,
                cashOutflow,
                netCashFlow
            },
            inflows: payments,
            outflows: expenses
        });
    } catch (error) {
        console.error('Get cash flow statement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate cash flow statement',
            error: error.message,
        });
    }
};

/**
 * Get Balance Sheet (simplified)
 */
const getBalanceSheet = async (req, res) => {
    try {
        const { Invoice, Expense } = req.tenantModels;

        // Assets: Accounts Receivable (unpaid invoices)
        const unpaidInvoices = await Invoice.find({
            status: { $in: ['unpaid', 'partially_paid'] }
        });
        const accountsReceivable = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0);

        // Liabilities: Unpaid Expenses
        const unpaidExpenses = await Expense.find({
            status: { $in: ['pending', 'approved'] }
        });
        const accountsPayable = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Equity (simplified)
        const equity = accountsReceivable - accountsPayable;

        res.status(200).json({
            success: true,
            balanceSheet: {
                assets: {
                    accountsReceivable,
                    total: accountsReceivable
                },
                liabilities: {
                    accountsPayable,
                    total: accountsPayable
                },
                equity: {
                    retainedEarnings: equity,
                    total: equity
                }
            }
        });
    } catch (error) {
        console.error('Get balance sheet error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate balance sheet',
            error: error.message,
        });
    }
};

/**
 * Get Income Statement
 */
const getIncomeStatement = async (req, res) => {
    try {
        const { Revenue, Expense } = req.tenantModels;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }

        const dateQuery = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

        // Get revenues by source
        const revenues = await Revenue.find({ date: dateQuery });
        const revenueBySource = {};
        let totalRevenue = 0;

        revenues.forEach(rev => {
            if (!revenueBySource[rev.source]) {
                revenueBySource[rev.source] = 0;
            }
            revenueBySource[rev.source] += rev.amount;
            totalRevenue += rev.amount;
        });

        // Get expenses by category
        const expenses = await Expense.find({ date: dateQuery });
        const expenseByCategory = {};
        let totalExpenses = 0;

        expenses.forEach(exp => {
            if (!expenseByCategory[exp.category]) {
                expenseByCategory[exp.category] = 0;
            }
            expenseByCategory[exp.category] += exp.amount;
            totalExpenses += exp.amount;
        });

        const grossProfit = totalRevenue;
        const operatingIncome = grossProfit - totalExpenses;
        const netIncome = operatingIncome;

        res.status(200).json({
            success: true,
            period: { startDate, endDate },
            incomeStatement: {
                revenue: {
                    bySource: revenueBySource,
                    total: totalRevenue
                },
                grossProfit,
                operatingExpenses: {
                    byCategory: expenseByCategory,
                    total: totalExpenses
                },
                operatingIncome,
                netIncome
            }
        });
    } catch (error) {
        console.error('Get income statement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate income statement',
            error: error.message,
        });
    }
};

/**
 * Get Daily Financial Summary
 */
const getDailyFinancialSummary = async (req, res) => {
    try {
        const { Revenue, Expense, Payment } = req.tenantModels;
        const { date } = req.params;

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dateQuery = { $gte: startOfDay, $lte: endOfDay };

        // Get daily revenue
        const revenues = await Revenue.find({ date: dateQuery });
        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);

        // Get daily expenses
        const expenses = await Expense.find({ date: dateQuery });
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Get daily payments
        const payments = await Payment.find({ paymentDate: dateQuery });
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);

        const netProfit = totalRevenue - totalExpenses;

        res.status(200).json({
            success: true,
            date,
            summary: {
                totalRevenue,
                totalExpenses,
                totalPayments,
                netProfit
            }
        });
    } catch (error) {
        console.error('Get daily financial summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate daily summary',
            error: error.message,
        });
    }
};

/**
 * Get Monthly Financial Summary
 */
const getMonthlyFinancialSummary = async (req, res) => {
    try {
        const { Revenue, Expense, Payment } = req.tenantModels;
        const { year, month } = req.params;

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const dateQuery = { $gte: startOfMonth, $lte: endOfMonth };

        // Get monthly revenue
        const revenues = await Revenue.find({ date: dateQuery });
        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);

        // Get monthly expenses
        const expenses = await Expense.find({ date: dateQuery });
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Get monthly payments
        const payments = await Payment.find({ paymentDate: dateQuery });
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);

        const netProfit = totalRevenue - totalExpenses;

        res.status(200).json({
            success: true,
            period: { year, month },
            summary: {
                totalRevenue,
                totalExpenses,
                totalPayments,
                netProfit,
                profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Get monthly financial summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly summary',
            error: error.message,
        });
    }
};

// ==================== TAX & COMPLIANCE ====================

/**
 * Calculate tax for period
 */
const calculateTax = async (req, res) => {
    try {
        const { Revenue, TaxRecord } = req.tenantModels;
        const { period } = req.params;
        const { taxRate = 18 } = req.query; // Default 18% GST

        // Parse period (e.g., "2026-02" for Feb 2026)
        const [year, month] = period.split('-');
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const revenues = await Revenue.find({
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);
        const taxableAmount = totalRevenue;
        const taxAmount = (taxableAmount * taxRate) / 100;

        // Check if tax record already exists
        let taxRecord = await TaxRecord.findOne({ period });

        if (taxRecord) {
            // Update existing record
            taxRecord.totalRevenue = totalRevenue;
            taxRecord.taxableAmount = taxableAmount;
            taxRecord.taxRate = taxRate;
            taxRecord.taxAmount = taxAmount;
            await taxRecord.save();
        } else {
            // Create new record
            taxRecord = new TaxRecord({
                period,
                periodType: 'monthly',
                totalRevenue,
                taxableAmount,
                taxRate,
                taxAmount,
                status: 'pending'
            });
            await taxRecord.save();
        }

        res.status(200).json({
            success: true,
            message: 'Tax calculated successfully',
            data: taxRecord
        });
    } catch (error) {
        console.error('Calculate tax error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate tax',
            error: error.message,
        });
    }
};

/**
 * Get tax report
 */
const getTaxReport = async (req, res) => {
    try {
        const TaxRecord = req.tenantModels.TaxRecord;
        const { period } = req.params;

        const taxRecord = await TaxRecord.findOne({ period });

        if (!taxRecord) {
            return res.status(404).json({
                success: false,
                message: 'Tax record not found for this period',
            });
        }

        res.status(200).json({
            success: true,
            data: taxRecord,
        });
    } catch (error) {
        console.error('Get tax report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tax report',
            error: error.message,
        });
    }
};

/**
 * Record tax payment
 */
const recordTaxPayment = async (req, res) => {
    try {
        const TaxRecord = req.tenantModels.TaxRecord;
        const { period, paymentReference, notes } = req.body;

        if (!period) {
            return res.status(400).json({
                success: false,
                message: 'Period is required',
            });
        }

        const taxRecord = await TaxRecord.findOne({ period });

        if (!taxRecord) {
            return res.status(404).json({
                success: false,
                message: 'Tax record not found',
            });
        }

        taxRecord.status = 'paid';
        taxRecord.paidDate = new Date();
        taxRecord.paymentReference = paymentReference;
        if (notes) taxRecord.notes = notes;

        await taxRecord.save();

        res.status(200).json({
            success: true,
            message: 'Tax payment recorded successfully',
            data: taxRecord,
        });
    } catch (error) {
        console.error('Record tax payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record tax payment',
            error: error.message,
        });
    }
};

// ==================== ANALYTICS ====================

/**
 * Get Revenue vs Expenses comparison
 */
const getRevenueVsExpenses = async (req, res) => {
    try {
        const { Revenue, Expense } = req.tenantModels;
        let { startDate, endDate } = req.query;

        // Default to last 6 months if not provided
        if (!startDate || !endDate) {
            const now = new Date();
            endDate = now.toISOString();
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            startDate = sixMonthsAgo.toISOString();
        }

        const dateQuery = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };

        const revenues = await Revenue.find({ date: dateQuery });
        const expenses = await Expense.find({ date: dateQuery });

        const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // For the bar chart (Income vs Expense summary)
        res.status(200).json({
            success: true,
            period: { startDate, endDate },
            data: {
                labels: ['Summary'],
                income: [totalRevenue],
                expenses: [totalExpenses]
            },
            comparison: {
                revenue: totalRevenue,
                expenses: totalExpenses,
                difference: totalRevenue - totalExpenses,
                ratio: totalExpenses > 0 ? (totalRevenue / totalExpenses).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Get revenue vs expenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate comparison',
            error: error.message,
        });
    }
};

/**
 * Get top expense categories
 */
const getTopExpenseCategories = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;
        const { startDate, endDate, limit = 5 } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const expenses = await Expense.find(query);

        // Group by category
        const byCategory = {};
        expenses.forEach(exp => {
            if (!byCategory[exp.category]) {
                byCategory[exp.category] = 0;
            }
            byCategory[exp.category] += exp.amount;
        });

        // Convert to array and sort
        const topCategories = Object.entries(byCategory)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, parseInt(limit));

        res.status(200).json({
            success: true,
            data: topCategories,
        });
    } catch (error) {
        console.error('Get top expense categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expense categories',
            error: error.message,
        });
    }
};

/**
 * Get payment method distribution
 */
const getPaymentMethodDistribution = async (req, res) => {
    try {
        const Payment = req.tenantModels.Payment;
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate) query.paymentDate.$gte = new Date(startDate);
            if (endDate) query.paymentDate.$lte = new Date(endDate);
        }

        const payments = await Payment.find(query);

        // Group by payment method
        const distribution = {};
        let total = 0;

        payments.forEach(payment => {
            if (!distribution[payment.paymentMethod]) {
                distribution[payment.paymentMethod] = {
                    count: 0,
                    amount: 0
                };
            }
            distribution[payment.paymentMethod].count += 1;
            distribution[payment.paymentMethod].amount += payment.amount;
            total += payment.amount;
        });

        // Calculate percentages
        Object.keys(distribution).forEach(method => {
            distribution[method].percentage = total > 0
                ? ((distribution[method].amount / total) * 100).toFixed(2)
                : 0;
        });

        res.status(200).json({
            success: true,
            total,
            distribution,
        });
    } catch (error) {
        console.error('Get payment method distribution error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment distribution',
            error: error.message,
        });
    }
};

/**
 * Get accounts receivable total
 */
const getAccountsReceivable = async (req, res) => {
    try {
        const Invoice = req.tenantModels.Invoice;

        const unpaidInvoices = await Invoice.find({
            status: { $in: ['unpaid', 'partially_paid'] }
        }).populate('patientId', 'firstName lastName phone');

        const totalReceivable = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0);

        res.status(200).json({
            success: true,
            totalReceivable,
            count: unpaidInvoices.length,
            invoices: unpaidInvoices,
        });
    } catch (error) {
        console.error('Get accounts receivable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch accounts receivable',
            error: error.message,
        });
    }
};

/**
 * Get accounts payable total
 */
const getAccountsPayable = async (req, res) => {
    try {
        const Expense = req.tenantModels.Expense;

        const unpaidExpenses = await Expense.find({
            status: { $in: ['pending', 'approved'] }
        });

        const totalPayable = unpaidExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        res.status(200).json({
            success: true,
            totalPayable,
            count: unpaidExpenses.length,
            expenses: unpaidExpenses,
        });
    } catch (error) {
        console.error('Get accounts payable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch accounts payable',
            error: error.message,
        });
    }
};

module.exports = {
    // Invoices
    getAllInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    addPaymentToInvoice,
    getOverdueInvoices,
    getInvoicesByDateRange,
    // Payments
    recordPayment,
    getAllPayments,
    getPaymentsByMethod,
    // Revenue
    recordRevenue,
    getRevenueBySource,
    getRevenueByDateRange,
    // Expenses
    getAllExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpensesByCategory,
    getExpensesByDateRange,
    // Financial Reports
    getProfitLossStatement,
    getCashFlowStatement,
    getBalanceSheet,
    getIncomeStatement,
    getDailyFinancialSummary,
    getMonthlyFinancialSummary,
    // Tax
    calculateTax,
    getTaxReport,
    recordTaxPayment,
    // Analytics
    getRevenueVsExpenses,
    getTopExpenseCategories,
    getPaymentMethodDistribution,
    getAccountsReceivable,
    getAccountsPayable
};
