// Login Form Handler
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  checkAuthAndRedirect();

  // Show selected software if product param exists
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  const softwareContainer = document.getElementById('selected-software-container');

  if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId] && softwareContainer) {
    const product = window.PRODUCT_CONFIG[productId];

    // Icon mapping based on product
    const icons = {
      'hospital-pms': 'fa-hospital',
      'pharmacy-pos': 'fa-pills',
      'lab-reporting': 'fa-flask',
      'quick-invoice': 'fa-file-invoice-dollar',
      'private-clinic-lite': 'fa-user-md'
    };

    const iconClass = icons[productId] || 'fa-cubes';

    const tier = urlParams.get('tier');
    const tierLabel = tier === 'free' ? 'Free Trial' : (tier ? (tier.charAt(0).toUpperCase() + tier.slice(1)) : '');

    softwareContainer.innerHTML = `
      <div id="selected-product-${productId}" class="selected-icon">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div>
        <span class="selected-label">Logging into</span>
        <span class="selected-name">${product.name}${tierLabel ? ` (${tierLabel} Plan)` : ''}</span>
      </div>
    `;
    softwareContainer.style.display = 'flex';
  }

  const loginForm = document.querySelector('form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitButton = loginForm.querySelector('.btn-login');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Basic validation
    if (!email || !password) {
      showError('Please fill in all fields');
      return;
    }

    // Disable button and show loading state
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Signing In...';
    submitButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          productId: productId // Send the productId we're trying to log into
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Extract productId from response user data
      const userProductId = data.data.user ? data.data.user.productId : null;

      // PRIORITIZE: If we have a product selection from the URL, use that.
      // Otherwise fallback to what the server says about the user.
      const finalProductId = productId || userProductId;

      // Save token using standard utility
      saveAuthToken(data.data.token, finalProductId);

      // Save user name for navbar
      if (data.data.user && data.data.user.companyName) {
        sessionStorage.setItem('userName', data.data.user.companyName);
      } else if (data.data.user && data.data.user.email) {
        sessionStorage.setItem('userName', data.data.user.email.split('@')[0]);
      }

      // Show success message
      showSuccess('Login successful! Redirecting…');

      // ── Check for a pending PayFast payment intent (saved before login redirect) ──
      const pendingPayment = sessionStorage.getItem('pf_pending_payment');
      const tierParam = urlParams.get('tier'); // e.g. 'monthly' or 'yearly'

      // ── Case 1: Resume a payment intent that was saved BEFORE login ──────
      if (pendingPayment) {
        try {
          const intent = JSON.parse(pendingPayment);
          // Only resume if it's a paid plan and intent is fresh (< 30 min)
          if (
            intent.productSlug &&
            (intent.tierKey === 'monthly' || intent.tierKey === 'yearly') &&
            Date.now() - intent.savedAt < 30 * 60 * 1000
          ) {
            showSuccess('Resuming your payment… Redirecting to GoPayFast checkout.');
            sessionStorage.setItem('pf_auto_resume', '1');
            setTimeout(() => {
              window.location.href = `./pricing-${intent.productSlug}.html?resume=payment`;
            }, 1500);
            return;
          }
        } catch (_) { /* ignore corrupt intent */ }
        sessionStorage.removeItem('pf_pending_payment');
      }

      // ── Case 2: Login URL has tier=monthly/yearly directly ───────────────
      // e.g. user visits Login.html?product=hospital-pms&tier=monthly
      if (productId && (tierParam === 'monthly' || tierParam === 'yearly')) {
        showSuccess('Login successful! Starting payment checkout…');
        sessionStorage.setItem('pf_pending_payment', JSON.stringify({
          productSlug: productId,
          tierKey: tierParam,
          savedAt: Date.now()
        }));
        sessionStorage.setItem('pf_auto_resume', '1');
        setTimeout(() => {
          window.location.href = `./pricing-${productId}.html?resume=payment`;
        }, 1500);
        return;
      }

      // ── Case 3: Normal redirect — go to product dashboard ────────────────
      if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId]) {
        const landingPage = window.PRODUCT_CONFIG[productId].landingPage;
        sessionStorage.setItem('productId', productId);
        window.location.href = landingPage;
      } else {
        // Fallback to central dashboard
        window.location.href = '/Frontend/comp/dashboard.html';
      }

    } catch (error) {
      console.error('Login error:', error);
      showError(error.message || 'Login failed. Please try again.');

      // Re-enable button
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });

  // Optional: Add enter key handler for password field
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
});
