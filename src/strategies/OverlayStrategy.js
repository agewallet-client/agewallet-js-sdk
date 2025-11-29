// src/strategies/OverlayStrategy.js
/**
 * Overlay Strategy (Standard Mode)
 * Checks verification. If unverified, renders the Gate UI.
 * If verified, does nothing (allowing content to be seen).
 */
export class OverlayStrategy {
    constructor(core) {
        this.core = core; // Access to Security, Storage, Renderer, Config
    }

    async execute() {
        // Must await storage retrieval
        const token = await this.core.storage.getVerificationToken();

        // 1. User is Verified
        if (token) {
            // Overlay mode: We just do nothing and let the content show.
            // Headless mode: We inform the app the user is verified.
            if (!this.core.config.render && this.core.config.onVerified) {
                this.core.config.onVerified(null); // No content to pass in overlay mode
            }
            return;
        }

        // 2. User is Unverified
        const authData = await this.core.generateAuthUrl();

        if (this.core.config.render) {
            // A. SDK Renders UI
            const target = document.querySelector(this.core.config.targetSelector);
            if (!target) {
                console.error(`[AgeWallet] Target "${this.core.config.targetSelector}" not found.`);
                return;
            }
            this.core.renderer.renderGate(target, this.core.config.ui, authData.url);
        } else {
            // B. Headless (React/Vue)
            if (this.core.config.onUnverified) {
                this.core.config.onUnverified(authData.url);
            }
        }
    }
}