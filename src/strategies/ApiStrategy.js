// src/strategies/ApiStrategy.js
/**
 * API Strategy (Strict/Secure Mode)
 * Checks verification. If verified, fetches secure content.
 * If unverified, shows Gate.
 */
export class ApiStrategy {
    constructor(core) {
        this.core = core;
    }

    async execute() {
        const token = await this.core.storage.getVerificationToken();
        const target = document.querySelector(this.core.config.targetSelector);

        // Safety check for Render Mode
        if (this.core.config.render && !target) {
            console.error(`[AgeWallet] Target "${this.core.config.targetSelector}" not found.`);
            return;
        }

        // --- Scenario A: User is Verified ---
        if (token) {
            if (!this.core.config.api || !this.core.config.api.endpoint) {
                console.error('[AgeWallet] API Strategy requires config.api.endpoint');
                return;
            }

            try {
                // 1. Show Loading State (only if rendering)
                if (this.core.config.render) {
                    this.core.renderer.renderLoading(target);
                }

                // 2. Fetch Content
                const content = await this.core.network.get(this.core.config.api.endpoint, token);

                // 3. Handle Content
                if (this.core.config.render) {
                    // Inject & Hydrate
                    this.core.renderer.injectContent(target, content);
                } else {
                    // Pass data to App
                    if (this.core.config.onVerified) {
                        this.core.config.onVerified(content);
                    }
                }

            } catch (e) {
                console.warn('[AgeWallet] Verification failed or expired.', e);
                await this.core.storage.clearVerification();
                await this._showGate(target);
            }
            return;
        }

        // --- Scenario B: User is Unverified ---
        await this._showGate(target);
    }

    async _showGate(target) {
        const authData = await this.core.generateAuthUrl();

        if (this.core.config.render) {
            this.core.renderer.renderGate(target, this.core.config.ui, authData.url);
        } else {
            if (this.core.config.onUnverified) {
                this.core.config.onUnverified(authData.url);
            }
        }
    }
}