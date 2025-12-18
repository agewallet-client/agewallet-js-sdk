import { AgeWallet } from '../../../src/index.js';
import { UpstashStorage } from '../helpers/UpstashStorage.js';

// --- CONFIGURATION ---
// These are pulled from your Netlify Environment Variables
const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;
const CLIENT_ID = process.env.AW_REDIS_ID;
const CLIENT_SECRET = process.env.AW_REDIS_SECRET;

// STRICT: The Site URL and Callback must match AgeWallet Dashboard
const SITE_URL = "https://aw-redis.netlify.app";
const REDIRECT_URI = `${SITE_URL}/callback`;

// --- UTILITIES ---
function parseCookies(headers) {
    const list = {};
    const cookieHeader = headers.cookie || "";
    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name?.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        if (value) list[name] = decodeURIComponent(value);
    });
    return list;
}

// --- HTML TEMPLATE ENGINE ---
const renderPage = (title, bodyContent, navLinks, isVerified) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SSR Redis - ${title}</title>
    <style>
        body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #e0e0e0; padding: 2rem; max-width: 800px; margin: 0 auto; }
        nav { border-bottom: 1px solid #444; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; gap: 20px; align-items: center; }
        nav a { color: #fff; text-decoration: none; text-transform: uppercase; font-weight: bold; }
        nav a:hover { color: #4caf50; }
        .btn { background: #4caf50; color: #000; padding: 10px 20px; border: none; font-weight: bold; cursor: pointer; text-decoration:none; display:inline-block; }
        .btn-reset { background: transparent; border: 1px solid #ff5252; color: #ff5252; font-size: 0.8rem; margin-left: auto; cursor:pointer; padding: 5px 10px;}
        .status { padding: 10px; background: ${isVerified ? '#1b5e20' : '#b71c1c'}; margin-bottom: 20px; border-radius: 4px; font-weight:bold;}
        .gate { border: 1px dashed #666; padding: 40px; text-align: center; background: #222; }
    </style>
</head>
<body>
    <nav>
        ${navLinks}
        <form method="POST" action="/reset" style="margin-left:auto; margin-bottom:0;">
            <button class="btn btn-reset">RESET SESSION</button>
        </form>
    </nav>

    <div class="status">Status: ${isVerified ? 'VERIFIED (Redis)' : 'UNVERIFIED (Gated)'}</div>

    <h1>${title}</h1>
    ${bodyContent}
</body>
</html>
`;

export const handler = async (event, context) => {
    // Normalize Path (Remove function prefix if present)
    const path = event.path.replace(/\/\.netlify\/functions\/redis-site/, '');
    const currentPath = path === '' ? '/' : path;

    const cookies = parseCookies(event.headers);

    // 1. SESSION MANAGEMENT (Cookie + Redis)
    let sessionId = cookies['aw_redis_sess'];
    let newCookieHeader = null;

    if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Secure, HTTP-Only Cookie (Browser cannot touch this)
        newCookieHeader = `aw_redis_sess=${sessionId}; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`;
    }

    // 2. INIT SDK WITH REDIS STORAGE
    // We bind the SDK to this specific user's session ID
    const storage = new UpstashStorage(REDIS_URL, REDIS_TOKEN, `aw_sess_${sessionId}_`);

    const aw = new AgeWallet({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
        environment: 'node', // Server-Side Mode
        mode: 'api',
        storage: storage
    });

    // 3. HANDLE RESET (POST /reset)
    if (currentPath === '/reset' && event.httpMethod === 'POST') {
        await aw.storage.clearVerification();
        return {
            statusCode: 302,
            headers: {
                'Location': '/',
                'Set-Cookie': `aw_redis_sess=; Max-Age=0; Path=/; HttpOnly` // Expire Cookie
            },
            body: ''
        };
    }

    // 4. HANDLE OAUTH CALLBACK (/callback)
    if (currentPath === '/callback') {
        const params = event.queryStringParameters || {};

        // Handle Errors (e.g., Access Denied)
        if (params.error) {
             return { statusCode: 302, headers: { 'Location': '/' }, body: '' };
        }

        // Handle Success code
        if (params.code && params.state) {
            try {
                // Exchange Code -> Token -> Store in Upstash Redis
                // The return value (dest) is the deep link we saved in state
                const dest = await aw.handleCallback(params.code, params.state);
                return {
                    statusCode: 302,
                    headers: {
                        'Location': dest || '/',
                        ...(newCookieHeader ? { 'Set-Cookie': newCookieHeader } : {})
                    },
                    body: ''
                };
            } catch (e) {
                return { statusCode: 400, body: `Callback Error: ${e.message}` };
            }
        }
    }

    // 5. CHECK VERIFICATION STATUS
    const token = await aw.storage.getVerificationToken();
    const isVerified = !!token;

    // 6. GENERATE AUTH URL (If needed)
    let authUrl = '#';
    if (!isVerified) {
        // We manually generate the URL so we can inject the 'currentPath' as the Deep Link
        const state = aw.security.generateRandomString(16);
        const nonce = aw.security.generateRandomString(16);
        const verifier = aw.security.generatePkceVerifier();
        const challenge = await aw.security.generatePkceChallenge(verifier);

        // SAVE STATE TO REDIS (Map State -> Deep Link)
        await aw.storage.setOidcState(state, verifier, nonce, SITE_URL + currentPath);

        const q = new URLSearchParams({
            response_type: 'code',
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'openid age',
            state: state,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            nonce: nonce
        });
        authUrl = `https://app.agewallet.io/user/authorize?${q.toString()}`;
    }

    // 7. ROUTING & CONTENT GENERATION
    let content = '';
    const nav = `
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/shop">Shop</a>
    `;

    // --- PAGE: HOME (/) ---
    if (currentPath === '/') {
        if (isVerified) {
            content = `
                <h3>Welcome Home</h3>
                <p>You are verified via Redis Session.</p>
                <p><strong>Session ID:</strong> ${sessionId}</p>
                <p>The SDK checked Upstash and found a valid token.</p>
            `;
        } else {
            content = `
                <div class="gate">
                    <h3>⛔ Verification Required</h3>
                    <p>This content is protected by Server-Side Redis logic.</p>
                    <a href="${authUrl}" class="btn">Verify Age</a>
                </div>
            `;
        }
    }
    // --- PAGE: ABOUT (/about) ---
    else if (currentPath === '/about') {
        if (isVerified) {
            content = `
                <h3>ℹ️ Secret History</h3>
                <p>This HTML was generated on the server.</p>
                <p>Unverified users <strong>never</strong> received this string.</p>
            `;
        } else {
             content = `
                <div class="gate">
                    <h3>🔒 Restricted Access</h3>
                    <p>You must verify to see the About page.</p>
                    <a href="${authUrl}" class="btn">Verify Age</a>
                </div>
            `;
        }
    }
    // --- PAGE: SHOP (/shop) ---
    else if (currentPath === '/shop') {
        if (isVerified) {
            content = `
                <h3>🛒 VIP Shop</h3>
                <ul>
                    <li>🔥 Flamethrower</li>
                    <li>🗡️ Sword of Truth</li>
                    <li>🛡️ Shield of Redis</li>
                </ul>
            `;
        } else {
             content = `
                <div class="gate">
                    <h3>⛔ Shop Closed</h3>
                    <p>Deep Link Protection Active.</p>
                    <a href="${authUrl}" class="btn">Verify Age</a>
                </div>
            `;
        }
    }
    // --- 404 ---
    else {
        return { statusCode: 404, body: 'Not Found' };
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            ...(newCookieHeader ? { 'Set-Cookie': newCookieHeader } : {})
        },
        body: renderPage(currentPath, content, nav, isVerified)
    };
};