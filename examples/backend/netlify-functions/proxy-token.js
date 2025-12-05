const https = require('https');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    return new Promise((resolve, reject) => {
        // Forward the request to AgeWallet
        const options = {
            hostname: 'app.agewallet.io',
            path: '/user/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': event.body.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: {
                        // CRITICAL: Allow any origin to read the response (Fixes CORS)
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    body: data
                });
            });
        });

        req.on('error', (e) => {
            console.error(e);
            resolve({
                statusCode: 502,
                body: JSON.stringify({ error: 'Gateway Error: ' + e.message })
            });
        });

        // Write the body received from the SDK (clientId, code, secret, etc.)
        req.write(event.body);
        req.end();
    });
};