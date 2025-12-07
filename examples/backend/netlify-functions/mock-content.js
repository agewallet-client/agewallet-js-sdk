exports.handler = async function(event, context) {
    const authHeader = event.headers.authorization || event.headers.Authorization;

    // 1. Verify Token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Missing Token' }) };
    }

    const token = authHeader.split(' ')[1];

    // Simple validation
    try {
        // Exemption Check
        if (token === 'region_exempt_placeholder') {
            // Pass
        } else {
            // Standard Mock Token (Base64 JSON)
            const data = JSON.parse(Buffer.from(token, 'base64').toString());
            if (data.age_verified !== true) throw new Error();
        }
    } catch (e) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Invalid Token' }) };
    }

    // 2. Return Secure Content (HTML with Scripts for Hydration Test)
    const secureHtml = `
        <div style="background:#e6fffa; color:#004440; padding:20px; border-radius:8px;">
            <h2>🎉 Access Granted!</h2>
            <p>You are viewing secure content fetched via API.</p>
            <div id="js-test-output">Waiting for script...</div>
        </div>

        <script>
            console.log("Hydrated Script Running!");
            document.getElementById('js-test-output').innerText = "✅ Script Executed Successfully!";
            document.getElementById('js-test-output').style.fontWeight = "bold";
        </script>
    `;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: secureHtml
    };
};