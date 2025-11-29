import Security from './modules/Security.js';
import Storage from './modules/Storage.js';
import Network from './modules/Network.js';
import Renderer from './modules/Renderer.js';
import OverlayStrategy from './strategies/OverlayStrategy.js';
import ApiStrategy from './strategies/ApiStrategy.js';

export default class AgeWallet {

    constructor(config) {
        // Define default endpoints
        const defaultEndpoints = {
            auth: 'https://app.agewallet.io/user/authorize',
            token: 'https://app.agewallet.io/user/token',
            userinfo: 'https://app.agewallet.io/user/userinfo'
        };

        this.config = {
            clientId: '',
            clientSecret: '',
            redirectUri: typeof window !== 'undefined' ? window.location.href.split('?')[0] : '',
            mode: 'overlay',
            render: true,
            targetSelector: 'body',
            storage: 'cookie',
            ui: {},
            api: {},
            ...config,
            // Ensure endpoints are merged correctly (defaults + user overrides)
            endpoints: {
                ...defaultEndpoints,
                ...(config.endpoints || {})
            }
        };

        if (!this.config.clientId) {
            throw new Error('[AgeWallet] Missing clientId.');
        }

        this.security = new Security();
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
            if (params.has('code') && params.has('state')) {
                await this.handleCallback(params.get('code'), params.get('state'));
                window.history.replaceState({}, document.title, this.config.redirectUri);
            }
        }

        if (this.config.mode === 'api') {
            const strategy = new ApiStrategy(this);
            await strategy.execute();
        } else {
            const strategy = new OverlayStrategy(this);
            await strategy.execute();
        }
    }

    async generateAuthUrl() {
        const state = this.security.generateRandomString(16);
        const nonce = this.security.generateRandomString(16);
        const verifier = this.security.generatePkceVerifier();
        const challenge = await this.security.generatePkceChallenge(verifier);

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

        // Use configured Auth endpoint
        return {
            url: `${this.config.endpoints.auth}?${params.toString()}`,
            state: state
        };
    }

    async handleCallback(code, state) {
        const stored = this.storage.getOidcState();

        if (!stored || stored.state !== state) {
            console.error('[AgeWallet] Invalid state or session expired.');
            return;
        }

        const body = {
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            redirect_uri: stored.returnUrl || this.config.redirectUri,
            code: code,
            code_verifier: stored.verifier
        };

        // Attach Secret if provided (required for Confidential Clients)
        if (this.config.clientSecret) {
            body.client_secret = this.config.clientSecret;
        }

        try {
            // Use configured Token endpoint (This allows the Proxy to intercept)
            const tokenData = await this.network.postForm(this.config.endpoints.token, body);

            // Use configured UserInfo endpoint
            const userInfo = await this.network.get(this.config.endpoints.userinfo, tokenData.access_token);

            if (userInfo.age_verified !== true) {
                throw new Error('Age requirement not met.');
            }

            this.storage.setVerification(tokenData);

        } catch (e) {
            console.error('[AgeWallet] Token exchange failed:', e);
        }
    }

    logout() {
        this.storage.clearVerification();
        window.location.reload();
    }
}