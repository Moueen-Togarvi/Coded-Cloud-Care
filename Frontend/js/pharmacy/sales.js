let allSales = [];

document.addEventListener('DOMContentLoaded', function () {
    fetchSalesData();
    setupSearch();
});

function setupSearch() {
    const searchInput = document.getElementById('invoiceSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allSales.filter(sale => {
            const invMatch = sale.invoiceNumber?.toLowerCase().includes(query);
            const custMatch = sale.customerName?.toLowerCase().includes(query);
            const idMatch = sale._id.slice(-6).toLowerCase().includes(query);
            return invMatch || custMatch || idMatch;
        });
        renderSalesTable(filtered);
    });
}

async function fetchSalesData() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch Sales History
        const salesRes = await fetch('/api/pharmacy/sales', { headers });
        const salesData = await salesRes.json();

        if (salesData.success) {
            allSales = salesData.data;
            renderSalesTable(allSales);
            updateSalesStats(allSales);
            updateSalesCharts(allSales);
        }

        // 2. Fetch Top Selling Medicines (for category breakdown if needed or extra insights)
        const topRes = await fetch('/api/pharmacy/reports/top-selling', { headers });
        const topData = await topRes.json();
        if (topData.success) {
            // Can be used for detailed category analysis
        }

    } catch (error) {
        console.error('Error fetching sales data:', error);
    }
}

function updateSalesCharts(sales) {
    if (!sales || sales.length === 0) return;

    // A. Sales Trend (Last 7 Days)
    const trendChart = Chart.getChart("salesTrendChart");
    if (trendChart) {
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toLocaleDateString('en-CA');
        }).reverse();

        const labels = last7Days.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        const data = last7Days.map(d => {
            return sales
                .filter(s => new Date(s.saleDate).toLocaleDateString('en-CA') === d)
                .reduce((sum, s) => sum + s.totalAmount, 0);
        });

        trendChart.data.labels = labels;
        trendChart.data.datasets[0].data = data;
        trendChart.update();
    }

    // B. Sales by Category
    const donutChart = Chart.getChart("categoryDonut");
    if (donutChart) {
        const categories = {};
        sales.forEach(sale => {
            const cat = sale.medicineId?.category || 'General';
            const normalizedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
            categories[normalizedCat] = (categories[normalizedCat] || 0) + sale.totalAmount;
        });

        donutChart.data.labels = Object.keys(categories);
        donutChart.data.datasets[0].data = Object.values(categories);
        donutChart.update();
    }
}

function renderSalesTable(sales) {
    const tbody = document.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // Clear static data

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">No transactions found</td></tr>';
        return;
    }

    sales.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate)); // Sort by saleDate desc

    sales.forEach(sale => {
        const dateObj = new Date(sale.saleDate || sale.createdAt || Date.now());
        const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = dateObj.toLocaleDateString();

        // Mocking some data if not present in API response yet
        const customerName = sale.customerName || 'Walk-in Customer';
        const paymentMethod = sale.paymentMethod || 'Cash';
        const status = 'Paid'; // Assuming all recorded sales are paid for now
        const statusColor = 'accent-green';

        const row = `
            <tr class="hover:bg-slate-800/20 transition-colors">
                <td class="px-6 py-4 text-primary-blue font-bold">${sale.invoiceNumber || '#INV-' + sale._id.slice(-6).toUpperCase()}</td>
                <td class="px-6 py-4">
                    <p class="font-bold text-white">${customerName}</p>
                    <p class="text-[10px] text-slate-500">${timeString} • ${dateString}</p>
                </td>
                <td class="px-6 py-4"><span class="px-2 py-1 bg-${statusColor}/10 text-${statusColor} rounded text-[9px] font-bold uppercase">${status}</span></td>
                <td class="px-6 py-4 text-slate-400">${paymentMethod}</td>
                <td class="px-6 py-4 font-bold text-white">RS ${sale.totalAmount.toFixed(2)}</td>
                <td class="px-6 py-4 text-right flex justify-end items-center gap-3">
                    <button onclick="printInvoiceByNumber('${sale.invoiceNumber || '#INV-' + sale._id.slice(-6).toUpperCase()}')" class="flex items-center justify-center w-8 h-8 bg-primary-blue/20 hover:bg-primary-blue text-primary-blue hover:text-white rounded-lg transition-all" title="Print Invoice">
                        <span class="material-icons-round text-base">print</span>
                    </button>
                    <div class="flex gap-1">
                        <button onclick="openReturnModal('${sale._id}', '${sale.medicineName}', ${sale.quantity})" class="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-amber-500 transition-colors" title="Return/Edit">
                            <span class="material-icons-round text-[14px]">edit</span>
                        </button>
                        <button onclick="voidSale('${sale.invoiceNumber}')" class="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-accent-rose transition-colors" title="Delete/Void Entire Invoice">
                            <span class="material-icons-round text-[14px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Invoice Printing Logic
async function printInvoiceByNumber(invoiceNumber) {
    if (!invoiceNumber) return;

    // Clean up if it was a prefixed ID
    const searchNumber = invoiceNumber.startsWith('#') ? invoiceNumber.slice(1) : invoiceNumber;

    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;

        const res = await fetch(`/api/pharmacy/sales?invoiceNumber=${encodeURIComponent(searchNumber)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            showInvoiceModal(result.data);
        } else {
            alert('Could not find invoice details');
        }
    } catch (e) {
        console.error('Error printing invoice:', e);
    }
}

