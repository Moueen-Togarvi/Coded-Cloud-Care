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
    customers: [],
    invoices: [],
    selectedCustomer: null,
  };

  const searchInput = document.querySelector('input[placeholder*="Search customers"]');
  const profileCard = document.querySelector('.profile-card-hover');
  const profileTitle = profileCard?.querySelector('h1.text-2xl.font-bold') || null;
  const statusBadge = profileCard?.querySelector('.status-badge') || null;
  const profileMetaLines = profileCard
    ? Array.from(profileCard.querySelectorAll('p.text-slate-500.text-sm')).slice(0, 2)
    : [];
  const infoItems = profileCard ? Array.from(profileCard.querySelectorAll('.info-item')) : [];

  const editBtn = profileCard
    ? Array.from(profileCard.querySelectorAll('button')).find((btn) =>
      (btn.textContent || '').toLowerCase().includes('edit profile')
    )
    : null;
  const createInvoiceBtn = profileCard
    ? Array.from(profileCard.querySelectorAll('button')).find((btn) =>
      (btn.textContent || '').toLowerCase().includes('create invoice')
    )
    : null;
  const addNoteBtn = Array.from(document.querySelectorAll('button')).find((btn) =>
    (btn.textContent || '').toLowerCase().includes('add new note')
  );
  const viewAllTransactionsLink = Array.from(document.querySelectorAll('a')).find((a) =>
    (a.textContent || '').toLowerCase().includes('view all transactions')
  );
  const fab = document.querySelector('button.fab');

  const transactionsTbody = document.querySelector('table tbody');
  const activityContainer = Array.from(document.querySelectorAll('h3')).find((el) =>
    (el.textContent || '').toLowerCase().includes('recent activity')
  )?.closest('div')?.querySelector('.space-y-4');
  const notesContainer = Array.from(document.querySelectorAll('h3')).find((el) =>
    (el.textContent || '').toLowerCase().includes('internal notes')
  )?.closest('div')?.querySelector('.space-y-4');

  function customerName(c) {
    return `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'Unnamed Customer';
  }

  function customerInvoices(customer) {
    if (!customer) return [];
    const id = String(customer._id || '');
    const fullName = customerName(customer).toLowerCase();

    return state.invoices
      .filter((inv) => {
        const patientMatch = inv.patientId && String(inv.patientId) === id;
        const nameMatch = String(inv.customerName || '').toLowerCase() === fullName;
        return patientMatch || nameMatch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function setInfoValue(labelIncludes, value) {
    const item = infoItems.find((el) => {
      const label = (el.querySelector('.info-label')?.textContent || '').toLowerCase();
      return label.includes(labelIncludes);
    });
    if (!item) return;
    const valueEl = item.querySelector('p:not(.info-label)');
    if (valueEl) valueEl.textContent = value;
  }

  function updateProfileHeader(customer) {
    if (!customer) {
      if (profileTitle) profileTitle.textContent = 'No Customer Found';
      if (statusBadge) {
        statusBadge.className = 'status-badge px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full shadow-sm';
        statusBadge.textContent = 'No Data';
      }
      setInfoValue('email', '-');
      setInfoValue('phone', '-');
      setInfoValue('billing address', '-');
      setInfoValue('customer since', '-');
      return;
    }

    if (profileTitle) profileTitle.textContent = customerName(customer);

    if (statusBadge) {
      statusBadge.className = 'status-badge px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm flex items-center gap-1';
      if (customer.isActive === false) {
        statusBadge.classList.add('bg-rose-100', 'text-rose-700');
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inactive';
      } else {
        statusBadge.classList.add('bg-green-100', 'text-green-700');
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active Account';
      }
    }

    if (profileMetaLines[0]) {
      profileMetaLines[0].innerHTML = `<span class="material-symbols-outlined text-sm">person</span> Primary Contact: ${window.QiApi.escapeHtml(customerName(customer))}`;
    }
    if (profileMetaLines[1]) {
      const code = customer.patientCode || String(customer._id || '').slice(-8).toUpperCase();
      profileMetaLines[1].innerHTML = `<span class="material-symbols-outlined text-sm">fingerprint</span> Customer Code: ${window.QiApi.escapeHtml(code)}`;
    }

    setInfoValue('email', customer.email || '-');
    setInfoValue('phone', customer.phone || '-');
    setInfoValue('billing address', customer.address || '-');
    setInfoValue('customer since', window.QiApi.formatDate(customer.createdAt));
  }

  function updateStats(customer, invoices) {
    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
    const outstanding = invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);

    const paidWithDates = invoices.filter((inv) => {
      if (String(inv.status || '').toLowerCase() !== 'paid') return false;
      return inv.createdAt && ((inv.paymentHistory || [])[0]?.paymentDate || inv.updatedAt);
    });

    let avgDaysText = 'N/A';
    if (paidWithDates.length) {
      const totalDays = paidWithDates.reduce((sum, inv) => {
        const start = new Date(inv.createdAt).getTime();
        const latestPayment = (inv.paymentHistory || []).slice(-1)[0]?.paymentDate || inv.updatedAt;
        const end = new Date(latestPayment).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return sum;
        const days = Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
        return sum + days;
      }, 0);
      avgDaysText = `${Math.round(totalDays / paidWithDates.length)} Days`;
    }

    const statCards = document.querySelectorAll('.hover-stat-card');
    statCards.forEach((card) => {
      const label = (card.querySelector('p.text-sm')?.textContent || '').toLowerCase();
      const valueEl = card.querySelector('p.text-2xl');
      const subEl = card.querySelector('div.mt-3 span:last-child');
      if (!valueEl) return;

      if (label.includes('total billed')) {
        valueEl.textContent = window.QiApi.formatCurrency(totalBilled);
        if (subEl) subEl.textContent = `${invoices.length} invoices generated`;
      }
      if (label.includes('outstanding balance')) {
        valueEl.textContent = window.QiApi.formatCurrency(outstanding);
        if (subEl) {
          const openCount = invoices.filter((inv) => Number(inv.balance || 0) > 0).length;
          subEl.textContent = `${openCount} invoices pending payment`;
        }
      }
      if (label.includes('average pay time')) {
        valueEl.textContent = avgDaysText;
        if (subEl) subEl.textContent = paidWithDates.length ? `${paidWithDates.length} paid invoices considered` : 'No paid invoices yet';
      }
    });
  }

  function renderTransactions(invoices) {
    if (!transactionsTbody) return;

    if (!invoices.length) {
      transactionsTbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No invoices found for this customer</td></tr>';
      return;
    }

    transactionsTbody.innerHTML = invoices.slice(0, 20).map((inv) => {
      const status = String(inv.status || '').toLowerCase();
      const statusClass = window.QiApi.statusClasses(status);
      return `
        <tr class="hover-table-row group cursor-pointer">
          <td class="px-6 py-4 font-semibold text-primary row-highlight">${window.QiApi.escapeHtml(inv.invoiceNumber || '-')}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${window.QiApi.formatDate(inv.createdAt)}</td>
          <td class="px-6 py-4">
            <span class="status-badge px-2.5 py-1 text-xs font-medium rounded-full shadow-sm inline-flex items-center gap-1 ${statusClass}">
              <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
              ${window.QiApi.escapeHtml(window.QiApi.statusLabel(status))}
            </span>
          </td>
          <td class="px-6 py-4 text-sm text-slate-600">${window.QiApi.formatDate(inv.dueDate)}</td>
          <td class="px-6 py-4 text-sm font-semibold text-slate-900 text-right">${window.QiApi.formatCurrency(inv.totalAmount || 0)}</td>
          <td class="px-6 py-4 text-right">
            <button class="hover-action-btn p-1.5 bg-slate-100 rounded-lg text-slate-500" data-action="view-invoice" data-id="${window.QiApi.escapeHtml(inv._id)}">
              <span class="material-symbols-outlined text-sm pointer-events-none">visibility</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderActivities(invoices) {
    if (!activityContainer) return;

    if (!invoices.length) {
      activityContainer.innerHTML = '<p class="text-sm text-slate-500">No recent activity for this customer.</p>';
      return;
    }

    const entries = [];

    invoices.slice(0, 5).forEach((inv) => {
      entries.push({
        icon: String(inv.status || '').toLowerCase() === 'paid' ? 'check_circle' : 'description',
        iconWrap: String(inv.status || '').toLowerCase() === 'paid' ? 'bg-green-100' : 'bg-blue-100',
        iconColor: String(inv.status || '').toLowerCase() === 'paid' ? 'text-green-600' : 'text-blue-600',
        title: String(inv.status || '').toLowerCase() === 'paid' ? 'Payment Received' : 'Invoice Issued',
        subtitle: `${inv.invoiceNumber || 'Invoice'} • ${window.QiApi.formatCurrency(inv.totalAmount || 0)}`,
        when: window.QiApi.formatDate(inv.updatedAt || inv.createdAt),
      });
    });

    activityContainer.innerHTML = entries.map((entry) => `
      <div class="flex gap-4 group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-all">
        <div class="size-10 rounded-full ${entry.iconWrap} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined ${entry.iconColor} text-lg">${entry.icon}</span>
        </div>
        <div>
          <p class="text-sm font-medium text-slate-900">${window.QiApi.escapeHtml(entry.title)}</p>
          <p class="text-xs text-slate-500">${window.QiApi.escapeHtml(entry.subtitle)}</p>
          <p class="text-xs text-slate-400 mt-1">${window.QiApi.escapeHtml(entry.when)}</p>
        </div>
      </div>
    `).join('');
  }

  function renderNotes(customer, invoices) {
    if (!notesContainer) return;

    const note1 = customer?.medicalHistory || 'No internal notes available. Use "Add New Note" to save customer notes.';
    const paid = invoices.filter((inv) => String(inv.status || '').toLowerCase() === 'paid').length;
    const open = invoices.filter((inv) => Number(inv.balance || 0) > 0).length;

    notesContainer.innerHTML = `
      <div class="p-4 bg-yellow-50 rounded-lg border border-yellow-100 hover:shadow-md transition-all cursor-pointer">
        <p class="text-sm text-slate-700">${window.QiApi.escapeHtml(note1)}</p>
        <p class="text-xs text-slate-400 mt-2">Stored in customer profile</p>
      </div>
      <div class="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:shadow-md transition-all cursor-pointer">
        <p class="text-sm text-slate-700">Invoice summary: ${paid} paid, ${open} open. Last sync: ${window.QiApi.formatDate(new Date())}.</p>
        <p class="text-xs text-slate-400 mt-2">Generated from live database</p>
      </div>
    `;
  }

  function renderInvoiceViewModal(inv) {
    const items = (inv.items || []).map((item) => `
      <tr>
        <td class="py-2 text-sm text-slate-700">${window.QiApi.escapeHtml(item.description || 'Item')}</td>
        <td class="py-2 text-sm text-slate-700 text-right">${Number(item.quantity || 0)}</td>
        <td class="py-2 text-sm text-slate-700 text-right">${window.QiApi.formatCurrency(item.amount || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="py-3 text-center text-sm text-slate-500">No line items</td></tr>';

    const modal = ui.createModal({
      title: inv.invoiceNumber || 'Invoice',
      contentHtml: `
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><span class="font-semibold text-slate-500">Customer:</span> ${window.QiApi.escapeHtml(inv.customerName || '-')}</div>
            <div><span class="font-semibold text-slate-500">Status:</span> ${window.QiApi.escapeHtml(window.QiApi.statusLabel(inv.status || ''))}</div>
            <div><span class="font-semibold text-slate-500">Issued:</span> ${window.QiApi.formatDate(inv.createdAt)}</div>
            <div><span class="font-semibold text-slate-500">Due:</span> ${window.QiApi.formatDate(inv.dueDate)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 p-3">
            <table class="w-full">
              <thead class="text-xs uppercase text-slate-500">
                <tr><th class="py-2 text-left">Description</th><th class="py-2 text-right">Qty</th><th class="py-2 text-right">Rate</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100">${items}</tbody>
            </table>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-slate-600">Total</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.totalAmount || 0)}</div>
            <div class="text-slate-600">Paid</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.paidAmount || 0)}</div>
            <div class="text-slate-600">Balance</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(inv.balance || 0)}</div>
          </div>
        </div>
      `,
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mt-4 px-4 py-2 rounded-xl bg-primary text-white font-bold';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => ui.closeModal(modal));
    modal.querySelector('[data-role="content"]').appendChild(closeBtn);
  }

  async function openCustomerForm(mode = 'create') {
    const customer = state.selectedCustomer;
    const initial = mode === 'edit' && customer ? customer : {};

    const data = await ui.form({
      title: mode === 'edit' ? `Edit ${customerName(customer)}` : 'Add Customer',
      submitText: mode === 'edit' ? 'Save Changes' : 'Create Customer',
      widthClass: 'max-w-xl',
      fields: [
        { name: 'firstName', label: 'First Name', required: true, value: initial.firstName || '' },
        { name: 'lastName', label: 'Last Name', required: true, value: initial.lastName || '' },
        { name: 'email', label: 'Email', type: 'email', value: initial.email || '' },
        { name: 'phone', label: 'Phone', value: initial.phone || '' },
        { name: 'patientCode', label: 'Customer Code', value: initial.patientCode || '' },
        { name: 'address', label: 'Address', value: initial.address || '' },
        { name: 'age', label: 'Age', type: 'number', min: 0, step: 1, value: initial.age || '' },
        {
          name: 'gender',
          label: 'Gender',
          type: 'select',
          value: initial.gender || 'other',
          options: [
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ],
        },
        { name: 'medicalHistory', label: 'Internal Note', type: 'textarea', rows: 3, value: initial.medicalHistory || '' },
      ],
    });

    if (!data) return;

    const payload = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || undefined,
      phone: data.phone || undefined,
      patientCode: data.patientCode || undefined,
      address: data.address || undefined,
      age: data.age ? Number(data.age) : undefined,
      gender: data.gender || undefined,
      medicalHistory: data.medicalHistory || undefined,
    };

    if (mode === 'edit' && customer) {
      await window.QiApi.request(`/customers/${customer._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await ui.alert('Customer updated successfully.', { title: 'Success' });
    } else {
      await window.QiApi.request('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await ui.alert('Customer created successfully.', { title: 'Success' });
    }

    await loadData();
  }

  async function deleteSelectedCustomer() {
    const customer = state.selectedCustomer;
    if (!customer) return;

    const ok = await ui.confirm(`Delete customer \"${customerName(customer)}\"?`, {
      title: 'Delete Customer',
      confirmText: 'Delete',
    });

    if (!ok) return;

    await window.QiApi.request(`/customers/${customer._id}`, { method: 'DELETE' });
    await ui.alert('Customer deleted successfully.', { title: 'Deleted' });
    await loadData();
  }

  function renderAll() {
    const customer = state.selectedCustomer;
    const invoices = customerInvoices(customer);

    updateProfileHeader(customer);
    updateStats(customer, invoices);
    renderTransactions(invoices);
    renderActivities(invoices);
    renderNotes(customer, invoices);
  }

  async function loadData() {
    const [customerPayload, invoicePayload] = await Promise.all([
      window.QiApi.request('/customers?limit=300'),
      window.QiApi.request('/invoices?limit=500'),
    ]);

    state.customers = customerPayload.data || [];
    state.invoices = invoicePayload.data || [];

    if (!state.selectedCustomer || !state.customers.some((c) => String(c._id) === String(state.selectedCustomer?._id))) {
      state.selectedCustomer = state.customers[0] || null;
    }

    renderAll();
  }

  try {
    updateProfileHeader(null);
    updateStats(null, []);
    renderTransactions([]);
    renderActivities([]);
    renderNotes(null, []);

    await loadData();

    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        const q = String(event.target.value || '').trim().toLowerCase();
        if (!q) {
          state.selectedCustomer = state.customers[0] || null;
          renderAll();
          return;
        }

        const matches = state.customers.filter((cust) => {
          return customerName(cust).toLowerCase().includes(q)
            || String(cust.email || '').toLowerCase().includes(q)
            || String(cust.phone || '').toLowerCase().includes(q)
            || String(cust.patientCode || '').toLowerCase().includes(q);
        });

        state.selectedCustomer = matches[0] || null;
        renderAll();
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          if (!state.selectedCustomer) {
            await ui.alert('No customer selected.', { title: 'Edit Customer' });
            return;
          }
          await openCustomerForm('edit');
        } catch (error) {
          await ui.alert(error.message || 'Failed to update customer', { title: 'Error' });
        }
      });
    }

    if (createInvoiceBtn) {
      createInvoiceBtn.addEventListener('click', () => {
        if (!state.selectedCustomer) {
          ui.alert('No customer selected.', { title: 'Create Invoice' });
          return;
        }
        window.location.href = `/Adminstration/Invoice.html?create=1&customerId=${encodeURIComponent(state.selectedCustomer._id)}`;
      });
    }

    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', async () => {
        try {
          if (!state.selectedCustomer) {
            await ui.alert('No customer selected.', { title: 'Notes' });
            return;
          }
          const data = await ui.form({
            title: 'Update Internal Note',
            submitText: 'Save Note',
            fields: [
              {
                name: 'medicalHistory',
                label: 'Internal Note',
                type: 'textarea',
                rows: 5,
                value: state.selectedCustomer.medicalHistory || '',
              },
            ],
          });
          if (!data) return;

          await window.QiApi.request(`/customers/${state.selectedCustomer._id}`, {
            method: 'PUT',
            body: JSON.stringify({ medicalHistory: data.medicalHistory || '' }),
          });

          await ui.alert('Note saved successfully.', { title: 'Success' });
          await loadData();
        } catch (error) {
          await ui.alert(error.message || 'Failed to save note', { title: 'Error' });
        }
      });
    }

    if (viewAllTransactionsLink) {
      viewAllTransactionsLink.addEventListener('click', (event) => {
        event.preventDefault();
        if (!state.selectedCustomer) {
          window.location.href = '/Adminstration/Invoice.html';
          return;
        }
        const q = encodeURIComponent(customerName(state.selectedCustomer));
        window.location.href = `/Adminstration/Invoice.html?search=${q}`;
      });
    }

    if (fab) {
      fab.setAttribute('title', 'Add New Customer');
      fab.addEventListener('click', async () => {
        try {
          await openCustomerForm('create');
        } catch (error) {
          await ui.alert(error.message || 'Failed to create customer', { title: 'Error' });
        }
      });
    }

    const actionsContainer = editBtn?.closest('div.flex.flex-wrap');
    if (actionsContainer) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-secondary flex-1 md:flex-none px-5 h-11 rounded-xl border border-rose-200 font-semibold text-sm flex items-center gap-2 text-rose-600 hover:bg-rose-50';
      deleteBtn.innerHTML = '<span class="material-symbols-outlined text-lg">delete</span> Delete';
      deleteBtn.type = 'button';
      deleteBtn.addEventListener('click', async () => {
        try {
          await deleteSelectedCustomer();
        } catch (error) {
          await ui.alert(error.message || 'Failed to delete customer', { title: 'Error' });
        }
      });
      actionsContainer.appendChild(deleteBtn);
    }

    if (transactionsTbody) {
      transactionsTbody.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action="view-invoice"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (!id) return;

        try {
          const payload = await window.QiApi.request(`/invoices/${id}`);
          renderInvoiceViewModal(payload.data || {});
        } catch (error) {
          await ui.alert(error.message || 'Failed to load invoice', { title: 'Error' });
        }
      });
    }
  } catch (error) {
    console.error('QuickInvoice customers page error:', error);
    state.selectedCustomer = null;
    state.invoices = [];
    updateProfileHeader(null);
    updateStats(null, []);
    renderTransactions([]);
    renderActivities([]);
    renderNotes(null, []);
    await ui.alert(error.message || 'Failed to load customer data', { title: 'Load Error' });
  }
});
