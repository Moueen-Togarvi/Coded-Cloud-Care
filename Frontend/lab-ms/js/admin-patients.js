document.addEventListener('DOMContentLoaded', () => {
  if (!window.LabApi) return;

  const ui = window.LabUi || {
    alert: async (msg) => window.alert(msg),
    confirm: async (msg) => window.confirm(msg),
    form: async () => null,
  };

  let patients = [];
  let filtered = [];

  const allTables = Array.from(document.querySelectorAll('table'));
  const patientTable = allTables.find((table) => {
    const headers = Array.from(table.querySelectorAll('th')).map((th) => (th.textContent || '').toLowerCase());
    return headers.includes('patient id') && headers.includes('name');
  });
  const tbody = patientTable ? patientTable.querySelector('tbody') : null;
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500">Loading patients...</td></tr>';
  }

  const searchInput = Array.from(document.querySelectorAll('input'))
    .find((input) => (input.placeholder || '').toLowerCase().includes('search patients'));

  const addBtn = Array.from(document.querySelectorAll('button'))
    .find((btn) => (btn.textContent || '').toLowerCase().includes('add new patient'));

  const footerSummary = Array.from(document.querySelectorAll('p'))
    .find((el) => /showing/i.test(el.textContent || '') && /patients/i.test(el.textContent || ''));

  const statCards = Array.from(document.querySelectorAll('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 > div'));

  function setStatCard(labelText, value) {
    statCards.forEach((card) => {
      const labelEl = card.querySelector('p.text-xs');
      const valueEl = card.querySelector('p.text-2xl');
      if (!labelEl || !valueEl) return;
      const label = (labelEl.textContent || '').toLowerCase();
      if (label.includes(labelText)) {
        valueEl.textContent = Number(value || 0).toLocaleString();
      }
    });
  }

  function patientCode(patient) {
    if (patient.patientCode) return patient.patientCode;
    return `PT-${String(patient._id || '').slice(-6).toUpperCase()}`;
  }

  function patientStatus(patient) {
    return patient.isActive ? 'active' : 'inactive';
  }

  function statusBadge(status) {
    if (status === 'active') {
      return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-600 text-xs font-bold"><span class="size-1.5 bg-green-500 rounded-full"></span>Active</span>';
    }
    return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold"><span class="size-1.5 bg-slate-400 rounded-full"></span>Inactive</span>';
  }

  function renderRows(rows) {
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-slate-500">No patients found</td>
        </tr>
      `;
      return;
    }

    rows.forEach((p) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50/50 transition-colors group';
      row.innerHTML = `
        <td class="px-6 py-4"><span class="text-sm font-bold text-slate-900">#${window.LabApi.escapeHtml(patientCode(p))}</span></td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">${window.LabApi.escapeHtml((p.firstName || 'P').charAt(0).toUpperCase())}</div>
            <div>
              <p class="text-sm font-bold text-slate-900">${window.LabApi.escapeHtml(`${p.firstName || ''} ${p.lastName || ''}`.trim())}</p>
              <p class="text-xs text-slate-500">Reg: ${window.LabApi.formatDate(p.createdAt)}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-sm"><span class="font-medium">${window.LabApi.escapeHtml(p.age || '-')}</span><span class="text-slate-300 mx-2">|</span><span class="text-slate-500">${window.LabApi.escapeHtml((p.gender || '-').toString())}</span></td>
        <td class="px-6 py-4 text-sm">
          <p class="font-medium">${window.LabApi.escapeHtml(p.phone || '-')}</p>
          <p class="text-xs text-slate-500">${window.LabApi.escapeHtml(p.email || '-')}</p>
        </td>
        <td class="px-6 py-4">${statusBadge(patientStatus(p))}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <button data-action="view" data-id="${p._id}" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="View"><span class="material-symbols-outlined text-xl">visibility</span></button>
            <button data-action="edit" data-id="${p._id}" class="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Edit"><span class="material-symbols-outlined text-xl">edit</span></button>
            <button data-action="delete" data-id="${p._id}" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><span class="material-symbols-outlined text-xl">delete</span></button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  function applySearch() {
    const q = String(searchInput?.value || '').trim().toLowerCase();
    if (!q) {
      filtered = [...patients];
    } else {
      filtered = patients.filter((p) => {
        const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
        return full.includes(q)
          || String(p.patientCode || '').toLowerCase().includes(q)
          || String(p.phone || '').toLowerCase().includes(q)
          || String(p.email || '').toLowerCase().includes(q);
      });
    }
    renderRows(filtered);

    if (footerSummary) {
      footerSummary.innerHTML = `Showing <span class="font-bold text-slate-900">${filtered.length}</span> of <span class="font-bold text-slate-900">${patients.length}</span> patients`;
    }
  }

  async function openPatientForm(title, patient = {}) {
    const payload = await ui.form({
      title,
      submitText: patient._id ? 'Update Patient' : 'Create Patient',
      fields: [
        { name: 'firstName', label: 'First Name', required: true, value: patient.firstName || '', placeholder: 'Ali' },
        { name: 'lastName', label: 'Last Name', required: true, value: patient.lastName || '', placeholder: 'Khan' },
        { name: 'phone', label: 'Phone', value: patient.phone || '', placeholder: '+92...' },
        { name: 'email', label: 'Email', value: patient.email || '', placeholder: 'patient@example.com' },
        { name: 'age', label: 'Age', type: 'number', value: patient.age || '', min: 0, step: 1 },
        {
          name: 'gender',
          label: 'Gender',
          type: 'select',
          value: patient.gender || '',
          options: [
            { value: '', label: 'Select Gender' },
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    });

    if (!payload) return null;
    const clean = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || '',
      email: payload.email || '',
      age: payload.age ? Number(payload.age) : undefined,
      gender: payload.gender || undefined,
    };
    if (!clean.firstName || !clean.lastName) return null;
    return clean;
  }

  function openPatientView(patient) {
    if (!ui.createModal || !ui.closeModal) {
      ui.alert(
        `Patient: ${patient.firstName || ''} ${patient.lastName || ''}\n` +
        `Phone: ${patient.phone || '-'}\nEmail: ${patient.email || '-'}`
      );
      return;
    }

    const modal = ui.createModal({
      title: 'Patient Details',
      contentHtml: `
        <div class="space-y-2 text-sm text-slate-700">
          <p><span class="font-bold text-slate-900">Name:</span> ${window.LabApi.escapeHtml(`${patient.firstName || ''} ${patient.lastName || ''}`.trim())}</p>
          <p><span class="font-bold text-slate-900">Patient Code:</span> ${window.LabApi.escapeHtml(patientCode(patient))}</p>
          <p><span class="font-bold text-slate-900">Phone:</span> ${window.LabApi.escapeHtml(patient.phone || '-')}</p>
          <p><span class="font-bold text-slate-900">Email:</span> ${window.LabApi.escapeHtml(patient.email || '-')}</p>
          <p><span class="font-bold text-slate-900">Gender:</span> ${window.LabApi.escapeHtml(patient.gender || '-')}</p>
          <p><span class="font-bold text-slate-900">Age:</span> ${window.LabApi.escapeHtml(patient.age || '-')}</p>
          <p><span class="font-bold text-slate-900">Address:</span> ${window.LabApi.escapeHtml(patient.address || '-')}</p>
        </div>
        <div class="mt-5 flex justify-end">
          <button type="button" data-role="close-view" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">Close</button>
        </div>
      `,
    });
    const closeBtn = modal.querySelector('[data-role="close-view"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => ui.closeModal(modal));
    }
  }

  async function load() {
    const [patientsResp, summaryResp] = await Promise.all([
      window.LabApi.request('/patients?limit=100'),
      window.LabApi.request('/dashboard/summary').catch(() => ({ data: { metrics: {} } })),
    ]);

    patients = patientsResp.data || [];
    applySearch();

    const metrics = summaryResp.data?.metrics || {};
    setStatCard('total patients', patientsResp.pagination?.total || patients.length || 0);
    setStatCard('active cases', metrics.activeCases || 0);
    setStatCard('reports issued', metrics.reportsIssued || 0);
    setStatCard('new today', metrics.newToday || 0);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applySearch);
  }

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const data = await openPatientForm('Add New Patient');
      if (!data) return;
      try {
        await window.LabApi.request('/patients', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        await load();
      } catch (error) {
        await ui.alert(error.message || 'Failed to create patient', { title: 'Create Failed' });
      }
    });
  }

  if (tbody) {
    tbody.addEventListener('click', async (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const patient = patients.find((p) => String(p._id) === String(id));
      if (!patient) return;

      if (action === 'view') {
        openPatientView(patient);
        return;
      }

      if (action === 'edit') {
        const data = await openPatientForm('Edit Patient', patient);
        if (!data) return;
        try {
          await window.LabApi.request(`/patients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          });
          await load();
        } catch (error) {
          await ui.alert(error.message || 'Failed to update patient', { title: 'Update Failed' });
        }
        return;
      }

      if (action === 'delete') {
        const yes = await ui.confirm('Delete this patient record?', { confirmText: 'Delete' });
        if (!yes) return;
        try {
          await window.LabApi.request(`/patients/${id}`, { method: 'DELETE' });
          await load();
        } catch (error) {
          await ui.alert(error.message || 'Failed to delete patient', { title: 'Delete Failed' });
        }
      }
    });
  }

  load().catch(async (error) => {
    console.error('Patients load failed:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Failed to load patients</td></tr>';
    }
    await ui.alert(error.message || 'Failed to load patients', { title: 'Load Error' });
  });
});
