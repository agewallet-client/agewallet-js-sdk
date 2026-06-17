// examples/backend/netlify-functions/headless-content.js
//
// Returns secure content to a verified user. Validates the bearer JWT **locally**
// (RS256 signature against AgeWallet's JWKS + exp/iss/aud claims) instead of
// calling /user/userinfo on every request. That's the standard production
// pattern for OIDC-protected resources: integrators verify the self-contained
// JWT on their own backend with no per-request round-trip to AgeWallet, which
// also means no extra `api.call` meter event per protected endpoint hit.
//
// Implemented with Node built-ins only (`https`, `crypto`) — no npm deps. A
// real integrator could swap this for a JWT library like `jose` if they want
// fewer lines and more battle-tested edge-case handling, but the standalone
// version is included here so the verification steps are transparent.

const https = require('https');
const crypto = require('crypto');

// Module-level JWKS cache, reused across warm Lambda invocations.
// 5-minute TTL — fresh enough to pick up rotated keys quickly, long enough to
// keep the network round-trip out of the hot path on warm invokes.
let _jwksCache = null;
let _jwksCacheExpiry = 0;
const JWKS_TTL_MS = 5 * 60 * 1000;

function base64urlDecode(str) {
    const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : '';
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function fetchJwks(apiHost) {
    if (_jwksCache && Date.now() < _jwksCacheExpiry) {
        return Promise.resolve(_jwksCache);
    }
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: apiHost,
            path: '/.well-known/jwks.json',
            method: 'GET',
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`JWKS fetch returned ${res.statusCode}`));
                }
                try {
                    _jwksCache = JSON.parse(data);
                    _jwksCacheExpiry = Date.now() + JWKS_TTL_MS;
                    resolve(_jwksCache);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function verifyJwt(token, jwks, expectedIssuer, expectedAudience) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed JWT');
    const [headerB64, payloadB64, sigB64] = parts;

    const header = JSON.parse(base64urlDecode(headerB64).toString('utf8'));
    const payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
    const signature = base64urlDecode(sigB64);

    if (header.alg !== 'RS256') throw new Error(`Unexpected alg: ${header.alg}`);

    const jwk = jwks.keys.find(k => k.kid === header.kid);
    if (!jwk) throw new Error(`No JWKS key matches kid: ${header.kid}`);

    // Node 16+: crypto.createPublicKey accepts JWK format directly.
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
    if (!crypto.verify('RSA-SHA256', signingInput, publicKey, signature)) {
        throw new Error('Invalid signature');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) throw new Error('Token expired');
    if (payload.iss !== expectedIssuer) throw new Error(`Issuer mismatch: ${payload.iss}`);
    const audClaim = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audClaim.includes(expectedAudience)) throw new Error(`Audience mismatch: ${payload.aud}`);

    return payload;
}

exports.handler = async function(event, context) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Missing or malformed Authorization' }) };
    }
    const token = authHeader.slice(7);

    const apiHost = process.env.AW_API_HOST || 'app.agewallet.io';
    const issuer = `https://${apiHost}`;
    const audience = process.env.VITE_AW_HEADLESS_ID;

    try {
        const jwks = await fetchJwks(apiHost);
        verifyJwt(token, jwks, issuer, audience);
    } catch (e) {
        console.error('[headless-content] JWT verification failed:', e.message);
        return { statusCode: 403, body: JSON.stringify({ error: 'Token Invalid or Expired' }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            title: "Access Granted",
            message: "This is premium content served via Headless API.",
            items: ["Secret Item A", "Secret Item B", "Secret Item C"]
        })
    };
};
