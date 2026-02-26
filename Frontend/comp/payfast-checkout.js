/**
 * payfast-checkout.js  —  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete payment flow manager for Cloud Care Systems.
 *
 * FLOW A — Free Tier (3-day trial):
 *   Click → Not logged in → Signup.html (plan=trial) → Register → Trial API
 *          → Product dashboard
 *   Click → Logged in → Trial API directly → Product dashboard
 *
 * FLOW B — Paid Plan (Monthly / Yearly):
 *   Click → Not logged in → Save pending intent → Login.html
 *          → After login, login.js auto-resumes → PayFast initiate → Checkout
 *   Click → Logged in → PayFast initiate directly → Checkout
 *
 * Key:
 *   - Token read from sessionStorage (matches auth.js)
 *   - Pending payment intent persisted in sessionStorage
 *   - login.js checks for pending intent and resumes automatically
 */

const PayFastCheckout = (() => {

    // ── Constants ──────────────────────────────────────────────────────────────
    const API_BASE = window.location.origin;
    const INITIATE_URL = `${API_BASE}/api/payments/payfast/initiate`;
    const TRIAL_URL = `${API_BASE}/api/subscriptions/trial`;

    // Session key for storing pending payment intent across login redirect
    const PENDING_KEY = 'pf_pending_payment';

    // Generate a unique basket ID on the frontend to persist across redirects
    const generateBasketId = () => {
        return `BKT-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    };

    // Amount display labels (matches backend PLAN_PRICES exactly)
    const AMOUNT_DISPLAY = {
        'hospital-pms': { monthly: 'PKR 20,000/month', yearly: 'PKR 210,000/year' },
        'pharmacy-pos': { monthly: 'PKR 20,000/month', yearly: 'PKR 210,000/year' },
        'lab-reporting': { monthly: 'PKR 20,000/month', yearly: 'PKR 210,000/year' },
        'quick-invoice': { monthly: 'PKR 20,000/month', yearly: 'PKR 210,000/year' },
        'private-clinic-lite': { monthly: 'PKR 20,000/month', yearly: 'PKR 210,000/year' },
    };

    // ── Auth helper — reads sessionStorage (same as auth.js) ──────────────────
    const getToken = () => sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
    const isLoggedIn = () => {
        const token = getToken();
        if (!token) return false;
        const ts = sessionStorage.getItem('loginTimestamp');
        if (!ts) return false;
        // Auth.js timeout is 1 min — we extend to 30 min for payment flow
        return (Date.now() - parseInt(ts)) < 30 * 60 * 1000;
    };

    // ── Toast system ──────────────────────────────────────────────────────────
    const showToast = (message, type = 'error') => {
        const existing = document.getElementById('pf-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'pf-toast';
        const colors = { error: '#ef4444', success: '#10b981', info: '#4f46e5', warning: '#f59e0b' };
        toast.style.cssText = `
            position:fixed; bottom:24px; right:24px; z-index:99999;
            padding:14px 20px; border-radius:12px; font-family:'Inter',sans-serif;
            font-size:0.9rem; font-weight:600; color:white;
            box-shadow:0 8px 24px rgba(0,0,0,0.18); max-width:380px;
            background:${colors[type] || colors.info};
            animation:pfSlideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 6000);
    };

    // ── Button loading state ──────────────────────────────────────────────────
    const setLoading = (btn, on) => {
        if (!btn) return;
        if (on) {
            btn.dataset.orig = btn.innerHTML;
            btn.innerHTML = '<span style="opacity:.7">Processing…</span>';
            btn.disabled = true; btn.style.opacity = '.7'; btn.style.cursor = 'not-allowed';
        } else {
            btn.innerHTML = btn.dataset.orig || 'Pay with GoPayFast';
            btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
        }
    };

    // ── Hidden form POST to PayFast ───────────────────────────────────────────
    const submitFormToPayFast = (checkoutUrl, formFields) => {
        const form = document.createElement('form');
        form.method = 'POST'; form.action = checkoutUrl; form.style.display = 'none';
        Object.entries(formFields).forEach(([k, v]) => {
            if (v == null) return;
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = k; inp.value = v;
            form.appendChild(inp);
        });
        document.body.appendChild(form);
        form.submit();
    };

    // ── Save pending payment intent (so login.js can resume it) ──────────────
    const savePendingIntent = (productSlug, tierKey) => {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({
            productSlug,
            tierKey,
            basketId: generateBasketId(), // Generate and store ID immediately
            savedAt: Date.now()
        }));
    };

    // ── Read & clear pending intent ───────────────────────────────────────────
    const getPendingIntent = () => {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            // Expire after 30 minutes
            if (Date.now() - data.savedAt > 30 * 60 * 1000) {
                sessionStorage.removeItem(PENDING_KEY);
                return null;
            }
            return data;
        } catch { return null; }
    };

    const clearPendingIntent = () => sessionStorage.removeItem(PENDING_KEY);

    // ── Free Trial (for already-logged-in users) ──────────────────────────────
    const startTrialDirectly = async (productSlug, btn) => {
        setLoading(btn, true);
        try {
            const resp = await fetch(TRIAL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ productSlug })
            });
            const data = await resp.json();
            if (!resp.ok) {
                if (data.code === 'TRIAL_ALREADY_USED') {
                    showToast(`You already used the trial for this product. Choose a paid plan to continue.`, 'warning');
                    setLoading(btn, false);
                    return;
                }
                throw new Error(data.message || 'Failed to start trial');
            }
            showToast('🎉 3-day free trial started! Redirecting…', 'success');
            setTimeout(() => {
                const config = window.PRODUCT_CONFIG;
                const page = config && config[productSlug] ? config[productSlug].landingPage : '/Frontend/comp/dashboard.html';
                window.location.href = page;
            }, 1500);
        } catch (err) {
            showToast(err.message || 'Could not start trial. Please try again.', 'error');
            setLoading(btn, false);
        }
    };

    // ── Paid Plan: initiate PayFast payment (user must be logged in) ──────────
    const initiatePaidPayment = async (productSlug, tierKey, btn) => {
        const amountText = (AMOUNT_DISPLAY[productSlug] || {})[tierKey] || '';
        const productName = (window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productSlug])
            ? window.PRODUCT_CONFIG[productSlug].name
            : productSlug;

        const confirmed = confirm(
            `You are about to subscribe to:\n\n` +
            `📦 Product: ${productName}\n` +
            `📅 Plan: ${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)}\n` +
            `💰 Amount: ${amountText}\n\n` +
            `You will be redirected to GoPayFast secure checkout.\nPay with Visa, Mastercard, JazzCash or EasyPaisa.\n\nProceed?`
        );
        if (!confirmed) return;

        setLoading(btn, true);

        try {
            // Check if we have a stored pending intent (with its basketId)
            const intent = getPendingIntent();

            const resp = await fetch(INITIATE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    productSlug,
                    planType: tierKey,
                    basketId: intent ? intent.basketId : generateBasketId()
                })
            });

            let data;
            try { data = await resp.json(); } catch { throw new Error('Invalid server response.'); }

            if (!resp.ok) {
                if (resp.status === 401) {
                    showToast('Session expired. Redirecting to login…', 'warning');
                    sessionStorage.clear();
                    savePendingIntent(productSlug, tierKey);
                    setTimeout(() => {
                        window.location.href = `./Login.html?redirect=payment&product=${productSlug}&tier=${tierKey}`;
                    }, 1200);
                    return;
                }
                if (data.code === 'ALREADY_SUBSCRIBED') {
                    showToast(`✅ You already have an active ${productName} subscription until ${new Date(data.endDate).toLocaleDateString()}.`, 'info');
                    setLoading(btn, false); return;
                }
                if (resp.status === 429) {
                    showToast('Too many payment attempts. Please wait 10 minutes.', 'error');
                    setLoading(btn, false); return;
                }
                throw new Error(data.message || 'Payment initiation failed.');
            }

            if (!data.success || !data.data?.checkoutUrl) {
                throw new Error('Invalid payment response from server.');
            }

            clearPendingIntent();
            showToast('✅ Redirecting to GoPayFast secure checkout…', 'success');
            setTimeout(() => submitFormToPayFast(data.data.checkoutUrl, data.data.formFields), 900);

        } catch (err) {
            showToast(err.message || 'Something went wrong. Please try again.', 'error');
            setLoading(btn, false);
        }
    };

    // ── PUBLIC: Main entry point called from pricing pages ────────────────────
    const initiatePayment = async (productSlug, tierKey, btn = null) => {

        // ── FREE TIER ────────────────────────────────────────────────────────
        if (tierKey === 'free') {
            if (isLoggedIn()) {
                // User is logged in → start trial via API directly
                await startTrialDirectly(productSlug, btn);
            } else {
                // Not logged in → go to Signup with trial intent in URL
                window.location.href = `./Signup.html?plan=trial&product=${productSlug}&tier=free`;
            }
            return;
        }

        // ── OUTRIGHT / CONTACT SALES ─────────────────────────────────────────
        if (tierKey === 'outright') {
            window.location.href = `./Contact.html?inquiry=pricing&product=${productSlug}&tier=${tierKey}`;
            return;
        }

        // ── PAID PLAN (monthly / yearly) ─────────────────────────────────────
        if (!isLoggedIn()) {
            // Save intent so login.js can resume after authentication
            savePendingIntent(productSlug, tierKey);
            showToast('Please sign up first. Your plan selection is saved!', 'info');

            // Get display details if possible
            const amountText = (AMOUNT_DISPLAY[productSlug] || {})[tierKey] || '';
            const productName = (window.PRODUCT_CONFIG && window.PRODUCT_CONFIG[productSlug])
                ? window.PRODUCT_CONFIG[productSlug].name
                : productSlug;

            // Format price for URL (remove PKR and /month)
            const cleanPrice = amountText.replace('PKR ', '').split('/')[0].trim();
            const planLabel = tierKey.charAt(0).toUpperCase() + tierKey.slice(1) + ' Plan';

            setTimeout(() => {
                window.location.href = `./Signup.html?redirect=payment&product=${productSlug}&tier=${tierKey}&planName=${encodeURIComponent(planLabel)}&price=${encodeURIComponent(cleanPrice)}`;
            }, 1200);
            return;
        }

        // User is authenticated → proceed with payment
        await initiatePaidPayment(productSlug, tierKey, btn);
    };

    // ── PUBLIC: Called by login.js after successful login ─────────────────────
    // Returns true if a pending payment was resumed, false otherwise
    const resumePendingPaymentIfAny = async () => {
        const intent = getPendingIntent();
        if (!intent) return false;
        if (!isLoggedIn()) return false;

        console.log('[PayFast] Resuming pending payment:', intent);
        clearPendingIntent();
        await initiatePaidPayment(intent.productSlug, intent.tierKey, null);
        return true;
    };

    // ── PUBLIC: Check URL params on success/cancel page ───────────────────────
    const handlePaymentStatusPage = () => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('payment');
        if (status === 'success') {
            showToast('🎉 Payment successful! Your subscription is now active.', 'success');
        } else if (status === 'cancelled') {
            showToast('Payment was cancelled. You can try again anytime.', 'warning');
        }
    };

    return {
        initiatePayment,
        resumePendingPaymentIfAny,
        handlePaymentStatusPage,
        savePendingIntent,
        getPendingIntent,
        clearPendingIntent,
    };
})();

