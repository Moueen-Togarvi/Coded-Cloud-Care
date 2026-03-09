const mongoose = require('mongoose');

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

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getDashboardSummary = async (req, res) => {
  try {
    const { Patient, LabOrder, LabReport, Invoice } = req.tenantModels;
    const tenantId = new mongoose.Types.ObjectId(req.user.userId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalPatients, pendingReports, completedToday, testsTodayAgg, revenueAgg, outstandingAgg, activeCases, reportsIssued, newToday, recentOrders] =
      await Promise.all([
        Patient.countDocuments({ tenantId, isActive: true }),
        LabReport.countDocuments({ tenantId, status: { $in: ['draft'] } }),
        LabOrder.countDocuments({ tenantId, status: { $in: ['completed', 'reported'] }, updatedAt: { $gte: startOfToday, $lte: endOfToday } }),
        LabOrder.aggregate([
          { $match: { tenantId, orderDate: { $gte: startOfToday, $lte: endOfToday }, status: { $ne: 'cancelled' } } },
          { $unwind: '$tests' },
          { $count: 'count' },
        ]),
        Invoice.aggregate([
          { $match: { tenantId, type: 'lab', createdAt: { $gte: monthStart }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, billed: { $sum: '$totalAmount' }, collected: { $sum: '$paidAmount' } } },
        ]),
        Invoice.aggregate([
          { $match: { tenantId, type: 'lab', status: { $in: ['unpaid', 'partially_paid', 'overdue'] } } },
          { $group: { _id: null, outstanding: { $sum: '$balance' }, count: { $sum: 1 } } },
        ]),
        LabOrder.countDocuments({ tenantId, status: { $in: ['registered', 'sample_collected', 'processing'] } }),
        LabReport.countDocuments({ tenantId }),
        Patient.countDocuments({ tenantId, isActive: true, createdAt: { $gte: startOfToday, $lte: endOfToday } }),
        LabOrder.find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('orderNumber patientName status totalAmount orderDate'),
      ]);

    const testsToday = testsTodayAgg[0]?.count || 0;
    const revenue = revenueAgg[0] || { billed: 0, collected: 0 };
    const outstanding = outstandingAgg[0] || { outstanding: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalPatients,
          testsToday,
          pendingReports,
          completedToday,
          activeCases,
          reportsIssued,
          newToday,
          billedThisMonth: revenue.billed,
          collectedThisMonth: revenue.collected,
          outstandingAmount: outstanding.outstanding,
          outstandingInvoices: outstanding.count,
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Lab dashboard summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab dashboard summary',
      error: error.message,
    });
  }
};

const getLabPatients = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const tenantId = req.user.userId;
    const { search = '', page = 1, limit = 20 } = req.query;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const query = { tenantId, isActive: true };
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { firstName: re },
        { lastName: re },
        { patientCode: re },
        { phone: re },
        { email: re },
      ];
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
    console.error('Get lab patients error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab patients',
      error: error.message,
    });
  }
};

const getLabPatientById = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { id } = req.params;

    const patient = await Patient.findOne({
      _id: id,
      tenantId: req.user.userId,
      isActive: true,
    }).select('-__v');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error('Get lab patient by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch patient',
      error: error.message,
    });
  }
};

const createLabPatient = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      medicalHistory,
      gender,
      age,
      patientCode,
      cnic,
      bloodGroup,
      referredBy,
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
      });
    }

    if (patientCode) {
      const codeExists = await Patient.findOne({
        tenantId: req.user.userId,
        patientCode: String(patientCode).trim(),
        isActive: true,
      });
      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'Patient code already exists',
        });
      }
    }

    const created = await Patient.create({
      tenantId: req.user.userId,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email,
      phone,
      dateOfBirth,
      address,
      medicalHistory,
      gender,
      age,
      patientCode: patientCode ? String(patientCode).trim() : undefined,
      cnic,
      bloodGroup,
      referredBy,
    });

    return res.status(201).json({
      success: true,
      message: 'Lab patient created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Create lab patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create lab patient',
      error: error.message,
    });
  }
};

