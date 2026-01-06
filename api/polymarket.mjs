// Netlify Serverless Function for Polymarket Markets - Zohran Mamdani
// Endpoint: GET /api/polymarket
// Fetches specific Mamdani prediction markets from Polymarket's Gamma API

// Known Mamdani market slugs
const MAMDANI_MARKET_SLUGS = [
    'will-mamdani-freeze-nyc-rents-before-2027',
    'mamdani-opens-city-owned-grocery-store-by-june-30',
    'will-mamdani-make-nyc-buses-free-by-march-31',
    'zohran-mamdani-out-as-mayor-of-nyc-before-2027',
    'will-mamdani-pass-the-2-millionaire-tax-before-2027',
    'zohran-mamdani-citizenship-revoked-before-2027',
    'will-mamdani-raise-the-minimum-wage-to-30-before-2027'
];

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

    try {
        const allMarkets = [];
        const errors = [];

        // Fetch each known Mamdani market by slug using correct endpoint: /events/slug/{slug}
        for (const slug of MAMDANI_MARKET_SLUGS) {
            try {
                const response = await fetch(
                    `${GAMMA_API_BASE}/events/slug/${slug}`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    const event = await response.json();
                    if (event && event.id) {
                        allMarkets.push(event);
                    }
                } else {
                    errors.push({ slug, status: response.status });
                }
            } catch (e) {
                errors.push({ slug, error: e.message });
            }
        }

        // Also search for any other Mamdani markets we might have missed
        try {
            const response = await fetch(
                `${GAMMA_API_BASE}/events?closed=false&limit=100&ascending=false`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const events = await response.json();
                if (Array.isArray(events)) {
                    const mamdaniMarkets = events.filter(event => {
                        const title = (event.title || '').toLowerCase();
                        const slug = (event.slug || '').toLowerCase();
                        return title.includes('mamdani') || slug.includes('mamdani');
                    });

                    // Add any we don't already have
                    for (const market of mamdaniMarkets) {
                        if (!allMarkets.find(m => m.id === market.id)) {
                            allMarkets.push(market);
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Search for additional markets failed:', e.message);
        }

        // Normalize the response
        const normalizedMarkets = allMarkets.map(event => {
            // Get the main market's outcome prices
            const mainMarket = event.markets && event.markets[0];
            let yesPrice = null;
            let noPrice = null;

            if (mainMarket && mainMarket.outcomePrices) {
                try {
                    const prices = typeof mainMarket.outcomePrices === 'string'
                        ? JSON.parse(mainMarket.outcomePrices)
                        : mainMarket.outcomePrices;
                    if (Array.isArray(prices)) {
                        yesPrice = parseFloat(prices[0]) || null;
                        noPrice = parseFloat(prices[1]) || null;
                    }
                } catch (e) {
                    console.log('Error parsing prices:', e.message);
                }
            }

            return {
                id: event.id,
                title: event.title || 'Unknown Market',
                slug: event.slug,
                yesPrice: yesPrice,
                noPrice: noPrice,
                volume: event.volume || (mainMarket && mainMarket.volume) || 0,
                liquidity: event.liquidity || 0,
                endDate: event.endDate,
                active: event.active !== false,
                url: `https://polymarket.com/event/${event.slug}`
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
                    slugsFetched: MAMDANI_MARKET_SLUGS.length,
                    marketsFound: normalizedMarkets.length,
                    errors: errors.length > 0 ? errors : undefined
                }
            })
        };

    } catch (error) {
        console.error('Error fetching Polymarket data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch Polymarket data',
                message: error.message,
                updatedAt: new Date().toISOString(),
                markets: []
            })
        };
    }
}