function showInvoiceModal(salesBatch) {
    const modal = document.getElementById('invoiceModal');
    if (!modal || !salesBatch || salesBatch.length === 0) return;

    const mainSale = salesBatch[0];
    fetchSettingsForInvoice();

    document.getElementById('displayInvoiceNum').innerText = mainSale.invoiceNumber || 'N/A';
    document.getElementById('displayInvoiceDate').innerText = new Date(mainSale.saleDate).toLocaleString();
    document.getElementById('displaySoldBy').innerText = mainSale.soldBy || 'Pharmacy Admin';
    document.getElementById('displayPaymentMethod').innerText = mainSale.paymentMethod || 'Cash';

    const itemsContainer = document.getElementById('invoiceItems');
    itemsContainer.innerHTML = '';

    let subtotal = 0;
    salesBatch.forEach(item => {
        const itemTotal = item.totalAmount;
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

async function voidSale(invoiceNumber) {
    if (!invoiceNumber) return;
    showConfirm('Are you sure you want to void this entire invoice? This will restock all items in this transaction.', async () => {
        try {
            const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
            const res = await fetch(`/api/pharmacy/sales/invoice/${invoiceNumber}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.success) {
                showAlert('Invoice voided successfully', 'success');
                fetchSales();
            } else {
                showAlert('Failed to void invoice: ' + result.message, 'error');
            }
        } catch (e) {
            console.error('Error voiding invoice:', e);
            showAlert('Error voiding invoice', 'error');
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
    document.getElementById('returnModal').classList.add('hidden');
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
            fetchSales();
        } else {
            showAlert('Failed: ' + result.message, 'error');
        }
    } catch (e) {
        console.error('Error submitting return:', e);
        showAlert('An error occurred during submission', 'error');
    }
}

window.printInvoiceByNumber = printInvoiceByNumber;
window.closeInvoiceModal = closeInvoiceModal;
window.voidSale = voidSale;
window.openReturnModal = openReturnModal;
window.closeReturnModal = closeReturnModal;
window.submitReturn = submitReturn;

function updateSalesStats(sales) {
    // Calculate stats client-side for now
    const totalOrders = sales.length;
    const grossRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;

    // Update UI Elements (Need to add IDs to HTML first, but targeting by existing structure for now to be safe if IDs mock)
    // Actually, I should add IDs to HTML like I did for Dashboard. 
    // For now, I will assume I will add IDs to sale.html in the next step.

    const totalOrdersEl = document.getElementById('totalOrders');
    if (totalOrdersEl) totalOrdersEl.innerText = totalOrders.toLocaleString();

    const grossRevenueEl = document.getElementById('grossRevenue');
    if (grossRevenueEl) grossRevenueEl.innerText = `RS ${grossRevenue.toFixed(2)}`;

    const avgOrderValueEl = document.getElementById('avgOrderValue');
    if (avgOrderValueEl) avgOrderValueEl.innerText = `RS ${avgOrderValue.toFixed(2)}`;

    // Return Rate (Mocking based on data if no Returns model yet, but setting to a plausible 0.0% for now)
    const returnRateEl = document.getElementById('returnRate');
    if (returnRateEl) {
        // In a real system, we'd fetch returns vs sales. 
        // For now, since everything is 'Paid', we show 0.0%
        returnRateEl.innerText = '0.0%';
    }
}