const updateLabPatient = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };

    if (update.patientCode) {
      const codeExists = await Patient.findOne({
        tenantId: req.user.userId,
        patientCode: String(update.patientCode).trim(),
        _id: { $ne: id },
        isActive: true,
      });
      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'Patient code already exists',
        });
      }
    }

    const patient = await Patient.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      update,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lab patient updated successfully',
      data: patient,
    });
  } catch (error) {
    console.error('Update lab patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lab patient',
      error: error.message,
    });
  }
};

const deleteLabPatient = async (req, res) => {
  try {
    const { Patient } = req.tenantModels;
    const { id } = req.params;

    const patient = await Patient.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId, isActive: true },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lab patient deleted successfully',
    });
  } catch (error) {
    console.error('Delete lab patient error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete lab patient',
      error: error.message,
    });
  }
};

const getLabTests = async (req, res) => {
  try {
    const { LabTest } = req.tenantModels;
    const { search = '', category = '', activeOnly = 'true' } = req.query;

    const query = { tenantId: req.user.userId };
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    if (category) {
      query.category = String(category).trim();
    }
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ name: re }, { code: re }, { sampleType: re }];
    }

    const items = await LabTest.find(query).sort({ createdAt: -1 }).select('-__v');

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    console.error('Get lab tests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab tests',
      error: error.message,
    });
  }
};

const getLabTestById = async (req, res) => {
  try {
    const { LabTest } = req.tenantModels;
    const { id } = req.params;

    const item = await LabTest.findOne({ _id: id, tenantId: req.user.userId });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Get lab test by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab test',
      error: error.message,
    });
  }
};

const createLabTest = async (req, res) => {
  try {
    const { LabTest } = req.tenantModels;
    const { code, name, category, sampleType, price, turnaroundHours, normalRange, unit, description } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Code and name are required',
      });
    }

    if (!Number.isFinite(Number(price)) || Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required',
      });
    }

    const existing = await LabTest.findOne({
      tenantId: req.user.userId,
      code: String(code).trim(),
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Lab test code already exists',
      });
    }

    const created = await LabTest.create({
      tenantId: req.user.userId,
      code: String(code).trim(),
      name: String(name).trim(),
      category,
      sampleType,
      price: Number(price),
      turnaroundHours: toPositiveNumber(turnaroundHours, 24),
      normalRange,
      unit,
      description,
    });

    return res.status(201).json({
      success: true,
      message: 'Lab test created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Create lab test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create lab test',
      error: error.message,
    });
  }
};

const updateLabTest = async (req, res) => {
  try {
    const { LabTest } = req.tenantModels;
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };

    if (update.code) {
      const duplicate = await LabTest.findOne({
        tenantId: req.user.userId,
        code: String(update.code).trim(),
        _id: { $ne: id },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Lab test code already exists',
        });
      }
      update.code = String(update.code).trim();
    }

    if (update.price !== undefined && (!Number.isFinite(Number(update.price)) || Number(update.price) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number',
      });
    }

    const item = await LabTest.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId },
      update,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lab test updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('Update lab test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lab test',
      error: error.message,
    });
  }
};

const deleteLabTest = async (req, res) => {
  try {
    const { LabTest } = req.tenantModels;
    const { id } = req.params;

    const item = await LabTest.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lab test removed successfully',
    });
  } catch (error) {
    console.error('Delete lab test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete lab test',
      error: error.message,
    });
  }
};

