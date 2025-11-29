// src/modules/Network.js
/**
 * AgeWallet Network Module
 * Handles HTTP requests for OIDC Token Exchange and API Content Fetching.
 */
export class Network {

    /**
     * POST request (Form URL Encoded) - Used for OIDC Token Endpoint
     * @param {string} url
     * @param {object} bodyParams
     */
    async postForm(url, bodyParams) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(bodyParams)) {
            params.append(key, value);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        return this._handleResponse(response);
    }

    /**
     * GET request - Used for UserInfo and Secure Content Fetch
     * @param {string} url
     * @param {string} token - Bearer Token (Optional)
     */
    async get(url, token = null) {
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        return this._handleResponse(response);
    }

    /**
     * Standardized response handler
     * Automatically parses JSON if content-type matches, otherwise returns text.
     */
    async _handleResponse(response) {
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            throw {
                status: response.status,
                message: data.error_description || data.error || 'Network Error',
                data: data
            };
        }

        return data;
    }
}