// examples/backend/netlify-functions/headless-userinfo.js
const https = require('https');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Authorization' }) };

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'app.agewallet.io',
            path: '/user/userinfo',
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
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
        req.end();
    });
};