let cart = [];

document.addEventListener('DOMContentLoaded', function () {
    initializeCharts();
    setupEventListeners();
    fetchDashboardStats();
});

function setupEventListeners() {
    // Expose functions to global scope
    window.addRow = addRow;
    window.checkout = checkout;
    window.removeFromCart = removeFromCart;
    window.updateQuantity = updateQuantity;
    window.closeInvoiceModal = closeInvoiceModal;
    window.printInvoiceByNumber = printInvoiceByNumber;
    window.voidSale = voidSale;
    window.openReturnModal = openReturnModal;
    window.closeReturnModal = closeReturnModal;
    window.submitReturn = submitReturn;
    setupScanner();
}

function setupScanner() {
    const scanInput = document.getElementById('scanInput');
    if (scanInput) {
        scanInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                addRow();
            }
        });
    }
}

async function voidSale(invoiceNumber) {
    if (!invoiceNumber) return;
    showConfirm('Are you sure you want to void this transaction? This will restock items and reverse revenue.', async () => {
        try {
            const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) return window.handleTokenExpiry();

            const res = await fetch(`/api/pharmacy/sales/invoice/${invoiceNumber}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success) {
                showAlert('Transaction voided successfully!', 'success');
                fetchDashboardStats();
            } else {
                showAlert('Failed to void sale: ' + result.message, 'error');
            }
        } catch (e) {
            console.error('Error voiding sale:', e);
            showAlert('Error voiding sale', 'error');
        }
    });
}

let activeReturnId = null;
function openReturnModal(id, name, qty) {
    activeReturnId = id;
    const modal = document.getElementById('returnModal');
    if (!modal) return;

    document.getElementById('returnItemName').innerText = name;
    const qtyInput = document.getElementById('returnQty');
    qtyInput.value = qty;
    qtyInput.max = qty;

    modal.classList.remove('hidden');
}

function closeReturnModal() {
    const modal = document.getElementById('returnModal');
    if (modal) modal.classList.add('hidden');
    activeReturnId = null;
}

async function submitReturn() {
    if (!activeReturnId) return;
    const newQty = parseInt(document.getElementById('returnQty').value);
    const notes = document.getElementById('returnNotes').value;

    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        const res = await fetch(`/api/pharmacy/sales/${activeReturnId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newQuantity: newQty, notes })
        });
        const result = await res.json();
        if (result.success) {
            showAlert('Sale updated and stock adjusted!', 'success');
            closeReturnModal();
            fetchDashboardStats(); // Refresh dashboard
        } else {
            showAlert('Failed: ' + result.message, 'error');
        }
    } catch (e) {
        console.error('Error submitting return:', e);
        showAlert('An error occurred', 'error');
    }
}

async function printInvoiceByNumber(invoiceNumber) {
    if (!invoiceNumber) return;

    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();

        // Fetch all items for this invoice
        const res = await fetch(`/api/pharmacy/sales?invoiceNumber=${invoiceNumber}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            // Group the sales into a structure similar to what checkout returns
            const mainSale = result.data[0];
            const saleData = {
                invoiceNumber: invoiceNumber,
                saleDate: mainSale.saleDate,
                soldBy: mainSale.soldBy,
                paymentMethod: mainSale.paymentMethod,
                sales: result.data // The array of items
            };
            showInvoiceModal(saleData);
        } else {
            showAlert('Could not find invoice details', 'info');
        }
    } catch (e) {
        console.error('Error printing invoice:', e);
        showAlert('Error printing invoice', 'error');
    }
}

// Charts Initialization
function initializeCharts() {
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        new Chart(revenueCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Revenue',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#137fec',
                    borderRadius: 8,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b' } },
                    x: { grid: { display: false }, ticks: { color: '#64748b' } }
                }
            }
        });
    }

    const inventoryCtx = document.getElementById('inventoryChart');
    if (inventoryCtx) {
        new Chart(inventoryCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [100, 0],
                    backgroundColor: ['#137fec', '#1e293b'],
                    borderWidth: 0,
                    cutout: '85%'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Billing Logic with Backend Integration
async function addRow() {
    const scanInput = document.getElementById('scanInput');
    const query = scanInput ? scanInput.value.trim() : '';

    if (!query) return;

    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();

        const response = await fetch(`/api/pharmacy/inventory?search=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        let foundItem = null;
        if (result.success && result.data && result.data.length > 0) {
            foundItem = result.data.find(item =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                (item.sku && item.sku.toLowerCase() === query.toLowerCase())
            );
            if (!foundItem) foundItem = result.data[0];
        }

        if (!foundItem) {
            showAlert('Item not found', 'error');
            return;
        }

        // Add to local cart array
        const existingIdx = cart.findIndex(c => c._id === foundItem._id);
        if (existingIdx > -1) {
            cart[existingIdx].qty += 1;
        } else {
            cart.push({
                _id: foundItem._id,
                name: foundItem.name,
                sku: foundItem.sku,
                price: foundItem.sellingPrice,
                qty: 1
            });
        }

        renderCart();
        if (scanInput) scanInput.value = '';

    } catch (error) {
        console.error('Error adding item:', error);
        showAlert('Error adding item', 'error');
    }
}

