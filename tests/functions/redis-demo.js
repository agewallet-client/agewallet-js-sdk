import { Redis } from '@upstash/redis';
import crypto from 'crypto';

// --- CONFIGURATION ---
const REDIS_URL = "https://eternal-unicorn-42562.upstash.io";
const REDIS_TOKEN = "AaZCAAIncDIxNWEwNjU2OTQxZjk0NTUxYjMwMzA2MTZmNzJhZjkzZnAyNDI1NjI";
const CLIENT_ID = '46e132f0-d4f5-4895-adb2-046f8aefd6ab';
const CLIENT_SECRET = 'f57f9a3089f15d1e65a86a7bc664bc85b71f80241b9478146cb24f143f6b4513';
const REDIRECT_URI = "https://agewallet-js-sdk.netlify.app/.netlify/functions/redis-demo";

const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });

// --- PKCE UTILITIES (REQUIRED FOR S256) ---

function base64UrlEncode(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function generatePkceVerifier() {
    return base64UrlEncode(crypto.randomBytes(64));
}

function generatePkceChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64UrlEncode(hash);
}

// --- SESSION / COOKIE UTILITIES ---

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
    // Note: Netlify IP address is stable for the duration of a session, good for demo.
    return `session_${ip.replace(/\./g, '-')}_${Math.random().toString(36).substring(2)}`;
}

// --- HANDLER ---

export const handler = async (event, context) => {
    const headers = event.headers;
    const cookies = parseCookies(headers.cookie);
    const params = event.queryStringParameters || {};

    let sessionId = cookies['redis_session_id'];
    let setCookieHeader = null;

    // 1. Session Handling: Ensure the client has a session cookie
    if (!sessionId) {
        sessionId = generateSimpleSessionId(headers['x-nf-client-connection-ip'] || 'unknown');
        setCookieHeader = `redis_session_id=${sessionId}; Max-Age=86400; Path=/; SameSite=Lax`;
    }

    const tokenKey = `aw_verified_${sessionId}`;
    const verifierKey = `aw_verifier_${sessionId}`;
    const verifiedDataRaw = await redis.get(tokenKey);
    const commonHeaders = {
        'Content-Type': 'text/html; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
    };
    if (setCookieHeader) {
        commonHeaders['Set-Cookie'] = setCookieHeader;
    }

    // --- SCENARIO A: User is Verified (Check Redis) ---
    if (verifiedDataRaw) {
        try {
            // Check expiry here if needed, but for simplicity we rely on Redis TTL
            JSON.parse(verifiedDataRaw);

            return {
                statusCode: 200,
                headers: commonHeaders,
                body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
                    <div style="font-family:system-ui; padding:40px; text-align:center; background:#f0fdf4; color:#166534;">
                        <h1>🦄 Redis Verification Success!</h1>
                        <p>This content was served directly from the server.</p>
                        <p><strong>Session ID:</strong> ${sessionId}</p>
                        <hr style="opacity:0.2; margin:20px 0;">
                        <form method="POST" action="?action=logout">
                            <button style="cursor:pointer; padding:10px 20px;">Logout / Clear Redis</button>
                        </form>
                    </div></body></html>`
            };
        } catch (e) {
             // If parsing fails, treat as unverified
        }
    }

    // --- SCENARIO B & C (Logout/Callback) ---
    if (params.action === 'logout') {
        await redis.del(tokenKey);
        await redis.del(verifierKey); // Clear verifier too
        commonHeaders['Set-Cookie'] = setCookieHeader + '; Max-Age=0';
        return {
            statusCode: 302,
            headers: { Location: "/.netlify/functions/redis-demo" },
            body: ''
        };
    }

    if (params.code) {
        // 2. Retrieve Verifier (Critical step)
        const code_verifier = await redis.get(verifierKey);
        await redis.del(verifierKey); // One-time use

        if (!code_verifier) {
             return { statusCode: 400, headers: commonHeaders, body: "Error: Session timed out or state mismatch." };
        }

        try {
            // 3. Exchange Code for Token (with retrieved verifier)
            const tokenResp = await fetch("https://app.agewallet.io/user/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    code: params.code,
                    code_verifier: code_verifier // Use the securely stored verifier
                })
            });

            const tokenData = await tokenResp.json();
            if (tokenData.error) throw new Error(tokenData.error_description || "Token Error");

            const userResp = await fetch("https://app.agewallet.io/user/userinfo", { headers: { "Authorization": "Bearer " + tokenData.access_token } });
            const userData = await userResp.json();

            if (userData.age_verified) {
                const expiry = tokenData.expires_in || 3600;
                await redis.set(tokenKey, JSON.stringify(tokenData), { ex: expiry });

                // Redirect to clear query params and show content
                return {
                    statusCode: 302,
                    headers: { Location: "/.netlify/functions/redis-demo" },
                    body: ""
                };
            }
        } catch (e) {
            return {
                statusCode: 400,
                headers: commonHeaders,
                body: `Verification Failed: ${e.message}`
            };
        }
    }

    // --- SCENARIO D: Render Gate (Unverified) ---

    // 4. Generate S256 PKCE Challenge and save Verifier
    const code_verifier = generatePkceVerifier();
    const code_challenge = generatePkceChallenge(code_verifier);
    await redis.set(verifierKey, code_verifier, { ex: 300 }); // Store verifier for 5 min

    const authUrl = `https://app.agewallet.io/user/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid+age&state=redis-test&code_challenge=${code_challenge}&code_challenge_method=S256`;

    return {
        statusCode: 200,
        headers: commonHeaders,
        body: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
            <div style="font-family:system-ui; padding:40px; text-align:center; max-width:500px; margin:0 auto;">
                <h1>Server-Side Gate</h1>
                <p>This content is protected by <strong>Redis</strong>.</p>
                <p>The server checked the database, found no session for you, and rendered this gate instead of the content.</p>
                <a href="${authUrl}" style="display:inline-block; margin-top:20px; background:#6a1b9a; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Verify with AgeWallet</a>
            </div></body></html>`
    };
};