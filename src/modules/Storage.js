// src/modules/Storage.js
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
    async setVerification(tokenData) {
        if (this.handler) {
            // Support async handlers
            return await this.handler.set(`${this.prefix}verified`, tokenData);
        }

        const expiry = new Date().getTime() + (tokenData.expires_in * 1000);
        const payload = JSON.stringify({ ...tokenData, expiry_timestamp: expiry });

        if (this.mode === 'local') {
            window.localStorage.setItem(`${this.prefix}verified`, payload);
        } else {
            // Cookie Fallback
            const maxAge = tokenData.expires_in || 86400;
            document.cookie = `${this.prefix}verified=${encodeURIComponent(payload)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
        }
    }

    /**
     * Get Verification Token
     * @returns {string|null} Access Token
     */
    async getVerificationToken() {
        if (this.handler) {
            // Support async handlers (await is safe even if handler returns sync value)
            const data = await this.handler.get(`${this.prefix}verified`);
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

    async clearVerification() {
        if (this.handler) return await this.handler.remove(`${this.prefix}verified`);

        if (this.mode === 'local') {
            window.localStorage.removeItem(`${this.prefix}verified`);
        } else {
            document.cookie = `${this.prefix}verified=; path=/; max-age=0; SameSite=Lax; Secure`;
        }
    }

    // --- OIDC State (Session) ---

    async setOidcState(state, verifier, nonce, returnUrl) {
        const data = { state, verifier, nonce, returnUrl };

        // 1. Prefer Custom Handler (Important for Server-Side/Node)
        if (this.handler && typeof this.handler.set === 'function') {
            // We store this with a distinct suffix to not collide with 'verified'
            // Since the handler usually has user-scoped prefix (e.g. redis session id), this is safe.
            return await this.handler.set('oidc_state', data);
        }

        // 2. Fallback to Browser SessionStorage
        if (this.session) {
            this.session.setItem(`${this.prefix}oidc_state`, JSON.stringify(data));
        }
    }

    async getOidcState() {
        // 1. Prefer Custom Handler
        if (this.handler && typeof this.handler.get === 'function') {
            const data = await this.handler.get('oidc_state');
            if (data) {
                // Optional: clean up state after retrieval to prevent reuse
                if (typeof this.handler.remove === 'function') {
                    await this.handler.remove('oidc_state');
                }
                return data;
            }
            return null;
        }

        // 2. Fallback to Browser SessionStorage
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