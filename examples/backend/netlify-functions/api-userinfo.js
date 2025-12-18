// examples/backend/netlify-functions/api-userinfo.js
const https = require('https');

exports.handler = async function(event, context) {
    // 1. Strict Method Check
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Extract Authorization Header
    // Netlify/AWS headers are case-insensitive, but we check standard casing
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Missing Authorization Header' }) };
    }

    // 3. Forward to AgeWallet (Server-to-Server)
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'app.agewallet.io',
            path: '/user/userinfo',
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                // Pass the upstream status and body directly to the frontend
                resolve({
                    statusCode: res.statusCode,
                    headers: {
                        'Access-Control-Allow-Origin': '*', // CORS for your frontend
                        'Content-Type': 'application/json'
                    },
                    body: data
                });
            });
        });

        req.on('error', (e) => {
            console.error('[API-UserInfo] Proxy Error:', e);
            resolve({
                statusCode: 502,
                body: JSON.stringify({ error: 'Gateway Error: ' + e.message })
            });
        });

        req.end();
    });
};