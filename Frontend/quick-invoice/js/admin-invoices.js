document.addEventListener('DOMContentLoaded', async () => {
  if (!window.QiApi) return;

  const ui = window.QiUi || {
    alert: async (msg) => window.alert(msg),
    confirm: async () => false,
    form: async () => null,
    createModal: () => null,
    closeModal: () => null,
  };

  const state = {
    invoices: [],
    customers: [],
    products: [],
    search: '',
    status: '',
  };

  const topSearchInput = document.querySelector('header input[placeholder*="Search invoices"]');
  const filterSearchInput = document.querySelector('input[placeholder*="INV-"]');
  const statusSelect = document.querySelector('select');
  const filterActionBtn = Array.from(document.querySelectorAll('button')).find((btn) =>
    (btn.querySelector('.material-symbols-outlined')?.textContent || '').trim() === 'filter_list'
  );
  const tbody = document.querySelector('table tbody');
  const footerSummary = Array.from(document.querySelectorAll('p.text-xs.text-slate-500, p.text-sm.text-slate-500'))
    .find((el) => (el.textContent || '').toLowerCase().includes('showing'));
  const fab = document.querySelector('button.fab');

  function normalizeStatus(value) {
    const v = String(value || '').trim().toLowerCase();
    if (!v || v.includes('all')) return '';
    if (v.includes('partial')) return 'partially_paid';
    if (v.includes('overdue')) return 'overdue';
    if (v.includes('unpaid')) return 'unpaid';
    if (v.includes('paid')) return 'paid';
    return '';
  }

  function findCustomerLabelById(id) {
    const customer = state.customers.find((item) => String(item._id) === String(id));
    if (!customer) return '';
    return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
  }

  function setSummaryCards() {
    const totalReceivables = state.invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    const pendingInvoices = state.invoices.filter((inv) => String(inv.status || '').toLowerCase() !== 'paid');
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    const now = new Date();
    const overdueInvoices = state.invoices.filter((inv) => {
      const status = String(inv.status || '').toLowerCase();
      if (status === 'overdue') return true;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate).getTime() < now.getTime() && Number(inv.balance || 0) > 0;
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);

    const cards = document.querySelectorAll('.card-hover');
    cards.forEach((card) => {
      const labelEl = card.querySelector('span.text-sm');
      const valueEl = card.querySelector('p.text-2xl');
      const subEl = card.querySelector('p.text-xs');
      const label = String(labelEl?.textContent || '').toLowerCase();

      if (!valueEl) return;

      if (label.includes('total receivables')) {
        valueEl.textContent = window.QiApi.formatCurrency(totalReceivables);
        if (subEl) subEl.textContent = `${state.invoices.length} invoices in current result`;
      }
      if (label.includes('pending invoices')) {
        valueEl.textContent = window.QiApi.formatCurrency(pendingAmount);
        if (subEl) subEl.textContent = `${pendingInvoices.length} invoices awaiting payment`;
      }
      if (label.includes('overdue')) {
        valueEl.textContent = window.QiApi.formatCurrency(overdueAmount);
        if (subEl) subEl.textContent = `${overdueInvoices.length} invoices past due date`;
      }
    });
  }

  function invoiceRow(inv) {
    const status = String(inv.status || 'unpaid').toLowerCase();
    const badgeClass = window.QiApi.statusClasses(status);

    return `
      <tr class="table-row">
        <td class="px-6 py-4 font-semibold text-primary">${window.QiApi.escapeHtml(inv.invoiceNumber || '-')}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="avatar-hover size-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center font-bold text-blue-600 text-xs">${window.QiApi.escapeHtml(window.QiApi.getInitials(inv.customerName || 'N A'))}</div>
            <div>
              <p class="text-sm font-semibold text-slate-900 leading-none">${window.QiApi.escapeHtml(inv.customerName || 'Unknown')}</p>
              <p class="text-xs text-slate-500">${window.QiApi.escapeHtml(inv.paymentTerms || 'Standard terms')}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-600">${window.QiApi.formatDate(inv.createdAt)}</td>
        <td class="px-6 py-4 text-sm font-bold text-slate-900 text-right">${window.QiApi.formatCurrency(inv.totalAmount || 0)}</td>
        <td class="px-6 py-4 text-center">
          <span class="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}">${window.QiApi.escapeHtml(window.QiApi.statusLabel(status))}</span>
        </td>
        <td class="px-6 py-4 text-right space-x-1">
          <button class="icon-btn p-1.5 text-slate-400" title="View" data-action="view" data-id="${window.QiApi.escapeHtml(inv._id)}"><span class="material-symbols-outlined text-lg pointer-events-none">visibility</span></button>
          <button class="icon-btn p-1.5 text-slate-400" title="Edit" data-action="edit" data-id="${window.QiApi.escapeHtml(inv._id)}"><span class="material-symbols-outlined text-lg pointer-events-none">edit</span></button>
          <button class="icon-btn p-1.5 text-slate-400" title="Receive Payment" data-action="pay" data-id="${window.QiApi.escapeHtml(inv._id)}"><span class="material-symbols-outlined text-lg pointer-events-none">payments</span></button>
          <button class="icon-btn p-1.5 text-slate-400" title="Duplicate" data-action="duplicate" data-id="${window.QiApi.escapeHtml(inv._id)}"><span class="material-symbols-outlined text-lg pointer-events-none">content_copy</span></button>
          <button class="icon-btn p-1.5 text-slate-400" title="Delete" data-action="delete" data-id="${window.QiApi.escapeHtml(inv._id)}"><span class="material-symbols-outlined text-lg pointer-events-none">delete</span></button>
        </td>
      </tr>
    `;
  }

  function renderTable() {
    if (!tbody) return;

    if (!state.invoices.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No invoices found</td></tr>';
      if (footerSummary) footerSummary.textContent = 'Showing 0 to 0 of 0 invoices';
      return;
    }

    tbody.innerHTML = state.invoices.map(invoiceRow).join('');

    if (footerSummary) {
      footerSummary.textContent = `Showing 1 to ${state.invoices.length} of ${state.invoices.length} invoices`;
    }
  }

  async function refreshInvoices() {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (state.search) params.set('search', state.search);
    if (state.status) params.set('status', state.status);

    const payload = await window.QiApi.request(`/invoices?${params.toString()}`);
    state.invoices = payload.data || [];
    setSummaryCards();
    renderTable();
  }

  function renderInvoiceDetailModal(inv) {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const payments = Array.isArray(inv.paymentHistory) ? inv.paymentHistory : [];

    const itemsHtml = items.map((item) => `
      <tr>
        <td class="px-3 py-2 text-sm text-slate-700">${window.QiApi.escapeHtml(item.description || 'Item')}</td>
        <td class="px-3 py-2 text-sm text-slate-700 text-right">${Number(item.quantity || 0)}</td>
        <td class="px-3 py-2 text-sm text-slate-700 text-right">${window.QiApi.formatCurrency(item.amount || 0)}</td>
        <td class="px-3 py-2 text-sm font-semibold text-slate-900 text-right">${window.QiApi.formatCurrency(item.totalAmount || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="px-3 py-3 text-center text-sm text-slate-500">No line items</td></tr>';

    const paymentHtml = payments.map((pay) => `
      <li class="flex items-center justify-between py-2 text-sm">
        <span class="text-slate-600">${window.QiApi.formatDate(pay.paymentDate)} • ${window.QiApi.escapeHtml(pay.paymentMethod || 'cash')}</span>
        <span class="font-semibold text-slate-900">${window.QiApi.formatCurrency(pay.amount || 0)}</span>
      </li>
    `).join('') || '<li class="py-2 text-sm text-slate-500">No payments recorded</li>';

    const modal = ui.createModal({
      title: `Invoice ${inv.invoiceNumber || ''}`,
      widthClass: 'max-w-4xl',
      contentHtml: `
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><span class="font-semibold text-slate-500">Customer:</span> ${window.QiApi.escapeHtml(inv.customerName || '-')}</div>
            <div><span class="font-semibold text-slate-500">Status:</span> ${window.QiApi.escapeHtml(window.QiApi.statusLabel(inv.status || ''))}</div>
            <div><span class="font-semibold text-slate-500">Due Date:</span> ${window.QiApi.formatDate(inv.dueDate)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="px-3 py-2 text-left">Description</th>
                  <th class="px-3 py-2 text-right">Qty</th>
                  <th class="px-3 py-2 text-right">Rate</th>
                  <th class="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">${itemsHtml}</tbody>
            </table>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-slate-600">Subtotal</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.subtotal || 0)}</div>
            <div class="text-slate-600">Tax</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.taxAmount || 0)}</div>
            <div class="text-slate-600">Discount</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.discountAmount || 0)}</div>
            <div class="font-bold text-slate-900">Total</div><div class="text-right font-bold text-slate-900">${window.QiApi.formatCurrency(inv.totalAmount || 0)}</div>
            <div class="text-slate-600">Paid</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.paidAmount || 0)}</div>
            <div class="text-slate-600">Balance</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.balance || 0)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <h4 class="text-sm font-bold text-slate-900 mb-2">Payment History</h4>
            <ul class="divide-y divide-slate-100">${paymentHtml}</ul>
          </div>
        </div>
      `,
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mt-4 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => ui.closeModal(modal));
    modal.querySelector('[data-role="content"]').appendChild(closeBtn);
  }

  function addInvoiceItemRow(container, productOptions, row = {}) {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid grid-cols-12 gap-2 items-end border border-slate-200 rounded-xl p-3';

    const optionHtml = ['<option value="">Custom Item</option>']
      .concat(productOptions.map((item) => `<option value="${window.QiApi.escapeHtml(item._id)}">${window.QiApi.escapeHtml(item.name)} (${window.QiApi.formatCurrency(item.sellingPrice || 0)})</option>`))
      .join('');

    rowEl.innerHTML = `
      <div class="col-span-12 md:col-span-4">
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Product</label>
        <select class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-field="productId">${optionHtml}</select>
      </div>
      <div class="col-span-12 md:col-span-4">
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Description</label>
        <input type="text" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-field="description" placeholder="Item description" />
      </div>
      <div class="col-span-6 md:col-span-2">
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Rate</label>
        <input type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-field="amount" value="0" />
      </div>
      <div class="col-span-4 md:col-span-1">
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Qty</label>
        <input type="number" min="1" step="1" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" data-field="quantity" value="1" />
      </div>
      <div class="col-span-2 md:col-span-1">
        <button type="button" class="w-full rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 py-2" data-action="remove-item">
          <span class="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
    `;

    const productSelect = rowEl.querySelector('[data-field="productId"]');
    const descInput = rowEl.querySelector('[data-field="description"]');
    const amountInput = rowEl.querySelector('[data-field="amount"]');
    const qtyInput = rowEl.querySelector('[data-field="quantity"]');
    const removeBtn = rowEl.querySelector('[data-action="remove-item"]');

    if (row.productId) productSelect.value = row.productId;
    if (row.description) descInput.value = row.description;
    if (row.amount !== undefined) amountInput.value = String(row.amount);
    if (row.quantity !== undefined) qtyInput.value = String(row.quantity);

    productSelect.addEventListener('change', () => {
      const selected = productOptions.find((p) => String(p._id) === String(productSelect.value));
      if (selected) {
        descInput.value = selected.name || '';
        amountInput.value = String(selected.sellingPrice || 0);
      }
    });

    removeBtn.addEventListener('click', () => {
      const rows = container.querySelectorAll('[data-role="invoice-item-row"]');
      if (rows.length <= 1) {
        descInput.value = '';
        amountInput.value = '0';
        qtyInput.value = '1';
        productSelect.value = '';
        return;
      }
      rowEl.remove();
    });

    rowEl.setAttribute('data-role', 'invoice-item-row');
    container.appendChild(rowEl);
  }

  async function openCreateInvoiceModal(defaultCustomerId = '') {
    const customerOptions = state.customers.map((cust) => {
      const name = `${cust.firstName || ''} ${cust.lastName || ''}`.trim();
      return `<option value="${window.QiApi.escapeHtml(cust._id)}">${window.QiApi.escapeHtml(name || 'Unnamed Customer')}</option>`;
    }).join('');

    const modal = ui.createModal({
      title: 'Create Invoice',
      widthClass: 'max-w-4xl',
      closeOnOverlay: false,
      contentHtml: `
        <form data-role="invoice-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer</span>
              <select name="customerId" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select customer</option>
                ${customerOptions}
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name (for custom invoice)</span>
              <input name="customerName" type="text" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Enter name if not in list" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</span>
              <input name="dueDate" type="date" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Payment Terms</span>
              <input name="paymentTerms" type="text" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Due in 15 days" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Tax Amount</span>
              <input name="taxAmount" type="number" min="0" step="0.01" value="0" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Discount Amount</span>
              <input name="discountAmount" type="number" min="0" step="0.01" value="0" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-slate-900">Invoice Items</h4>
              <button type="button" data-action="add-item" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">Add Item</button>
            </div>
            <div data-role="items" class="space-y-2"></div>
          </div>

          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Notes</span>
            <textarea name="notes" rows="3" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Optional notes"></textarea>
          </label>

          <div class="pt-2 flex justify-end gap-2">
            <button type="button" data-action="cancel" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90">Create Invoice</button>
          </div>
        </form>
      `,
    });

    const formEl = modal.querySelector('[data-role="invoice-form"]');
    const itemsWrap = modal.querySelector('[data-role="items"]');
    const addItemBtn = modal.querySelector('[data-action="add-item"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const customerSelect = formEl.elements.namedItem('customerId');
    const customerNameInput = formEl.elements.namedItem('customerName');

    addInvoiceItemRow(itemsWrap, state.products);

    if (defaultCustomerId) {
      if (customerSelect) customerSelect.value = defaultCustomerId;
      if (customerNameInput) {
        customerNameInput.value = findCustomerLabelById(defaultCustomerId);
      }
    }

    if (customerSelect && customerNameInput) {
      customerSelect.addEventListener('change', () => {
        const label = findCustomerLabelById(customerSelect.value);
        customerNameInput.value = label || customerNameInput.value || '';
      });
    }

    addItemBtn.addEventListener('click', () => addInvoiceItemRow(itemsWrap, state.products));
    cancelBtn.addEventListener('click', () => ui.closeModal(modal));

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();

      const customerId = String(formEl.elements.namedItem('customerId')?.value || '').trim();
      const customerName = String(formEl.elements.namedItem('customerName')?.value || '').trim();
      const dueDate = String(formEl.elements.namedItem('dueDate')?.value || '').trim();
      const paymentTerms = String(formEl.elements.namedItem('paymentTerms')?.value || '').trim();
      const taxAmount = Number(formEl.elements.namedItem('taxAmount')?.value || 0);
      const discountAmount = Number(formEl.elements.namedItem('discountAmount')?.value || 0);
      const notes = String(formEl.elements.namedItem('notes')?.value || '').trim();

      const rows = Array.from(itemsWrap.querySelectorAll('[data-role="invoice-item-row"]'));
      const items = [];

      for (const row of rows) {
        const productId = String(row.querySelector('[data-field="productId"]')?.value || '').trim();
        const description = String(row.querySelector('[data-field="description"]')?.value || '').trim();
        const amount = Number(row.querySelector('[data-field="amount"]')?.value || 0);
        const quantity = Number(row.querySelector('[data-field="quantity"]')?.value || 1);

        if (productId) {
          items.push({ productId, quantity: Math.max(1, quantity) });
        } else if (description && Number.isFinite(amount) && amount >= 0) {
          items.push({ description, amount, quantity: Math.max(1, quantity) });
        }
      }

      if (!items.length) {
        await ui.alert('Please add at least one valid item.', { title: 'Validation' });
        return;
      }

      if (!customerId && !customerName) {
        await ui.alert('Select a customer or enter customer name.', { title: 'Validation' });
        return;
      }

      try {
        await window.QiApi.request('/invoices', {
          method: 'POST',
          body: JSON.stringify({
            customerId: customerId || undefined,
            customerName: customerName || undefined,
            items,
            taxAmount,
            discountAmount,
            dueDate: dueDate || undefined,
            paymentTerms: paymentTerms || undefined,
            notes: notes || undefined,
          }),
        });

        ui.closeModal(modal);
        await ui.alert('Invoice created successfully.', { title: 'Success' });
        await refreshInvoices();
      } catch (error) {
        await ui.alert(error.message || 'Failed to create invoice', { title: 'Create Failed' });
      }
    });
  }

  async function editInvoice(inv) {
    const data = await ui.form({
      title: `Edit ${inv.invoiceNumber || 'Invoice'}`,
      submitText: 'Save Changes',
      fields: [
        { name: 'customerName', label: 'Customer Name', required: true, value: inv.customerName || '' },
        { name: 'dueDate', label: 'Due Date', type: 'date', value: window.QiApi.formatDateInput(inv.dueDate) },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          value: String(inv.status || 'unpaid'),
          options: [
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'partially_paid', label: 'Partially Paid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
          ],
        },
        { name: 'paymentTerms', label: 'Payment Terms', value: inv.paymentTerms || '' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, value: inv.notes || '' },
      ],
    });

    if (!data) return;

    await window.QiApi.request(`/invoices/${inv._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        customerName: data.customerName,
        dueDate: data.dueDate || null,
        status: data.status,
        paymentTerms: data.paymentTerms || undefined,
        notes: data.notes || undefined,
      }),
    });

    await ui.alert('Invoice updated successfully.', { title: 'Success' });
    await refreshInvoices();
  }

  async function addPayment(inv) {
    if (Number(inv.balance || 0) <= 0) {
      await ui.alert('This invoice has no pending balance.', { title: 'No Balance' });
      return;
    }

    const data = await ui.form({
      title: `Receive Payment (${inv.invoiceNumber || ''})`,
      submitText: 'Record Payment',
      fields: [
        { name: 'amount', label: 'Amount', type: 'number', min: 0.01, step: '0.01', required: true, value: String(inv.balance || 0) },
        {
          name: 'paymentMethod',
          label: 'Payment Method',
          type: 'select',
          value: 'cash',
          options: [
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'jazzcash', label: 'JazzCash' },
            { value: 'easypaisa', label: 'Easypaisa' },
            { value: 'other', label: 'Other' },
          ],
        },
        { name: 'transactionId', label: 'Transaction ID', placeholder: 'Optional' },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
      ],
    });

    if (!data) return;

    await window.QiApi.request(`/invoices/${inv._id}/payment`, {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(data.amount || 0),
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId || undefined,
        notes: data.notes || undefined,
      }),
    });

    await ui.alert('Payment recorded successfully.', { title: 'Success' });
    await refreshInvoices();
  }

  async function duplicateInvoice(inv) {
    const ok = await ui.confirm(`Create a duplicate of ${inv.invoiceNumber || 'this invoice'}?`, {
      title: 'Duplicate Invoice',
      confirmText: 'Duplicate',
    });
    if (!ok) return;

    const items = (inv.items || []).map((item) => ({
      description: item.description,
      amount: Number(item.amount || 0),
      quantity: Number(item.quantity || 1),
    }));

    await window.QiApi.request('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId: inv.patientId || undefined,
        customerName: inv.customerName,
        items,
        taxAmount: Number(inv.taxAmount || 0),
        discountAmount: Number(inv.discountAmount || 0),
        dueDate: inv.dueDate || undefined,
        paymentTerms: inv.paymentTerms || undefined,
        notes: inv.notes || undefined,
      }),
    });

    await ui.alert('Invoice duplicated successfully.', { title: 'Success' });
    await refreshInvoices();
  }

  async function deleteInvoice(inv) {
    const ok = await ui.confirm(`Delete ${inv.invoiceNumber || 'this invoice'}?`, {
      title: 'Delete Invoice',
      confirmText: 'Delete',
    });

    if (!ok) return;

    await window.QiApi.request(`/invoices/${inv._id}`, { method: 'DELETE' });
    await ui.alert('Invoice deleted successfully.', { title: 'Deleted' });
    await refreshInvoices();
  }

  function installSearchHandlers() {
    const onSearch = (value) => {
      state.search = String(value || '').trim();
      refreshInvoices().catch(async (error) => {
        await ui.alert(error.message || 'Failed to search invoices', { title: 'Search Error' });
      });
    };

    let timer = null;
    const debounce = (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => onSearch(value), 250);
    };

    if (topSearchInput) {
      topSearchInput.addEventListener('input', (event) => {
        if (filterSearchInput) filterSearchInput.value = event.target.value;
        debounce(event.target.value);
      });
    }

    if (filterSearchInput) {
      filterSearchInput.addEventListener('input', (event) => {
        if (topSearchInput) topSearchInput.value = event.target.value;
        debounce(event.target.value);
      });
    }

    if (statusSelect) {
      if (!Array.from(statusSelect.options).some((opt) => normalizeStatus(opt.value || opt.textContent) === 'overdue')) {
        const overdueOpt = document.createElement('option');
        overdueOpt.value = 'Overdue';
        overdueOpt.textContent = 'Overdue';
        statusSelect.appendChild(overdueOpt);
      }

      statusSelect.addEventListener('change', (event) => {
        state.status = normalizeStatus(event.target.value || event.target.options[event.target.selectedIndex]?.text || '');
        refreshInvoices().catch(async (error) => {
          await ui.alert(error.message || 'Failed to filter invoices', { title: 'Filter Error' });
        });
      });
    }

    if (filterActionBtn) {
      filterActionBtn.addEventListener('click', () => {
        state.search = '';
        state.status = '';
        if (topSearchInput) topSearchInput.value = '';
        if (filterSearchInput) filterSearchInput.value = '';
        if (statusSelect) statusSelect.selectedIndex = 0;
        refreshInvoices().catch(async (error) => {
          await ui.alert(error.message || 'Failed to refresh invoices', { title: 'Filter Error' });
        });
      });
    }
  }

  function installActionHandlers() {
    if (!tbody) return;

    tbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;

      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const inv = state.invoices.find((item) => String(item._id) === String(id));
      if (!inv) return;

      try {
        if (action === 'view') {
          const payload = await window.QiApi.request(`/invoices/${id}`);
          renderInvoiceDetailModal(payload.data || inv);
        }
        if (action === 'edit') await editInvoice(inv);
        if (action === 'pay') await addPayment(inv);
        if (action === 'duplicate') await duplicateInvoice(inv);
        if (action === 'delete') await deleteInvoice(inv);
      } catch (error) {
        await ui.alert(error.message || 'Action failed', { title: 'Error' });
      }
    });
  }

  async function loadLookups() {
    const [customersPayload, productsPayload] = await Promise.all([
      window.QiApi.request('/customers?limit=200'),
      window.QiApi.request('/products?limit=200'),
    ]);

    state.customers = customersPayload.data || [];
    state.products = productsPayload.data || [];
  }

  try {
    installSearchHandlers();
    installActionHandlers();
    setSummaryCards();
    renderTable();

    if (fab) {
      fab.addEventListener('click', () => {
        openCreateInvoiceModal().catch(async (error) => {
          await ui.alert(error.message || 'Failed to open form', { title: 'Error' });
        });
      });
    }

    const params = new URLSearchParams(window.location.search);
    const querySearch = String(params.get('search') || '').trim();
    if (querySearch) {
      state.search = querySearch;
      if (topSearchInput) topSearchInput.value = querySearch;
      if (filterSearchInput) filterSearchInput.value = querySearch;
    }

    await loadLookups();
    await refreshInvoices();

    if (params.get('create') === '1') {
      const defaultCustomerId = params.get('customerId') || '';
      await openCreateInvoiceModal(defaultCustomerId);
    }
  } catch (error) {
    console.error('QuickInvoice invoice page error:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Failed to load invoices</td></tr>';
    }
    await ui.alert(error.message || 'Failed to load invoices', { title: 'Load Error' });
  }
});