const createLabOrder = async (req, res) => {
  try {
    const { Patient, LabTest, LabOrder, Invoice } = req.tenantModels;
    const tenantId = req.user.userId;

    const {
      patientId,
      testIds = [],
      priority = 'routine',
      referredBy,
      notes,
      discountAmount = 0,
      taxAmount = 0,
      createInvoice = true,
      dueDate,
    } = req.body;

    if (!patientId || !isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid patientId is required',
      });
    }

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one lab test is required',
      });
    }

    const patient = await Patient.findOne({ _id: patientId, tenantId, isActive: true });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found for this tenant',
      });
    }

    const uniqueIds = [...new Set(testIds.map((id) => String(id)))];
    const invalid = uniqueIds.find((id) => !isValidObjectId(id));
    if (invalid) {
      return res.status(400).json({
        success: false,
        message: `Invalid test id: ${invalid}`,
      });
    }

    const tests = await LabTest.find({
      _id: { $in: uniqueIds },
      tenantId,
      isActive: true,
    });
    if (!tests.length || tests.length !== uniqueIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some tests are invalid or inactive',
      });
    }

    const orderTests = tests.map((t) => ({
      testId: t._id,
      code: t.code,
      name: t.name,
      sampleType: t.sampleType,
      price: t.price,
      status: 'pending',
    }));

    const subtotal = orderTests.reduce((sum, t) => sum + (t.price || 0), 0);
    const discount = toPositiveNumber(discountAmount, 0);
    const tax = toPositiveNumber(taxAmount, 0);
    const totalAmount = Math.max(0, subtotal - discount + tax);

    const order = await LabOrder.create({
      tenantId,
      orderNumber: buildNumber('LORD'),
      patientId: patient._id,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      tests: orderTests,
      priority,
      status: 'registered',
      reportStatus: 'not_started',
      billingStatus: 'unbilled',
      subtotal,
      discountAmount: discount,
      taxAmount: tax,
      totalAmount,
      referredBy,
      notes,
      createdBy: req.user.email,
    });

    let invoice = null;
    if (createInvoice) {
      invoice = await Invoice.create({
        tenantId,
        invoiceNumber: buildNumber('LABINV'),
        patientId: patient._id,
        customerName: `${patient.firstName} ${patient.lastName}`.trim(),
        type: 'lab',
        items: orderTests.map((t) => ({
          description: `${t.name} (${t.code || 'LAB'})`,
          amount: t.price,
          quantity: 1,
          totalAmount: t.price,
        })),
        subtotal,
        taxAmount: tax,
        discountAmount: discount,
        totalAmount,
        paidAmount: 0,
        balance: totalAmount,
        status: totalAmount > 0 ? 'unpaid' : 'paid',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes: `Auto-generated for lab order ${order.orderNumber}`,
        createdBy: req.user.email,
      });

      order.invoiceId = invoice._id;
      order.billingStatus = invoice.status === 'paid' ? 'paid' : 'unpaid';
      await order.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Lab order created successfully',
      data: {
        order,
        invoice,
      },
    });
  } catch (error) {
    console.error('Create lab order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create lab order',
      error: error.message,
    });
  }
};

const getLabOrders = async (req, res) => {
  try {
    const { LabOrder } = req.tenantModels;
    const tenantId = req.user.userId;
    const {
      status,
      reportStatus,
      billingStatus,
      patientId,
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const query = { tenantId };
    if (status) query.status = status;
    if (reportStatus) query.reportStatus = reportStatus;
    if (billingStatus) query.billingStatus = billingStatus;
    if (patientId && isValidObjectId(patientId)) query.patientId = patientId;
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ orderNumber: re }, { patientName: re }, { 'tests.name': re }];
    }

    const [total, items] = await Promise.all([
      LabOrder.countDocuments(query),
      LabOrder.find(query)
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
    console.error('Get lab orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab orders',
      error: error.message,
    });
  }
};

const getLabOrderById = async (req, res) => {
  try {
    const { LabOrder } = req.tenantModels;
    const { id } = req.params;

    const item = await LabOrder.findOne({ _id: id, tenantId: req.user.userId }).select('-__v');
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('Get lab order by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab order',
      error: error.message,
    });
  }
};

