// Signup Form Handler
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  checkAuthAndRedirect();

  // Get plan info from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');
  const tierParam = urlParams.get('tier');
  const planName = urlParams.get('planName') || 'Basic Plan';
  const price = urlParams.get('price');
  const productId = urlParams.get('product'); // Don't default to hospital-pms here

  // Check for existing session and redirect if valid
  const token = sessionStorage.getItem('authToken');
  // Note: productId is already defined above, so we don't redeclare it here.

  // If user is already logged in with a valid session, redirect
  if (token && sessionStorage.getItem('loginTimestamp')) {
    const now = Date.now();
    const loginTimestamp = parseInt(sessionStorage.getItem('loginTimestamp'));
    // Check if session is less than 1 minute old (for quick redirect after login)
    if (now - loginTimestamp < 60000) {
      if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId]) {
        window.location.href = window.PRODUCT_CONFIG[productId].landingPage;
        return;
      }
    } else {
      // If session is older than 1 minute, clear it (it's handled by checkAuthAndRedirect for longer sessions)
      sessionStorage.clear();
    }
  }

  // Extract and use software name from global config
  const softwareName = (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId])
    ? window.PRODUCT_CONFIG[productId].name
    : 'Select Software';

  // Map pricing page parameters to backend plan types
  // Valid plan types: 'subscription', 'one-time', 'white-label', 'basic'
  let selectedPlan = 'subscription'; // default

  if (planParam === 'basic') {
    selectedPlan = 'basic';
  } else if (tierParam === 'outright' || tierParam === 'lifetime' || planParam === 'one-time') {
    selectedPlan = 'one-time';
  } else if (planParam === 'white-label' || planParam === 'whitelabel') {
    selectedPlan = 'white-label';
  } else if (tierParam === 'monthly' || tierParam === 'yearly' || planParam === 'subscription') {
    selectedPlan = 'subscription';
  }

  // Display selected plan if provided
  displaySelectedPlan(softwareName, planName, price);

  const signupForm = document.querySelector('form');
  const submitButton = signupForm.querySelector('.btn-login');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form inputs by ID
    const companyName = document.getElementById('companyName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const termsChecked = document.getElementById('terms').checked;

    // Validation
    if (!companyName || !email || !password) {
      showError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      showError('Password must be at least 8 characters long');
      return;
    }

    if (!termsChecked) {
      showError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please enter a valid email address');
      return;
    }

    // Disable button and show loading state
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Creating Account...';
    submitButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          companyName,
          planType: selectedPlan,
          productId: productId, // Use the extracted productId variable
        }),
      });

      // Try to parse JSON, but handle cases where response isn't JSON
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, treat as text error
        const text = await response.text();
        throw new Error(text || `Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      const token = data.data ? data.data.token : null;

      // Save token if returned
      if (data.data && data.data.token) {
        saveAuthToken(data.data.token, productId);
      }

      // Show success message
      showSuccess('Account created successfully! Redirecting to Dashboard...');

      // DIRECT DASH: If we have a productId from the URL, redirect directly to that software
      if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId]) {
        const landingPage = window.PRODUCT_CONFIG[productId].landingPage;
        // The landing page logic (auth-check.js) will handle the redirect to settings.html
        window.location.href = landingPage;
      } else {
        // Fallback to central dashboard
        window.location.href = '/Frontend/comp/dashboard.html';
      }
    } catch (error) {
      console.error('Signup error:', error);
      showError(error.message || 'Registration failed. Please try again.');

      // Re-enable button
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });
});

// Display selected plan information
function displaySelectedPlan(softwareName, planName, price) {
  const planInfoElement = document.getElementById('selectedPlanInfo');
  if (planInfoElement) {
    planInfoElement.innerHTML = `
      <div style="background: #EEF2FF; border: 2px solid #4F46E5; border-radius: 12px; padding: 15px; margin-bottom: 20px; text-align: center;">
        <i class="fa-solid fa-check-circle" style="color: #4F46E5; font-size: 20px;"></i>
        <p style="margin: 8px 0 0 0; color: #374151; font-weight: 600;">Subscribing to: <strong style="color: #4F46E5;">${softwareName}</strong></p>
        <p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">Plan: <strong>${planName}</strong></p>
        ${price ? `<p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">Price: <strong style="color: #4F46E5;">PKR ${price}</strong></p>` : ''}
      </div>
    `;
    planInfoElement.style.display = 'block';
  }
}
