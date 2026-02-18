// Accounting Dashboard Logic

let currentAccountingView = 'invoices';
let patientsList = [];

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on the dashboard page
  if (document.getElementById('accounting')) {
    // Add event listener for tab switching to load data when tab becomes active
    const accountingNav = document.getElementById('nav-accounting');
    if (accountingNav) {
      accountingNav.addEventListener('click', () => {
        if (currentAccountingView === 'invoices') loadInvoices();
        else loadExpenses();

        // Pre-fetch patients for invoice creation
        loadPatientsList();
      });
    }
  }
});

function switchAccountingTab(view) {
  currentAccountingView = view;

  // Update Nav
  document
    .querySelectorAll('#accounting .nav-link')
    .forEach((link) => link.classList.remove('active'));
  document.getElementById('tab-' + view).classList.add('active');

  // Update View
  document.getElementById('invoices-view').style.display = view === 'invoices' ? 'block' : 'none';
  document.getElementById('expenses-view').style.display = view === 'expenses' ? 'block' : 'none';

  // Load Data
  if (view === 'invoices') loadInvoices();
  else loadExpenses();
}

/**
 * Load Invoices
 */
async function loadInvoices() {
  const tableBody = document.getElementById('invoicesTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading invoices...</td></tr>';

  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounting/invoices`);
    const data = await response.json();

    if (data.success) {
      displayInvoices(data.data);
    } else {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load invoices: ${data.message}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading invoices:', error);
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading invoices</td></tr>`;
  }
}

function displayInvoices(invoices) {
  const tableBody = document.getElementById('invoicesTableBody');
  if (!tableBody) return;

  if (invoices.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">No invoices found. Create your first invoice!</td></tr>';
    return;
  }

  tableBody.innerHTML = invoices
    .map((invoice) => {
      const patientName = invoice.patientId
        ? `${invoice.patientId.firstName} ${invoice.patientId.lastName}`
        : 'Unknown Patient';
      const date = new Date(invoice.createdAt).toLocaleDateString();

      let statusBadge = 'bg-secondary';
      if (invoice.status === 'paid') statusBadge = 'bg-success';
      else if (invoice.status === 'partially_paid') statusBadge = 'bg-warning';
      else if (invoice.status === 'overdue') statusBadge = 'bg-danger';

      return `
            <tr>
                <td>${date}</td>
                <td>
                    <div class="fw-bold">${patientName}</div>
                    ${invoice.patientId ? `<small class="text-muted">${invoice.patientId.email || ''}</small>` : ''}
                </td>
                <td>PKR ${invoice.totalAmount.toLocaleString()}</td>
                <td><span class="badge ${statusBadge}">${invoice.status.replace('_', ' ').toUpperCase()}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewInvoice('${invoice._id}')">
                        <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
                    </button>
                </td>
            </tr>
        `;
    })
    .join('');

  if (window.lucide) lucide.createIcons();
}

/**
 * Load Expenses
 */
async function loadExpenses() {
  const tableBody = document.getElementById('expensesTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading expenses...</td></tr>';

  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounting/expenses`);
    const data = await response.json();

    if (data.success) {
      displayExpenses(data.data);
    } else {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load expenses: ${data.message}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading expenses:', error);
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading expenses</td></tr>`;
  }
}

function displayExpenses(expenses) {
  const tableBody = document.getElementById('expensesTableBody');
  if (!tableBody) return;

  if (expenses.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No expenses recorded.</td></tr>';
    return;
  }

  tableBody.innerHTML = expenses
    .map(
      (expense) => `
        <tr>
            <td>${new Date(expense.date).toLocaleDateString()}</td>
            <td>${expense.description}</td>
            <td><span class="badge bg-light text-dark border">${expense.category.toUpperCase()}</span></td>
            <td class="text-danger fw-bold">- PKR ${expense.amount.toLocaleString()}</td>
            <td>${expense.paymentMethod || '-'}</td>
        </tr>
    `
    )
    .join('');
}

/**
 * Helpers
 */
async function loadPatientsList() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/patients`);
    const data = await response.json();
    if (data.success) {
      patientsList = data.data;
    }
  } catch (error) {
    console.error('Failed to load patients for dropdown:', error);
  }
}

function showCreateInvoiceModal() {
  // In a real app, this would open a formatted modal with patient select and item rows
  // For this prototype, we'll use a prompt flow to demonstrate capability

  if (patientsList.length === 0) {
    alert('Please add patients before creating an invoice.');
    return;
  }

  // Simple mock flow for demonstration
  const patientName = prompt(
    'Select Patient (Enter ID or Name for demo, usually a dropdown):',
    patientsList[0].firstName
  );
  if (!patientName) return;

  const amount = prompt('Total Amount:', '1500');
  if (!amount) return;

  createInvoiceShim(patientsList[0]._id, parseFloat(amount));
}

async function createInvoiceShim(patientId, totalAmount) {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounting/invoices`, {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        items: [{ description: 'Medical Services', amount: totalAmount, quantity: 1 }],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    });

    const data = await response.json();
    if (data.success) {
      showSuccess('Invoice created successfully');
      loadInvoices();
    } else {
      showError(data.message);
    }
  } catch (error) {
    showError('Error creating invoice');
  }
}

function showAddExpenseModal() {
  const desc = prompt('Expense Description:', 'Office Supplies');
  if (!desc) return;

  const amount = prompt('Amount:', '500');
  if (!amount) return;

  createExpenseShim(desc, parseFloat(amount));
}

async function createExpenseShim(description, amount) {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/accounting/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        description,
        amount,
        category: 'supplies',
        paymentMethod: 'cash',
      }),
    });

    const data = await response.json();
    if (data.success) {
      showSuccess('Expense recorded');
      if (currentAccountingView === 'expenses') loadExpenses();
    } else {
      showError(data.message);
    }
  } catch (error) {
    showError('Error creating expense');
  }
}

function viewInvoice(id) {
  alert('View Invoice ' + id);
}
