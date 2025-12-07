import { AgeWallet } from '../../../src/index.js';
import { UpstashStorage } from '../helpers/UpstashStorage.js';

// --- CONFIGURATION (Env Vars) ---
const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;

const CLIENT_ID = process.env.AW_REDIS_ID;
const CLIENT_SECRET = process.env.AW_REDIS_SECRET;
// Note: We assume the Redirect URI is configured in Netlify or derived dynamically
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

    if (!sessionId) {
        sessionId = generateSimpleSessionId(headers['x-nf-client-connection-ip'] || 'unknown');
        setCookieHeader = `redis_session_id=${sessionId}; Max-Age=86400; Path=/; SameSite=Lax`;
    }

    const commonHeaders = {
        'Content-Type': 'text/html; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    if (setCookieHeader) {
        commonHeaders['Set-Cookie'] = setCookieHeader;
    }

    // Initialize SDK with Redis Storage
    const userStorage = new UpstashStorage(REDIS_URL, REDIS_TOKEN, `aw_${sessionId}_`);

    const aw = new AgeWallet({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
        environment: 'node',
        mode: 'api',
        storage: userStorage
    });

    // Logout
    if (params.action === 'logout') {
        await aw.storage.clearVerification();
        const logoutHeaders = {
            ...commonHeaders,
            'Location': "/ssr-redis-session.html",
            'Set-Cookie': `redis_session_id=${sessionId}; Max-Age=0; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
        };
        return { statusCode: 302, headers: logoutHeaders, body: '' };
    }

    // Check Status
    try {
        const token = await aw.storage.getVerificationToken();
        if (token) {
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

    // Error / Exemption Handling (e.g. Regional Access Denied)
    if (params.error && params.state) {
        const handled = await aw.handleError(params.error, params.error_description, params.state);
        if (handled) {
            return {
                statusCode: 302,
                headers: { ...commonHeaders, 'Location': "/.netlify/functions/redis-demo" },
                body: ""
            };
        }
        // If not handled (actual error), fall through to show the error message or gate
        return {
            statusCode: 400,
            headers: commonHeaders,
            body: `Verification Error: ${params.error_description || params.error}`
        };
    }

    // Callback
    if (params.code && params.state) {
        try {
            await aw.handleCallback(params.code, params.state);
            return {
                statusCode: 302,
                headers: { ...commonHeaders, 'Location': "/.netlify/functions/redis-demo" },
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

    // Gate
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