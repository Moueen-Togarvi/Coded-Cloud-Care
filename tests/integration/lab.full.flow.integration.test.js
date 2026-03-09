const test = require('node:test');
const assert = require('node:assert/strict');

const labController = require('../../src/controllers/labController');
const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createFullTenantModels } = require('../helpers/inMemoryModels');

test('Lab Reporting full workflow: patient, test, order, report, invoice and payment lifecycle', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091911',
    email: 'labadmin@cloudcare.com',
    companyName: 'Cloud Lab',
  };

  let patientId = null;
  let testId = null;
  let orderId = null;
  let invoiceId = null;

  // 1) create lab patient
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        firstName: 'Fatima',
        lastName: 'Noor',
        patientCode: 'LAB-PT-001',
        phone: '+92-300-7777777',
      },
    });
    const res = createMockRes();
    await labController.createLabPatient(req, res);

    assert.equal(res.statusCode, 201);
    patientId = res.body.data._id;
  }

  // 2) create lab test
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        code: 'CBC-001',
        name: 'Complete Blood Count',
        category: 'Hematology',
        sampleType: 'Blood',
        price: 1200,
        turnaroundHours: 24,
      },
    });
    const res = createMockRes();
    await labController.createLabTest(req, res);

    assert.equal(res.statusCode, 201);
    testId = res.body.data._id;
  }

  // 3) create lab order with auto invoice
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        patientId,
        testIds: [testId],
        discountAmount: 100,
        taxAmount: 60,
        createInvoice: true,
      },
    });
    const res = createMockRes();
    await labController.createLabOrder(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    orderId = res.body.data.order._id;
    invoiceId = res.body.data.invoice._id;
    assert.equal(res.body.data.invoice.totalAmount, 1160);
    assert.equal(res.body.data.order.billingStatus, 'unpaid');
  }

  // 4) update order status
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: orderId },
      body: { status: 'processing', reportStatus: 'in_progress' },
    });
    const res = createMockRes();
    await labController.updateLabOrderStatus(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'processing');
  }

  // 5) create report as finalized, then mark delivered
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        orderId,
        tests: [
          {
            testId,
            code: 'CBC-001',
            name: 'Complete Blood Count',
            resultText: 'Within normal range',
            unit: '',
            normalRange: '',
          },
        ],
        summary: 'All values are stable',
        status: 'finalized',
      },
    });
    const res = createMockRes();
    await labController.createOrUpdateLabReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'finalized');
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        orderId,
        tests: [
          {
            testId,
            code: 'CBC-001',
            name: 'Complete Blood Count',
            resultText: 'Delivered to patient',
          },
        ],
        status: 'delivered',
      },
    });
    const res = createMockRes();
    await labController.createOrUpdateLabReport(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'delivered');
  }

  // 6) verify report can be fetched by order
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { orderId },
    });
    const res = createMockRes();
    await labController.getLabReportByOrder(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.orderId, orderId);
  }

  // 7) invoices list should include the generated invoice
  {
    const req = createMockReq({ user, tenantModels, query: { status: 'unpaid' } });
    const res = createMockRes();
    await labController.getLabInvoices(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0]._id, invoiceId);
  }

  // 8) partial payment then outstanding summary
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: invoiceId },
      body: { amount: 600, paymentMethod: 'cash' },
    });
    const res = createMockRes();
    await labController.addLabInvoicePayment(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.invoice.status, 'partially_paid');
    assert.equal(res.body.data.invoice.balance, 560);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await labController.getOutstandingLabInvoices(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.summary.invoiceCount, 1);
    assert.equal(res.body.data.summary.totalOutstanding, 560);
  }

  // 9) settle remaining balance and ensure outstanding drops to zero
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: invoiceId },
      body: { amount: 560, paymentMethod: 'card' },
    });
    const res = createMockRes();
    await labController.addLabInvoicePayment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.invoice.status, 'paid');
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await labController.getOutstandingLabInvoices(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.summary.invoiceCount || 0, 0);
  }
});
