// Netlify Serverless Function to Check for Breaking Market Alerts
// Endpoint: POST /api/check-breaking-alerts
// Compares current market prices with 1-hour-ago prices and sends alerts for 10%+ changes

const PRICE_CHANGE_THRESHOLD = 0.10; // 10% change
const LOOKBACK_HOURS = 1;

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const BUTTONDOWN_API_KEY = process.env.BUTTDOWN_API;

    if (!SUPABASE_URL || !SUPABASE_KEY || !BUTTONDOWN_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Required credentials not configured' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { markets } = body;

        if (!Array.isArray(markets) || markets.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'markets array is required' })
            };
        }

        const breakingAlerts = [];
        const oneHourAgo = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

        // Check each market for price changes
        for (const market of markets) {
            const marketId = market.id || market.slug;
            const currentPrice = market.yesPrice;

            if (currentPrice === null || currentPrice === undefined) continue;

            // Fetch price from 1 hour ago
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/market_history?market_id=eq.${encodeURIComponent(marketId)}&recorded_at=lte.${oneHourAgo}&order=recorded_at.desc&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    }
                }
            );

            if (!response.ok) continue;

            const historicalData = await response.json();
            if (historicalData.length === 0) continue;

            const oldPrice = historicalData[0].yes_price;
            if (oldPrice === null || oldPrice === undefined) continue;

            // Calculate price change
            const priceChange = Math.abs(currentPrice - oldPrice);
            const percentChange = priceChange / oldPrice;

            // Check if it exceeds threshold
            if (percentChange >= PRICE_CHANGE_THRESHOLD) {
                const direction = currentPrice > oldPrice ? 'up' : 'down';
                const changePercent = (percentChange * 100).toFixed(1);

                // Check if we already sent this alert today
                const today = new Date().toISOString().split('T')[0];
                const checkSent = await fetch(
                    `${SUPABASE_URL}/rest/v1/breaking_alerts_sent?market_id=eq.${encodeURIComponent(marketId)}&alert_type=eq.price_spike&sent_at=gte.${today}T00:00:00Z`,
                    {
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        }
                    }
                );

                const alreadySent = await checkSent.json();
                if (alreadySent.length > 0) {
                    console.log(`Already sent alert for ${marketId} today`);
                    continue;
                }

                breakingAlerts.push({
                    marketId,
                    title: market.title,
                    oldPrice,
                    currentPrice,
                    percentChange,
                    direction,
                    changePercent,
                    url: market.url
                });
            }
        }

        // Send breaking alerts via Buttondown
        if (breakingAlerts.length > 0) {
            console.log(`Sending ${breakingAlerts.length} breaking alerts`);

            for (const alert of breakingAlerts) {
                // Format email content
                const subject = `🚨 Breaking: ${alert.title} ${alert.direction === 'up' ? '📈' : '📉'} ${alert.changePercent}%`;
                const body = `
**Market Alert**

${alert.title} has moved **${alert.changePercent}%** ${alert.direction} in the last hour.

- Previous: ${(alert.oldPrice * 100).toFixed(1)}%
- Current: ${(alert.currentPrice * 100).toFixed(1)}%

[View Market](${alert.url})

---
You're receiving this because you subscribed to Breaking Alerts on Monitor Mamdani.
                `.trim();

                // Send via Buttondown API to breaking_alerts tag
                const emailResponse = await fetch('https://api.buttondown.email/v1/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        subject,
                        body,
                        email_type: 'public',
                        tags: ['breaking_alerts']
                    })
                });

                if (emailResponse.ok) {
                    console.log(`Sent breaking alert for ${alert.marketId}`);

                    // Record that we sent this alert
                    await fetch(`${SUPABASE_URL}/rest/v1/breaking_alerts_sent`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        },
                        body: JSON.stringify({
                            market_id: alert.marketId,
                            alert_type: 'price_spike'
                        })
                    });
                } else {
                    const errorText = await emailResponse.text();
                    console.error(`Failed to send alert for ${alert.marketId}:`, errorText);
                }
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                alertsSent: breakingAlerts.length,
                alerts: breakingAlerts.map(a => ({ title: a.title, change: a.changePercent }))
            })
        };

    } catch (error) {
        console.error('Error checking breaking alerts:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to check alerts', message: error.message })
        };
    }
}
