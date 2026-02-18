const API_BASE_URL = window.location.origin + '/api';

// Centralized product metadata and landing pages
const PRODUCT_CONFIG = {
  'hospital-pms': {
    name: 'Hospital PMS',
    landingPage: '/hospital-pms',
    description: 'Complete hospital management system',
    keywords: ['hospital-pms', 'rooh', 'hms']
  },
  pharmacy: {
    name: 'Pharmacy Management',
    landingPage: '/Frontend/pharmacy/index.html',
    description: 'Comprehensive pharmacy management solution',
    keywords: ['pharmacy']
  },
  'quick-invoice': {
    name: 'Quick Invoice',
    landingPage: '/Frontend/comp/dashboard.html',
    description: 'Fast and easy invoicing',
    keywords: ['dashboard']
  },
  'asset-management': {
    name: 'Asset Management',
    landingPage: '/Frontend/comp/dashboard.html',
    description: 'Track and manage your assets',
    keywords: ['dashboard']
  },
  'ai-chatbot': {
    name: 'AI Chatbot',
    landingPage: '/Frontend/comp/dashboard.html',
    description: 'Intelligent customer support',
    keywords: ['dashboard']
  },
};

// Make it globally accessible
window.PRODUCT_CONFIG = PRODUCT_CONFIG;

// Toast Notification System
let toastContainer = null;

const initToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

const showToast = (message, type = 'info') => {
  const container = initToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

  toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Utility Functions
const showError = (message) => {
  showToast(message, 'error');
};

const showSuccess = (message) => {
  showToast(message, 'success');
};

const showInfo = (message) => {
  showToast(message, 'info');
};

// Token Management
const saveAuthToken = (token, productId) => {
  sessionStorage.setItem('authToken', token);
  sessionStorage.setItem('token', token);
  localStorage.setItem('authToken', token);
  localStorage.setItem('token', token);

  if (productId) {
    sessionStorage.setItem('productId', productId);
    localStorage.setItem('productId', productId);
  } else {
    sessionStorage.removeItem('productId');
    localStorage.removeItem('productId');
  }
};

const getAuthToken = () => {
  return sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
};

const removeAuthToken = () => {
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('productId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('productId');
};

// Check if user is authenticated
const isAuthenticated = () => {
  return !!getAuthToken();
};

// Redirect to appropriate dashboard based on product ID
const checkAuthAndRedirect = () => {
  if (isAuthenticated()) {
    let productId = sessionStorage.getItem('productId') || localStorage.getItem('productId');

    if (productId && PRODUCT_CONFIG[productId]) {
      window.location.href = PRODUCT_CONFIG[productId].landingPage;
    } else {
      // Default fallback
      window.location.href = '/Frontend/comp/dashboard.html';
    }
  }
};

// Logout function
const logout = () => {
  removeAuthToken();
  window.location.href = '/Frontend/comp/Login.html';
};

// Make authenticated API requests
const authenticatedFetch = async (url, options = {}) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No authentication token found');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  // If unauthorized, logout user
  if (response.status === 401) {
    removeAuthToken();
    window.location.href = '/Frontend/comp/Login.html';
    throw new Error('Session expired. Please login again.');
  }

  return response;
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    API_BASE_URL,
    showError,
    showSuccess,
    saveAuthToken,
    getAuthToken,
    removeAuthToken,
    isAuthenticated,
    checkAuthAndRedirect,
    logout,
    authenticatedFetch,
  };
}