function renderCart() {
    const table = document.getElementById('billTable');
    const totalDisplay = document.getElementById('totalDisplay');
    if (!table) return;

    table.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const subtotal = item.price * item.qty;
        total += subtotal;
        const row = `
            <tr class="animate-in fade-in duration-300">
                <td class="py-4 font-bold text-white">${item.name}</td>
                <td class="py-4 text-slate-400">${item.sku || '#'}</td>
                <td class="py-4">
                    <div class="flex items-center gap-2">
                        <button onclick="updateQuantity(${index}, -1)" class="w-6 h-6 bg-slate-800 rounded hover:bg-slate-700">-</button>
                        <span class="w-4 text-center text-xs">${item.qty}</span>
                        <button onclick="updateQuantity(${index}, 1)" class="w-6 h-6 bg-slate-800 rounded hover:bg-slate-700">+</button>
                    </div>
                </td>
                <td class="py-4 font-bold text-primary-blue">RS ${subtotal.toFixed(2)}</td>
                <td class="py-4 text-right">
                    <span class="material-icons-round text-slate-600 cursor-pointer hover:text-accent-rose transition-colors" onclick="removeFromCart(${index})">delete</span>
                </td>
            </tr>
        `;
        table.insertAdjacentHTML('beforeend', row);
    });

    if (totalDisplay) totalDisplay.innerText = `RS ${total.toFixed(2)}`;
}

