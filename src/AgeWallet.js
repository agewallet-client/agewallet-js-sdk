import Security from './modules/Security.js';
import Storage from './modules/Storage.js';
import Network from './modules/Network.js';
import Renderer from './modules/Renderer.js';
import OverlayStrategy from './strategies/OverlayStrategy.js';
import ApiStrategy from './strategies/ApiStrategy.js';

export default class AgeWallet {

    constructor(config) {
        this.config = {
            clientId: '',
            redirectUri: typeof window !== 'undefined' ? window.location.href.split('?')[0] : '',
            mode: 'overlay', // 'overlay' | 'api'
            render: true,    // true = SDK renders, false = Headless
            targetSelector: 'body',
            storage: 'cookie', // 'cookie' | 'local' | CustomClass
            ui: {},
            api: {}, // { endpoint: '/...' }
            ...config
        };

        if (!this.config.clientId) {
            throw new Error('[AgeWallet] Missing clientId.');
        }

        // Initialize Modules
        this.security = new Security();
        this.network = new Network();

        // Handle Storage Injection
        if (typeof this.config.storage === 'object') {
            this.storage = new Storage('custom', this.config.storage);
        } else {
            this.storage = new Storage(this.config.storage);
        }

        this.renderer = new Renderer();
    }

    /**
     * Main Entry Point
     */
    async init() {
        // 1. Check for OIDC Callback (Authorization Code)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.has('code') && params.has('state')) {
                await this.handleCallback(params.get('code'), params.get('state'));
                // Clean URL after handling
                window.history.replaceState({}, document.title, this.config.redirectUri);
            }
        }

        // 2. Execute Strategy
        if (this.config.mode === 'api') {
            const strategy = new ApiStrategy(this);
            await strategy.execute();
        } else {
            const strategy = new OverlayStrategy(this);
            await strategy.execute();
        }
    }

    /**
     * Generates OIDC Params and URL
     */
    async generateAuthUrl() {
        const state = this.security.generateRandomString(16);
        const nonce = this.security.generateRandomString(16);
        const verifier = this.security.generatePkceVerifier();
        const challenge = await this.security.generatePkceChallenge(verifier);

        // Store session state
        this.storage.setOidcState(state, verifier, nonce, this.config.redirectUri);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: 'openid age',
            state: state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            nonce: nonce
        });

        return {
            url: `https://app.agewallet.io/user/authorize?${params.toString()}`,
            state: state
        };
    }

    /**
     * Handles the OIDC Callback (Exchange Code for Token)
     */
    async handleCallback(code, state) {
        const stored = this.storage.getOidcState();

        if (!stored || stored.state !== state) {
            console.error('[AgeWallet] Invalid state or session expired.');
            return;
        }

        try {
            const tokenData = await this.network.postForm('https://app.agewallet.io/user/token', {
                grant_type: 'authorization_code',
                client_id: this.config.clientId,
                redirect_uri: stored.returnUrl || this.config.redirectUri,
                code: code,
                code_verifier: stored.verifier
            });

            // Verify age requirement via UserInfo (Optional but recommended)
            const userInfo = await this.network.get('https://app.agewallet.io/user/userinfo', tokenData.access_token);

            if (userInfo.age_verified !== true) {
                throw new Error('Age requirement not met.');
            }

            this.storage.setVerification(tokenData);

        } catch (e) {
            console.error('[AgeWallet] Token exchange failed:', e);
        }
    }

    // Helper for manual logout
    logout() {
        this.storage.clearVerification();
        window.location.reload();
    }
}