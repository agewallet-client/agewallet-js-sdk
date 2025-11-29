// src/modules/Security.js
/**
 * AgeWallet Security Module
 * Handles cryptographic operations for OIDC PKCE flow using native Web Crypto API.
 */
export class Security {

    constructor(environment = 'browser') {
        this.environment = environment;

        // Auto-detect crypto
        this.crypto = globalThis.crypto;

        if (!this.crypto) {
            // Fallback check for older browser implementations (msCrypto) or strict Node checks
            if (typeof window !== 'undefined' && window.crypto) {
                this.crypto = window.crypto;
            } else {
                throw new Error('[AgeWallet] Crypto API not found. Secure environment (HTTPS) or Node.js 19+ required.');
            }
        }
    }

    /**
     * Generates a cryptographically secure random hex string.
     * @param {number} length - Number of bytes (output string will be 2x length in hex)
     * @returns {string} Hex string
     */
    generateRandomString(length = 32) {
        const array = new Uint8Array(length);
        this.crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generates a PKCE Code Verifier (High Entropy).
     * RFC 7636: "min 43 chars, max 128 chars"
     * @returns {string} URL-safe base64 string
     */
    generatePkceVerifier() {
        const array = new Uint8Array(64); // 64 bytes -> ~86 chars Base64
        this.crypto.getRandomValues(array);
        return this._base64UrlEncode(array);
    }

    /**
     * Generates the S256 Code Challenge from a Verifier.
     * Uses SHA-256 hashing.
     * @param {string} verifier
     * @returns {Promise<string>}
     */
    async generatePkceChallenge(verifier) {
        if (this.environment === 'node') {
            const data = new TextEncoder().encode(verifier);
            const hashBuffer = await this.crypto.subtle.digest('SHA-256', data);
            return this._base64UrlEncode(new Uint8Array(hashBuffer));
        } else {
            const encoder = new TextEncoder();
            const data = encoder.encode(verifier);
            const hashBuffer = await this.crypto.subtle.digest('SHA-256', data);
            return this._base64UrlEncode(new Uint8Array(hashBuffer));
        }
    }

    /**
     * Helper: Base64 URL Encoding (RFC 4648)
     * Replaces + with -, / with _, and removes padding =
     * @param {Uint8Array} uint8Array
     * @returns {string}
     */
    _base64UrlEncode(uint8Array) {
        let str;

        if (this.environment === 'node') {
            str = Buffer.from(uint8Array).toString('base64');
        } else {
            let binary = '';
            const len = uint8Array.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            str = btoa(binary);
        }

        return str
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
}