const test = require('node:test');
const assert = require('node:assert/strict');

const pharmacyController = require('../../src/controllers/pharmacyController');
const accountingController = require('../../src/controllers/accountingController');

const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createFullTenantModels } = require('../helpers/inMemoryModels');

test('Pharmacy workflow: inventory, stock, sales, supplier, purchase order, and voiding', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091811',
    email: 'pharmacy@cloudcare.com',
    companyName: 'Pharma Cloud',
    name: 'Pharma Admin',
  };

  let medicineId = null;
  let saleInvoiceNumber = null;
  let supplierId = null;
  let purchaseOrderId = null;

  // create inventory item
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        name: 'Amoxicillin 500mg',
        sku: 'AMX-500',
        quantity: 20,
        costPrice: 50,
        sellingPrice: 80,
        taxRate: 5,
        lowStockThreshold: 5,
      },
    });
    const res = createMockRes();
    await pharmacyController.createItem(req, res);

    assert.equal(res.statusCode, 201);
    medicineId = res.body.data._id;
    assert.equal(tenantModels.Inventory.__data.length, 1);
  }

  // add stock
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        medicineId,
        quantity: 10,
        reason: 'manual-adjustment',
        performedBy: 'Stock Manager',
      },
    });
    const res = createMockRes();
    await pharmacyController.addStock(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(tenantModels.Inventory.__data[0].quantity, 30);
    assert.equal(tenantModels.StockMovement.__data.length, 1);
  }

  // record sale
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        items: [{ medicineId, quantity: 3 }],
        paymentMethod: 'cash',
        customerName: 'Walk-in',
        soldBy: 'Cashier 1',
        discount: 5,
      },
    });
    const res = createMockRes();
    await pharmacyController.recordBulkSale(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    saleInvoiceNumber = res.body.data.invoiceNumber;
    assert.equal(tenantModels.Sale.__data.length, 1);
    assert.equal(tenantModels.Inventory.__data[0].quantity, 27);
  }

  // adjust stock
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        medicineId,
        newQuantity: 15,
        type: 'adjustment',
        reason: 'cycle-count',
        performedBy: 'Stock Manager',
      },
    });
    const res = createMockRes();
    await pharmacyController.adjustStock(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(tenantModels.Inventory.__data[0].quantity, 15);
  }

  // fetch sales summary
  {
    const req = createMockReq({ user, tenantModels, query: {} });
    const res = createMockRes();
    await pharmacyController.getAllSales(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
    assert.ok(res.body.totalSales > 0);
  }

  // void sale batch and restore stock
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { invoiceNumber: saleInvoiceNumber },
    });
    const res = createMockRes();
    await pharmacyController.voidSaleBatch(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(tenantModels.Sale.__data[0].status, 'voided');
    assert.equal(tenantModels.Inventory.__data[0].quantity, 18);
  }

  // supplier + purchase order + receive stock
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: { name: 'Medi Supplies', phone: '+92-300-4444444' },
    });
    const res = createMockRes();
    await pharmacyController.createSupplier(req, res);
    assert.equal(res.statusCode, 201);
    supplierId = res.body.data._id;
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        supplierId,
        items: [
          {
            medicineId,
            medicineName: 'Amoxicillin 500mg',
            quantity: 5,
            totalCost: 250,
          },
        ],
        taxAmount: 0,
        createdBy: 'Procurement',
      },
    });
    const res = createMockRes();
    await pharmacyController.createPurchaseOrder(req, res);
    assert.equal(res.statusCode, 201);
    purchaseOrderId = res.body.data._id;
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: purchaseOrderId },
      body: { receivedBy: 'Store Incharge' },
    });
    const res = createMockRes();
    await pharmacyController.receivePurchaseOrder(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'received');
    assert.equal(tenantModels.Inventory.__data[0].quantity, 23);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await pharmacyController.getInventoryValue(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.summary.totalItems, 1);
  }
});

test('Accounting workflow: invoice/payment/revenue/expense/reports/tax full cycle', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091821',
    email: 'finance@cloudcare.com',
    companyName: 'Finance Cloud',
  };

  let invoiceId = null;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const period = `${now.getFullYear()}-${month}`;

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        customerName: 'Patient A',
        type: 'consultation',
        items: [{ description: 'Consultation Fee', amount: 1000, quantity: 1 }],
        taxAmount: 100,
        discountAmount: 50,
      },
    });
    const res = createMockRes();
    await accountingController.createInvoice(req, res);

    assert.equal(res.statusCode, 201);
    invoiceId = res.body.data._id;
    assert.equal(res.body.data.totalAmount, 1050);
    assert.equal(res.body.data.balance, 1050);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: invoiceId },
      body: {
        amount: 500,
        paymentMethod: 'cash',
        transactionId: 'TX-500',
        receivedBy: 'Cashier',
      },
    });
    const res = createMockRes();
    await accountingController.addPaymentToInvoice(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.invoice.status, 'partially_paid');
    assert.equal(res.body.data.invoice.balance, 550);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        amount: 200,
        paymentMethod: 'card',
        status: 'completed',
      },
    });
    const res = createMockRes();
    await accountingController.recordPayment(req, res);
    assert.equal(res.statusCode, 201);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        source: 'services',
        amount: 2000,
        date: now,
        category: 'Consultation',
      },
    });
    const res = createMockRes();
    await accountingController.recordRevenue(req, res);
    assert.equal(res.statusCode, 201);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        description: 'Electricity Bill',
        amount: 600,
        category: 'utilities',
        status: 'paid',
        date: now,
      },
    });
    const res = createMockRes();
    await accountingController.createExpense(req, res);
    assert.equal(res.statusCode, 201);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        description: 'Vendor Due',
        amount: 300,
        category: 'supplies',
        status: 'pending',
        date: now,
      },
    });
    const res = createMockRes();
    await accountingController.createExpense(req, res);
    assert.equal(res.statusCode, 201);
  }

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  {
    const req = createMockReq({ user, tenantModels, query: { startDate, endDate } });
    const res = createMockRes();
    await accountingController.getProfitLossStatement(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.totalRevenue, 2000);
    assert.equal(res.body.summary.totalExpenses, 900);
  }

  {
    const req = createMockReq({ user, tenantModels, query: { startDate, endDate } });
    const res = createMockRes();
    await accountingController.getCashFlowStatement(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.summary.cashInflow, 700);
    assert.equal(res.body.summary.cashOutflow, 600);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await accountingController.getBalanceSheet(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.balanceSheet.assets.accountsReceivable, 550);
    assert.equal(res.body.balanceSheet.liabilities.accountsPayable, 300);
  }

  {
    const req = createMockReq({ user, tenantModels, query: {} });
    const res = createMockRes();
    await accountingController.getPaymentMethodDistribution(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, 700);
    assert.equal(res.body.distribution.cash.count, 1);
    assert.equal(res.body.distribution.card.count, 1);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { period },
      query: { taxRate: 16 },
    });
    const res = createMockRes();
    await accountingController.calculateTax(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.period, period);
    assert.equal(res.body.data.taxAmount, 320);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { period },
    });
    const res = createMockRes();
    await accountingController.getTaxReport(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.period, period);
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        period,
        paymentReference: 'TAX-REF-001',
      },
    });
    const res = createMockRes();
    await accountingController.recordTaxPayment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'paid');
  }
});
