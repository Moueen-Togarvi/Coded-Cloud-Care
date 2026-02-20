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

        const isSetupPage = window.location.pathname.includes('setup.html') || window.location.pathname.includes('setting.html');

        try {
            // Check if onboarding is complete
            const response = await fetch(`${API_BASE_URL}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                const settings = result.data;
                const isComplete = settings.isOnboardingComplete;
                console.log("[AuthCheck] Settings fetched. isOnboardingComplete =", isComplete, "Current Path =", window.location.pathname);

                if (!isComplete && !window.location.pathname.includes('setup.html')) {
                    console.log("[AuthCheck] Onboarding incomplete, redirecting to setup.html...");
                    window.location.href = '/Frontend/pharmacy/setup.html';
                    return;
                } else if (isComplete && window.location.pathname.includes('setup.html')) {
                    console.log("[AuthCheck] Onboarding complete, redirecting to index.html...");
                    window.location.href = '/Frontend/pharmacy/index.html';
                    return;
                }

                // Store settings and apply branding
                if (settings) {
                    sessionStorage.setItem('pharmacy_settings', JSON.stringify(settings));
                    applyPharmacyBranding(settings);
                }

                // All good, show the page
                console.log("[AuthCheck] Showing page...");
                document.body.style.opacity = '1';
            } else {
                console.log("[AuthCheck] Settings API returned success: false. Assuming onboarding is incomplete...");
                // Settings fetch returned success: false (e.g., 404 Not Found), meaning no settings exist.
                // Ergo, onboarding is NOT complete.
                if (!window.location.pathname.includes('setup.html')) {
                    window.location.href = '/Frontend/pharmacy/setup.html';
                    return;
                }
                document.body.style.opacity = '1';
            }
        } catch (err) {
            console.error('Pharmacy auth check error:', err);
            // If api fails entirely, assume onboarding is incomplete to be safe,
            // or we might be offline. If not on setup, let's just go to setup.
            if (!window.location.pathname.includes('setup.html')) {
                window.location.href = '/Frontend/pharmacy/setup.html';
                return;
            }

            // Try to load from session storage if API fails
            const cached = sessionStorage.getItem('pharmacy_settings');
            if (cached) {
                applyPharmacyBranding(JSON.parse(cached));
            }
            document.body.style.opacity = '1'; // Show anyway if API fails
        }
    };

    const applyPharmacyBranding = (settings) => {
        if (!settings) return;

        // Use pharmacy specific fields if available, fallback to clinic fields
        const name = settings.pharmacyName || settings.clinicName || 'PharmaTrack';
        const phone = settings.pharmacyPhone || settings.clinicPhone || '';
        const logo = settings.pharmacyLogo || settings.clinicLogo;
        const address = settings.pharmacyAddress || settings.clinicAddress || '';

        // update sidebar title
        const sidebarTitle = document.getElementById('sidebar-pharmacy-name');
        if (sidebarTitle) {
            sidebarTitle.textContent = name;
        }

        // update invoice branding (if present)
        const invoiceName = document.getElementById('invoiceClinicName');
        if (invoiceName) {
            invoiceName.textContent = name;
        }

        const invoiceAddress = document.getElementById('invoiceClinicAddress');
        if (invoiceAddress) {
            invoiceAddress.textContent = address;
        }

        const invoicePhone = document.getElementById('invoiceClinicPhone');
        if (invoicePhone) {
            invoicePhone.textContent = phone;
        }

        // update sidebar logo
        const logoContainer = document.getElementById('sidebar-logo-container');
        if (logoContainer && logo) {
            logoContainer.innerHTML = `<img src="${logo}" alt="Logo" class="w-full h-full object-contain rounded">`;
            logoContainer.classList.remove('bg-primary-blue', 'flex', 'items-center', 'justify-center');
        }
    };

    // Hide body initially to prevent flash (Wait for DOM)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.2s ease-in-out';
            checkPharmacyAuth();
        });
    } else {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.2s ease-in-out';
        checkPharmacyAuth();
    }
})();
