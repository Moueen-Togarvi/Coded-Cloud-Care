const API_BASE_URL = window.location.origin + '/api';

// Centralized product metadata and landing pages
const PRODUCT_CONFIG = {
  'hospital-pms': {
    name: 'Hospital PMS',
    landingPage: '/hospital-pms',
    description: 'Complete hospital management system'
  },
  'pharmacy-pos': {
    name: 'Pharmacy POS',
    landingPage: '/Frontend/pharmacy/index.html',
    description: 'Comprehensive pharmacy management solution'
  },
  'lab-reporting': {
    name: 'Lab Reporting',
    landingPage: '/Frontend/comp/in-progress.html',
    description: 'Pathology and diagnostic reporting'
  },
  'quick-invoice': {
    name: 'Quick Invoice',
    landingPage: '/Frontend/comp/in-progress.html',
    description: 'Fast and easy invoicing'
  },
  'private-clinic-lite': {
    name: 'Private Clinic Lite',
    landingPage: '/Frontend/comp/in-progress.html',
    description: 'Essential tools for private practitioners'
  }
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
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

const saveAuthToken = (token, productId) => {
  // We no longer save the token to sessionStorage for better security (XSS)
  // The server now handles the token via httpOnly cookies.

  // We keep the legacy save if needed for specific non-browser clients, 
  // but for the browser we prioritize cookies.
  if (token) {
    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('authToken_legacy', token);
  }

  sessionStorage.setItem('loginTimestamp', Date.now().toString());

  if (productId) {
    sessionStorage.setItem('productId', productId);
  } else {
    sessionStorage.removeItem('productId');
  }

  // Clear legacy localStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
};

const getAuthToken = () => {
  return sessionStorage.getItem('authToken') || sessionStorage.getItem('authToken_legacy');
};

const removeAuthToken = () => {
  sessionStorage.clear();
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('productId');
};

// Check if user is authenticated and session is still valid
const isAuthenticated = () => {
  // Since authToken is now httpOnly, we check for the loginTimestamp as a 'soft' login indicator
  const loginTimestamp = sessionStorage.getItem('loginTimestamp');
  if (!loginTimestamp) return false;

  const now = Date.now();
  const elapsed = now - parseInt(loginTimestamp);

  if (elapsed > SESSION_TIMEOUT) {
    removeAuthToken();
    return false;
  }

  return true;
};

// Helper to enforce auth on a page
const verifySession = () => {
  if (!isAuthenticated()) {
    window.location.href = '/Frontend/comp/Login.html';
  }
};

// Redirect to appropriate dashboard based on product ID
const checkAuthAndRedirect = () => {
  if (isAuthenticated()) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlProductId = urlParams.get('product');

    // If a specific product is requested in the URL, use that if valid
    if (urlProductId && PRODUCT_CONFIG[urlProductId]) {
      window.location.href = PRODUCT_CONFIG[urlProductId].landingPage;
      return;
    }

    // Otherwise use the stored productId
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
  window.location.href = '/index.html'; // Redirect to home after logout
};

// Navbar Auth UI Update
const updateNavbarUI = () => {
  const authContainer = document.getElementById('navbar-auth-ui');
  const mobileAuthContainer = document.getElementById('mobile-navbar-auth-ui');
  const bookDemoButtons = document.querySelectorAll('.btn-book-demo');

  const isAuth = isAuthenticated();
  const userName = sessionStorage.getItem('userName') || 'User';

  // Toggle Book a Demo visibility
  bookDemoButtons.forEach(btn => {
    btn.style.display = isAuth ? 'none' : '';
  });

  if (!authContainer && !mobileAuthContainer) return;

  const desktopHtml = isAuth
    ? `<div class="nav-auth-info">
         <span class="user-name">Hi, ${userName}</span>
         <button class="btn-logout" onclick="logout()">Logout</button>
       </div>`
    : `<a href="/Frontend/comp/Login.html" class="btn-nav-login">Login</a>`;

  const mobileHtml = isAuth
    ? `<div class="nav-auth-info" style="justify-content: center; margin-top: 10px;">
         <span class="user-name">Hi, ${userName}</span>
         <button class="btn-logout" onclick="logout()" style="margin-left: 10px;">Logout</button>
       </div>`
    : `<a href="/Frontend/comp/Login.html" class="btn-nav-login" style="margin-top: 10px;">Login</a>`;

  if (authContainer) authContainer.innerHTML = desktopHtml;
  if (mobileAuthContainer) mobileAuthContainer.innerHTML = mobileHtml;
};

// Run UI update on load if authContainer exists
document.addEventListener('DOMContentLoaded', updateNavbarUI);

// Attach to window for global access
window.logout = logout;
window.updateNavbarUI = updateNavbarUI;
window.isAuthenticated = isAuthenticated;
window.saveAuthToken = saveAuthToken;
window.removeAuthToken = removeAuthToken;
window.verifySession = verifySession;
window.authenticatedFetch = authenticatedFetch;

// Make authenticated API requests
const authenticatedFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If we have a legacy token in session, attach it (for transition period)
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Ensure credentials are included so the browser sends the httpOnly cookie
  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include'
  };

  const response = await fetch(url, fetchOptions);

  // If unauthorized, logout user
  if (response.status === 401) {
    removeAuthToken();
    if (!url.includes('/api/auth/session')) { // Avoid loops on background checks
      window.location.href = '/Frontend/comp/Login.html';
    }
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
    verifySession,
    logout,
    authenticatedFetch,
  };
}
