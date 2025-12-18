// examples/backend/netlify-functions/api-token.js
const https = require('https');
const querystring = require('querystring');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 1. Parse Input
        const params = querystring.parse(event.body);
        const clientId = params.client_id;

        // 2. Strict Security Check
        // Only allow the specific API Client ID for this function
        if (!clientId || clientId !== process.env.VITE_AW_API_ID) {
            console.error(`[API-Token] Invalid Client ID access attempt: ${clientId}`);
            return { statusCode: 403, body: JSON.stringify({ error: "Access Denied: Invalid Client ID" }) };
        }

        if (!process.env.VITE_AW_API_SECRET) {
            console.error('[API-Token] Server Misconfiguration: Missing Secret');
            return { statusCode: 500, body: JSON.stringify({ error: "Server Error" }) };
        }

        // 3. Inject Secret
        params.client_secret = process.env.VITE_AW_API_SECRET;
        const postData = querystring.stringify(params);

        // 4. Forward to AgeWallet
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'app.agewallet.io',
                path: '/user/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        body: data
                    });
                });
            });

            req.on('error', (e) => {
                console.error('[API-Token] Upstream Error:', e);
                resolve({ statusCode: 502, body: JSON.stringify({ error: 'Gateway Connection Failed' }) });
            });

            req.write(postData);
            req.end();
        });

    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};