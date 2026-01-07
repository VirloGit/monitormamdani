// Netlify Serverless Function for Kalshi Markets - Zohran Mamdani
// Endpoint: GET /api/kalshi
// Fetches Mamdani prediction markets from Kalshi Elections API

// Keywords to filter markets (case-insensitive)
const MAMDANI_KEYWORDS = ['zohran', 'mamdani', 'zohran mamdani'];

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

    try {
        const allMarkets = [];
        let cursor = null;
        let pageCount = 0;
        const maxPages = 5; // Limit pagination to avoid timeout

        // Paginate through markets
        while (pageCount < maxPages) {
            const url = cursor
                ? `${KALSHI_API_BASE}/markets?limit=1000&cursor=${cursor}`
                : `${KALSHI_API_BASE}/markets?limit=1000`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Kalshi API error:', response.status);
                break;
            }

            const data = await response.json();
            const markets = data.markets || [];

            // Filter for Mamdani-related markets
            for (const market of markets) {
                const title = (market.title || '').toLowerCase();
                const subtitle = (market.subtitle || '').toLowerCase();
                const searchText = `${title} ${subtitle}`;

                const isRelevant = MAMDANI_KEYWORDS.some(keyword =>
                    searchText.includes(keyword.toLowerCase())
                );

                if (isRelevant) {
                    allMarkets.push(market);
                }
            }

            // Check for next page
            cursor = data.cursor;
            if (!cursor || markets.length === 0) {
                break;
            }

            pageCount++;
        }

        // Normalize to match Polymarket format exactly
        const normalizedMarkets = allMarkets.map(market => {
            // Kalshi yes_price is already 0-1 decimal
            const yesPrice = market.yes_price !== undefined ? market.yes_price : null;
            const noPrice = yesPrice !== null ? (1 - yesPrice) : null;

            return {
                id: market.ticker,
                title: market.title || 'Unknown Market',
                slug: market.ticker,
                yesPrice: yesPrice,
                noPrice: noPrice,
                volume: market.volume || 0,
                liquidity: market.open_interest || 0,
                endDate: market.close_time,
                active: market.status === 'active',
                url: `https://kalshi.com/markets/${market.ticker}`,
                source: 'kalshi'
            };
        });

        // Sort by volume (most traded first)
        normalizedMarkets.sort((a, b) => (b.volume || 0) - (a.volume || 0));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=120, stale-while-revalidate'
            },
            body: JSON.stringify({
                updatedAt: new Date().toISOString(),
                markets: normalizedMarkets,
                count: normalizedMarkets.length,
                debug: {
                    pagesScanned: pageCount + 1,
                    marketsFound: normalizedMarkets.length
                }
            })
        };

    } catch (error) {
        console.error('Error fetching Kalshi data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch Kalshi data',
                message: error.message,
                updatedAt: new Date().toISOString(),
                markets: []
            })
        };
    }
}
