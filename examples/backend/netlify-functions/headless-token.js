// examples/backend/netlify-functions/headless-token.js
const https = require('https');
const querystring = require('querystring');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const params = querystring.parse(event.body);
        const clientId = params.client_id;

        // STRICT: Only allow the Headless Client ID
        if (clientId !== process.env.VITE_AW_HEADLESS_ID) {
            console.error(`[Headless-Token] Invalid Client ID: ${clientId}`);
            return { statusCode: 403, body: JSON.stringify({ error: "Access Denied" }) };
        }

        // Inject Secret
        params.client_secret = process.env.VITE_AW_HEADLESS_SECRET;
        const postData = querystring.stringify(params);

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'app.agewallet.io',
                path: '/user/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({
                    statusCode: res.statusCode,
                    headers: { 'Content-Type': 'application/json' },
                    body: data
                }));
            });

            req.on('error', (e) => resolve({ statusCode: 502, body: JSON.stringify({ error: e.message }) }));
            req.write(postData);
            req.end();
        });

    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};