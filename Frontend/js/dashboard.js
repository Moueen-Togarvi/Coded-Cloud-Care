// Dashboard initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  if (!isAuthenticated()) {
    window.location.href = '/Frontend/comp/Login.html';
    return;
  }

  // Load user profile and subscriptions
  await loadDashboardData();

  // Setup logout
  setupLogoutButton();
});

// Load user profile and their subscriptions
async function loadDashboardData() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/profile`);
    const data = await response.json();

    if (data.success && data.data) {
      const { user, subscriptions } = data.data;

      // Display user info
      displayUserInfo(user);

      // Display products and subscriptions
      displayProducts(subscriptions || []);
    } else {
      throw new Error(data.message || 'Failed to load profile');
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('Failed to load dashboard data. Please login again.');
  }
}

// Display user information in the UI
function displayUserInfo(user) {
  const name = user.companyName || user.email;
  sessionStorage.setItem('userName', name);

  // Refresh standard navbar UI
  if (window.updateNavbarUI) {
    window.updateNavbarUI();
  }
}

// Render the product grid with subscription status
function displayProducts(userSubscriptions) {
  const container = document.getElementById('products-grid');
  if (!container) return;

  // Define our 5 products
  const allProducts = [
    {
      id: 'hospital-pms',
      name: 'Hospital Management',
      description: 'Complete OPD, IPD, Billing, and Patient Management.',
      icon: 'fa-hospital',
      color: '#4f46e5'
    },
    {
      id: 'pharmacy-pos',
      name: 'Pharmacy POS',
      description: 'Stock, Sales, Expiry Tracking, and Daily Reports.',
      icon: 'fa-pills',
      color: '#10b981'
    },
    {
      id: 'lab-reporting',
      name: 'Lab Reporting',
      description: 'Automated Lab Tests and Patient Report Generation.',
      icon: 'fa-flask',
      color: '#f59e0b',
      comingSoon: true
    },
    {
      id: 'quick-invoice',
      name: 'Quick Invoice',
      description: 'Instant Billing and GST Invoicing for shops.',
      icon: 'fa-file-invoice-dollar',
      color: '#ec4899',
      comingSoon: true
    },
    {
      id: 'private-clinic-lite',
      name: 'Private Clinic Lite',
      description: 'Lightweight EMR for individual doctors.',
      icon: 'fa-user-md',
      color: '#8b5cf6',
      comingSoon: true
    }
  ];

  container.innerHTML = '';

  allProducts.forEach(product => {
    // Find if user has a subscription for this product
    const sub = userSubscriptions.find(s => s.productSlug === product.id);

    const card = document.createElement('div');
    card.className = 'col-md-4 mb-4';

    let statusHtml = '';
    let actionBtnHtml = '';

    if (product.comingSoon) {
      statusHtml = '<span class="badge bg-secondary">Coming Soon</span>';
      actionBtnHtml = '<button class="btn btn-outline-secondary w-100 disabled">Notify Me</button>';
    } else if (sub && sub.isAccessible) {
      const typeLabel = sub.planType === 'trial' ? 'Trial' : 'Active';
      const badgeClass = sub.planType === 'trial' ? 'bg-warning text-dark' : 'bg-success';
      statusHtml = `<span class="badge ${badgeClass}">${typeLabel}</span>`;

      const landingPage = window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[product.id]
        ? window.PRODUCT_CONFIG[product.id].landingPage
        : `/Frontend/${product.id.split('-')[0]}/index.html`;

      actionBtnHtml = `<button onclick="openProduct('${product.id}', '${landingPage}')" class="btn btn-primary w-100">Open Software</button>`;
    } else if (sub && !sub.isAccessible) {
      statusHtml = '<span class="badge bg-danger">Expired</span>';
      actionBtnHtml = '<button onclick="upgradePrompt()" class="btn btn-outline-danger w-100">Renew Subscription</button>';
    } else {
      statusHtml = '<span class="badge bg-light text-dark">Not Started</span>';
      actionBtnHtml = `<button onclick="startTrial('${product.id}')" class="btn btn-outline-primary w-100">Start 3-Day Free Trial</button>`;
    }

    card.innerHTML = `
      <div class="card h-100 border-0 shadow-sm" style="border-radius: 16px; overflow: hidden; transition: transform 0.2s;">
        <div class="card-body p-4">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div class="p-3 rounded-4" style="background: ${product.color}20; color: ${product.color}">
              <i class="fa-solid ${product.icon} fa-2x"></i>
            </div>
            ${statusHtml}
          </div>
          <h5 class="card-title fw-bold">${product.name}</h5>
          <p class="card-text text-muted small mb-4">${product.description}</p>
          ${actionBtnHtml}
        </div>
      </div>
    `;

    // Add hover effect
    card.querySelector('.card').addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-5px)';
    });
    card.querySelector('.card').addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0)';
    });

    container.appendChild(card);
  });
}

// Function to start a new trial
async function startTrial(productSlug) {
  if (!confirm(`Do you want to start your 3-day free trial for ${productSlug}?`)) return;

  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/subscriptions/trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productSlug })
    });

    const data = await response.json();
    if (data.success) {
      showSuccess(data.message);
      await loadDashboardData(); // Refresh grid
    } else {
      showError(data.message || 'Failed to start trial');
    }
  } catch (error) {
    showError('Error starting trial');
  }
}

// Function to open product and set session
function openProduct(productSlug, landingPage) {
  sessionStorage.setItem('productId', productSlug);
  window.location.href = landingPage;
}

function upgradePrompt() {
  alert('Subscription payments are currently being integrated. Please contact support to upgrade manually@cloudcare.com');
}

// Logout button handler
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        logout();
      }
    };
  }
}
