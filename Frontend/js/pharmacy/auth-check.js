/**
 * Pharmacy Module Authentication & Onboarding Guard
 * Redirects to the main portal login if unauthenticated.
 * Redirects to setup page if onboarding is not complete.
 */
(function () {
    const API_BASE_URL = window.location.origin + '/api';

    const SESSION_TIMEOUT = 1 * 60 * 1000; // 1 minute

    const checkPharmacyAuth = async () => {
        const token = sessionStorage.getItem('authToken');
        const productId = sessionStorage.getItem('productId');
        const loginTimestamp = sessionStorage.getItem('loginTimestamp');

        // 1. Basic Auth Check
        if (!token || !loginTimestamp) {
            window.location.href = '/Frontend/comp/Login.html';
            return;
        }

        // 2. Session Expiry Check
        const now = Date.now();
        if (now - parseInt(loginTimestamp) > SESSION_TIMEOUT) {
            sessionStorage.clear();
            window.location.href = '/Frontend/comp/Login.html';
            return;
        }

        // 3. Product ID Check (Security)
        if (productId && productId !== 'pharmacy-pos') {
            window.location.href = '/Frontend/comp/dashboard.html';
            return;
        }

        const isSetupPage = window.location.pathname.includes('login.html');

        try {
            // Check if onboarding is complete
            const response = await fetch(`${API_BASE_URL}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                const isComplete = result.data.isOnboardingComplete;

                if (!isComplete && !isSetupPage) {
                    window.location.href = '/Frontend/pharmacy/login.html';
                } else if (isComplete && isSetupPage) {
                    window.location.href = '/Frontend/pharmacy/index.html';
                } else {
                    // All good, show the page
                    document.body.style.opacity = '1';
                }
            }
        } catch (err) {
            console.error('Pharmacy auth check error:', err);
            document.body.style.opacity = '1'; // Show anyway if API fails
        }
    };

    // Hide body initially to prevent flash
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.2s ease-in-out';

    // Run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPharmacyAuth);
    } else {
        checkPharmacyAuth();
    }
})();
