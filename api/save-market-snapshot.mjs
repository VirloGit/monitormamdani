// Netlify Serverless Function to Save Market Price Snapshots to Supabase
// Endpoint: POST /api/save-market-snapshot
// Records market prices for historical tracking and breaking alert detection

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Supabase credentials not configured' })
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

        // Prepare snapshots for bulk insert
        const snapshots = markets.map(market => ({
            market_id: market.id || market.slug,
            market_title: market.title,
            source: market.source || 'unknown',
            yes_price: market.yesPrice,
            volume: market.volume || 0,
            liquidity: market.liquidity || 0
        }));

        // Save to Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/market_history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(snapshots)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Supabase error:', response.status, errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Failed to save snapshots', details: errorText })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                saved: snapshots.length
            })
        };

    } catch (error) {
        console.error('Error saving market snapshots:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to save snapshots', message: error.message })
        };
    }
}
