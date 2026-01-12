// Netlify Serverless Function for Buttondown Newsletter Subscription
// Endpoint: POST /api/subscribe

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Note: User set this as BUTTDOWN_API (typo) in Netlify
    const BUTTONDOWN_API_KEY = process.env.BUTTDOWN_API || process.env.BUTTONDOWN_API;

    if (!BUTTONDOWN_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Buttondown API key not configured' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { email, tags } = body;

        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Email is required' })
            };
        }

        // Subscribe via Buttondown API
        const response = await fetch('https://api.buttondown.email/v1/subscribers', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                tags: tags || []
            })
        });

        const data = await response.json();

        if (response.ok || response.status === 201) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Successfully subscribed!'
                })
            };
        } else if (response.status === 409) {
            // Already subscribed - still a success
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'You are already subscribed!'
                })
            };
        } else {
            return {
                statusCode: response.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: data.detail || data.message || 'Subscription failed',
                    details: data
                })
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to process subscription',
                message: error.message
            })
        };
    }
}
