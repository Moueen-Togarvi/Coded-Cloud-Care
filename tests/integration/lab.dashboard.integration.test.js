const test = require('node:test');
const assert = require('node:assert/strict');

const { getDashboardSummary } = require('../../src/controllers/labController');
const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createLabTenantModels } = require('../helpers/inMemoryModels');

test('Lab dashboard summary computes metrics from tenant models', async () => {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(8, 0, 0, 0);

  const tenantModels = createLabTenantModels({
    patients: [
      {
        _id: '64f1a2b3c4d5e6f708091111',
        tenantId: '64f1a2b3c4d5e6f708091011',
        firstName: 'Ali',
        lastName: 'Khan',
        isActive: true,
        createdAt: now,
      },
      {
        _id: '64f1a2b3c4d5e6f708091112',
        tenantId: '64f1a2b3c4d5e6f708091011',
        firstName: 'Sara',
        lastName: 'Noor',
        isActive: true,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
    labOrders: [
      {
        _id: '64f1a2b3c4d5e6f708091121',
        tenantId: '64f1a2b3c4d5e6f708091011',
        orderNumber: 'LAB-001',
        patientName: 'Ali Khan',
        status: 'reported',
        orderDate: now,
        updatedAt: now,
        createdAt: now,
        totalAmount: 200,
        tests: [{ name: 'CBC' }, { name: 'LFT' }],
      },
      {
        _id: '64f1a2b3c4d5e6f708091122',
        tenantId: '64f1a2b3c4d5e6f708091011',
        orderNumber: 'LAB-002',
        patientName: 'Sara Noor',
        status: 'processing',
        orderDate: startToday,
        updatedAt: startToday,
        createdAt: startToday,
        totalAmount: 100,
        tests: [{ name: 'Glucose' }],
      },
    ],
    labReports: [
      {
        _id: '64f1a2b3c4d5e6f708091131',
        tenantId: '64f1a2b3c4d5e6f708091011',
        status: 'draft',
      },
      {
        _id: '64f1a2b3c4d5e6f708091132',
        tenantId: '64f1a2b3c4d5e6f708091011',
        status: 'finalized',
      },
    ],
    invoices: [
      {
        _id: '64f1a2b3c4d5e6f708091141',
        tenantId: '64f1a2b3c4d5e6f708091011',
        type: 'lab',
        status: 'partially_paid',
        totalAmount: 300,
        paidAmount: 100,
        balance: 200,
        createdAt: now,
      },
    ],
  });

  const req = createMockReq({
    user: {
      userId: '64f1a2b3c4d5e6f708091011',
      email: 'admin@lab.com',
      companyName: 'LabCare',
    },
    tenantModels,
  });
  const res = createMockRes();

  await getDashboardSummary(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);

  const metrics = res.body.data.metrics;
  assert.equal(metrics.totalPatients, 2);
  assert.equal(metrics.pendingReports, 1);
  assert.equal(metrics.testsToday, 3);
  assert.equal(metrics.reportsIssued, 2);
  assert.equal(metrics.activeCases, 1);
  assert.equal(metrics.outstandingInvoices, 1);
  assert.equal(metrics.outstandingAmount, 200);
  assert.equal(metrics.billedThisMonth, 300);
  assert.equal(metrics.collectedThisMonth, 100);

  assert.ok(Array.isArray(res.body.data.recentOrders));
  assert.ok(res.body.data.recentOrders.length >= 1);
});