const updateLabOrderStatus = async (req, res) => {
  try {
    const { LabOrder } = req.tenantModels;
    const { id } = req.params;
    const { status, reportStatus, sampleCollectedAt, notes } = req.body;

    const allowedStatus = ['registered', 'sample_collected', 'processing', 'completed', 'reported', 'cancelled'];
    const allowedReportStatus = ['not_started', 'in_progress', 'ready', 'delivered'];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatus.join(', ')}`,
      });
    }

    if (reportStatus && !allowedReportStatus.includes(reportStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report status. Allowed values: ${allowedReportStatus.join(', ')}`,
      });
    }

    const update = { updatedAt: new Date() };
    if (status) update.status = status;
    if (reportStatus) update.reportStatus = reportStatus;
    if (sampleCollectedAt) update.sampleCollectedAt = new Date(sampleCollectedAt);
    if (notes !== undefined) update.notes = notes;

    const item = await LabOrder.findOneAndUpdate(
      { _id: id, tenantId: req.user.userId },
      update,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lab order status updated successfully',
      data: item,
    });
  } catch (error) {
    console.error('Update lab order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update lab order status',
      error: error.message,
    });
  }
};

const createOrUpdateLabReport = async (req, res) => {
  try {
    const { LabOrder, LabReport } = req.tenantModels;
    const tenantId = req.user.userId;
    const {
      orderId,
      tests = [],
      summary,
      interpretation,
      recommendations,
      status = 'draft',
      deliveredAt,
      verifiedBy,
      attachments = [],
    } = req.body;

    if (!orderId || !isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid orderId is required',
      });
    }

    const order = await LabOrder.findOne({ _id: orderId, tenantId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Lab order not found',
      });
    }

    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one test result is required',
      });
    }

    const normalizedTests = tests.map((t) => ({
      testId: t.testId,
      code: t.code,
      name: t.name,
      resultValue: t.resultValue,
      resultText: t.resultText,
      unit: t.unit,
      normalRange: t.normalRange,
      flag: t.flag || 'normal',
      remarks: t.remarks,
    }));

    let report = await LabReport.findOne({ orderId, tenantId });
    if (!report) {
      report = await LabReport.create({
        tenantId,
        reportNumber: buildNumber('LREP'),
        orderId: order._id,
        patientId: order.patientId,
        patientName: order.patientName,
        tests: normalizedTests,
        summary,
        interpretation,
        recommendations,
        verifiedBy: verifiedBy || req.user.email,
        verifiedAt: status === 'finalized' || status === 'delivered' ? new Date() : undefined,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
        status,
        attachments,
      });
    } else {
      report.tests = normalizedTests;
      report.summary = summary;
      report.interpretation = interpretation;
      report.recommendations = recommendations;
      report.status = status;
      report.attachments = attachments;
      report.verifiedBy = verifiedBy || report.verifiedBy || req.user.email;
      if (status === 'finalized' || status === 'delivered') {
        report.verifiedAt = report.verifiedAt || new Date();
      }
      if (deliveredAt) {
        report.deliveredAt = new Date(deliveredAt);
      }
      report.updatedAt = new Date();
      await report.save();
    }

    const nextReportStatus = status === 'delivered'
      ? 'delivered'
      : status === 'finalized'
        ? 'ready'
        : 'in_progress';
    const nextOrderStatus = status === 'delivered' ? 'reported' : 'completed';

    order.reportStatus = nextReportStatus;
    order.status = nextOrderStatus;
    order.updatedAt = new Date();
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Lab report saved successfully',
      data: report,
    });
  } catch (error) {
    console.error('Create/Update lab report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save lab report',
      error: error.message,
    });
  }
};

const getLabReports = async (req, res) => {
  try {
    const { LabReport } = req.tenantModels;
    const { search = '', status, page = 1, limit = 20 } = req.query;
    const tenantId = req.user.userId;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const query = { tenantId };
    if (status) query.status = status;
    if (search) {
      const re = new RegExp(String(search).trim(), 'i');
      query.$or = [{ reportNumber: re }, { patientName: re }, { 'tests.name': re }];
    }

    const [total, items] = await Promise.all([
      LabReport.countDocuments(query),
      LabReport.find(query)
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
    console.error('Get lab reports error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab reports',
      error: error.message,
    });
  }
};

const getLabReportById = async (req, res) => {
  try {
    const { LabReport } = req.tenantModels;
    const { id } = req.params;

    const report = await LabReport.findOne({ _id: id, tenantId: req.user.userId }).select('-__v');
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get lab report by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab report',
      error: error.message,
    });
  }
};

