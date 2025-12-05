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

    <script src="https://unpkg.com/@agewallet/js-sdk@latest/dist/agewallet.umd.cjs"></script>
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
        redirectUri: window.location.href.split('?')[0] // Redirect back to the same page
    });

    aw.init();

## Configuration

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `clientId` | `string` | **Required** | Your AgeWallet Application ID. |
| `clientSecret` | `string` | `''` | Required for Confidential Clients. Leave empty for Public Clients (SPA). |
| `redirectUri` | `string` | `window.location` | The URL users return to after verification. Must be whitelisted in Dashboard. |
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

    // 3. Handle Callback (Exchange Token)
    // Call this when the user returns to your callback URL with ?code=...
    await aw.handleCallback(code, state);
    const token = await aw.storage.getVerificationToken();

    if (token) {
       // User is verified
    }
