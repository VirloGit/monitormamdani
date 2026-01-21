// Netlify Serverless Function to Check for Breaking Market Alerts
// Endpoint: POST /api/check-breaking-alerts
// Compares current market prices with 1-hour-ago prices and sends alerts for significant changes

const PRICE_CHANGE_THRESHOLD = 0.15; // 15% change (increased from 10% to reduce alert volume)
const LOOKBACK_HOURS = 1;

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const SUPBASE_URL = process.env.SUPBASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const BUTTONDOWN_API_KEY = process.env.BUTTDOWN_API;

    if (!SUPBASE_URL || !SUPABASE_KEY || !BUTTONDOWN_API_KEY) {
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
                `${SUPBASE_URL}/rest/v1/market_history?market_id=eq.${encodeURIComponent(marketId)}&recorded_at=lte.${oneHourAgo}&order=recorded_at.desc&limit=1`,
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
                    `${SUPBASE_URL}/rest/v1/breaking_alerts_sent?market_id=eq.${encodeURIComponent(marketId)}&alert_type=eq.price_spike&sent_at=gte.${today}T00:00:00Z`,
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
                const timestamp = new Date().toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
                const directionIcon = alert.direction === 'up' ? '📈' : '📉';
                const directionColor = alert.direction === 'up' ? '#22c55e' : '#ef4444';

                const subject = `🚨 Breaking: ${alert.title} ${directionIcon} ${alert.changePercent}%`;

                const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <h1 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px 0;">
            🚨 Breaking from MonitorMamdani.com
        </h1>
        <p style="color: #666; margin: 0; font-size: 13px;">
            ${timestamp}
        </p>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">
            ${alert.title}
        </h2>

        <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #1a1a1a;">
                This market has moved <strong style="color: ${directionColor};">${directionIcon} ${alert.changePercent}% ${alert.direction}</strong> in the last hour.
            </p>

            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="color: #666; font-size: 14px;">Previous:</span>
                    <strong style="float: right; font-size: 16px;">${(alert.oldPrice * 100).toFixed(1)}%</strong>
                </li>
                <li style="padding: 8px 0;">
                    <span style="color: #666; font-size: 14px;">Current:</span>
                    <strong style="float: right; font-size: 16px; color: ${directionColor};">${(alert.currentPrice * 100).toFixed(1)}%</strong>
                </li>
            </ul>
        </div>

        <a href="${alert.url}" style="display: inline-block; background: #0066cc; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
            View Market →
        </a>
    </div>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e9ecef;">
        <p style="font-size: 12px; color: #999; margin: 0;">
            You're receiving this because you subscribed to Breaking Alerts on <a href="https://monitormamdani.com" style="color: #0066cc; text-decoration: none;">Monitor Mamdani</a>.
        </p>
    </div>
</body>
</html>`.trim();

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
                    await fetch(`${SUPBASE_URL}/rest/v1/breaking_alerts_sent`, {
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
