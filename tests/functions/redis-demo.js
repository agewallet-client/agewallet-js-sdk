// tests/functions/redis-demo.js
import AgeWallet from '../../src/index.js';
import UpstashStorage from '../helpers/UpstashStorage.js';

// --- CONFIGURATION ---
const REDIS_URL = "https://eternal-unicorn-42562.upstash.io";
const REDIS_TOKEN = "AaZCAAIncDIxNWEwNjU2OTQxZjk0NTUxYjMwMzA2MTZmNzJhZjkzZnAyNDI1NjI";

const CLIENT_ID = '46e132f0-d4f5-4895-adb2-046f8aefd6ab';
const CLIENT_SECRET = 'f57f9a3089f15d1e65a86a7bc664bc85b71f80241b9478146cb24f143f6b4513';
const REDIRECT_URI = "https://agewallet-js-sdk.netlify.app/.netlify/functions/redis-demo";

// --- SESSION UTILITIES ---
function parseCookies(cookieString) {
    const cookies = {};
    if (cookieString) {
        cookieString.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length === 2) cookies[parts[0].trim()] = parts[1].trim();
        });
    }
    return cookies;
}

function generateSimpleSessionId(ip) {
    return `session_${ip.replace(/\./g, '-')}_${Math.random().toString(36).substring(2)}`;
}

// --- HANDLER ---
export const handler = async (event, context) => {
    const headers = event.headers;
    const cookies = parseCookies(headers.cookie);
    const params = event.queryStringParameters || {};

    let sessionId = cookies['redis_session_id'];
    let setCookieHeader = null;

    // 1. Session Setup
    if (!sessionId) {
        sessionId = generateSimpleSessionId(headers['x-nf-client-connection-ip'] || 'unknown');
        setCookieHeader = `redis_session_id=${sessionId}; Max-Age=86400; Path=/; SameSite=Lax`;
    }

    const commonHeaders = {
        'Content-Type': 'text/html; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
    };
    if (setCookieHeader) {
        commonHeaders['Set-Cookie'] = setCookieHeader;
    }

    // 2. Initialize SDK with Redis Storage
    // We create a storage instance scoped to this specific user session
    const userStorage = new UpstashStorage(REDIS_URL, REDIS_TOKEN, `aw_${sessionId}_`);

    const aw = new AgeWallet({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
        environment: 'node', // <--- Crucial: Tells SDK to use Node crypto/buffers
        mode: 'api',
        storage: userStorage
    });

    // --- LOGOUT FLOW ---
    if (params.action === 'logout') {
        await aw.storage.clearVerification();
        // Also clear cookies
        commonHeaders['Set-Cookie'] = setCookieHeader + '; Max-Age=0';
        return {
            statusCode: 302,
            headers: { Location: "/.netlify/functions/redis-demo" },
            body: ''
        };
    }

    // --- CHECK VERIFICATION STATUS ---
    try {
        const token = await aw.storage.getVerificationToken();

        if (token) {
            // User is Verified
            return {
                statusCode: 200,
                headers: commonHeaders,
                body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
                    <div style="font-family:system-ui; padding:40px; text-align:center; background:#f0fdf4; color:#166534;">
                        <h1>🦄 Redis Verification Success!</h1>
                        <p>This content was served directly from the server using the AgeWallet SDK.</p>
                        <p><strong>Session ID:</strong> ${sessionId}</p>
                        <hr style="opacity:0.2; margin:20px 0;">
                        <form method="POST" action="?action=logout">
                            <button style="cursor:pointer; padding:10px 20px;">Logout / Clear Redis</button>
                        </form>
                    </div></body></html>`
            };
        }
    } catch (e) {
        console.error("Redis Read Error:", e);
    }

    // --- CALLBACK FLOW ---
    if (params.code && params.state) {
        try {
            await aw.handleCallback(params.code, params.state);

            // Redirect to clear params
            return {
                statusCode: 302,
                headers: { Location: "/.netlify/functions/redis-demo" },
                body: ""
            };
        } catch (e) {
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: `Verification Failed: ${e.message || 'Unknown Error'}`
            };
        }
    }

    // --- RENDER GATE (UNVERIFIED) ---
    // Auto-generate secure URL with Nonce, PKCE, etc.
    const authData = await aw.generateAuthUrl();

    return {
        statusCode: 200,
        headers: commonHeaders,
        body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
            <div style="font-family:system-ui; padding:40px; text-align:center; max-width:500px; margin:0 auto;">
                <h1>Server-Side Gate (SDK)</h1>
                <p>This content is protected by <strong>Redis + AgeWallet SDK</strong>.</p>
                <p>The server checked the database, found no session for you, and rendered this gate instead of the content.</p>
                <a href="${authData.url}" style="display:inline-block; margin-top:20px; background:#6a1b9a; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Verify with AgeWallet</a>
            </div></body></html>`
    };
};