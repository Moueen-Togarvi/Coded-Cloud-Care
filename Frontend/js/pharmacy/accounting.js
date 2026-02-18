document.addEventListener('DOMContentLoaded', function () {
    fetchAccountingData();
});

async function fetchAccountingData() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };

        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // 1. Monthly Financial Summary
        const summaryRes = await fetch(`/api/accounting/reports/monthly/${year}/${month}`, { headers });
        const summaryData = await summaryRes.json();
        if (summaryData.success) {
            updateFinancialCards(summaryData.summary);
        }

        // 2. Revenue vs Expenses (Chart)
        // Defaulting to last 30 days for fresh summary
        const chartRes = await fetch('/api/accounting/analytics/revenue-vs-expenses', { headers });
        const chartData = await chartRes.json();
        if (chartData.success) {
            updateCashFlowChart(chartData.data);
        }

        // Let's also fetch ledger from real expenses
        const ledgerRes = await fetch('/api/accounting/expenses?limit=10', { headers });
        const ledgerData = await ledgerRes.json();
        if (ledgerData.success) {
            renderLedgerTable(ledgerData.data);
        }

        // 5. Dynamic Page Date
        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            dateDisplay.innerText = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }

    } catch (error) {
        console.error('Error fetching accounting data:', error);
    }
}

async function showAddExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Set default date to today
        const dateInput = document.getElementById('expenseDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
    }
}

function closeExpenseModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('expenseForm')?.reset();
    }
}

// Add event listener for form submission
document.addEventListener('DOMContentLoaded', function () {
    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleExpenseSubmit);
    }
});

async function handleExpenseSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const description = formData.get('description');
    const amount = parseFloat(formData.get('amount'));
    const category = formData.get('category');
    const date = formData.get('date');

    await createExpense(description, amount, category, date);
}

async function createExpense(description, amount, category, date) {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const res = await fetch('/api/accounting/expenses', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                description,
                amount,
                category: category.toLowerCase(),
                date: date || new Date(),
                paymentMethod: 'cash'
            })
        });

        const result = await response.json();
        if (result.success) {
            showAlert('Expense added successfully!', 'success');
            closeExpenseModal();
            fetchAccountingData();
        } else {
            showAlert('Failed: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Error creating expense:', error);
        showAlert('An error occurred', 'error');
    }
}

function updateFinancialCards(data) {
    if (!data) return;
    const { totalRevenue, totalExpenses, netProfit } = data;

    const incEl = document.getElementById('totalIncome');
    if (incEl) incEl.innerText = `$${totalRevenue?.toFixed(2) || '0.00'}`;

    const expEl = document.getElementById('totalExpenses');
    if (expEl) expEl.innerText = `$${totalExpenses?.toFixed(2) || '0.00'}`;

    const profitEl = document.getElementById('netProfit');
    if (profitEl) profitEl.innerText = `$${netProfit?.toFixed(2) || '0.00'}`;

    const balanceEl = document.getElementById('totalBalance');
    if (balanceEl) balanceEl.innerText = `$${(totalRevenue - totalExpenses)?.toFixed(2) || '0.00'}`;
}

function updateCashFlowChart(data) {
    const chart = Chart.getChart("cashFlowChart");
    if (!chart || !data) return;

    chart.data.labels = data.labels || [];
    chart.data.datasets[0].data = data.income || [];
    chart.data.datasets[1].data = data.expenses || [];
    chart.update();
}

function updateExpenseBreakdown(categories) {
    const container = document.getElementById('expenseBreakdown');
    if (!container) return;

    if (!categories || Object.keys(categories).length === 0) {
        container.innerHTML = '<div class="text-center text-slate-500 text-xs py-10">No expense data</div>';
        return;
    }

    container.innerHTML = '';
    const icons = {
        'salary': 'people',
        'rent': 'home',
        'utilities': 'electric_bolt',
        'inventory': 'inventory_2',
        'other': 'payments'
    };

    Object.entries(categories).forEach(([cat, amount]) => {
        const icon = icons[cat.toLowerCase()] || 'payments';
        const item = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-slate-800 rounded flex items-center justify-center">
                        <span class="material-icons-round text-slate-400 text-sm">${icon}</span>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-white uppercase">${cat}</p>
                        <p class="text-[10px] text-slate-500">Monthly Spending</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-white">$${amount.toFixed(2)}</p>
                    <p class="text-[9px] text-accent-rose">Outbound</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', item);
    });
}

function renderLedgerTable(expenses) {
    const tbody = document.getElementById('ledgerTable');
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">No recent transactions</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    expenses.forEach(exp => {
        const row = `
            <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="px-6 py-4 text-slate-400">${new Date(exp.date).toLocaleDateString()}</td>
                <td class="px-6 py-4">
                    <p class="font-bold text-white">${exp.description}</p>
                    <p class="text-[10px] text-slate-500">No: ${exp.expenseNumber}</p>
                </td>
                <td class="px-6 py-4"><span class="text-[9px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold uppercase">${exp.category}</span></td>
                <td class="px-6 py-4"><span class="text-accent-rose font-bold text-[10px]">DEBIT</span></td>
                <td class="px-6 py-4 font-bold text-white">$${exp.amount.toFixed(2)}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full bg-accent-green/10 text-accent-green text-[9px] font-bold uppercase">${exp.status}</span>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}
