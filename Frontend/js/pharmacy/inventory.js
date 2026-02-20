if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInventory);
} else {
    initInventory();
}

let inventoryData = []; // Store current data for export

function initInventory() {
    fetchInventory();
    fetchInventoryDashboardData();
    fetchPendingRequisitions();
    setupInventoryListeners();
    initializeQuarterlyChart();
    setupScanner();
}

function setupScanner() {
    const skuInput = document.getElementById('itemSku');
    if (skuInput) {
        skuInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('itemCategory').focus();
            }
        });
    }
}

function setupInventoryListeners() {
    // "New Entry" button
    const addBtn = document.querySelector('button.bg-primary-blue');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openModal();
        });
    }

    // Modal Form Submit
    const form = document.getElementById('inventoryForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    // Export CSV button
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', downloadInventoryCSV);
    }
}

// Modal Functions
window.openModal = function (item = null) {
    const modal = document.getElementById('inventoryModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('inventoryForm');

    if (!modal || !form) return;

    // Reset Form
    form.reset();
    document.getElementById('itemId').value = '';

    if (item) {
        title.innerText = 'Edit Item';
        document.getElementById('itemId').value = item._id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemSku').value = item.sku || '';
        document.getElementById('itemCategory').value = item.category || 'General';
        document.getElementById('itemCost').value = item.costPrice;
        document.getElementById('itemPrice').value = item.sellingPrice;
        document.getElementById('itemQty').value = item.quantity;
        document.getElementById('itemMinStock').value = item.lowStockThreshold || 10;

        if (item.expiryDate) {
            document.getElementById('itemExpiry').value = new Date(item.expiryDate).toISOString().split('T')[0];
        }
    } else {
        title.innerText = 'Add New Item';
    }

    modal.classList.remove('hidden');
    // Focus SKU field for scanner
    setTimeout(() => {
        const skuInput = document.getElementById('itemSku');
        if (skuInput) skuInput.focus();
    }, 100);
}

window.closeModal = () => {
    const modal = document.getElementById('inventoryModal');
    if (modal) modal.classList.add('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) return window.handleTokenExpiry();

    const id = document.getElementById('itemId').value;
    const isEdit = !!id;

    const formData = {
        name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value,
        category: document.getElementById('itemCategory').value,
        costPrice: parseFloat(document.getElementById('itemCost').value) || 0,
        sellingPrice: parseFloat(document.getElementById('itemPrice').value) || 0,
        quantity: parseInt(document.getElementById('itemQty').value) || 0,
        lowStockThreshold: parseInt(document.getElementById('itemMinStock').value) || 10,
        expiryDate: document.getElementById('itemExpiry').value || null
    };

    try {
        const url = isEdit ? `/api/pharmacy/inventory/${id}` : '/api/pharmacy/inventory';
        const method = isEdit ? 'PUT' : 'POST';

        console.log(`Submitting inventory form to ${url}`, formData);
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            closeModal();
            showAlert(isEdit ? 'Item updated successfully!' : 'Item added to inventory!', 'success');
            fetchInventory();
        } else {
            console.error('Inventory operation failed:', result);
            showAlert(`${result.message || 'Operation failed'}`, 'error');
        }
    } catch (error) {
        console.error('Error saving item:', error);
        showAlert('An error occurred while saving the item', 'error');
    }
}

async function fetchInventory() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();

        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch Items
        const response = await fetch('/api/pharmacy/inventory', { headers });
        const result = await response.json();

        if (result.success) {
            inventoryData = result.data;
            renderInventoryTable(result.data);
        }

        // 2. Fetch Valuation
        const valResponse = await fetch('/api/pharmacy/analytics/inventory-value', { headers });
        const valResult = await valResponse.json();

        if (valResult.success && valResult.summary) {
            const el = document.getElementById('inventoryValuation');
            if (el) el.innerText = `RS ${valResult.summary.totalSellingValue || '0.00'}`;

            // Also update net margin if possible (placeholder logic using potential profit)
            const marginEl = document.getElementById('netMargin');
            if (marginEl) marginEl.innerText = `RS ${valResult.summary.potentialProfit || '0.00'}`;
        }

    } catch (error) {
        console.error('Error fetching inventory:', error);
    }
}

async function fetchInventoryDashboardData() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Accounts Receivable
        const arRes = await fetch('/api/accounting/analytics/accounts-receivable', { headers });
        const arData = await arRes.json();
        if (arData.success) {
            const el = document.getElementById('accountsReceivable');
            if (el) el.innerText = `RS ${arData.totalReceivable?.toFixed(2) || '0.00'}`;
        }

        // 2. Accounts Payable
        const apRes = await fetch('/api/accounting/analytics/accounts-payable', { headers });
        const apData = await apRes.json();
        if (apData.success) {
            const el = document.getElementById('accountsPayable');
            if (el) el.innerText = `RS ${apData.totalPayable?.toFixed(2) || '0.00'}`;
        }

        // 3. Quarterly Performance (Chart)
        const chartRes = await fetch('/api/accounting/analytics/revenue-vs-expenses', { headers });
        const chartData = await chartRes.json();
        if (chartData.success) {
            updateQuarterlyChart(chartData.data);
        }

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

