document.addEventListener('DOMContentLoaded', () => {
  if (!window.LabApi) return;

  const ui = window.LabUi || {
    alert: async (msg) => window.alert(msg),
    confirm: async (msg) => window.confirm(msg),
    form: async () => null,
  };

  let reports = [];
  let orders = [];
  let filtered = [];

  const table = Array.from(document.querySelectorAll('table')).find((t) => {
    const headers = Array.from(t.querySelectorAll('th')).map((h) => (h.textContent || '').toLowerCase());
    return headers.includes('report id') && headers.includes('patient name');
  });
  const tbody = table ? table.querySelector('tbody') : null;
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">Loading reports...</td></tr>';
  }

  const searchInput = Array.from(document.querySelectorAll('input'))
    .find((input) => (input.placeholder || '').toLowerCase().includes('patient name or report id'));
  const statusSelect = Array.from(document.querySelectorAll('select'))
    .find((sel) => (sel.textContent || '').toLowerCase().includes('all status'));
  const createBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('create new report'));
  const applyBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').trim() === 'apply');

  const footerSummary = Array.from(document.querySelectorAll('p'))
    .find((el) => /showing/i.test(el.textContent || '') && /entries/i.test(el.textContent || ''));

  function statusBadge(status) {
    const s = String(status || 'draft').toLowerCase();
    if (s === 'finalized' || s === 'delivered') {
      return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><span class="size-1.5 bg-green-500 rounded-full mr-1.5"></span>Approved</span>';
    }
    if (s === 'draft') {
      return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600"><span class="size-1.5 bg-slate-400 rounded-full mr-1.5"></span>Draft</span>';
    }
    if (s === 'rejected') {
      return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><span class="size-1.5 bg-red-500 rounded-full mr-1.5"></span>Rejected</span>';
    }
    return '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><span class="size-1.5 bg-amber-500 rounded-full mr-1.5"></span>Pending</span>';
  }

  function render(rows) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">No reports found</td></tr>';
      return;
    }

    rows.forEach((report) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition-colors';
      row.innerHTML = `
        <td class="px-6 py-4 font-mono text-sm text-primary font-bold">#${window.LabApi.escapeHtml(report.reportNumber || 'N/A')}</td>
        <td class="px-6 py-4 font-medium">${window.LabApi.escapeHtml(report.patientName || '-')}</td>
        <td class="px-6 py-4 text-sm">${window.LabApi.escapeHtml(report.tests?.[0]?.name || 'Lab Test')}</td>
        <td class="px-6 py-4 text-sm text-slate-500">${window.LabApi.formatDate(report.createdAt)}</td>
        <td class="px-6 py-4">${statusBadge(report.status)}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button data-action="view" data-id="${report._id}" class="p-1.5 text-slate-400 hover:text-primary transition-colors" title="View"><span class="material-symbols-outlined text-lg">visibility</span></button>
            <button data-action="approve" data-id="${report._id}" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Approve"><span class="material-symbols-outlined text-lg">check_circle</span></button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  function updateStats(rows) {
    const total = rows.length;
    const pending = rows.filter((r) => !['finalized', 'delivered'].includes(String(r.status || '').toLowerCase())).length;
    const completed = rows.filter((r) => ['finalized', 'delivered'].includes(String(r.status || '').toLowerCase())).length;
    const rejected = rows.filter((r) => String(r.status || '').toLowerCase() === 'rejected').length;

    const cards = Array.from(document.querySelectorAll('.grid .glass-card'));
    cards.forEach((card) => {
      const label = (card.querySelector('p.text-slate-500')?.textContent || '').toLowerCase();
      const valueEl = card.querySelector('p.text-2xl');
      if (!valueEl) return;
      if (label.includes('total reports')) valueEl.textContent = Number(total).toLocaleString();
      if (label.includes('pending approval')) valueEl.textContent = Number(pending).toLocaleString();
      if (label.includes('completed today')) valueEl.textContent = Number(completed).toLocaleString();
      if (label.includes('rejected')) valueEl.textContent = Number(rejected).toLocaleString();
    });

    if (footerSummary) {
      footerSummary.textContent = `Showing ${rows.length} of ${reports.length} entries`;
    }
  }

  function applyFilters() {
    const q = String(searchInput?.value || '').trim().toLowerCase();
    const selectedStatus = String(statusSelect?.value || 'All Status').toLowerCase();

    filtered = reports.filter((r) => {
      const matchesSearch = !q
        || String(r.reportNumber || '').toLowerCase().includes(q)
        || String(r.patientName || '').toLowerCase().includes(q)
        || String(r.tests?.[0]?.name || '').toLowerCase().includes(q);

      const reportStatus = String(r.status || '').toLowerCase();
      const mappedStatus = reportStatus === 'finalized' || reportStatus === 'delivered'
        ? 'approved'
        : (reportStatus === 'draft' ? 'draft' : (reportStatus === 'rejected' ? 'rejected' : 'pending'));

      const matchesStatus = selectedStatus === 'all status' || selectedStatus === mappedStatus;
      return matchesSearch && matchesStatus;
    });

    render(filtered);
    updateStats(filtered);
  }

  async function load() {
    const [reportsPayload, ordersPayload] = await Promise.all([
      window.LabApi.request('/reports?limit=200'),
      window.LabApi.request('/orders?limit=200').catch(() => ({ data: [] })),
    ]);
    reports = reportsPayload.data || [];
    orders = ordersPayload.data || [];
    applyFilters();
  }

  function openView(report) {
    if (!ui.createModal || !ui.closeModal) {
      ui.alert(
        `Report: ${report.reportNumber || '-'}\n` +
        `Patient: ${report.patientName || '-'}\n` +
        `Status: ${report.status || '-'}`
      );
      return;
    }

    const testsList = (report.tests || []).map((test) => `
      <li class="py-1 flex justify-between gap-3">
        <span class="font-medium text-slate-800">${window.LabApi.escapeHtml(test.name || 'Test')}</span>
        <span class="text-slate-500">${window.LabApi.escapeHtml(test.resultText || test.resultValue || '-')}</span>
      </li>
    `).join('');

    const modal = ui.createModal({
      title: `Report ${report.reportNumber || ''}`,
      contentHtml: `
        <div class="space-y-3 text-sm text-slate-700">
          <p><span class="font-bold text-slate-900">Patient:</span> ${window.LabApi.escapeHtml(report.patientName || '-')}</p>
          <p><span class="font-bold text-slate-900">Status:</span> ${window.LabApi.escapeHtml(report.status || '-')}</p>
          <p><span class="font-bold text-slate-900">Summary:</span> ${window.LabApi.escapeHtml(report.summary || '-')}</p>
          <div>
            <p class="font-bold text-slate-900 mb-1">Tests</p>
            <ul class="divide-y divide-slate-100">${testsList || '<li class="py-1 text-slate-500">No tests found</li>'}</ul>
          </div>
          <div class="pt-2 flex justify-end">
            <button type="button" data-role="close-view" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">Close</button>
          </div>
        </div>
      `,
    });
    const closeBtn = modal.querySelector('[data-role="close-view"]');
    if (closeBtn) closeBtn.addEventListener('click', () => ui.closeModal(modal));
  }

  async function openCreateReportForm() {
    const reportableOrders = orders
      .filter((order) => order && order._id)
      .slice(0, 100);

    if (!reportableOrders.length) {
      await ui.alert('No lab orders found. Create an order first.', { title: 'No Orders' });
      return;
    }

    const form = await ui.form({
      title: 'Create New Report',
      submitText: 'Save Report',
      fields: [
        {
          name: 'orderId',
          label: 'Lab Order',
          type: 'select',
          required: true,
          value: reportableOrders[0]._id,
          options: reportableOrders.map((order) => ({
            value: order._id,
            label: `${order.orderNumber || 'Order'} • ${order.patientName || 'Unknown'}`,
          })),
        },
        { name: 'testName', label: 'Test Name', required: true, value: 'CBC' },
        { name: 'resultText', label: 'Result', required: true, value: 'Normal' },
        { name: 'summary', label: 'Summary', type: 'textarea', value: 'Report generated from admin panel' },
      ],
    });

    if (!form) return;

    await window.LabApi.request('/reports', {
      method: 'POST',
      body: JSON.stringify({
        orderId: form.orderId,
        status: 'draft',
        tests: [{ name: form.testName, resultText: form.resultText, flag: 'normal' }],
        summary: form.summary || '',
      }),
    });
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);
  if (applyBtn) applyBtn.addEventListener('click', applyFilters);

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      try {
        await openCreateReportForm();
        await load();
      } catch (error) {
        await ui.alert(error.message || 'Failed to create report', { title: 'Create Failed' });
      }
    });
  }

  if (tbody) {
    tbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const report = reports.find((r) => String(r._id) === String(id));
      if (!report) return;

      if (action === 'view') {
        openView(report);
        return;
      }

      if (action === 'approve') {
        const yes = await ui.confirm('Finalize and approve this report?', { confirmText: 'Approve' });
        if (!yes) return;
        try {
          await window.LabApi.request('/reports', {
            method: 'POST',
            body: JSON.stringify({
              orderId: report.orderId,
              status: 'finalized',
              tests: report.tests || [],
              summary: report.summary || 'Finalized report',
              interpretation: report.interpretation || '',
              recommendations: report.recommendations || '',
            }),
          });
          await load();
        } catch (error) {
          await ui.alert(error.message || 'Failed to approve report', { title: 'Approve Failed' });
        }
      }
    });
  }

  load().catch(async (error) => {
    console.error('Reports load failed:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Failed to load reports</td></tr>';
    }
    await ui.alert(error.message || 'Failed to load reports', { title: 'Load Error' });
  });
});
