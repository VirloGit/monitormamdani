// Netlify Serverless Function for Kalshi Markets - Zohran Mamdani
// Endpoint: GET /api/kalshi
// Fetches Mamdani prediction markets from Kalshi Elections API

// Keywords to filter markets (case-insensitive)
const MAMDANI_KEYWORDS = ['zohran', 'mamdani', 'nyc mayor'];

// Known Mamdani market tickers (discovered via Kalshi website)
const KNOWN_MAMDANI_TICKERS = [
    'KXPERSONPRESMAM-45',      // Will Mamdani become President before 2045?
    'KXNYCCORPORATETAX-27JAN01', // Will Mamdani raise corporate taxes before 2027?
    'KXNYCCHILDCARE-27JAN01',    // Will Mamdani establish universal child care before 2027?
    'KXNYCTAXMILLIONS-27JAN01',  // Will Mamdani tax incomes over $1M?
    'KXNYCFREEBUS-27MAR31',      // Will Mamdani make NYC buses free?
    'KXNYCRENTFREEZE-27JAN01',   // Will Mamdani freeze NYC rents?
    'KXNYCGROCERY-26JUN30',      // Will Mamdani open city-owned grocery store?
    'KXNYCMINWAGE-27JAN01',      // Will Mamdani raise minimum wage to $30?
];

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
        const seenTickers = new Set();

        // 1. First fetch known Mamdani tickers directly
        for (const ticker of KNOWN_MAMDANI_TICKERS) {
            try {
                const response = await fetch(`${KALSHI_API_BASE}/markets/${ticker}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.market) {
                        allMarkets.push(data.market);
                        seenTickers.add(data.market.ticker);
                    }
                }
            } catch (e) {
                console.log(`Failed to fetch ticker ${ticker}:`, e.message);
            }
        }

        // 2. Search events for Mamdani-related markets
        try {
            const eventsResponse = await fetch(`${KALSHI_API_BASE}/events?limit=200&status=open`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                const events = eventsData.events || [];

                for (const event of events) {
                    const title = (event.title || '').toLowerCase();
                    const category = (event.category || '').toLowerCase();
                    const searchText = `${title} ${category}`;

                    const isRelevant = MAMDANI_KEYWORDS.some(keyword =>
                        searchText.includes(keyword.toLowerCase())
                    );

                    if (isRelevant && event.markets) {
                        for (const market of event.markets) {
                            if (!seenTickers.has(market.ticker)) {
                                allMarkets.push(market);
                                seenTickers.add(market.ticker);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log('Events search failed:', e.message);
        }

        // 3. Also paginate through markets endpoint to find any we missed
        // Search for ticker prefixes that are known to contain Mamdani markets
        const MAMDANI_TICKER_PREFIXES = ['KXNYC', 'KXPERSONPRESMAM', 'MAM'];

        let cursor = null;
        let pageCount = 0;
        const maxPages = 5; // Increased to find more markets

        while (pageCount < maxPages) {
            const url = cursor
                ? `${KALSHI_API_BASE}/markets?limit=1000&cursor=${cursor}`
                : `${KALSHI_API_BASE}/markets?limit=1000`;

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                console.error('Kalshi markets API error:', response.status);
                break;
            }

            const data = await response.json();
            const markets = data.markets || [];

            for (const market of markets) {
                if (seenTickers.has(market.ticker)) continue;

                const title = (market.title || '').toLowerCase();
                const subtitle = (market.subtitle || '').toLowerCase();
                const ticker = (market.ticker || '').toUpperCase();
                const searchText = `${title} ${subtitle}`;

                // Check if ticker starts with known Mamdani prefixes
                const hasKnownPrefix = MAMDANI_TICKER_PREFIXES.some(prefix =>
                    ticker.startsWith(prefix)
                );

                // Check if title/subtitle contains Mamdani keywords
                const hasKeyword = MAMDANI_KEYWORDS.some(keyword =>
                    searchText.includes(keyword.toLowerCase())
                );

                if (hasKnownPrefix || hasKeyword) {
                    allMarkets.push(market);
                    seenTickers.add(market.ticker);
                }
            }

            cursor = data.cursor;
            if (!cursor || markets.length === 0) break;
            pageCount++;
        }

        // Normalize to match Polymarket format
        // Kalshi uses yes_bid/yes_ask in CENTS (0-100), not decimals
        const normalizedMarkets = allMarkets.map(market => {
            // yes_bid and yes_ask are in cents (0-100)
            // Convert to decimal (0-1) to match Polymarket format
            let yesPrice = null;
            let noPrice = null;

            // Try yes_bid first (best bid price), fall back to last_price
            if (market.yes_bid !== undefined && market.yes_bid !== null) {
                yesPrice = market.yes_bid / 100; // Convert cents to decimal
            } else if (market.last_price !== undefined && market.last_price !== null) {
                yesPrice = market.last_price / 100;
            }

            if (yesPrice !== null) {
                noPrice = 1 - yesPrice;
            }

            return {
                id: market.ticker,
                title: market.title || 'Unknown Market',
                slug: market.ticker,
                yesPrice: yesPrice,
                noPrice: noPrice,
                volume: market.volume || 0,
                liquidity: market.open_interest || 0,
                endDate: market.close_time,
                active: market.status === 'active' || market.status === 'open',
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
                    knownTickersFetched: KNOWN_MAMDANI_TICKERS.length,
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
