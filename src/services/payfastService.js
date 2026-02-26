/**
 * payfastService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All GoPayFast (Pakistan) API interactions are centralised here.
 *
 * REAL API Endpoints (Sandbox → Production swap only requires .env change):
 *   GetAccessToken  → https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken
 *   Web Checkout    → https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction
 *
 * Security best-practices applied:
 *   • All credentials loaded exclusively from environment variables.
 *   • HTTPS enforced by the API URL itself (sandbox & production).
 *   • Tokens are short-lived (per-request), never stored in plain text long-term.
 *   • IPN validation checks expected fields and response code.
 *   • axios timeout set to prevent hanging requests.
 */

const axios = require('axios');

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYFAST_TOKEN_URL =
    process.env.PAYFAST_TOKEN_URL ||
    'https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken';

const PAYFAST_CHECKOUT_URL =
    process.env.PAYFAST_CHECKOUT_URL ||
    'https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction';

const PAYFAST_SUCCESS_CODE = '00'; // PayFast success response code

// ─── HTTP Client (with security-conscious defaults) ───────────────────────────
const payfastHttp = axios.create({
    timeout: 15000, // 15-second timeout — fail fast
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
});

// ─── Helper: validate credentials at startup ──────────────────────────────────
const validateConfig = () => {
    const { PAYFAST_MERCHANT_ID, PAYFAST_SECURED_KEY } = process.env;
    if (!PAYFAST_MERCHANT_ID || !PAYFAST_SECURED_KEY) {
        throw new Error(
            '[PayFast] PAYFAST_MERCHANT_ID or PAYFAST_SECURED_KEY is missing from environment variables.'
        );
    }
};

/**
 * getAccessToken()
 * ─────────────────────────────────────────────────────────────────────────────
 * Requests a short-lived encrypted access token from GoPayFast.
 * Must be called from the SERVER — never the browser.
 *
 * @param {object} orderData
 * @param {number} orderData.amount         — Transaction amount in PKR (e.g. 3000)
 * @param {string} orderData.basketId       — Unique basket/order identifier
 * @param {string} [orderData.currency]     — Currency code, default 'PKR'
 * @returns {Promise<string>} Encrypted access token string
 */
const getAccessToken = async ({ amount, basketId, currency = 'PKR' }) => {
    validateConfig();

    const payload = {
        MERCHANT_ID: process.env.PAYFAST_MERCHANT_ID,
        SECURED_KEY: process.env.PAYFAST_SECURED_KEY,
        TXNAMT: String(amount), // PayFast expects string
        BASKET_ID: basketId,
        Currency_code: currency,
    };

    try {
        const response = await payfastHttp.post(PAYFAST_TOKEN_URL, payload);
        const data = response.data;

        // GoPayFast returns { ACCESS_TOKEN: "...", MERCHANT_ID: "..." }  on success
        if (!data || !data.ACCESS_TOKEN) {
            throw new Error(
                `[PayFast] Failed to obtain access token. Response: ${JSON.stringify(data)}`
            );
        }

        return data.ACCESS_TOKEN;
    } catch (err) {
        if (err.response) {
            // PayFast returned an HTTP error
            throw new Error(
                `[PayFast] Token API error ${err.response.status}: ${JSON.stringify(err.response.data)}`
            );
        }
        throw err; // Network / config error — re-throw
    }
};

/**
 * buildCheckoutFormData()
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the form-post data object that redirects the customer to the
 * GoPayFast hosted checkout page. The frontend POSTs this as a form.
 *
 * @param {object} params
 * @param {string} params.accessToken   — Token from getAccessToken()
 * @param {string} params.basketId
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {string} params.orderDesc     — Item description shown at checkout
 * @param {string} params.customerEmail
 * @param {string} params.customerName
 * @returns {object} Form fields to POST to PAYFAST_CHECKOUT_URL
 */
const buildCheckoutFormData = ({
    accessToken,
    basketId,
    amount,
    currency = 'PKR',
    orderDesc,
    customerEmail,
    customerName,
}) => {
    return {
        ACCESS_TOKEN: accessToken,
        MERCHANT_ID: process.env.PAYFAST_MERCHANT_ID,
        TXNAMT: String(amount),
        CUSTOMER_MOBILE_NO: '', // Optional — can be added later
        CUSTOMER_EMAIL_ADDRESS: customerEmail || '',
        SIGNATURE: '', // PayFast auto-computes on their side for hosted checkout
        VERSION: 'MERCHANT-CART-0.1',
        TXNDESC: orderDesc || 'Subscription Payment',
        PROCCODE: '00',
        TRAN_TYPE: 'ECOMM_PURCHASE',
        BASKET_ID: basketId,
        ORDER_DATE: new Date().toISOString(),
        CHECKOUT_URL: PAYFAST_CHECKOUT_URL,
        SUCCESS_URL: process.env.PAYFAST_SUCCESS_URL,
        FAILURE_URL: process.env.PAYFAST_FAILURE_URL,
        BACK_URL: process.env.PAYFAST_CANCEL_URL,
        Currency_Code: currency,
        COUNTRY_CODE: 'PK',
        CURRENCY_CODE: currency, // PayFast accepts both spellings; included for safety
        CUSTOMER_NAME: customerName || '',
    };
};

/**
 * validateIPN()
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates an incoming IPN (Instant Payment Notification) from PayFast.
 *
 * Security checks:
 *   1. Response code must equal '00' (PayFast success code).
 *   2. Required fields must be present.
 *   3. Amount must match what we originally stored (prevents tampering).
 *
 * @param {object} ipnData        — Raw POST body from PayFast webhook
 * @param {number} expectedAmount — Amount we stored in our DB for this basket
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateIPN = (ipnData, expectedAmount) => {
    const required = ['BASKET_ID', 'TRANAUTH_RESP', 'TXNAMT'];

    for (const field of required) {
        if (!ipnData[field]) {
            return { valid: false, reason: `Missing required IPN field: ${field}` };
        }
    }

    // Check PayFast response code (must be '00' = approved)
    if (ipnData.TRANAUTH_RESP !== PAYFAST_SUCCESS_CODE) {
        return {
            valid: false,
            reason: `PayFast response code: ${ipnData.TRANAUTH_RESP} (expected 00)`,
        };
    }

    // Amount integrity check — parse carefully to handle decimal strings
    const receivedAmount = parseFloat(ipnData.TXNAMT);
    const expected = parseFloat(expectedAmount);

    if (isNaN(receivedAmount) || Math.abs(receivedAmount - expected) > 0.01) {
        return {
            valid: false,
            reason: `Amount mismatch. Expected ${expected}, received ${receivedAmount}`,
        };
    }

    return { valid: true };
};

module.exports = {
    getAccessToken,
    buildCheckoutFormData,
    validateIPN,
    PAYFAST_CHECKOUT_URL,
};
