// Test endpoint to send sample emails to subscribers
// Endpoint: POST /api/test-send-emails

export async function handler(event, context) {
    const BUTTONDOWN_API_KEY = process.env.BUTTDOWN_API;

    if (!BUTTONDOWN_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Buttondown API key not configured' })
        };
    }

    try {
        const results = [];

        // 1. Send test weekly digest
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const weekRange = 'Jan 6 - Jan 10, 2026';

        const digestHTML = `
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

    <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px; margin-bottom: 12px;">
        📈 Trends
    </h2>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">
            <strong>Mamdani's Rent Freeze Market Shows Momentum</strong>: Prediction market odds for rent freeze initiative moved from 42% to 51% this week.
        </li>
        <li style="margin-bottom: 8px;">
            <strong>Universal Childcare Gaining Traction</strong>: Public support for universal childcare proposal increased significantly based on recent polling data.
        </li>
    </ul>

    <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px; margin-bottom: 12px;">
        💡 Opportunities
    </h2>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">
            <strong>NYC Budget Proposal Window Opening</strong>: Key period for advocating policy priorities begins next week.
        </li>
    </ul>

    <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 24px; margin-bottom: 12px;">
        ⚠️ Risks
    </h2>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
        <li style="margin-bottom: 8px;">
            <strong>Opposition Campaign Launched</strong>: Business coalition announced campaign against proposed tax increases.
        </li>
    </ul>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e9ecef;">
        <p style="font-size: 14px; color: #666; margin-bottom: 12px;">
            Stay informed on all things Mamdani at <a href="https://monitormamdani.com" style="color: #0066cc; text-decoration: none;">monitormamdani.com</a>
        </p>
        <p style="font-size: 12px; color: #999; margin: 0;">
            You're receiving this weekly digest because you subscribed to "Informed on Zohran" on Monitor Mamdani.
        </p>
    </div>
</body>
</html>`.trim();

        const digestResponse = await fetch('https://api.buttondown.email/v1/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: `📊 Informed on Zohran - Week of ${weekRange} (TEST)`,
                body: digestHTML,
                email_type: 'public',
                tags: ['weekly_digest']
            })
        });

        const digestData = await digestResponse.json();
        results.push({
            type: 'weekly_digest',
            status: digestResponse.ok ? 'sent' : 'failed',
            data: digestData
        });

        // 2. Send test breaking alert
        const timestamp = new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const alertHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
        <h1 style="color: #1a1a1a; font-size: 20px; margin: 0 0 8px 0;">
            🚨 Breaking Market Alert
        </h1>
        <p style="color: #666; margin: 0; font-size: 13px;">
            ${timestamp}
        </p>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">
            Will Mamdani freeze NYC rents before 2027?
        </h2>

        <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #1a1a1a;">
                This market has moved <strong style="color: #22c55e;">📈 12.5% up</strong> in the last hour.
            </p>

            <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="color: #666; font-size: 14px;">Previous:</span>
                    <strong style="float: right; font-size: 16px;">45.2%</strong>
                </li>
                <li style="padding: 8px 0;">
                    <span style="color: #666; font-size: 14px;">Current:</span>
                    <strong style="float: right; font-size: 16px; color: #22c55e;">57.7%</strong>
                </li>
            </ul>
        </div>

        <a href="https://kalshi.com/markets/KXNYCRENTFREEZE-27JAN01" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
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

        const alertResponse = await fetch('https://api.buttondown.email/v1/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: '🚨 Breaking: Rent Freeze Market 📈 12.5% (TEST)',
                body: alertHTML,
                email_type: 'public',
                tags: ['breaking_alerts']
            })
        });

        const alertData = await alertResponse.json();
        results.push({
            type: 'breaking_alert',
            status: alertResponse.ok ? 'sent' : 'failed',
            data: alertData
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Test emails sent!',
                results
            })
        };

    } catch (error) {
        console.error('Error sending test emails:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send test emails', message: error.message })
        };
    }
}
