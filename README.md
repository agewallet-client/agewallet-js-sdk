# AgeWallet JavaScript SDK

The official, zero-dependency JavaScript SDK for integrating AgeWallet Age Verification into modern web applications.

Designed for versatility, it supports everything from static landing pages to Single Page Applications (React, Vue, Angular) and Server-Side Node.js environments.

## Features

- **Universal Support:** Works in all modern browsers and Node.js 19+ (Server-Side Rendering).

- **Secure by Default:** Automatically handles OIDC Authorization Code Flow with PKCE (S256) and State verification.

- **Flexible Modes:**

  - **Overlay Mode:** Drop-in age gate for marketing sites.

  - **Headless Mode:** Full control for SPAs and custom UIs.

  - **API Mode:** Secure content fetching for premium video/assets.

  - **Zero Dependencies:** Lightweight and fast.

## Installation

### Option 1: NPM (Recommended for Bundlers)

    npm install @agewallet/js-sdk


    import { AgeWallet } from '@agewallet/js-sdk';

### Option 2: CDN (Browser Script)

    <script src="https://unpkg.com/@agewallet/js-sdk@latest/dist/agewallet.min.js"></script>
    <script>
      // Access via global window.AgeWallet
      const aw = new AgeWallet({ ... });
    </script>

## Quick Start: Standard Overlay

The fastest way to protect a landing page. This renders a fixed-position age gate over your content until the user verifies.

    import { AgeWallet } from '@agewallet/js-sdk';

    const aw = new AgeWallet({
        clientId: 'YOUR_CLIENT_ID',
        clientSecret: 'YOUR_CLIENT_SECRET', // Only required for Confidential Clients
        mode: 'overlay',
        redirectUri: window.location.origin + '/' // Single callback URL (see note below)
    });

    aw.init();

### ⚠️ Important: Single Redirect URI

AgeWallet requires **one redirect URI per Client ID**. All pages on your site must use the same `redirectUri` value (typically your homepage or a dedicated `/callback` route).

The SDK automatically handles deep linking — if a user lands on `/shop/product-123` and needs to verify, they will be returned to `/shop/product-123` after verification, even though the OAuth callback goes through your single redirect URI.

## Configuration

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `clientId` | `string` | **Required** | Your AgeWallet Application ID. |
| `clientSecret` | `string` | `''` | Required for Confidential Clients. Leave empty for Public Clients (SPA). |
| `redirectUri` | `string` | `window.location` | The single OAuth callback URL (e.g., `window.location.origin + '/'`). Must be whitelisted in Dashboard. One per Client ID. |
| `mode` | `string` | `'overlay'` | `'overlay'` (Default) or `'api'` (Secure Fetch). |
| `render` | `boolean` | `true` | Set to `false` for Headless Mode (no UI injected). |
| `storage` | `string` \| `object` | `'cookie'` | `'cookie'`, `'local'`, or a custom object implementing `SessionHandlerInterface`. |
| `targetSelector` | `string` | `'body'` | CSS selector for the container where the Gate UI will be rendered. |
| `api` | `object` | `{}` | Required for `api` mode. Must contain an `endpoint` URL. |
| `environment` | `string` | `'browser'` | `'browser'` (Default) or `'node'` (Server-Side). |
| `ui` | `object` | `{}` | Customize text and logo (see below). |
| `onVerified` | `function` | `null` | Callback fired when verification succeeds. Receives content (API mode) or null (Overlay mode). |
| `onUnverified` | `function` | `null` | Callback fired when verification is required. Receives the `authUrl` string. |

## Advanced Usage

### Headless Mode (React / Vue)

For full control over the UI, disable the built-in renderer and use event handlers.

    const aw = new AgeWallet({
        clientId: 'YOUR_ID',
        render: false, // Disable SDK UI
        redirectUri: 'https://mysite.com/callback',

        // Called when user needs to verify
        onUnverified: (authUrl) => {
            // Show your own "Verify Age" button linking to authUrl
            setVerifyLink(authUrl);
            setShowGate(true);
        },

        // Called when verification is successful
        onVerified: (content) => {
            // Content is null in overlay mode, or data in API mode
            setShowGate(false);
            setVerified(true);
        }
    });

    aw.init();

