document.addEventListener('DOMContentLoaded', () => {
  if (!window.LabApi) return;

  const ui = window.LabUi || {
    alert: async (msg) => window.alert(msg),
    confirm: async (msg) => window.confirm(msg),
    form: async () => null,
  };

  let patients = [];
  let tests = [];
  let invoices = [];
  let cart = [];

  const selects = Array.from(document.querySelectorAll('select.form-select'));
  const patientSelect = selects[0] || null;
  const testSelect = selects[1] || null;
  const phoneInput = Array.from(document.querySelectorAll('label'))
    .find((label) => (label.textContent || '').toLowerCase().includes('phone number'))
    ?.parentElement?.querySelector('input');
  const invoiceDateInput = Array.from(document.querySelectorAll('input[type="date"]'))[0] || null;

  if (invoiceDateInput) {
    invoiceDateInput.value = new Date().toISOString().slice(0, 10);
  }

  const addTestBtn = testSelect
    ? testSelect.closest('.mb-8')?.querySelector('button')
    : null;
  const generateBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('generate invoice'));
  const newPatientBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('new patient'));
  const recentActivityBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('recent activity'));
  const printBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('print now'));

  const allTables = Array.from(document.querySelectorAll('table'));
  const cartTable = allTables.find((table) => {
    const headers = Array.from(table.querySelectorAll('th')).map((th) => (th.textContent || '').toLowerCase());
    return headers.includes('test name') && headers.includes('unit price') && headers.includes('subtotal');
  });
  const cartTbody = cartTable ? cartTable.querySelector('tbody') : null;
  if (cartTbody) {
    cartTbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-sm text-center text-slate-500">No tests added</td></tr>';
  }

  const invoicesTable = allTables.find((table) => {
    const headers = Array.from(table.querySelectorAll('th')).map((th) => (th.textContent || '').toLowerCase());
    return headers.includes('invoice no') && headers.includes('patient') && headers.includes('balance');
  });
  const invoicesTbody = invoicesTable ? invoicesTable.querySelector('tbody') : null;
  if (invoicesTbody) {
    invoicesTbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-500">Loading invoices...</td></tr>';
  }

  const totalValueEl = Array.from(document.querySelectorAll('span.text-xl.font-bold'))
    .find((el) => String(el.textContent || '').includes('$') || String(el.textContent || '').includes('PKR'));

  function selectedPatient() {
    const id = patientSelect?.value;
    return patients.find((p) => String(p._id) === String(id));
  }

  function updatePatientPhone() {
    if (!phoneInput) return;
    const patient = selectedPatient();
    phoneInput.value = patient?.phone || '';
  }

  function updateReceiptPreview() {
    const patient = selectedPatient();
    const billToMarker = Array.from(document.querySelectorAll('p'))
      .find((p) => (p.textContent || '').trim().toLowerCase() === 'bill to:');
    const billBox = billToMarker?.parentElement;
    if (billBox) {
      const lines = billBox.querySelectorAll('p');
      if (lines[1]) lines[1].textContent = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : '-';
      if (lines[2]) {
        const patientCode = patient?.patientCode || (patient ? `PT-${String(patient._id).slice(-6).toUpperCase()}` : '-');
        lines[2].textContent = `Patient ID: ${patientCode}`;
      }
      if (lines[3]) lines[3].textContent = patient?.phone || '-';
    }

    const dateLine = Array.from(document.querySelectorAll('p'))
      .find((p) => (p.textContent || '').toLowerCase().includes('date:'));
    if (dateLine && invoiceDateInput?.value) {
      const d = new Date(invoiceDateInput.value);
      dateLine.textContent = `Date: ${Number.isNaN(d.getTime()) ? invoiceDateInput.value : d.toLocaleDateString()}`;
    }
  }

  function renderCart() {
    if (!cartTbody) return;
    cartTbody.innerHTML = '';

    if (!cart.length) {
      cartTbody.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-sm text-center text-slate-500">No tests added</td></tr>';
    } else {
      cart.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-4 py-3 text-sm font-medium text-slate-700">${window.LabApi.escapeHtml(item.name)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${window.LabApi.formatCurrency(item.price)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">1</td>
          <td class="px-4 py-3 text-sm text-slate-500">${window.LabApi.formatCurrency(item.price)}</td>
          <td class="px-4 py-3 text-center">
            <button data-remove-index="${idx}" class="text-sm text-red-500 hover:text-red-600">Remove</button>
          </td>
        `;
        cartTbody.appendChild(tr);
      });
    }

    const total = cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
    if (totalValueEl) totalValueEl.textContent = window.LabApi.formatCurrency(total);
    updateReceiptPreview();
  }

  function renderInvoices() {
    if (!invoicesTbody) return;
    invoicesTbody.innerHTML = '';

    if (!invoices.length) {
      invoicesTbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-slate-500">No invoices found</td></tr>';
      return;
    }

    invoices.forEach((inv) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      const status = String(inv.status || 'unpaid');
      const statusColor = status === 'paid'
        ? 'bg-green-100 text-green-600'
        : (status === 'partially_paid' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600');
      const label = status === 'partially_paid' ? 'Partial' : status.charAt(0).toUpperCase() + status.slice(1);

      tr.innerHTML = `
        <td class="px-4 py-4 text-sm font-bold text-primary">${window.LabApi.escapeHtml(inv.invoiceNumber || '-')}</td>
        <td class="px-4 py-4">
          <div class="flex flex-col">
            <span class="text-sm font-medium">${window.LabApi.escapeHtml(inv.customerName || '-')}</span>
            <span class="text-[10px] text-slate-400">${window.LabApi.escapeHtml(String(inv.patientId || '-'))}</span>
          </div>
        </td>
        <td class="px-4 py-4 text-sm text-slate-600">${window.LabApi.formatDate(inv.createdAt)}</td>
        <td class="px-4 py-4 text-sm font-bold">${window.LabApi.formatCurrency(inv.totalAmount || 0)}</td>
        <td class="px-4 py-4 text-sm text-green-600 font-medium">${window.LabApi.formatCurrency(inv.paidAmount || 0)}</td>
        <td class="px-4 py-4 text-sm text-red-500 font-bold">${window.LabApi.formatCurrency(inv.balance || 0)}</td>
        <td class="px-4 py-4"><span class="px-3 py-1 ${statusColor} text-[10px] font-bold rounded-full uppercase">${window.LabApi.escapeHtml(label)}</span></td>
        <td class="px-4 py-4 text-right">
          <button data-action="pay" data-id="${inv._id}" class="size-8 rounded-lg text-slate-400 hover:text-primary transition-colors" title="Collect Payment">
            <span class="material-symbols-outlined">payments</span>
          </button>
        </td>
      `;
      invoicesTbody.appendChild(tr);
    });
  }

  async function loadData() {
    const [patientsResp, testsResp, invoicesResp] = await Promise.all([
      window.LabApi.request('/patients?limit=200'),
      window.LabApi.request('/tests?limit=200'),
      window.LabApi.request('/billing/invoices?limit=200'),
    ]);

    patients = patientsResp.data || [];
    tests = testsResp.data || [];
    invoices = invoicesResp.data || [];

    if (patientSelect) {
      patientSelect.innerHTML = '<option value="">Select patient</option>';
      patients.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p._id;
        const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown';
        const code = p.patientCode || `PT-${String(p._id).slice(-6).toUpperCase()}`;
        opt.textContent = `${name} (${code})`;
        patientSelect.appendChild(opt);
      });
    }

    if (testSelect) {
      testSelect.innerHTML = '<option value="">Select test name</option>';
      tests.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t._id;
        opt.textContent = `${t.name} (${window.LabApi.formatCurrency(t.price || 0)})`;
        testSelect.appendChild(opt);
      });
    }

    renderCart();
    renderInvoices();
    updatePatientPhone();
  }

  async function openNewPatientForm() {
    const form = await ui.form({
      title: 'Add New Patient',
      submitText: 'Create Patient',
      fields: [
        { name: 'firstName', label: 'First Name', required: true, placeholder: 'Ali' },
        { name: 'lastName', label: 'Last Name', required: true, placeholder: 'Khan' },
        { name: 'phone', label: 'Phone', placeholder: '+92...' },
        { name: 'email', label: 'Email', placeholder: 'patient@example.com' },
      ],
    });
    if (!form) return false;

    await window.LabApi.request('/patients', {
      method: 'POST',
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || '',
        email: form.email || '',
      }),
    });
    return true;
  }

  if (patientSelect) {
    patientSelect.addEventListener('change', () => {
      updatePatientPhone();
      updateReceiptPreview();
    });
  }

  if (invoiceDateInput) {
    invoiceDateInput.addEventListener('change', updateReceiptPreview);
  }

  if (addTestBtn && testSelect) {
    addTestBtn.addEventListener('click', async () => {
      const testId = testSelect.value;
      if (!testId) {
        await ui.alert('Please select a test first.', { title: 'Test Required' });
        return;
      }
      const test = tests.find((t) => String(t._id) === String(testId));
      if (!test) {
        await ui.alert('Selected test is not available.', { title: 'Invalid Test' });
        return;
      }
      if (cart.some((x) => String(x._id) === String(test._id))) {
        await ui.alert('This test is already added to invoice cart.', { title: 'Duplicate Test' });
        return;
      }
      cart.push(test);
      renderCart();
    });
  }

  if (cartTbody) {
    cartTbody.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-remove-index]');
      if (!btn) return;
      const idx = Number(btn.dataset.removeIndex);
      cart.splice(idx, 1);
      renderCart();
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      const patientId = patientSelect?.value;
      if (!patientId) {
        await ui.alert('Please select a patient.', { title: 'Patient Required' });
        return;
      }
      if (!cart.length) {
        await ui.alert('Please add at least one test.', { title: 'No Tests Added' });
        return;
      }

      try {
        await window.LabApi.request('/orders', {
          method: 'POST',
          body: JSON.stringify({
            patientId,
            testIds: cart.map((x) => x._id),
            createInvoice: true,
            dueDate: invoiceDateInput?.value || undefined,
          }),
        });
        cart = [];
        await loadData();
        await ui.alert('Invoice generated successfully.', { title: 'Success' });
      } catch (error) {
        await ui.alert(error.message || 'Failed to generate invoice', { title: 'Generation Failed' });
      }
    });
  }

  if (invoicesTbody) {
    invoicesTbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action="pay"]');
      if (!btn) return;
      const id = btn.dataset.id;
      const invoice = invoices.find((i) => String(i._id) === String(id));
      if (!invoice) return;
      if (Number(invoice.balance || 0) <= 0) {
        await ui.alert('This invoice is already fully paid.', { title: 'Already Paid' });
        return;
      }

      const payment = await ui.form({
        title: 'Collect Payment',
        submitText: 'Record Payment',
        fields: [
          { name: 'amount', label: `Amount (Balance: ${invoice.balance})`, required: true, type: 'number', min: 0.01, step: 0.01 },
          {
            name: 'paymentMethod',
            label: 'Payment Method',
            type: 'select',
            value: 'cash',
            options: [
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'upi', label: 'UPI' },
              { value: 'other', label: 'Other' },
            ],
          },
          { name: 'transactionId', label: 'Transaction ID (Optional)', value: '' },
        ],
      });

      if (!payment) return;
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        await ui.alert('Invalid amount entered.', { title: 'Invalid Amount' });
        return;
      }

      try {
        await window.LabApi.request(`/billing/invoices/${id}/payment`, {
          method: 'POST',
          body: JSON.stringify({
            amount,
            paymentMethod: payment.paymentMethod || 'cash',
            transactionId: payment.transactionId || undefined,
          }),
        });
        await loadData();
      } catch (error) {
        await ui.alert(error.message || 'Failed to record payment', { title: 'Payment Failed' });
      }
    });
  }

  if (newPatientBtn) {
    newPatientBtn.addEventListener('click', async () => {
      try {
        const created = await openNewPatientForm();
        if (!created) return;
        await loadData();
        await ui.alert('Patient created successfully.', { title: 'Success' });
      } catch (error) {
        await ui.alert(error.message || 'Failed to create patient', { title: 'Create Failed' });
      }
    });
  }

  if (recentActivityBtn) {
    recentActivityBtn.addEventListener('click', async () => {
      if (!ui.createModal || !ui.closeModal) {
        await ui.alert('Recent activity panel is not available right now.', { title: 'Unavailable' });
        return;
      }
      const latest = invoices.slice(0, 8).map((inv) => `
        <li class="py-2 border-b border-slate-100 last:border-0 text-sm">
          <span class="font-bold text-slate-900">${window.LabApi.escapeHtml(inv.invoiceNumber || '-')}</span>
          <span class="text-slate-500"> • ${window.LabApi.escapeHtml(inv.customerName || '-')}</span>
          <span class="text-slate-400"> • ${window.LabApi.escapeHtml(inv.status || 'unpaid')}</span>
        </li>
      `).join('');
      const modal = ui.createModal({
        title: 'Recent Invoice Activity',
        contentHtml: `
          <ul>${latest || '<li class="text-sm text-slate-500">No activity found</li>'}</ul>
          <div class="mt-4 flex justify-end">
            <button type="button" data-role="close-activity" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">Close</button>
          </div>
        `,
      });
      const closeBtn = modal.querySelector('[data-role="close-activity"]');
      if (closeBtn) closeBtn.addEventListener('click', () => ui.closeModal(modal));
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  loadData().catch(async (error) => {
    console.error('Invoicing load failed:', error);
    if (invoicesTbody) {
      invoicesTbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-red-500">Failed to load invoices</td></tr>';
    }
    await ui.alert(error.message || 'Failed to load invoicing data', { title: 'Load Error' });
  });
});
