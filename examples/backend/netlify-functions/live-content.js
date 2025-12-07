const https = require('https');

exports.handler = async function(event, context) {
    // 1. Extract Token from Header
    const headers = event.headers;
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: "Missing Token" })
        };
    }

    const token = authHeader.split(" ")[1];

    try {
        let userData;

        // 2a. Check for Regional Exemption (Synthetic Token)
        if (token === 'region_exempt_placeholder') {
            console.log("Regional Exemption Detected. Bypassing validation.");
            userData = {
                age_verified: true,
                sub: 'exempt_user_' + Math.random().toString(36).substring(7)
            };
        }
        // 2b. Validate Real Token by calling AgeWallet UserInfo
        else {
            userData = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'app.agewallet.io',
                    path: '/user/userinfo',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(JSON.parse(data));
                        } else {
                            reject(new Error(`UserInfo failed: ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', (e) => reject(e));
                req.end();
            });
        }

        // 3. Check Age Requirement
        if (userData.age_verified !== true) {
            return {
                statusCode: 403,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: "Underage" })
            };
        }

        // 4. Return Secure Content
        const html = `
            <div style="background:#f0f9ff; color:#0c4a6e; padding:2rem; border-radius:12px; text-align:center;">
                <h2 style="margin-top:0">🎉 LIVE VERIFICATION SUCCESS</h2>
                <p><strong>User ID:</strong> ${userData.sub}</p>
                <p>This content was fetched securely from the server after verifying your real AgeWallet token.</p>
                <div style="background:#000; border-radius:8px; padding:20px; color:#fff; margin-top:20px;">
                    [SECURE VIDEO PLAYER PLACEHOLDER]
                </div>
            </div>
        `;

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Allow browser to read response
            },
            body: JSON.stringify({ html: html })
        };

    } catch (e) {
        console.error("Verification Error:", e);
        return {
            statusCode: 403,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: "Verification Failed or Token Invalid" })
        };
    }
};