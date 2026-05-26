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
| `onVerified` | `function` | `null` | Callback fired when verification succeeds. Receives `(content, info)`: content is API-mode data or `null` for overlay; `info` is `{metadata, expiresAt, hasToken}`. |
| `onUnverified` | `function` | `null` | Callback fired when verification is required. Receives the `authUrl` string. |
| `metadata` | `string` | `null` | Optional opaque per-verification string (max 4096 bytes) sent with the next auth request and round-tripped back. See [Metadata Pass-Through](#metadata-pass-through). |

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

## Metadata Pass-Through

Attach an arbitrary opaque string (max 4096 bytes) — for example an order ID, customer ID, or any other reference — to a verification request. AgeWallet stores it server-side and returns it to the SDK, where you can read it back via `getMetadata()` or the `onVerified(content, info)` callback.

### Three ways to set metadata

    // 1. Constructor (initial / static value)
    const aw = new AgeWallet({
        clientId: 'YOUR_ID',
        redirectUri: 'https://mysite.com/',
        metadata: 'site:winery1'
    });

    // 2. Runtime setter (overlay mode — update before next button click)
    aw.setMetadata('order:' + currentOrderId);

    // 3. Per-call (headless mode — override at the moment you build the auth URL)
    const { url } = await aw.generateAuthUrl({ metadata: 'order:XYZ-42' });
    window.location.href = url;

Precedence: per-call option > runtime setter > constructor value.

### Reading metadata back

Two equivalent ways:

    // (a) Method — call any time after init()
    const value = await aw.getMetadata();   // 'order:XYZ-42' or null

    // (b) onVerified callback (headless mode) — second arg
    const aw = new AgeWallet({
        clientId, redirectUri, render: false,
        onVerified: (content, info) => {
            console.log(info.metadata);     // 'order:XYZ-42'
            console.log(info.expiresAt);    // ms timestamp
        }
    });

The value comes from the server's signed `/user/userinfo` response, persisted alongside the access token. It survives page navigations the same way the verification itself does (via cookie or `localStorage`, per your `storage` option).

### Notes

- Sending more than 4096 bytes throws `Error('[AgeWallet] metadata exceeds 4096-byte limit.')` — fail-fast at the SDK before hitting the server.
- Metadata is **optional**. If you don't set it, the existing flow is unchanged — `getMetadata()` returns `null` and `onVerified`'s `info.metadata` is `null`.
- `info` second arg to `onVerified` is additive — existing single-arg callbacks (`(content) => ...`) keep working.

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

    // 3. Handle Callback
    // Call this when the user returns to your callback URL.
    // It might contain ?code=... (Verification) OR ?error=... (Failure)

    if (req.query.code) {
        // Handle Standard Verification
        await aw.handleCallback(req.query.code, req.query.state);
    }

    // 4. Check Status
    const token = await aw.storage.getVerificationToken();

    if (token) {
       // User is verified
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