function updateQuantity(index, delta) {
    if (cart[index]) {
        cart[index].qty += delta;
        if (cart[index].qty <= 0) {
            cart.splice(index, 1);
        }
        renderCart();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

async function checkout() {
    if (cart.length === 0) {
        showAlert('Cart is empty', 'info');
        return;
    }

    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();

        const payload = {
            items: cart.map(item => ({
                medicineId: item._id,
                quantity: item.qty
            })),
            paymentMethod: 'cash', // Default for now
            soldBy: 'Admin' // Default for now
        };

        const response = await fetch('/api/pharmacy/sales/bulk', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Checkout successful!', 'success');
            // Show print modal
            showInvoiceModal(result.data);
            fetchDashboardStats();
            cart = []; // Clear cart after successful checkout
            renderCart(); // Re-render to show empty cart
        } else {
            showAlert('Checkout failed: ' + result.message, 'error');
            // If the failure was due to insufficient stock or similar backend validations,
            // we should technically refresh our local understanding of inventory if we had any.
            // Since dashboard.js fetches via search, we don't have a master inventory array to refresh,
            // but we can at least log the exact error and give a clearer message.
            if (result.message && result.message.includes('Insufficient stock')) {
                showAlert('Stock error! Please verify item quantities before trying again.', 'warning');
            }
        }
    } catch (e) {
        console.error('Checkout error:', e);
        showAlert('Checkout failed', 'error');
    }
}

// Fetch Stats from Backend
// Fetch Stats from Backend
async function fetchDashboardStats() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return window.handleTokenExpiry();

        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Total Stock Value
        const stockRes = await fetch('/api/pharmacy/analytics/inventory-value', { headers });
        const stockData = await stockRes.json();
        let totalItems = 0;

        if (stockData.success && stockData.summary) {
            const el = document.getElementById('totalStockValue');
            const skuEl = document.getElementById('totalSKUs');
            if (el) el.innerText = `RS ${stockData.summary.totalSellingValue || '0.00'}`;
            if (skuEl) skuEl.innerText = stockData.summary.totalItems || '0';
            totalItems = stockData.summary.totalItems || 0;
        }

        // 2. Low Stock
        const lowStockRes = await fetch('/api/pharmacy/stock/low', { headers });
        const lowStockData = await lowStockRes.json();
        if (lowStockData.success) {
            const el = document.getElementById('lowStockCount');
            if (el) el.innerText = `${lowStockData.count} Items`;

            // Update chart data for inventory
            updateInventoryChart(lowStockData.count, totalItems);
        }

        // 3. Today's Sales & Profit Margin
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-CA'); // Get YYYY-MM-DD in local time
        const salesRes = await fetch(`/api/pharmacy/sales/daily/${todayStr}`, { headers });
        const salesData = await salesRes.json();
        if (salesData.success) {
            const el = document.getElementById('todaySales');
            const profitEl = document.getElementById('profitMargin');

            if (el) el.innerText = `RS ${salesData.totalSales?.toFixed(2) || '0.00'}`;

            if (profitEl) {
                if (salesData.totalSales > 0) {
                    const margin = ((salesData.totalProfit / salesData.totalSales) * 100).toFixed(1);
                    profitEl.innerText = `${margin}%`;
                } else {
                    profitEl.innerText = '0.0%';
                }
            }
        }

        // 4. Recent Activity (Sales)
        const activityRes = await fetch('/api/pharmacy/sales?limit=5', { headers });
        const activityData = await activityRes.json();
        if (activityData.success) {
            updateLiveActivity(activityData.data);
        }

        // 5. Revenue Chart Data (Last 7 Days)
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 6);
        const startDate = lastWeek.toLocaleDateString('en-CA');
        const endDate = todayStr;

        const chartRes = await fetch(`/api/pharmacy/sales/range?startDate=${startDate}&endDate=${endDate}`, { headers });
        const chartData = await chartRes.json();

        if (chartData.success) {
            updateRevenueChart(chartData.data, startDate, endDate);
        }

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