### Local Storage (SPA Friendly)

By default, the SDK uses `document.cookie` for compatibility. For Single Page Apps where you prefer `localStorage`:

    const aw = new AgeWallet({
        // ... credentials ...
        storage: 'local' // Tokens stored in localStorage (Key: aw_verified)
    });

### Custom Branding

You can customize the look and feel of the built-in age gate by passing a `ui` object.

    const aw = new AgeWallet({
        // ... credentials ...
        ui: {
            title: "Restricted Access",
            description: "Please verify your age to enter the VIP lounge.",
            buttonText: "I am 18+",
            logo: "https://example.com/my-logo.png", // Optional
        }
    });

**CSS Overrides:** The SDK uses BEM-style classes. You can override them in your own CSS:

    /* Change the "Agree" button color */
    .aw-gate__btn--yes {
        background-color: #ff0055 !important;
    }

## Server-Side Verification (Node.js)

The SDK works natively in Node.js (v19+) for server-side rendering (SSR) or API protection.

**Configuration:** Set `environment: 'node'` to enable server-compatible cryptography.

    import { AgeWallet } from '@agewallet/js-sdk';

    // 1. Initialize
    // You must provide a custom storage handler for the server (e.g., Redis, DB)
    const myStorage = {
        get: async (key) => { /* return value from DB */ },
        set: async (key, val) => { /* save value to DB */ },
        remove: async (key) => { /* delete from DB */ }
    };

    const aw = new AgeWallet({
        clientId: 'YOUR_ID',
        clientSecret: 'YOUR_SECRET',
        redirectUri: 'https://mysite.com/callback',
        environment: 'node', // <--- Crucial for Node.js support
        mode: 'api',
        storage: myStorage
    });

    // 2. Generate Auth URL (for unverified users)
    const authData = await aw.generateAuthUrl();
    // Redirect user to: authData.url

    // 3. Handle Callback OR Exemption
    // Call this when the user returns to your callback URL.
    // It might contain ?code=... (Verification) OR ?error=... (Exemption)

    if (req.query.error) {
        // Handle Regional Exemption (e.g. "Region does not require verification")
        await aw.handleError(req.query.error, req.query.error_description, req.query.state);
    } else if (req.query.code) {
        // Handle Standard Verification
        await aw.handleCallback(req.query.code, req.query.state);
    }

    // 4. Check Status
    const token = await aw.storage.getVerificationToken();

    if (token) {
       // User is verified (or exempt)
    }

### ⚠️ Important: Regional Exemptions & API Mode

 If a user visits from an exempt region (e.g., a jurisdiction where verification is not legally required), the SDK will generate a **Synthetic Token** to grant access without an ID scan.

The token string will be: `'region_exempt_placeholder'`

 **If you are validating tokens on your backend:** You must check for this specific string *before* calling the AgeWallet UserInfo endpoint. Sending this placeholder to the AgeWallet API will result in a `401 Unauthorized` error.

 **Example Backend Check:**

    if (token === 'region_exempt_placeholder') {
        // Allow access (Regional Exemption)
        return serveContent();
    }

## Examples & Recipes

This repository includes complete multi-page example sites in the `examples/` directory, demonstrating real-world integration patterns with deep link support.

### Frontend Examples

Each example is a 3-page mini-site (Home, About, Shop) demonstrating how verification persists across pages and deep links.

- **[Overlay Mode](examples/sites/overlay/):** The standard full-screen gate integration with deep link preservation.
- **[API Mode](examples/sites/api/):** Securely fetching content from a backend only after verification.
- **[Headless Mode](examples/sites/headless/):** Building a completely custom UI (React/Vue style) without the SDK's default styling.
- **[Local Storage](examples/sites/local/):** Persisting tokens in `localStorage` for Single Page Apps.
- **[Custom Branding](examples/sites/branding/):** Customizing the default gate's logo, text, and colors via CSS variable overrides.

### Backend Examples

- **[SSR + Redis](examples/sites/redis/):** A fully server-rendered Node.js example using Upstash Redis for session management. Demonstrates deep link restoration entirely on the server.
- **[Netlify Functions](examples/backend/netlify-functions/):** Serverless token proxy functions for secure client secret handling.
