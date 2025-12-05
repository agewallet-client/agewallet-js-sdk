const https = require('https');
const querystring = require('querystring');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 1. Parse the incoming body (from Frontend)
    const params = querystring.parse(event.body);
    const clientId = params.client_id;

    if (!clientId) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing client_id" }) };
    }

    // 2. Look up the Secret for this App
    // We check which env var matches the incoming Client ID
    const appMap = {
        [process.env.VITE_AW_OVERLAY_ID]: process.env.VITE_AW_OVERLAY_SECRET,
        [process.env.VITE_AW_API_ID]:     process.env.VITE_AW_API_SECRET,
        [process.env.VITE_AW_HEADLESS_ID]: process.env.VITE_AW_HEADLESS_SECRET,
        [process.env.VITE_AW_LOCAL_ID]:    process.env.VITE_AW_LOCAL_SECRET,
        [process.env.VITE_AW_BRANDING_ID]: process.env.VITE_AW_BRANDING_SECRET
    };

    const secret = appMap[clientId];

    if (!secret) {
        console.error(`[Proxy] No secret found for Client ID: ${clientId}`);
        return { statusCode: 500, body: JSON.stringify({ error: "Server Configuration Error: Invalid Client ID" }) };
    }

    // 3. Inject the Secret into the params
    params.client_secret = secret;
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
            console.error(e);
            resolve({ statusCode: 502, body: JSON.stringify({ error: 'Gateway Error: ' + e.message }) });
        });

        req.write(postData);
        req.end();
    });
};