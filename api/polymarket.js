// Netlify Serverless Function for Polymarket Markets - Zohran Mamdani
// Endpoint: GET /api/polymarket
// Fetches prediction markets related to Mamdani from Polymarket's Gamma API

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

    try {
        // Search for Mamdani-related markets
        const searchTerms = ['mamdani', 'zohran', 'nyc mayor 2025'];
        let allMarkets = [];

        for (const term of searchTerms) {
            try {
                // Try the events endpoint with text search
                const response = await fetch(
                    `${GAMMA_API_BASE}/events?closed=false&limit=20`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    const events = await response.json();
                    // Filter events that contain our search terms
                    const filtered = events.filter(event => {
                        const title = (event.title || '').toLowerCase();
                        const description = (event.description || '').toLowerCase();
                        const slug = (event.slug || '').toLowerCase();
                        return title.includes(term) ||
                               description.includes(term) ||
                               slug.includes(term) ||
                               title.includes('nyc') && title.includes('mayor');
                    });
                    allMarkets.push(...filtered);
                }
            } catch (e) {
                console.log(`Search for "${term}" failed:`, e.message);
            }
        }

        // Also try searching for NYC mayor markets specifically
        try {
            const response = await fetch(
                `${GAMMA_API_BASE}/events?closed=false&limit=50`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const events = await response.json();
                // Filter for NYC mayor related markets
                const nycMayorMarkets = events.filter(event => {
                    const title = (event.title || '').toLowerCase();
                    const description = (event.description || '').toLowerCase();
                    return (title.includes('nyc') || title.includes('new york')) &&
                           (title.includes('mayor') || description.includes('mayor'));
                });
                allMarkets.push(...nycMayorMarkets);
            }
        } catch (e) {
            console.log('NYC mayor search failed:', e.message);
        }

        // Deduplicate by ID
        const uniqueMarkets = [];
        const seenIds = new Set();
        for (const market of allMarkets) {
            if (market.id && !seenIds.has(market.id)) {
                seenIds.add(market.id);
                uniqueMarkets.push(market);
            }
        }

        // Normalize the response
        const normalizedMarkets = uniqueMarkets.map(event => ({
            id: event.id,
            title: event.title || 'Unknown Market',
            slug: event.slug,
            description: truncate(event.description || '', 150),
            image: event.image,
            startDate: event.startDate,
            endDate: event.endDate,
            volume: event.volume || 0,
            liquidity: event.liquidity || 0,
            markets: (event.markets || []).map(m => ({
                id: m.id,
                question: m.question,
                outcomePrices: m.outcomePrices,
                outcomes: m.outcomes,
                volume: m.volume
            })),
            url: `https://polymarket.com/event/${event.slug}`
        }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate' // Cache 5 minutes
            },
            body: JSON.stringify({
                updatedAt: new Date().toISOString(),
                markets: normalizedMarkets,
                count: normalizedMarkets.length
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

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
