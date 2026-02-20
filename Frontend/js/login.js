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

    softwareContainer.innerHTML = `
      <div id="selected-product-${productId}" class="selected-icon">
        <i class="fa-solid ${iconClass}"></i>
      </div>
      <div>
        <span class="selected-label">Logging into</span>
        <span class="selected-name">${product.name}</span>
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

      // STRICT ADMIN SEPARATION
      if (data.data.user && data.data.user.role === 'admin') {
        Swal.fire({
          icon: 'warning',
          title: 'Administrator Access',
          text: 'Platform Administrators must use the secure Super Admin Portal. Redirecting...',
          timer: 3000,
          showConfirmButton: false
        }).then(() => {
          window.location.href = '/portal-secure-admin';
        });

        // Ensure buttons are reset but don't proceed with tenant login
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        return;
      }

      // Extract productId from response user data
      const userProductId = data.data.user ? data.data.user.productId : null;

      // PRIORITIZE: If we have a product selection from the URL, use that.
      // Otherwise fallback to what the server says about the user.
      const finalProductId = productId || userProductId;

      // Save token using standard utility
      saveAuthToken(data.data.token, finalProductId);

      // Show success message
      showSuccess('Login successful! Redirecting to Dashboard...');

      // DIRECT DASH: If we have a productId from the URL, redirect directly to that software
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
