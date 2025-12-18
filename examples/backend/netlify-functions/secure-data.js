exports.handler = async (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader) return { statusCode: 401, body: 'Missing Authorization Header' };

    try {
        const token = authHeader.split(' ')[1];

        // Validate token using CORRECT endpoint
        const response = await fetch('https://app.agewallet.io/user/userinfo', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error('Token validation failed');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: "ACCESS_GRANTED",
                user_age_status: data.age_verified ? "Verified" : "Unverified",
                secret_message: "Congratulations! You have unlocked the secure API content.",
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Invalid or Expired Token' })
        };
    }
};