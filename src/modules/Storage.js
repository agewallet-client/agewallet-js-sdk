/**
 * AgeWallet Storage Module
 * Manages persistence for OIDC state (Session) and verification tokens (Local/Cookie).
 */
export default class Storage {

    /**
     * @param {string} mode - 'cookie' | 'local' | 'custom'
     * @param {object|null} customHandler - Must implement get/set/remove interface
     */
    constructor(mode = 'cookie', customHandler = null) {
        this.mode = mode;
        this.prefix = 'aw_';
        this.handler = customHandler;

        // Session storage is always used for temporary OIDC state (PKCE)
        // unless a custom handler overrides everything (Node.js context)
        this.session = (typeof window !== 'undefined') ? window.sessionStorage : null;
    }

    /**
     * Set Verification Data (Long-lived)
     * @param {object} tokenData - { access_token, expires_in, etc }
     */
    setVerification(tokenData) {
        if (this.handler) {
            return this.handler.set(`${this.prefix}verified`, tokenData);
        }

        const expiry = new Date().getTime() + (tokenData.expires_in * 1000);
        const payload = JSON.stringify({ ...tokenData, expiry_timestamp: expiry });

        if (this.mode === 'local') {
            window.localStorage.setItem(`${this.prefix}verified`, payload);
        } else {
            // Cookie Fallback (Default)
            // Secure, Lax, 1 Day default if not specified
            const maxAge = tokenData.expires_in || 86400;
            document.cookie = `${this.prefix}verified=${encodeURIComponent(payload)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
        }
    }

    /**
     * Get Verification Token
     * @returns {string|null} Access Token
     */
    getVerificationToken() {
        if (this.handler) {
            const data = this.handler.get(`${this.prefix}verified`);
            return data ? data.access_token : null;
        }

        let raw = null;

        if (this.mode === 'local') {
            raw = window.localStorage.getItem(`${this.prefix}verified`);
        } else {
            // Parse Cookies
            const match = document.cookie.match(new RegExp('(^| )' + `${this.prefix}verified` + '=([^;]+)'));
            if (match) raw = decodeURIComponent(match[2]);
        }

        if (!raw) return null;

        try {
            const data = JSON.parse(raw);
            const now = new Date().getTime();

            // Auto-expire
            if (now > data.expiry_timestamp) {
                this.clearVerification();
                return null;
            }
            return data.access_token;
        } catch (e) {
            this.clearVerification();
            return null;
        }
    }

    clearVerification() {
        if (this.handler) return this.handler.remove(`${this.prefix}verified`);

        if (this.mode === 'local') {
            window.localStorage.removeItem(`${this.prefix}verified`);
        } else {
            document.cookie = `${this.prefix}verified=; path=/; max-age=0; SameSite=Lax; Secure`;
        }
    }

    // --- OIDC State (Session) ---

    setOidcState(state, verifier, nonce, returnUrl) {
        // If we are in a server context without session storage, we skip this
        // (or rely on the custom handler if provided for state)
        if (!this.session) return;

        const data = JSON.stringify({ state, verifier, nonce, returnUrl });
        this.session.setItem(`${this.prefix}oidc_state`, data);
    }

    getOidcState() {
        if (!this.session) return null;

        const key = `${this.prefix}oidc_state`;
        const raw = this.session.getItem(key);
        if (!raw) return null;

        this.session.removeItem(key); // Security: One-time use
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }
}