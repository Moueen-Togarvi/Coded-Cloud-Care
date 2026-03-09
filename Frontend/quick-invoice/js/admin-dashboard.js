document.addEventListener('DOMContentLoaded', async () => {
  if (!window.QiApi) return;

  const ui = window.QiUi || {
    alert: async (msg) => window.alert(msg),
    createModal: () => null,
    closeModal: () => null,
  };

  let recentInvoices = [];

  function setMetricCards(metrics) {
    const labels = document.querySelectorAll('p.text-slate-500.text-sm.font-medium.mb-1');
    labels.forEach((labelEl) => {
      const label = (labelEl.textContent || '').toLowerCase();
      const card = labelEl.closest('div');
      const valueEl = card ? card.querySelector('h3') : null;
      if (!valueEl) return;

      if (label.includes('sales (today)')) valueEl.textContent = window.QiApi.formatCurrency(metrics.salesToday || 0);
      if (label.includes('sales (month)')) valueEl.textContent = window.QiApi.formatCurrency(metrics.salesMonth || 0);
      if (label.includes('total invoices')) valueEl.textContent = Number(metrics.totalInvoices || 0).toLocaleString('en-US');
      if (label.includes('paid invoices')) valueEl.textContent = Number(metrics.paidInvoices || 0).toLocaleString('en-US');
      if (label.includes('unpaid invoices')) valueEl.textContent = Number(metrics.unpaidInvoices || 0).toLocaleString('en-US');
      if (label.includes('total customers')) valueEl.textContent = Number(metrics.totalCustomers || 0).toLocaleString('en-US');
    });

    const statusCard = Array.from(document.querySelectorAll('h3')).find((el) =>
      (el.textContent || '').trim().toLowerCase() === 'invoice status'
    )?.closest('div.bg-white');

    if (statusCard) {
      const total = Number(metrics.totalInvoices || 0);
      const paid = Number(metrics.paidInvoices || 0);
      const unpaid = Number(metrics.unpaidInvoices || 0);
      const open = Math.max(total - paid, 0);
      const totalEl = statusCard.querySelector('span.text-3xl');
      if (totalEl) totalEl.textContent = total.toLocaleString('en-US');

      const legend = statusCard.querySelectorAll('span.text-xs.font-medium');
      legend.forEach((item) => {
        const txt = (item.textContent || '').toLowerCase();
        if (txt.includes('paid')) {
          const p = total > 0 ? Math.round((paid / total) * 100) : 0;
          item.textContent = `Paid (${p}%)`;
        } else if (txt.includes('unpaid')) {
          const p = total > 0 ? Math.round((unpaid / total) * 100) : 0;
          item.textContent = `Unpaid (${p}%)`;
        } else {
          const p = total > 0 ? Math.round((open / total) * 100) : 0;
          item.textContent = `Open (${p}%)`;
        }
      });
    }
  }

  function invoiceRow(invoice) {
    const name = invoice.customerName || 'Unknown';
    const initials = window.QiApi.getInitials(name);
    const status = String(invoice.status || 'unpaid').toLowerCase();
    const statusClass = window.QiApi.statusClasses(status);

    return `
      <tr class="group hover:bg-slate-50/80 transition-all duration-300">
        <td class="px-6 py-4 font-bold text-slate-900 group-hover:text-primary transition-colors">${window.QiApi.escapeHtml(invoice.invoiceNumber || '-')}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">${window.QiApi.escapeHtml(initials)}</div>
            <span class="text-sm font-medium">${window.QiApi.escapeHtml(name)}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-500">${window.QiApi.formatDate(invoice.createdAt)}</td>
        <td class="px-6 py-4 font-bold text-slate-900">${window.QiApi.formatCurrency(invoice.totalAmount || 0)}</td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusClass}">${window.QiApi.escapeHtml(window.QiApi.statusLabel(status))}</span>
        </td>
        <td class="px-6 py-4 text-right">
          <button class="p-2 bg-slate-100 rounded-lg text-slate-500 hover:text-white hover:bg-primary transition-all duration-200" data-action="view" data-id="${window.QiApi.escapeHtml(invoice._id)}">
            <span class="material-symbols-outlined text-xl pointer-events-none">visibility</span>
          </button>
        </td>
      </tr>
    `;
  }

  function renderRecentRows(query = '') {
    const tableCard = Array.from(document.querySelectorAll('h3')).find((el) =>
      (el.textContent || '').trim().toLowerCase() === 'recent invoices'
    )?.closest('div.bg-white');

    if (!tableCard) return;
    const tbody = tableCard.querySelector('tbody');
    if (!tbody) return;

    const q = String(query || '').trim().toLowerCase();
    const filtered = q
      ? recentInvoices.filter((inv) =>
        String(inv.invoiceNumber || '').toLowerCase().includes(q)
        || String(inv.customerName || '').toLowerCase().includes(q)
      )
      : recentInvoices;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No invoices found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(invoiceRow).join('');
  }

  function showInvoiceModal(invoice) {
    const itemsHtml = (invoice.items || []).map((item) => `
      <tr>
        <td class="py-2 text-sm text-slate-700">${window.QiApi.escapeHtml(item.description || 'Item')}</td>
        <td class="py-2 text-sm text-slate-700 text-right">${Number(item.quantity || 0)}</td>
        <td class="py-2 text-sm text-slate-700 text-right">${window.QiApi.formatCurrency(item.amount || 0)}</td>
        <td class="py-2 text-sm font-semibold text-slate-900 text-right">${window.QiApi.formatCurrency(item.totalAmount || 0)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="py-3 text-sm text-slate-500 text-center">No line items</td></tr>';

    const modal = ui.createModal({
      title: `Invoice ${invoice.invoiceNumber || ''}`,
      contentHtml: `
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span class="font-semibold text-slate-500">Customer:</span> ${window.QiApi.escapeHtml(invoice.customerName || '-')}</div>
            <div><span class="font-semibold text-slate-500">Status:</span> ${window.QiApi.escapeHtml(window.QiApi.statusLabel(invoice.status))}</div>
            <div><span class="font-semibold text-slate-500">Issued:</span> ${window.QiApi.formatDate(invoice.createdAt)}</div>
            <div><span class="font-semibold text-slate-500">Due:</span> ${window.QiApi.formatDate(invoice.dueDate)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <table class="w-full">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
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
            <div class="text-slate-600">Subtotal</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(invoice.subtotal || 0)}</div>
            <div class="text-slate-600">Tax</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(invoice.taxAmount || 0)}</div>
            <div class="text-slate-600">Discount</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(invoice.discountAmount || 0)}</div>
            <div class="text-slate-900 font-bold">Total</div><div class="text-right font-bold text-slate-900">${window.QiApi.formatCurrency(invoice.totalAmount || 0)}</div>
            <div class="text-slate-600">Paid</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(invoice.paidAmount || 0)}</div>
            <div class="text-slate-600">Balance</div><div class="text-right font-semibold">${window.QiApi.formatCurrency(invoice.balance || 0)}</div>
          </div>
        </div>
      `,
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mt-4 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => ui.closeModal(modal));
    modal.querySelector('[data-role="content"]').appendChild(closeButton);
  }

  try {
    setMetricCards({
      salesToday: 0,
      salesMonth: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      totalCustomers: 0,
    });
    renderRecentRows();

    const payload = await window.QiApi.request('/dashboard/summary');
    const metrics = payload.data?.metrics || {};
    recentInvoices = payload.data?.recentInvoices || [];

    setMetricCards(metrics);
    renderRecentRows();

    const searchInput = document.querySelector('header input[placeholder*="Search invoices"]');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        renderRecentRows(event.target.value || '');
      });
    }

    const tableCard = Array.from(document.querySelectorAll('h3')).find((el) =>
      (el.textContent || '').trim().toLowerCase() === 'recent invoices'
    )?.closest('div.bg-white');

    const tbody = tableCard ? tableCard.querySelector('tbody') : null;
    if (tbody) {
      tbody.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="view"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const invoice = recentInvoices.find((inv) => String(inv._id) === String(id));
        if (invoice) showInvoiceModal(invoice);
      });
    }

    const viewAllBtn = Array.from(document.querySelectorAll('button')).find((btn) =>
      (btn.textContent || '').toLowerCase().includes('view all invoices')
    );
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        window.location.href = '/Adminstration/Invoice.html';
      });
    }
  } catch (error) {
    console.error('QuickInvoice dashboard error:', error);
    recentInvoices = [];
    renderRecentRows();
    await ui.alert(error.message || 'Failed to load dashboard data', { title: 'Load Error' });
  }
});
