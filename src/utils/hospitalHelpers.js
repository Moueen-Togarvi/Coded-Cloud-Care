/**
 * Hospital PMS Utility Functions
 * Helper functions for data processing and calculations
 */

/**
 * Calculate prorated fee based on days elapsed
 * Formula: (monthly_fee / 30) * days_elapsed
 * @param {string|number} monthlyFee - Monthly fee (can be string with commas)
 * @param {number} daysElapsed - Number of days since admission
 * @returns {number} - Prorated fee amount
 */
const calculateProratedFee = (monthlyFee, daysElapsed) => {
    try {
        // Parse monthly fee (handle string values with commas)
        let fee;
        if (typeof monthlyFee === 'string') {
            fee = parseInt(monthlyFee.replace(/,/g, '') || '0');
        } else {
            fee = parseInt(monthlyFee || 0);
        }

        // Calculate per-day rate and multiply by days elapsed
        const perDayRate = fee / 30.0;
        return Math.floor(perDayRate * daysElapsed);
    } catch (error) {
        return 0;
    }
};

/**
 * Clean input data by trimming whitespace from string values
 * @param {Object} data - Input data object
 * @returns {Object} - Cleaned data object
 */
const cleanInputData = (data) => {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            cleaned[key] = value.trim();
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleaned[key] = cleanInputData(value);
        } else if (Array.isArray(value)) {
            cleaned[key] = value.map((item) =>
                typeof item === 'object' && item !== null ? cleanInputData(item) :
                    typeof item === 'string' ? item.trim() : item
            );
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
};

/**
 * Normalize email to lowercase and trim whitespace
 * @param {string} email - Email address
 * @returns {string} - Normalized email
 */
const normalizeEmail = (email) => {
    if (typeof email !== 'string') return email;
    return email.trim().toLowerCase();
};

/**
 * Parse amount string (with commas) to integer
 * @param {string|number} amount - Amount value
 * @returns {number} - Parsed integer amount
 */
const parseAmount = (amount) => {
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') {
        return parseInt(amount.replace(/,/g, '') || '0');
    }
    return 0;
};

/**
 * Format number with commas (e.g., 50000 -> "50,000")
 * @param {number} num - Number to format
 * @returns {string} - Formatted string
 */
const formatWithCommas = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

module.exports = {
    calculateProratedFee,
    cleanInputData,
    normalizeEmail,
    parseAmount,
    formatWithCommas,
};
