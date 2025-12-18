// examples/backend/netlify-functions/headless-content.js
const https = require('https');

exports.handler = async function(event, context) {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) return { statusCode: 401, body: 'Unauthorized' };

    // 1. Verify Token with AgeWallet UserInfo
    const isValid = await new Promise((resolve) => {
        const req = https.request({
            hostname: 'app.agewallet.io',
            path: '/user/userinfo',
            method: 'GET',
            headers: { 'Authorization': authHeader }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve(false);
                try {
                    const json = JSON.parse(data);
                    resolve(json.age_verified === true);
                } catch { resolve(false); }
            });
        });
        req.on('error', () => resolve(false));
        req.end();
    });

    if (!isValid) return { statusCode: 403, body: JSON.stringify({ error: "Token Invalid or Expired" }) };

    // 2. Return Secure Content
    return {
        statusCode: 200,
        body: JSON.stringify({
            title: "Access Granted",
            message: "This is premium content served via Headless API.",
            items: ["Secret Item A", "Secret Item B", "Secret Item C"]
        })
    };
};