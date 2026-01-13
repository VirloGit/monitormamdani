// Netlify Serverless Function to Send Weekly Digest via Buttondown
// Endpoint: POST /api/send-weekly-digest
// Fetches notable alerts from the past week (Mon-Fri) and sends digest to subscribers

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
        // Calculate date range (last Monday to Friday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

        // If it's Sunday (0), get the previous week's Mon-Fri
        // Calculate days to go back to get to last Monday
        const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6;
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - daysToLastMonday);
        lastMonday.setHours(0, 0, 0, 0);

        // Last Friday is 4 days after last Monday
        const lastFriday = new Date(lastMonday);
        lastFriday.setDate(lastMonday.getDate() + 4);
        lastFriday.setHours(23, 59, 59, 999);

        console.log(`Fetching alerts from ${lastMonday.toISOString()} to ${lastFriday.toISOString()}`);

        // Fetch unsent alerts from last week (Mon-Fri)
        const response = await fetch(
            `${SUPBASE_URL}/rest/v1/notable_alerts?sent_in_digest=eq.false&created_at=gte.${lastMonday.toISOString()}&created_at=lte.${lastFriday.toISOString()}&order=created_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Failed to fetch alerts', details: errorText })
            };
        }

        const alerts = await response.json();

        if (alerts.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    message: 'No new alerts to send',
                    alertCount: 0
                })
            };
        }

        // Group alerts by type
        const groupedAlerts = {
            TREND: [],
            OPPORTUNITY: [],
            RISK: [],
            MOMENTUM: []
        };

        alerts.forEach(alert => {
            if (groupedAlerts[alert.type]) {
                groupedAlerts[alert.type].push(alert);
            }
        });

        // Format digest email
        const weekRange = `${lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastFriday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const subject = `📊 MonitorMamdani.com - Week of ${weekRange}`;

        // Add alerts by category
        const categories = [
            { key: 'TREND', icon: '📈', label: 'Trends' },
            { key: 'OPPORTUNITY', icon: '💡', label: 'Opportunities' },
            { key: 'RISK', icon: '⚠️', label: 'Risks' },
            { key: 'MOMENTUM', icon: '🚀', label: 'Momentum' }
        ];

        let sectionsHTML = '';
        categories.forEach(({ key, icon, label }) => {
            if (groupedAlerts[key].length > 0) {
                sectionsHTML += `
                <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px; margin-bottom: 12px;">
                    ${icon} ${label}
                </h2>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">`;
                groupedAlerts[key].forEach(alert => {
                    sectionsHTML += `
                    <li style="margin-bottom: 8px;">
                        <strong>${alert.title}</strong>: ${alert.description}
                    </li>`;
                });
                sectionsHTML += `
                </ul>`;
            }
        });

        const bodyHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0;">
            📊 Informed on Zohran
        </h1>
        <p style="color: #666; margin: 0; font-size: 14px;">
            <strong>${today}</strong>
        </p>
        <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">
            Weekly Digest: ${weekRange}
        </p>
    </div>

    <p style="font-size: 16px; margin-bottom: 24px;">
        Here's your bullet-point summary of <strong>Notable Alerts</strong> from the past week:
    </p>

    ${sectionsHTML}

    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
        <a href="https://monitormamdani.com" style="display: inline-block; background: #0066cc; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
            Monitor Now →
        </a>
        <p style="font-size: 12px; color: #999; margin: 0;">
            You're receiving this weekly digest because you subscribed to "Informed on Zohran" on Monitor Mamdani.
        </p>
    </div>
</body>
</html>`.trim();

        // Send via Buttondown to weekly_digest tag
        const emailResponse = await fetch('https://api.buttondown.email/v1/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject,
                body: bodyHTML,
                email_type: 'public',
                tags: ['weekly_digest']
            })
        });

        if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('Buttondown API error:', errorText);
            return {
                statusCode: emailResponse.status,
                body: JSON.stringify({ error: 'Failed to send digest', details: errorText })
            };
        }

        const emailData = await emailResponse.json();

        // Mark alerts as sent
        const alertIds = alerts.map(a => a.id);
        await fetch(`${SUPBASE_URL}/rest/v1/notable_alerts?id=in.(${alertIds.join(',')})`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                sent_in_digest: true
            })
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                alertCount: alerts.length,
                weekRange,
                emailId: emailData.id
            })
        };

    } catch (error) {
        console.error('Error sending weekly digest:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send digest', message: error.message })
        };
    }
}
