document.addEventListener('DOMContentLoaded', async () => {
  if (!window.LabApi) return;
  const ui = window.LabUi || {
    alert: async (msg) => window.alert(msg),
    form: async () => null,
  };

  try {
    const payload = await window.LabApi.request('/dashboard/summary');
    const metrics = payload.data?.metrics || {};
    const recentOrders = payload.data?.recentOrders || [];

    const metricCards = document.querySelectorAll('section[data-purpose="metrics-grid"] .glass-card');
    metricCards.forEach((card) => {
      const heading = (card.querySelector('h3')?.textContent || '').toLowerCase();
      const valueEl = card.querySelector('p.text-3xl');
      if (!valueEl) return;

      if (heading.includes('total patients')) valueEl.textContent = Number(metrics.totalPatients || 0).toLocaleString();
      if (heading.includes('tests today')) valueEl.textContent = Number(metrics.testsToday || 0).toLocaleString();
      if (heading.includes('pending reports')) valueEl.textContent = Number(metrics.pendingReports || 0).toLocaleString();
      if (heading.includes('completed today')) valueEl.textContent = Number(metrics.completedToday || 0).toLocaleString();
    });

    const statBoxes = document.querySelectorAll('.grid.grid-cols-3 .text-center');
    statBoxes.forEach((box) => {
      const label = (box.querySelector('p')?.textContent || '').toLowerCase();
      const valueEl = box.querySelector('p.text-2xl');
      if (!valueEl) return;
      if (label.includes('gross income')) valueEl.textContent = window.LabApi.formatCurrency(metrics.billedThisMonth || 0);
      if (label.includes('net profit')) valueEl.textContent = window.LabApi.formatCurrency(metrics.collectedThisMonth || 0);
      if (label.includes('avg ticket')) {
        const avg = (metrics.testsToday || 0) > 0 ? (Number(metrics.collectedThisMonth || 0) / Number(metrics.testsToday || 1)) : 0;
        valueEl.textContent = window.LabApi.formatCurrency(avg);
      }
    });

    const timelineContainer = Array.from(document.querySelectorAll('h3'))
      .find((el) => (el.textContent || '').toLowerCase().includes('recent activity'))
      ?.closest('.glass-card')
      ?.querySelector('.space-y-6');

    if (timelineContainer) {
      timelineContainer.innerHTML = '';
      if (!recentOrders.length) {
        timelineContainer.innerHTML = '<p class="text-sm text-slate-500">No recent activity found.</p>';
      } else {
        recentOrders.forEach((order) => {
          const status = String(order.status || 'registered').replace(/_/g, ' ');
          const item = document.createElement('div');
          item.className = 'flex gap-4';
          item.innerHTML = `
            <div class="relative">
              <div class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-primary z-10 relative">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
              </div>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-900">${window.LabApi.escapeHtml(order.orderNumber || 'Order')}</p>
              <p class="text-xs text-slate-400 font-medium">${window.LabApi.escapeHtml(order.patientName || 'Unknown')} • ${window.LabApi.escapeHtml(status)}</p>
            </div>
          `;
          timelineContainer.appendChild(item);
        });
      }
    }

    const createBtn = Array.from(document.querySelectorAll('button'))
      .find((btn) => (btn.textContent || '').toLowerCase().includes('create new test case'));

    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const form = await ui.form({
          title: 'Create Lab Test',
          submitText: 'Create Test',
          fields: [
            { name: 'code', label: 'Test Code', required: true, value: `LAB-${Date.now().toString().slice(-4)}` },
            { name: 'name', label: 'Test Name', required: true, placeholder: 'Complete Blood Count' },
            { name: 'category', label: 'Category', placeholder: 'Hematology' },
            { name: 'sampleType', label: 'Sample Type', placeholder: 'Blood' },
            { name: 'price', label: 'Price (PKR)', type: 'number', required: true, min: 0, step: 1, value: '0' },
            { name: 'turnaroundHours', label: 'Turnaround Hours', type: 'number', min: 1, step: 1, value: '24' },
          ],
        });
        if (!form) return;

        try {
          await window.LabApi.request('/tests', {
            method: 'POST',
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              category: form.category || undefined,
              sampleType: form.sampleType || undefined,
              price: Number(form.price || 0),
              turnaroundHours: Number(form.turnaroundHours || 24),
            }),
          });
          await ui.alert('Test created successfully.', { title: 'Success' });
        } catch (error) {
          await ui.alert(error.message || 'Failed to create test', { title: 'Create Failed' });
        }
      });
    }

    const viewLogsBtn = Array.from(document.querySelectorAll('button'))
      .find((btn) => (btn.textContent || '').toLowerCase().includes('view all logs'));
    if (viewLogsBtn) {
      viewLogsBtn.addEventListener('click', () => {
        window.location.href = '/lab-ms/Admin/LabReport.html';
      });
    }
  } catch (error) {
    console.error('Dashboard load failed:', error);
    await ui.alert(error.message || 'Failed to load dashboard data', { title: 'Load Error' });
  }
});
