document.addEventListener('DOMContentLoaded', async () => {
  if (!window.QiApi) return;

  const ui = window.QiUi || {
    alert: async (msg) => window.alert(msg),
    confirm: async () => false,
    form: async () => null,
    createModal: () => null,
    closeModal: () => null,
  };

  let products = [];
  let filtered = [];
  let categoryFilter = '';
  let stockFilter = 'all';

  const searchInput = document.querySelector('input[placeholder*="Search products"]');
  const addButton = Array.from(document.querySelectorAll('button')).find((btn) =>
    (btn.textContent || '').toLowerCase().includes('add product')
  );
  const dropdownButtons = Array.from(document.querySelectorAll('button.dropdown-btn'));
  const categoryBtn = dropdownButtons[0] || null;
  const stockBtn = dropdownButtons[1] || null;
  const tbody = document.querySelector('table tbody');
  const footerSummary = Array.from(document.querySelectorAll('p.text-sm.text-slate-500'))
    .find((el) => (el.textContent || '').toLowerCase().includes('showing'));

  function categoryBadgeClass(category) {
    const c = String(category || '').toLowerCase();
    if (c.includes('hardware')) return 'bg-blue-100 text-blue-800';
    if (c.includes('software')) return 'bg-purple-100 text-purple-800';
    if (c.includes('service')) return 'bg-emerald-100 text-emerald-800';
    if (c.includes('furniture')) return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-700';
  }

  function stockCell(item) {
    const qty = Number(item.quantity || 0);
    const threshold = Number(item.lowStockThreshold || 0);
    if (qty <= threshold) {
      return `
        <div class="flex flex-col items-center">
          <span class="text-sm font-bold text-red-600">${qty}</span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 mt-1 uppercase">Low Stock</span>
        </div>
      `;
    }
    return `<span class="text-sm font-medium">${qty}</span>`;
  }

  function renderRows(rows) {
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-slate-500">No products found</td></tr>';
      if (footerSummary) footerSummary.textContent = 'Showing 0 of 0 results';
      return;
    }

    tbody.innerHTML = rows.map((item) => `
      <tr class="table-row-hover cursor-pointer">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="product-icon w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-slate-400">inventory_2</span>
            </div>
            <span class="font-semibold text-sm">${window.QiApi.escapeHtml(item.name || 'Untitled Product')}</span>
          </div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-500 font-mono">${window.QiApi.escapeHtml(item.sku || '-')}</td>
        <td class="px-6 py-4">
          <span class="badge-hover inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryBadgeClass(item.category)}">
            ${window.QiApi.escapeHtml(item.category || 'general')}
          </span>
        </td>
        <td class="px-6 py-4 text-sm font-semibold">${window.QiApi.formatCurrency(item.sellingPrice || 0)}</td>
        <td class="px-6 py-4 text-sm text-center">${Number(item.taxRate || 0)}%</td>
        <td class="px-6 py-4 text-center">${stockCell(item)}</td>
        <td class="px-6 py-4 text-right">
          <div class="flex justify-end gap-1">
            <button class="action-btn p-2 text-slate-400 hover:text-primary" data-action="view" data-id="${window.QiApi.escapeHtml(item._id)}">
              <span class="material-symbols-outlined text-[20px] pointer-events-none">visibility</span>
            </button>
            <button class="action-btn p-2 text-slate-400 hover:text-primary" data-action="edit" data-id="${window.QiApi.escapeHtml(item._id)}">
              <span class="material-symbols-outlined text-[20px] pointer-events-none">edit</span>
            </button>
            <button class="action-btn delete p-2 text-slate-400 hover:text-red-500" data-action="delete" data-id="${window.QiApi.escapeHtml(item._id)}">
              <span class="material-symbols-outlined text-[20px] pointer-events-none">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    if (footerSummary) {
      footerSummary.innerHTML = `Showing <span class="font-medium text-slate-900">${rows.length}</span> of <span class="font-medium text-slate-900">${products.length}</span> results`;
    }
  }

  function applyFilters() {
    const q = String(searchInput?.value || '').trim().toLowerCase();

    filtered = products.filter((item) => {
      const queryMatch = !q
        || String(item.name || '').toLowerCase().includes(q)
        || String(item.sku || '').toLowerCase().includes(q)
        || String(item.category || '').toLowerCase().includes(q);

      const categoryMatch = !categoryFilter
        || String(item.category || '').toLowerCase() === categoryFilter;

      const qty = Number(item.quantity || 0);
      const threshold = Number(item.lowStockThreshold || 0);
      const stockMatch = (() => {
        if (stockFilter === 'all') return true;
        if (stockFilter === 'out') return qty <= 0;
        if (stockFilter === 'low') return qty > 0 && qty <= threshold;
        if (stockFilter === 'in') return qty > threshold;
        return true;
      })();

      return queryMatch && categoryMatch && stockMatch;
    });

    renderRows(filtered);
  }

  function showProductDetails(item) {
    const modal = ui.createModal({
      title: item.name || 'Product Details',
      contentHtml: `
        <div class="space-y-3 text-sm">
          <div><span class="font-semibold text-slate-500">SKU:</span> ${window.QiApi.escapeHtml(item.sku || '-')}</div>
          <div><span class="font-semibold text-slate-500">Category:</span> ${window.QiApi.escapeHtml(item.category || '-')}</div>
          <div><span class="font-semibold text-slate-500">Selling Price:</span> ${window.QiApi.formatCurrency(item.sellingPrice || 0)}</div>
          <div><span class="font-semibold text-slate-500">Cost Price:</span> ${window.QiApi.formatCurrency(item.costPrice || 0)}</div>
          <div><span class="font-semibold text-slate-500">Stock:</span> ${Number(item.quantity || 0)}</div>
          <div><span class="font-semibold text-slate-500">Tax:</span> ${Number(item.taxRate || 0)}%</div>
          <div><span class="font-semibold text-slate-500">Description:</span> ${window.QiApi.escapeHtml(item.description || '-')}</div>
        </div>
      `,
      widthClass: 'max-w-lg',
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mt-4 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => ui.closeModal(modal));
    modal.querySelector('[data-role="content"]').appendChild(closeBtn);
  }

  async function createProduct() {
    const data = await ui.form({
      title: 'Add Product',
      submitText: 'Create Product',
      fields: [
        { name: 'name', label: 'Product Name', required: true, placeholder: 'Blood Test Kit' },
        { name: 'sku', label: 'SKU', placeholder: 'KIT-BLD-001' },
        { name: 'category', label: 'Category', placeholder: 'Medical Supplies' },
        { name: 'sellingPrice', label: 'Selling Price', type: 'number', min: 0, step: '0.01', required: true, value: '0' },
        { name: 'costPrice', label: 'Cost Price', type: 'number', min: 0, step: '0.01', value: '0' },
        { name: 'quantity', label: 'Stock Quantity', type: 'number', min: 0, step: '1', value: '0' },
        { name: 'taxRate', label: 'Tax %', type: 'number', min: 0, step: '0.01', value: '0' },
        { name: 'lowStockThreshold', label: 'Low Stock Threshold', type: 'number', min: 0, step: '1', value: '5' },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, placeholder: 'Optional' },
      ],
    });

    if (!data) return;

    await window.QiApi.request('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        sku: data.sku || undefined,
        category: data.category || undefined,
        description: data.description || undefined,
        sellingPrice: Number(data.sellingPrice || 0),
        costPrice: Number(data.costPrice || data.sellingPrice || 0),
        quantity: Number(data.quantity || 0),
        taxRate: Number(data.taxRate || 0),
        lowStockThreshold: Number(data.lowStockThreshold || 5),
      }),
    });

    await ui.alert('Product created successfully.', { title: 'Success' });
    await loadProducts();
  }

  async function editProduct(item) {
    const data = await ui.form({
      title: `Edit ${item.name || 'Product'}`,
      submitText: 'Update Product',
      fields: [
        { name: 'name', label: 'Product Name', required: true, value: item.name || '' },
        { name: 'sku', label: 'SKU', value: item.sku || '' },
        { name: 'category', label: 'Category', value: item.category || '' },
        { name: 'sellingPrice', label: 'Selling Price', type: 'number', min: 0, step: '0.01', required: true, value: String(item.sellingPrice || 0) },
        { name: 'costPrice', label: 'Cost Price', type: 'number', min: 0, step: '0.01', value: String(item.costPrice || 0) },
        { name: 'quantity', label: 'Stock Quantity', type: 'number', min: 0, step: '1', value: String(item.quantity || 0) },
        { name: 'taxRate', label: 'Tax %', type: 'number', min: 0, step: '0.01', value: String(item.taxRate || 0) },
        { name: 'lowStockThreshold', label: 'Low Stock Threshold', type: 'number', min: 0, step: '1', value: String(item.lowStockThreshold || 5) },
        { name: 'description', label: 'Description', type: 'textarea', rows: 3, value: item.description || '' },
      ],
    });

    if (!data) return;

    await window.QiApi.request(`/products/${item._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: data.name,
        sku: data.sku || undefined,
        category: data.category || undefined,
        description: data.description || undefined,
        sellingPrice: Number(data.sellingPrice || 0),
        costPrice: Number(data.costPrice || data.sellingPrice || 0),
        quantity: Number(data.quantity || 0),
        taxRate: Number(data.taxRate || 0),
        lowStockThreshold: Number(data.lowStockThreshold || 5),
      }),
    });

    await ui.alert('Product updated successfully.', { title: 'Success' });
    await loadProducts();
  }

  async function deleteProduct(item) {
    const ok = await ui.confirm(`Delete product \"${item.name || 'this product'}\"?`, {
      title: 'Delete Product',
      confirmText: 'Delete',
    });

    if (!ok) return;

    await window.QiApi.request(`/products/${item._id}`, { method: 'DELETE' });
    await ui.alert('Product deleted successfully.', { title: 'Deleted' });
    await loadProducts();
  }

  async function loadProducts() {
    const payload = await window.QiApi.request('/products?limit=200');
    products = payload.data || [];
    filtered = [...products];
    applyFilters();
  }

  try {
    renderRows([]);

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }

    if (addButton) {
      addButton.addEventListener('click', async () => {
        try {
          await createProduct();
        } catch (error) {
          await ui.alert(error.message || 'Failed to create product', { title: 'Create Failed' });
        }
      });
    }

    if (categoryBtn) {
      categoryBtn.addEventListener('click', () => {
        const categories = ['All'].concat(
          Array.from(new Set(products.map((p) => String(p.category || 'general').trim()).filter(Boolean)))
        );
        const currentLabel = categoryFilter || 'all';
        const currentIndex = categories.findIndex((c) => c.toLowerCase() === currentLabel);
        const next = categories[(currentIndex + 1) % categories.length];
        categoryFilter = next.toLowerCase() === 'all' ? '' : next.toLowerCase();
        categoryBtn.innerHTML = `${window.QiApi.escapeHtml(next)} <span class=\"material-symbols-outlined text-[20px]\">expand_more</span>`;
        applyFilters();
      });
    }

    if (stockBtn) {
      const stockOptions = [
        { label: 'All Stock', value: 'all' },
        { label: 'In Stock', value: 'in' },
        { label: 'Low Stock', value: 'low' },
        { label: 'Out of Stock', value: 'out' },
      ];
      stockBtn.addEventListener('click', () => {
        const idx = stockOptions.findIndex((opt) => opt.value === stockFilter);
        const next = stockOptions[(idx + 1) % stockOptions.length];
        stockFilter = next.value;
        stockBtn.innerHTML = `${next.label} <span class=\"material-symbols-outlined text-[20px]\">expand_more</span>`;
        applyFilters();
      });
    }

    if (tbody) {
      tbody.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action]');
        if (!btn) return;

        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const item = products.find((p) => String(p._id) === String(id));
        if (!item) return;

        try {
          if (action === 'view') showProductDetails(item);
          if (action === 'edit') await editProduct(item);
          if (action === 'delete') await deleteProduct(item);
        } catch (error) {
          await ui.alert(error.message || 'Action failed', { title: 'Error' });
        }
      });
    }

    await loadProducts();
  } catch (error) {
    console.error('QuickInvoice products error:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Failed to load products</td></tr>';
    }
    await ui.alert(error.message || 'Failed to load products', { title: 'Load Error' });
  }
});
