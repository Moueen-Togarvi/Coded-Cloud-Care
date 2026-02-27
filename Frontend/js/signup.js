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
  let selectedPlan = 'subscription'; // default
  let displayPlanName = planName;
  let displayPrice = price;

  // Find product info from config if available
  const productData = (productId && typeof pricingData !== 'undefined')
    ? pricingData.find(p => p.id === productId)
    : null;

  if (productId && productData) {
    // If planName or price is missing, derive it from config
    const tier = tierParam || 'monthly';
    if (productData.pricing && productData.pricing[tier]) {
      if (!displayPlanName || displayPlanName === 'Basic Plan') {
        displayPlanName = productData.pricing[tier].label || (tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan');
      }
      if (!displayPrice) {
        displayPrice = productData.pricing[tier].price;
      }
    }
  }

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
  displaySelectedPlan(softwareName, displayPlanName, displayPrice);

  const signupForm = document.querySelector('form');
  const submitButton = signupForm.querySelector('.btn-login');

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form inputs by ID
    const companyName = document.getElementById('companyName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const termsChecked = document.getElementById('terms').checked;

    // Validation
    if (!companyName || !email || !password || !phone) {
      showError('Please fill in all fields (including phone number)');
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
          phone,
          termsAccepted: termsChecked,
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

      if (data.data && data.data.token) {
        saveAuthToken(data.data.token, productId);

        // Save user name for navbar
        if (data.data.user && data.data.user.companyName) {
          sessionStorage.setItem('userName', data.data.user.companyName);
        } else if (data.data.user && data.data.user.email) {
          sessionStorage.setItem('userName', data.data.user.email.split('@')[0]);
        }
      }

      // ── POST-REGISTRATION ROUTING BASED ON PLAN TYPE ────────────────────
      // Determine what the user signed up for from URL params
      const isTrialPlan = (planParam === 'trial' || tierParam === 'free');
      const isPaidPlan = !isTrialPlan && (tierParam === 'monthly' || tierParam === 'yearly');

      if (isPaidPlan && productId && data.data && data.data.token) {
        // PAID PLAN: User registered → now they're logged in → trigger PayFast checkout
        showSuccess('Account created! Initiating payment checkout…');

        // Give the token time to save, then load payfast-checkout.js and initiate
        try {
          // Save the pending intent so it survives any reload scenario
          sessionStorage.setItem('pf_pending_payment', JSON.stringify({
            productSlug: productId,
            tierKey: tierParam || 'monthly',
            savedAt: Date.now()
          }));
          sessionStorage.setItem('pf_auto_resume', '1');

          // Redirect to the matching pricing page with resume=payment so PayFast auto-fires
          setTimeout(() => {
            window.location.href = `./product-pricing.html?product=${productId}&resume=payment`;
          }, 1500);
        } catch (_) {
          // Fallback: just go to pricing page so user can click subscribe again
          window.location.href = `./product-pricing.html?product=${productId}`;
        }
        return;
      }

      // ── FREE TRIAL: activate it via API ─────────────────────────────────
      if (isTrialPlan && productId && data.data && data.data.token) {
        try {
          const trialResp = await fetch(`${API_BASE_URL}/subscriptions/trial`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.data.token}`,
            },
            body: JSON.stringify({ productSlug: productId }),
          });
          if (trialResp.ok) {
            showSuccess('🎉 Account created & 3-day free trial started! Redirecting…');
          } else {
            showSuccess('Account created successfully! Redirecting…');
          }
        } catch (_) {
          showSuccess('Account created successfully! Redirecting…');
        }
      } else {
        showSuccess('Account created successfully! Redirecting…');
      }

      // ── Redirect to product dashboard (for trial / no product) ─────────
      setTimeout(() => {
        if (productId && window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productId]) {
          const landingPage = window.PRODUCT_CONFIG[productId].landingPage;
          window.location.href = landingPage;
        } else {
          window.location.href = '/Frontend/comp/dashboard.html';
        }
      }, 1500);

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
    const isFree = !price || price === '0' || planName.toLowerCase().includes('free') || planName.toLowerCase().includes('trial');
    const badgeColor = isFree ? '#10B981' : '#4F46E5';
    const bgColor = isFree ? '#ECFDF5' : '#EEF2FF';

    planInfoElement.innerHTML = `
      <div style="background: ${bgColor}; border: 2px solid ${badgeColor}; border-radius: 12px; padding: 15px; margin-bottom: 20px; text-align: center;">
        <i class="fa-solid fa-check-circle" style="color: ${badgeColor}; font-size: 20px;"></i>
        <p style="margin: 8px 0 0 0; color: #374151; font-weight: 600;">Subscribing to: <strong style="color: ${badgeColor};">${softwareName}</strong></p>
        <p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">Plan: <strong style="color: ${badgeColor}; text-transform: uppercase;">${planName}</strong></p>
        ${!isFree ? `<p style="margin: 5px 0 0 0; color: #6B7280; font-size: 14px;">Price: <strong style="color: ${badgeColor};">PKR ${price}</strong></p>` : `<p style="margin: 5px 0 0 0; color: #10B981; font-weight: 700;">Enjoy your 3-Day Free Trial! 🚀</p>`}
      </div>
    `;
    planInfoElement.style.display = 'block';
  }
}
