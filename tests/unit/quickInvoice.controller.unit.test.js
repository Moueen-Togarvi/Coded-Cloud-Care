const test = require('node:test');
const assert = require('node:assert/strict');

const quickInvoiceController = require('../../src/controllers/quickInvoiceController');
const { createMockReq, createMockRes } = require('../helpers/mockHttp');

const {
  createCustomer,
  createProduct,
  createInvoice,
  addInvoicePayment,
  deleteInvoice,
} = quickInvoiceController;

test('createCustomer returns 400 when required fields are missing', async () => {
  const req = createMockReq({
    body: { firstName: 'A' },
    tenantModels: {
      Patient: {
        findOne: async () => null,
        create: async () => ({ _id: 'x' }),
      },
    },
  });
  const res = createMockRes();

  await createCustomer(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /First name and last name are required/i);
});

test('createProduct returns 400 for negative selling price', async () => {
  const req = createMockReq({
    body: { name: 'Service A', sellingPrice: -10 },
    tenantModels: {
      Inventory: {
        create: async () => ({ _id: 'x' }),
      },
    },
  });
  const res = createMockRes();

  await createProduct(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Selling price must be a positive number/i);
});

test('createInvoice returns 400 when items are missing', async () => {
  const req = createMockReq({
    body: {
      customerName: 'Acme Corp',
      items: [],
    },
    tenantModels: {
      Invoice: { create: async () => ({}) },
      Inventory: { findOne: async () => null },
      Patient: { findOne: async () => null },
    },
  });
  const res = createMockRes();

  await createInvoice(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /At least one invoice item is required/i);
});

test('addInvoicePayment returns 400 when payment exceeds invoice balance', async () => {
  const invoiceDoc = {
    _id: '64f1a2b3c4d5e6f708091055',
    invoiceNumber: 'QIINV-TEST-001',
    totalAmount: 1000,
    paidAmount: 100,
    balance: 900,
    status: 'unpaid',
    paymentHistory: [],
    save: async function save() {
      return this;
    },
  };

  const req = createMockReq({
    params: { id: '64f1a2b3c4d5e6f708091055' },
    body: { amount: 1000, paymentMethod: 'cash' },
    tenantModels: {
      Invoice: {
        findOne: async () => invoiceDoc,
      },
      Payment: { create: async () => ({}) },
      Revenue: { create: async () => ({}) },
    },
  });
  const res = createMockRes();

  await addInvoicePayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Payment amount exceeds balance/i);
});

test('deleteInvoice returns 404 when invoice does not exist', async () => {
  const req = createMockReq({
    params: { id: '64f1a2b3c4d5e6f708091099' },
    tenantModels: {
      Invoice: {
        findOneAndUpdate: async () => null,
      },
    },
  });
  const res = createMockRes();

  await deleteInvoice(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Invoice not found/i);
});
