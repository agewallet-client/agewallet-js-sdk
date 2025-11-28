exports.handler = async function(event, context) {
    const params = event.queryStringParameters || {};
    const body = new URLSearchParams(event.body || '');

    // 1. Authorization Request (GET) -> Redirect back with code
    if (event.httpMethod === 'GET' && params.redirect_uri) {
        const code = 'mock_auth_code_' + Math.random().toString(36).substring(7);
        const state = params.state || '';
        const returnUrl = `${params.redirect_uri}?code=${code}&state=${state}`;

        return {
            statusCode: 302,
            headers: { Location: returnUrl },
            body: ''
        };
    }

    // 2. Token Exchange (POST) -> Return Fake JWT
    if (event.httpMethod === 'POST') {
        // Create a fake JWT-like token (Base64)
        const fakeToken = Buffer.from(JSON.stringify({
            sub: 'user_123',
            age_verified: true,
            exp: Date.now() + 3600000 // 1 hour
        })).toString('base64');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_token: fakeToken,
                token_type: 'Bearer',
                expires_in: 3600
            })
        };
    }

    return { statusCode: 400, body: 'Invalid Request' };
};