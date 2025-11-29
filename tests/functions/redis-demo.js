const { Redis } = require('@upstash/redis');

// --- CONFIGURATION ---
const REDIS_URL = "https://eternal-unicorn-42562.upstash.io";
const REDIS_TOKEN = "AaZCAAIncDIxNWEwNjU2OTQxZjk0NTUxYjMwMzA2MTZmNzJhZjkzZnAyNDI1NjI";

// NEW CREDENTIALS FOR REDIS TEST CLIENT
const CLIENT_ID = '46e132f0-d4f5-4895-adb2-046f8aefd6ab';
const CLIENT_SECRET = 'f57f9a3089f15d1e65a86a7bc664bc85b71f80241b9478146cb24f143f6b4513';

const REDIRECT_URI = "https://agewallet-js-sdk.netlify.app/.netlify/functions/redis-demo";

const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });

exports.handler = async function(event, context) {
    // 1. Identify User (Simulated Session)
    // In a real app, you'd use a 'session_id' cookie.
    // For this demo, we'll use the IP address or a mock ID to keep it simple.
    const sessionId = event.headers['x-nf-client-connection-ip'] || 'demo-user';

    // 2. Check Redis for Verification
    const tokenKey = `aw_verified_${sessionId}`;
    const verifiedData = await redis.get(tokenKey);

    // --- SCENARIO A: User is Verified ---
    if (verifiedData) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <div style="font-family:system-ui; padding:40px; text-align:center; background:#f0fdf4; color:#166534;">
                    <h1>🦄 Redis Verification Success!</h1>
                    <p>This page was rendered on the server.</p>
                    <p><strong>Status:</strong> Verified</p>
                    <p><strong>Storage:</strong> Upstash Redis (Server-Side)</p>
                    <hr style="opacity:0.2; margin:20px 0;">
                    <form method="POST" action="?action=logout">
                        <button style="cursor:pointer; padding:10px 20px;">Logout / Clear Redis</button>
                    </form>
                </div>
            `
        };
    }

    const params = event.queryStringParameters || {};

    // --- SCENARIO B: Logout Action ---
    if (params.action === 'logout') {
        await redis.del(tokenKey);
        return {
            statusCode: 302,
            headers: { Location: '/.netlify/functions/redis-demo' },
            body: ''
        };
    }

    // --- SCENARIO C: Callback from AgeWallet ---
    if (params.code) {
        try {
            // Exchange Code for Token
            const tokenResp = await fetch("https://app.agewallet.io/user/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI,
                    code: params.code,
                    // Note: For this server-side demo we are skipping PKCE verifier check
                    // to keep the file single-contained. In production, you'd retrieve the stored verifier from Redis.
                    code_verifier: "skip_for_demo"
                })
            });

            const tokenData = await tokenResp.json();

            // Verify Age
            const userResp = await fetch("https://app.agewallet.io/user/userinfo", {
                headers: { "Authorization": "Bearer " + tokenData.access_token }
            });
            const userData = await userResp.json();

            if (userData.age_verified) {
                // Save to Redis
                await redis.set(tokenKey, tokenData, { ex: 3600 });

                // Redirect to clear query params
                return {
                    statusCode: 302,
                    headers: { Location: "/.netlify/functions/redis-demo" },
                    body: ""
                };
            }
        } catch (e) {
            return { statusCode: 400, body: "Verification Failed: " + e.message };
        }
    }

    // --- SCENARIO D: Render Gate (Unverified) ---
    // Generate Auth URL
    const authUrl = `https://app.agewallet.io/user/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid+age&state=redis-test&code_challenge=skip_for_demo&code_challenge_method=plain`;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `
            <div style="font-family:system-ui; padding:40px; text-align:center; max-width:500px; margin:0 auto;">
                <h1>🛡️ Server-Side Gate</h1>
                <p>This content is protected by <strong>Redis</strong>.</p>
                <p>The server checked the database, found no session for you, and rendered this gate instead of the content.</p>
                <a href="${authUrl}" style="display:inline-block; margin-top:20px; background:#6a1b9a; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Verify with AgeWallet</a>
            </div>
        `
    };
};