const getLabReportByOrder = async (req, res) => {
  try {
    const { LabReport } = req.tenantModels;
    const orderId = req.params.orderId || req.params.id;

    const report = await LabReport.findOne({ orderId, tenantId: req.user.userId }).select('-__v');
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Lab report not found for this order',
      });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get lab report by order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab report',
      error: error.message,
    });
  }
};

const getLabInvoices = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const { status, patientId, search = '', page = 1, limit = 20 } = req.query;
    const tenantId = req.user.userId;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const query = { tenantId, type: 'lab', isActive: { $ne: false } };
    if (status) query.status = status;
    if (patientId && isValidObjectId(patientId)) query.patientId = patientId;
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
    console.error('Get lab invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lab invoices',
      error: error.message,
    });
  }
};

const addLabInvoicePayment = async (req, res) => {
  try {
    const { Invoice, Payment, Revenue, LabOrder } = req.tenantModels;
    const invoiceId = req.params.invoiceId || req.params.id;
    const { amount, paymentMethod = 'cash', transactionId, notes } = req.body;
    const tenantId = req.user.userId;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required',
      });
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenantId,
      type: 'lab',
      isActive: { $ne: false },
    });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Lab invoice not found',
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
    invoice.updatedAt = new Date();
    invoice.paymentHistory = invoice.paymentHistory || [];
    invoice.paymentHistory.push({
      amount: numericAmount,
      paymentMethod,
      paymentDate: new Date(),
      transactionId,
      receivedBy: req.user.email,
    });
    await invoice.save();

    const payment = await Payment.create({
      tenantId,
      paymentNumber: buildNumber('LABPAY'),
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
      tenantId,
      source: 'lab-tests',
      amount: numericAmount,
      date: new Date(),
      category: 'Lab Billing',
      description: `Payment received for ${invoice.invoiceNumber}`,
      referenceType: 'invoice',
      referenceId: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      paymentMethod,
      createdBy: req.user.email,
    });

    const order = await LabOrder.findOne({ tenantId, invoiceId: invoice._id });
    if (order) {
      order.billingStatus = invoice.status === 'paid' ? 'paid' : 'partially_paid';
      order.updatedAt = new Date();
      await order.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Lab invoice payment recorded successfully',
      data: {
        invoice,
        payment,
      },
    });
  } catch (error) {
    console.error('Add lab invoice payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record invoice payment',
      error: error.message,
    });
  }
};

const getOutstandingLabInvoices = async (req, res) => {
  try {
    const { Invoice } = req.tenantModels;
    const tenantId = new mongoose.Types.ObjectId(req.user.userId);

    const [summary] = await Invoice.aggregate([
      { $match: { tenantId, type: 'lab', status: { $in: ['unpaid', 'partially_paid', 'overdue'] } } },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          totalOutstanding: { $sum: '$balance' },
          totalBilled: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
        },
      },
    ]);

    const items = await Invoice.find({
      tenantId,
      type: 'lab',
      status: { $in: ['unpaid', 'partially_paid', 'overdue'] },
    })
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(50)
      .select('invoiceNumber customerName totalAmount paidAmount balance dueDate status');

    return res.status(200).json({
      success: true,
      data: {
        summary: summary || {
          invoiceCount: 0,
          totalOutstanding: 0,
          totalBilled: 0,
          totalPaid: 0,
        },
        items,
      },
    });
  } catch (error) {
    console.error('Outstanding lab invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch outstanding lab invoices',
      error: error.message,
    });
  }
};

module.exports = {
  // Dashboard
  getDashboardSummary,
  // Patients
  getLabPatients,
  getLabPatientById,
  createLabPatient,
  updateLabPatient,
  deleteLabPatient,
  // Tests
  getLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  deleteLabTest,
  // Orders
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrderStatus,
  // Reports
  createOrUpdateLabReport,
  getLabReports,
  getLabReportById,
  getLabReportByOrder,
  // Billing
  getLabInvoices,
  addLabInvoicePayment,
  getOutstandingLabInvoices,
};
