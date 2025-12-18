// src/AgeWallet.js
import { Security } from './modules/Security.js';
import { Storage } from './modules/Storage.js';
import { Network } from './modules/Network.js';
import { Renderer } from './modules/Renderer.js';
import { OverlayStrategy } from './strategies/OverlayStrategy.js';
import { ApiStrategy } from './strategies/ApiStrategy.js';

export class AgeWallet {

    constructor(config) {
        // Define default endpoints
        const defaultEndpoints = {
            auth: 'https://app.agewallet.io/user/authorize',
            token: 'https://app.agewallet.io/user/token',
            userinfo: 'https://app.agewallet.io/user/userinfo'
        };

        // Environment Detection / Fallback
        const isBrowser = typeof window !== 'undefined';

        this.config = {
            clientId: '',
            clientSecret: '',
            // Sanitize redirectUri for Node environments
            redirectUri: isBrowser ? window.location.href.split('?')[0] : '',
            environment: 'browser', // 'browser' or 'node'
            mode: 'overlay',
            render: true,
            targetSelector: 'body',
            storage: 'cookie',
            ui: {},
            api: {},
            ...config,
            endpoints: {
                ...defaultEndpoints,
                ...(config.endpoints || {})
            }
        };

        if (!this.config.clientId) {
            throw new Error('[AgeWallet] Missing clientId.');
        }

        // Initialize Security with environment flag
        this.security = new Security(this.config.environment);
        this.network = new Network();

        if (typeof this.config.storage === 'object') {
            this.storage = new Storage('custom', this.config.storage);
        } else {
            this.storage = new Storage(this.config.storage);
        }

        this.renderer = new Renderer();
    }

    async init() {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            let destination = null;

            // 1. Immediate UI Feedback for Redirects
            if ((params.has('code') || params.has('error')) && this.config.render) {
                const target = document.querySelector(this.config.targetSelector);
                if (target) {
                    this.renderer.renderLoading(target);
                }
            }

            // 2. Perform Token Exchange or Error Handling
            if (params.has('code') && params.has('state')) {
                // Returns the Deep Link (returnUrl) if successful
                destination = await this.handleCallback(params.get('code'), params.get('state'));
            }
            else if (params.has('error') && params.has('state')) {
                // Returns the Deep Link (returnUrl) if exemption granted
                destination = await this.handleError(
                    params.get('error'),
                    params.get('error_description'),
                    params.get('state')
                );
            }

            // 3. Deep Link Restoration (Critical for Single Redirect URI Support)
            // If we have a destination and it is NOT the current page, redirect the user back there.
            if (destination && typeof destination === 'string' && destination !== window.location.href) {
                window.location.href = destination;
                return; // Stop execution here, browser is redirecting
            }

            // If we are staying on this page (or destination was null/invalid), clean the URL
            if (destination) {
                window.history.replaceState({}, document.title, this.config.redirectUri);
            }
        }

        // 4. Cleanup Loading State before strategy execution
        if (this.config.render) {
            const target = document.querySelector(this.config.targetSelector);
            if (target) this.renderer.clearGate(target);
        }

        // 5. Execute Strategy
        if (this.config.mode === 'api') {
            const strategy = new ApiStrategy(this);
            await strategy.execute();
        } else {
            const strategy = new OverlayStrategy(this);
            await strategy.execute();
        }

        // 6. Final Reveal
        this.renderer.revealPage();
    }

    async generateAuthUrl() {
        const state = this.security.generateRandomString(16);
        const nonce = this.security.generateRandomString(16);
        const verifier = this.security.generatePkceVerifier();
        const challenge = await this.security.generatePkceChallenge(verifier);

        // Capture Deep Link (User's current location)
        // If in Node/Server mode, default to the redirectUri
        const returnUrl = (typeof window !== 'undefined') ? window.location.href : this.config.redirectUri;

        // Store Deep Link in State
        await this.storage.setOidcState(state, verifier, nonce, returnUrl);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            // STRICT: Must match the registered Redirect URI (e.g., Homepage)
            redirect_uri: this.config.redirectUri,
            scope: 'openid age',
            state: state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            nonce: nonce
        });

        return {
            url: `${this.config.endpoints.auth}?${params.toString()}`,
            state: state
        };
    }

    async handleCallback(code, state) {
        // Await storage get
        const stored = await this.storage.getOidcState();

        if (!stored || stored.state !== state) {
            console.error('[AgeWallet] Invalid state or session expired.');
            return null;
        }

        const body = {
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            // STRICT: Must match the registered Redirect URI used in generateAuthUrl
            // Do NOT use stored.returnUrl here, that is for the browser redirect later
            redirect_uri: this.config.redirectUri,
            code: code,
            code_verifier: stored.verifier
        };

        if (this.config.clientSecret) {
            body.client_secret = this.config.clientSecret;
        }

        try {
            const tokenData = await this.network.postForm(this.config.endpoints.token, body);
            const userInfo = await this.network.get(this.config.endpoints.userinfo, tokenData.access_token);

            if (userInfo.age_verified !== true) {
                throw new Error('Age requirement not met.');
            }

            // Await storage set
            await this.storage.setVerification(tokenData);

            // Return the deep link to the init() caller
            return stored.returnUrl || this.config.redirectUri;

        } catch (e) {
            console.error('[AgeWallet] Token exchange failed:', e);
            return null;
        }
    }

    /**
     * Handles OIDC Errors (specifically Regional Exemptions)
     * @returns {Promise<string|boolean>} - Returns Deep Link (string) if exemption granted, False otherwise
     */
    async handleError(error, description, state) {
        // 1. Validate State (CSRF Protection)
        const stored = await this.storage.getOidcState();
        if (!stored || stored.state !== state) {
            console.warn('[AgeWallet] Error received with invalid state. Ignoring.');
            return false;
        }

        // 2. Check for Regional Exemption
        if (error === 'access_denied' && description === 'Region does not require verification') {
            console.log('[AgeWallet] Regional exemption detected. Bypass granted.');

            // 3. Create Synthetic Token (24h validity)
            const syntheticToken = {
                access_token: 'region_exempt_placeholder',
                token_type: 'Bearer',
                expires_in: 86400,
                scope: 'openid age',
                is_synthetic: true
            };

            // 4. Store as if it were a real token
            await this.storage.setVerification(syntheticToken);

            // 5. Return Deep Link
            return stored.returnUrl || this.config.redirectUri;
        }

        // 3. Log genuine errors
        console.error(`[AgeWallet] OIDC Error: ${error} - ${description}`);
        return false;
    }
}