function updateLiveActivity(sales) {
    const feed = document.getElementById('liveActivityFeed');
    if (!feed || !sales || sales.length === 0) return;

    feed.innerHTML = ''; // Clear "No recent activity"

    sales.slice(0, 5).forEach(sale => {
        const timeAgo = getTimeAgo(new Date(sale.saleDate));
        const item = `
            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                <div class="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>${timeAgo} • SALE</span>
                    <span class="text-accent-green">+RS ${sale.totalAmount.toFixed(2)}</span>
                </div>
                <div class="mb-3">
                    <h4 class="text-xs font-bold text-white">Invoice: #${sale.invoiceNumber}</h4>
                    <p class="text-[10px] text-slate-500">${sale.medicineName} (x${sale.quantity})</p>
                </div>
                <div class="flex justify-between items-center">
                    <button onclick="printInvoiceByNumber('${sale.invoiceNumber}')" class="flex items-center gap-2 px-3 py-1.5 bg-primary-blue/20 hover:bg-primary-blue text-primary-blue hover:text-white rounded-lg transition-all text-[10px] font-bold uppercase" title="Print Invoice">
                        <span class="material-icons-round text-sm">print</span>
                        Print
                    </button>
                    <div class="flex gap-2">
                        <button onclick="openReturnModal('${sale._id}', '${sale.medicineName}', ${sale.quantity})" class="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-500 transition-colors" title="Return/Edit">
                            <span class="material-icons-round text-sm">edit</span>
                        </button>
                        <button onclick="voidSale('${sale.invoiceNumber}')" class="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-accent-rose transition-colors" title="Void Transaction">
                            <span class="material-icons-round text-sm">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        feed.insertAdjacentHTML('beforeend', item);
    });
}

function updateRevenueChart(sales, startDate, endDate) {
    const chart = Chart.getChart("revenueChart");
    if (!chart) return;

    const labels = [];
    const dataPoints = [];
    const dateMap = {};

    // 1. Initialize the map with 0 for each day in range
    let current = new Date(startDate);
    const end = new Date(endDate);

    // Normalize to midnight UTC for consistent comparison
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        const dayName = current.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayName);
        dateMap[dateKey] = 0;
        current.setUTCDate(current.getUTCDate() + 1);
    }

    // 2. Aggregate sales data
    if (sales && sales.length > 0) {
        sales.forEach(sale => {
            // Use local date string for aggregation to match labels
            const saleDate = new Date(sale.saleDate).toLocaleDateString('en-CA');
            if (dateMap[saleDate] !== undefined) {
                dateMap[saleDate] += sale.totalAmount;
            }
        });
    }

    // 3. Populate dataPoints array based on the ordered keys
    labels.forEach((_, index) => {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + index);
        const key = d.toLocaleDateString('en-CA');
        dataPoints.push(dateMap[key] || 0);
    });

    chart.data.labels = labels;
    chart.data.datasets[0].data = dataPoints;
    chart.update();
}

function updateInventoryChart(lowStock, total) {
    const chart = Chart.getChart("inventoryChart");
    if (chart) {
        chart.data.datasets[0].data = [total - lowStock, lowStock];
        chart.update();
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return Math.floor(seconds) + " seconds ago";
}
function showInvoiceModal(sale) {
    const modal = document.getElementById('invoiceModal');
    if (!modal || !sale) return;

    // Populate Clinic Details (could fetch from settings too)
    // For now use defaults or fetch from API
    fetchSettingsForInvoice();

    // Populate Sale Details
    document.getElementById('displayInvoiceNum').innerText = sale.invoiceNumber;
    document.getElementById('displayInvoiceDate').innerText = new Date(sale.saleDate || new Date()).toLocaleString();
    document.getElementById('displaySoldBy').innerText = sale.soldBy || 'Pharmacy Admin';
    document.getElementById('displayPaymentMethod').innerText = sale.paymentMethod || 'Cash';

    // Populate Items
    const itemsContainer = document.getElementById('invoiceItems');
    itemsContainer.innerHTML = '';

    // sale.sales contains individual items
    const items = sale.sales || [];
    let subtotal = 0;

    items.forEach(item => {
        const itemTotal = item.totalAmount || (item.unitPrice * item.quantity);
        subtotal += itemTotal;
        const row = `
            <tr>
                <td class="py-3 font-bold text-slate-800">${item.medicineName}</td>
                <td class="py-3 text-center text-slate-600">${item.quantity}</td>
                <td class="py-3 text-right text-slate-600">RS ${item.unitPrice.toFixed(2)}</td>
                <td class="py-3 text-right font-bold text-slate-900">RS ${itemTotal.toFixed(2)}</td>
            </tr>
        `;
        itemsContainer.insertAdjacentHTML('beforeend', row);
    });

    document.getElementById('invoiceSubtotal').innerText = `RS ${subtotal.toFixed(2)}`;
    document.getElementById('invoiceGrandTotal').innerText = `RS ${subtotal.toFixed(2)}`;

    modal.classList.remove('hidden');
}

async function fetchSettingsForInvoice() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success && result.data) {
            const s = result.data;
            document.getElementById('invoiceClinicName').innerText = s.clinicName || 'PharmaTrack Pro';
            document.getElementById('invoiceClinicAddress').innerText = s.clinicAddress || 'Pharmacy Street';

            if (s.clinicLogo) {
                const logoContainer = document.getElementById('invoiceLogo');
                logoContainer.innerHTML = `<img src="${s.clinicLogo}" class="h-12 w-auto object-contain" alt="Clinic Logo">`;
            }
        }
    } catch (e) {
        console.error('Error fetching settings for invoice:', e);
    }
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.classList.add('hidden');
}
