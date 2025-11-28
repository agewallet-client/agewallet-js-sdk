/**
 * AgeWallet Security Module
 * Handles cryptographic operations for OIDC PKCE flow using native Web Crypto API.
 */
export default class Security {

    /**
     * Generates a cryptographically secure random hex string.
     * @param {number} length - Number of bytes (output string will be 2x length in hex)
     * @returns {string} Hex string
     */
    generateRandomString(length = 32) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generates a PKCE Code Verifier (High Entropy).
     * RFC 7636: "min 43 chars, max 128 chars"
     * @returns {string} URL-safe base64 string
     */
    generatePkceVerifier() {
        const array = new Uint8Array(64); // 64 bytes -> ~86 chars Base64
        window.crypto.getRandomValues(array);
        return this._base64UrlEncode(array);
    }

    /**
     * Generates the S256 Code Challenge from a Verifier.
     * Uses SHA-256 hashing.
     * @param {string} verifier
     * @returns {Promise<string>}
     */
    async generatePkceChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        // SHA-256 hash
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        return this._base64UrlEncode(new Uint8Array(hashBuffer));
    }

    /**
     * Helper: Base64 URL Encoding (RFC 4648)
     * Replaces + with -, / with _, and removes padding =
     * @param {Uint8Array} uint8Array
     * @returns {string}
     */
    _base64UrlEncode(uint8Array) {
        let str = '';
        const bytes = uint8Array;
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return btoa(str)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
}