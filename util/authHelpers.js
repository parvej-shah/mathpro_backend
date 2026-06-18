/**
 * Authentication Helper Utilities
 * Provides email/phone detection, validation, and OTP management
 */

// Email regex pattern (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone regex pattern (Bangladesh: 11 digits starting with 01)
const PHONE_REGEX = /^01[0-9]{9}$/;

/**
 * Detect if input is email or phone
 * @param {string} input - Login identifier
 * @returns {'email' | 'phone' | null}
 */
const detectContactType = (input) => {
    if (!input) return null;
    
    const trimmed = input.trim();
    
    // Check email first (more specific pattern)
    if (EMAIL_REGEX.test(trimmed)) {
        return 'email';
    }
    
    // Check phone
    if (PHONE_REGEX.test(trimmed)) {
        return 'phone';
    }
    
    return null;
};

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
const isValidEmail = (email) => {
    if (!email) return false;
    return EMAIL_REGEX.test(email.trim());
};

/**
 * Validate phone format (11 digits for Bangladesh)
 * @param {string} phone 
 * @returns {boolean}
 */
const isValidPhone = (phone) => {
    if (!phone) return false;
    return PHONE_REGEX.test(phone.trim());
};

/**
 * Normalize contact info (trim and lowercase)
 * @param {string} contact
 * @returns {string}
 */
const normalizeContact = (contact) => {
    if (!contact) return '';
    return contact.trim().toLowerCase();
};

/**
 * Normalize a Bangladesh phone number to the canonical 01XXXXXXXXX form.
 * Strips spaces/dashes and a leading +88 or 88 country code if present.
 * @param {string} phone
 * @returns {string}
 */
const normalizePhone = (phone) => {
    if (!phone) return '';
    let digits = `${phone}`.trim().replace(/[\s-]/g, '');
    if (digits.startsWith('+88')) digits = digits.slice(3);
    else if (digits.startsWith('88') && digits.length === 13) digits = digits.slice(2);
    return digits;
};

/**
 * Normalize any login identifier (email or phone) for lookup/storage.
 * Phone numbers (including +88/88-prefixed) collapse to canonical 01XXXXXXXXX.
 * @param {string} contact
 * @returns {string}
 */
const normalizeIdentifier = (contact) => {
    // Try phone first so country-code-prefixed numbers are recognized.
    const phone = normalizePhone(contact);
    if (PHONE_REGEX.test(phone)) return phone;
    return normalizeContact(contact);
};

/**
 * Generate random OTP
 * @param {number} length - OTP length (default 6)
 * @returns {string}
 */
const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
};

/**
 * Get OTP expiration time (default 10 minutes)
 * @param {number} minutes 
 * @returns {number} Unix timestamp in seconds
 */
const getOTPExpiration = (minutes = 10) => {
    return Math.floor(Date.now() / 1000) + (minutes * 60);
};

/**
 * Check if OTP is expired
 * @param {number} expiresAt - Unix timestamp in seconds
 * @returns {boolean}
 */
const isOTPExpired = (expiresAt) => {
    if (!expiresAt) return true;
    const now = Math.floor(Date.now() / 1000);
    return now > expiresAt;
};

/**
 * Sanitize contact for logging (masks sensitive info)
 * @param {string} contact 
 * @param {'email' | 'phone'} contactType 
 * @returns {string}
 */
const sanitizeContactForLog = (contact, contactType) => {
    if (!contact) return '[empty]';
    
    if (contactType === 'email') {
        const [localPart, domain] = contact.split('@');
        if (!domain) return contact;
        const maskedLocal = localPart.substring(0, 2) + '***';
        return `${maskedLocal}@${domain}`;
    }
    
    if (contactType === 'phone') {
        // Show first 3 and last 2 digits
        if (contact.length !== 11) return contact;
        return contact.substring(0, 3) + '******' + contact.substring(9);
    }
    
    return contact;
};

/**
 * Get field name for database query based on contact type
 * @param {'email' | 'phone'} contactType 
 * @returns {string}
 */
const getContactField = (contactType) => {
    return contactType === 'email' ? 'email' : 'phone';
};

module.exports = {
    detectContactType,
    isValidEmail,
    isValidPhone,
    normalizeContact,
    normalizePhone,
    normalizeIdentifier,
    generateOTP,
    getOTPExpiration,
    isOTPExpired,
    sanitizeContactForLog,
    getContactField,
    EMAIL_REGEX,
    PHONE_REGEX
};
