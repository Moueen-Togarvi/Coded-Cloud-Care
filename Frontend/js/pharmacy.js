// Pharmacy Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on the dashboard page
  if (document.getElementById('pharmacy')) {
    // Initial load if pharmacy tab is active (though usually it's hidden on load)
    if (document.getElementById('pharmacy').classList.contains('active')) {
      loadInventory();
    }

    // Add event listener for tab switching to load data when tab becomes active
    const pharmacyNav = document.getElementById('nav-pharmacy');
    if (pharmacyNav) {
      pharmacyNav.addEventListener('click', loadInventory);
    }
  }
});

/**
 * Load inventory items from API
 */
async function loadInventory() {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading inventory...</td></tr>';

  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacy/inventory`);
    const data = await response.json();

    if (data.success) {
      displayInventory(data.data);
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load inventory: ${data.message}</td></tr>`;
    }
  } catch (error) {
    console.error('Error loading inventory:', error);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading inventory</td></tr>`;
  }
}

/**
 * Display inventory items in table
 */
function displayInventory(items) {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

  if (items.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="6" class="text-center">No items found. Add your first item!</td></tr>';
    return;
  }

  tableBody.innerHTML = items
    .map(
      (item) => `
        <tr>
            <td>
                <div class="fw-bold">${item.name}</div>
                ${item.description ? `<small class="text-muted">${item.description}</small>` : ''}
            </td>
            <td>${item.sku || '-'}</td>
            <td>
                <span class="badge ${item.quantity <= (item.lowStockThreshold || 10) ? 'bg-danger' : 'bg-success'}">
                    ${item.quantity}
                </span>
            </td>
            <td>PKR ${item.unitPrice.toLocaleString()}</td>
            <td>${item.supplier || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editItem('${item._id}')">
                    <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteItem('${item._id}')">
                    <i data-lucide="trash" style="width: 14px; height: 14px;"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join('');

  // Re-initialize icons for new content
  if (window.lucide) lucide.createIcons();
}

/**
 * Show Add Item Modal
 */
function showAddItemModal() {
  const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
  document.getElementById('addItemForm').reset();
  modal.show();
}

/**
 * Submit Add Item Form
 */
async function submitAddItem() {
  const form = document.getElementById('addItemForm');
  const formData = new FormData(form);
  const itemData = Object.fromEntries(formData.entries());

  // Convert number fields
  itemData.quantity = parseInt(itemData.quantity);
  itemData.unitPrice = parseFloat(itemData.unitPrice);

  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/pharmacy/inventory`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    });

    const data = await response.json();

    if (data.success) {
      // Close modal
      const modalEl = document.getElementById('addItemModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();

      showSuccess('Item added successfully');
      loadInventory(); // Refresh table
    } else {
      showError(data.message || 'Failed to add item');
    }
  } catch (error) {
    console.error('Error adding item:', error);
    showError('An error occurred while adding the item');
  }
}

/**
 * Delete Item
 */
async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;

  try {
    const response = await authenticatedFetch(`/pharmacy/inventory/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.success) {
      showSuccess('Item deleted successfully');
      loadInventory();
    } else {
      showError(data.message || 'Failed to delete item');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    showError('An error occurred while deleting the item');
  }
}

// Placeholder for edit (full implementation would require another modal)
function editItem(id) {
  alert('Edit functionality coming soon! ID: ' + id);
}