// ── Inject CSS ───────────────────────────────────────────────────────────────
(() => {
    const s = document.createElement('style');
    s.textContent = `
@keyframes pfSlideIn {
    from { transform: translateX(110px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
}
.pf-pay-btn {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; width: 100%; padding: 0.85rem; margin-top: 0.75rem;
    border-radius: 10px; font-weight: 700; font-size: 0.95rem;
    cursor: pointer; border: none;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white; transition: all 0.25s ease; letter-spacing: 0.3px;
    position: relative; overflow: hidden;
}
.pf-pay-btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, #0f3460 0%, #533483 100%);
    opacity: 0; transition: opacity 0.25s ease;
}
.pf-pay-btn:hover::before { opacity: 1; }
.pf-pay-btn svg, .pf-pay-btn span { position: relative; z-index: 1; }
.pf-pay-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(83,52,131,0.4); }
.pf-badges {
    display: flex; align-items: center; justify-content: center;
    gap: 5px; margin-top: 8px; font-size: 0.72rem; color: #9ca3af; flex-wrap: wrap;
}
.pf-badge {
    display: flex; align-items: center; gap: 3px;
    padding: 2px 7px; background: #f3f4f6; border-radius: 4px; font-weight: 500;
}
`;
    document.head.appendChild(s);
})();

// Auto-run on page load: handle payment status messages (success/cancel page)
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.search.includes('payment=')) {
        PayFastCheckout.handlePaymentStatusPage();
    }
});
