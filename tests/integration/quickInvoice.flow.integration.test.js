const test = require('node:test');
const assert = require('node:assert/strict');

const quickInvoiceController = require('../../src/controllers/quickInvoiceController');
const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createQuickInvoiceTenantModels } = require('../helpers/inMemoryModels');

const {
  createCustomer,
  createProduct,
  createInvoice,
  addInvoicePayment,
  getDashboardSummary,
  getInvoices,
} = quickInvoiceController;

test('QuickInvoice end-to-end flow: customer -> product -> invoice -> payment -> summary', async () => {
  const tenantModels = createQuickInvoiceTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091011',
    email: 'admin@quick.com',
    companyName: 'Quick Corp',
  };

  // 1) Create customer
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@doe.com',
        phone: '+92-300-1111111',
        patientCode: 'CUST-001',
      },
    });
    const res = createMockRes();
    await createCustomer(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(tenantModels.Patient.__data.length, 1);
  }

  const customer = tenantModels.Patient.__data[0];

  // 2) Create product
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        name: 'CBC Test Kit',
        sku: 'KIT-CBC-01',
        category: 'Lab Supplies',
        quantity: 10,
        sellingPrice: 100,
        costPrice: 60,
        taxRate: 0,
        lowStockThreshold: 2,
      },
    });
    const res = createMockRes();
    await createProduct(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(tenantModels.Inventory.__data.length, 1);
  }

  const product = tenantModels.Inventory.__data[0];

  // 3) Create invoice from product stock
  let invoiceId = null;
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        customerId: customer._id,
        items: [{ productId: product._id, quantity: 2 }],
        taxAmount: 10,
        discountAmount: 5,
        paymentTerms: 'Due on receipt',
      },
    });
    const res = createMockRes();
    await createInvoice(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);

    const invoice = res.body.data;
    invoiceId = invoice._id;

    assert.equal(invoice.subtotal, 200);
    assert.equal(invoice.totalAmount, 205);
    assert.equal(invoice.balance, 205);
    assert.equal(invoice.status, 'unpaid');

    // stock reduced
    assert.equal(tenantModels.Inventory.__data[0].quantity, 8);
  }

  // 4) Add payment and settle invoice
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: invoiceId },
      body: {
        amount: 205,
        paymentMethod: 'cash',
        transactionId: 'TX-001',
      },
    });
    const res = createMockRes();
    await addInvoicePayment(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const invoice = tenantModels.Invoice.__data.find((i) => String(i._id) === String(invoiceId));
    assert.ok(invoice);
    assert.equal(invoice.status, 'paid');
    assert.equal(invoice.balance, 0);
    assert.equal(Number(invoice.paidAmount), 205);

    assert.equal(tenantModels.Payment.__data.length, 1);
    assert.equal(tenantModels.Revenue.__data.length, 1);
  }

  // 5) Validate summary
  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getDashboardSummary(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    const metrics = res.body.data.metrics;
    assert.equal(metrics.totalCustomers, 1);
    assert.equal(metrics.totalInvoices, 1);
    assert.equal(metrics.paidInvoices, 1);
    assert.equal(metrics.unpaidInvoices, 0);
    assert.equal(Number(metrics.salesToday), 205);
  }

  // 6) Validate list filtering
  {
    const req = createMockReq({
      user,
      tenantModels,
      query: {
        status: 'paid',
        search: 'john',
        limit: 50,
      },
    });
    const res = createMockRes();
    await getInvoices(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].status, 'paid');
  }
});
