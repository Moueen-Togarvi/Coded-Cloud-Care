// Immediate Aggressive Redirection Check (Runs before DOM is fully loaded)
(function () {
  const checkRedirection = () => {
    if (!isAuthenticated()) {
      window.location.href = '/Frontend/comp/Login.html';
      return true;
    }

    const productId = sessionStorage.getItem('productId') || localStorage.getItem('productId');
    const currentPath = window.location.pathname;

    // Use the central config for checks
    if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId]) {
      const config = window.PRODUCT_CONFIG[productId];
      const isCorrectProduct = config.keywords.some(keyword =>
        currentPath.toLowerCase().includes(keyword.toLowerCase())
      );

      // If they are on a page that doesn't match their product keywords, redirect them
      if (!isCorrectProduct) {
        console.warn(`Unauthorized access. Redirecting ${productId} to ${config.landingPage}`);
        window.location.href = config.landingPage;
        return true;
      }
    }
    return false;
  };

  // Run check immediately
  if (checkRedirection()) return;

  // Add a listener as a backup for dynamic path changes
  window.addEventListener('load', checkRedirection);
})();

// Dashboard initialization
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth again as part of standard profile loading
  if (!isAuthenticated()) return;

  // Load user profile
  await loadUserProfile();
});

// Load and display user profile
async function loadUserProfile() {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/profile`);
    const data = await response.json();

    if (data.success && data.data) {
      const user = data.data.user;

      // Ensure local productId matches what's in the profile
      if (user.productId) {
        sessionStorage.setItem('productId', user.productId);
        localStorage.setItem('productId', user.productId);
      }

      displayUserInfo(user);
    } else {
      throw new Error(data.message || 'Failed to load profile');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showError('Failed to load user profile');
  }
}

// Display user information in the UI
function displayUserInfo(user) {
  // Update names
  const userNameElement = document.getElementById('userName');
  if (userNameElement) userNameElement.textContent = user.companyName || user.email;

  const userNameSmallElement = document.getElementById('userNameSmall');
  if (userNameSmallElement) userNameSmallElement.textContent = user.companyName || 'User';

  const userInitialElement = document.getElementById('userInitial');
  if (userInitialElement) userInitialElement.textContent = (user.companyName || 'U').charAt(0).toUpperCase();

  // Update email
  const userEmailElement = document.getElementById('userEmail');
  if (userEmailElement) userEmailElement.textContent = user.email;

  // Update software info
  const softwareNameElement = document.getElementById('softwareName');
  const softwareNameFullElement = document.getElementById('softwareNameFull');
  if (softwareNameElement) softwareNameElement.textContent = user.productId || 'None';
  if (softwareNameFullElement) softwareNameFullElement.textContent = user.productId || 'Software';

  const tenantDbNameElement = document.getElementById('tenantDbName');
  if (tenantDbNameElement) tenantDbNameElement.textContent = user.tenantDbName || 'Not Provisioned';

  // Update subscription info
  const subStatusTextElement = document.getElementById('subStatusText');
  const trialEndDateTextElement = document.getElementById('trialEndDateText');
  const subscriptionBadgeElement = document.getElementById('subscriptionBadge');

  if (subStatusTextElement) {
    subStatusTextElement.textContent = user.subscriptionStatus.toUpperCase();
  }

  if (trialEndDateTextElement && user.trialEndDate) {
    const end = new Date(user.trialEndDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      trialEndDateTextElement.textContent = `Ends in ${diffDays} days`;
    } else {
      trialEndDateTextElement.textContent = 'Expired';
      trialEndDateTextElement.style.color = '#ef4444';
    }
  }

  if (subscriptionBadgeElement) {
    if (user.subscriptionStatus === 'trial') {
      subscriptionBadgeElement.innerHTML = '<span class="badge-trial">Free Trial</span>';
    } else {
      subscriptionBadgeElement.innerHTML = '<span class="badge-active">Active</span>';
    }
  }

  console.log('User profile loaded:', user);
}

// Logout button handler
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        logout();
      }
    });
  }
}

// Initialize logout button when DOM is ready
document.addEventListener('DOMContentLoaded', setupLogoutButton);
