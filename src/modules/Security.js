// src/modules/Security.js
/**
 * AgeWallet Security Module
 * Handles cryptographic operations for OIDC PKCE flow.
 * Supports Modern Browsers and Node.js 19+ (via globalThis.crypto).
 */
export default class Security {

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
     */
    generateRandomString(length = 32) {
        const array = new Uint8Array(length);
        this.crypto.getRandomValues(array);
        return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generates a PKCE Code Verifier (High Entropy).
     */
    generatePkceVerifier() {
        const array = new Uint8Array(64); // 64 bytes -> ~86 chars Base64
        this.crypto.getRandomValues(array);
        return this._base64UrlEncode(array);
    }

    /**
     * Generates the S256 Code Challenge from a Verifier.
     */
    async generatePkceChallenge(verifier) {
        if (this.environment === 'node') {
            // Node.js implementation
            const data = new TextEncoder().encode(verifier);
            const hashBuffer = await this.crypto.subtle.digest('SHA-256', data);
            return this._base64UrlEncode(new Uint8Array(hashBuffer));
        } else {
            // Browser implementation
            const encoder = new TextEncoder();
            const data = encoder.encode(verifier);
            const hashBuffer = await this.crypto.subtle.digest('SHA-256', data);
            return this._base64UrlEncode(new Uint8Array(hashBuffer));
        }
    }

    /**
     * Helper: Base64 URL Encoding (RFC 4648)
     * Replaces + with -, / with _, and removes padding =
     */
    _base64UrlEncode(uint8Array) {
        let str;

        if (this.environment === 'node') {
            // Node.js: Use Buffer for reliable encoding
            str = Buffer.from(uint8Array).toString('base64');
        } else {
            // Browser: Use btoa
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