async function fetchPendingRequisitions() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();
        const headers = { 'Authorization': `Bearer ${token}` };

        const response = await fetch('/api/pharmacy/purchase-orders?status=pending', { headers });
        const result = await response.json();

        if (result.success) {
            renderRequisitions(result.data);
        }
    } catch (error) {
        console.error('Error fetching requisitions:', error);
    }
}

function renderRequisitions(orders) {
    const container = document.getElementById('pendingRequisitions');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-[10px] text-slate-500 italic">No pending requisitions</div>';
        return;
    }

    container.innerHTML = '';
    orders.slice(0, 3).forEach(po => {
        const item = `
            <div class="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-800">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-accent-orange/10 text-accent-orange rounded flex items-center justify-center">
                        <span class="material-icons-round text-sm">shopping_cart</span>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-white uppercase">${po.poNumber}</p>
                        <p class="text-[10px] text-slate-500">${po.supplierId?.name || 'Unknown Supplier'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-white">RS ${po.totalAmount.toFixed(2)}</p>
                    <p class="text-[9px] text-accent-orange uppercase font-bold">Pending</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', item);
    });
}

function initializeQuarterlyChart() {
    const el = document.getElementById('quarterlyChart');
    if (!el) return;
    const ctx = el.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Revenue',
                    data: [],
                    backgroundColor: '#137fec',
                    borderRadius: 4,
                    barThickness: 30
                },
                {
                    label: 'Expenses',
                    data: [],
                    backgroundColor: '#334155',
                    borderRadius: 4,
                    barThickness: 30
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }
            }
        }
    });
}

function updateQuarterlyChart(data) {
    // Assuming quarterlyChart is globally available from the bottom script in HTML
    const chart = Chart.getChart("quarterlyChart");
    if (!chart || !data) return;

    chart.data.labels = data.labels || [];
    chart.data.datasets[0].data = data.income || [];
    chart.data.datasets[1].data = data.expenses || [];
    chart.update();
}

function renderInventoryTable(items) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // Clear static data

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-slate-500">No items found</td></tr>';
        return;
    }

    items.forEach(item => {
        const statusColor = item.quantity > 10 ? 'accent-green' : (item.quantity > 0 ? 'accent-orange' : 'accent-rose');
        const statusText = item.quantity > 10 ? 'IN STOCK' : (item.quantity > 0 ? 'LOW STOCK' : 'OUT OF STOCK');
        const stockPercent = Math.min(100, (item.quantity / 100) * 100); // Mock percent

        const row = `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 text-primary-blue font-bold">${item.sku || 'N/A'}</td>
                <td class="px-6 py-4">
                    <p class="font-bold text-white leading-none">${item.name}</p>
                    <p class="text-[10px] text-slate-500 mt-1">${item.description || ''}</p>
                </td>
                <td class="px-6 py-4"><span class="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded font-bold uppercase">${item.category || 'General'}</span></td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-white">${item.quantity}</span>
                        <div class="flex-1 h-1 bg-slate-800 rounded-full min-w-[60px]">
                            <div class="h-full bg-${statusColor} rounded-full" style="width: ${stockPercent}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4"><span class="text-${statusColor} flex items-center gap-1 font-bold text-[10px]"><span class="w-1.5 h-1.5 bg-${statusColor} rounded-full"></span> ${statusText}</span></td>
                <td class="px-6 py-4 text-slate-400">${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</td>
                <td class="px-6 py-4 text-center text-slate-500">
                    <button class="material-icons-round text-sm cursor-pointer hover:text-red-500" onclick="deleteItem('${item._id}')">delete</button>
                    <button class="material-icons-round text-sm cursor-pointer hover:text-blue-500 ml-2" onclick="editItem('${item._id}')">edit</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Global functions for inline onclicks
window.deleteItem = async (id) => {
    showConfirm('Are you sure you want to delete this item?', async () => {
        try {
            const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
            const response = await fetch(`/api/pharmacy/inventory/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const result = await response.json();
            if (result.success) {
                showAlert('Item deleted successfully', 'success');
                fetchInventory(); // Refresh
            } else {
                showAlert(result.message || 'Failed to delete item', 'error');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showAlert('Error deleting item', 'error');
        }
    });
};

window.editItem = async (id) => {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/pharmacy/inventory/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            openModal(result.data);
        }
    } catch (error) {
        console.error('Error fetching item details:', error);
    }
};

function downloadInventoryCSV() {
    if (!inventoryData || inventoryData.length === 0) {
        showAlert('No data available to export', 'warning');
        return;
    }

    const headers = ['SKU', 'Name', 'Category', 'Quantity', 'Cost Price', 'Selling Price', 'Expiry Date'];
    const rows = inventoryData.map(item => [
        item.sku || 'N/A',
        item.name,
        item.category || 'General',
        item.quantity,
        item.costPrice,
        item.sellingPrice,
        item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
