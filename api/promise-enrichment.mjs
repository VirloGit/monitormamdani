// Netlify Serverless Function for Promise Enrichment
// Endpoint: POST /api/promise-enrichment
// Uses Claude to match prediction markets and analyze news velocity for each campaign promise

// Promise to market mapping (keyword-based)
const PROMISE_MARKET_MAP = {
    'rent-freeze': {
        polymarketSlugs: ['will-mamdani-freeze-nyc-rents-before-2027'],
        kalshiTickers: ['KXNYCRENTFREEZE-27JAN01'],
        keywords: ['rent', 'freeze', 'housing', 'tenant']
    },
    'fare-free': {
        polymarketSlugs: ['will-mamdani-make-nyc-buses-free-by-march-31'],
        kalshiTickers: ['KXNYCFREEBUS-27MAR31'],
        keywords: ['bus', 'fare', 'free', 'transit', 'mta']
    },
    'city-grocery': {
        polymarketSlugs: ['mamdani-opens-city-owned-grocery-store-by-june-30'],
        kalshiTickers: ['KXNYCGROCERY-26JUN30'],
        keywords: ['grocery', 'food', 'supermarket', 'city-owned']
    },
    'housing': {
        polymarketSlugs: ['will-mamdani-freeze-nyc-rents-before-2027'],
        kalshiTickers: ['KXNYCRENTFREEZE-27JAN01'],
        keywords: ['rent', 'housing', 'tenant', 'landlord', 'affordable']
    },
    'transit': {
        polymarketSlugs: ['will-mamdani-make-nyc-buses-free-by-march-31'],
        kalshiTickers: ['KXNYCFREEBUS-27MAR31'],
        keywords: ['bus', 'transit', 'fare', 'transportation', 'mta']
    },
    'grocery': {
        polymarketSlugs: ['mamdani-opens-city-owned-grocery-store-by-june-30'],
        kalshiTickers: ['KXNYCGROCERY-26JUN30'],
        keywords: ['grocery', 'food', 'supermarket']
    },
    'workers': {
        polymarketSlugs: ['will-mamdani-raise-the-minimum-wage-to-30-before-2027'],
        kalshiTickers: ['KXNYCMINWAGE-27JAN01'],
        keywords: ['worker', 'wage', 'minimum', 'labor', 'union']
    },
    'bad-landlords': {
        polymarketSlugs: ['will-mamdani-freeze-nyc-rents-before-2027'],
        kalshiTickers: ['KXNYCRENTFREEZE-27JAN01'],
        keywords: ['landlord', 'tenant', 'housing', 'rent']
    },
    'democracy': {
        polymarketSlugs: [],
        kalshiTickers: [],
        keywords: ['democracy', 'engagement', 'participatory', 'vote']
    },
    'mass-engagement': {
        polymarketSlugs: [],
        kalshiTickers: [],
        keywords: ['engagement', 'democracy', 'participatory']
    },
    'community-safety': {
        polymarketSlugs: [],
        kalshiTickers: [],
        keywords: ['safety', 'community', 'police', 'crisis']
    },
    'healthcare': {
        polymarketSlugs: [],
        kalshiTickers: ['KXNYCCHILDCARE-27JAN01'],
        keywords: ['health', 'care', 'medical', 'childcare']
    },
    'environment': {
        polymarketSlugs: [],
        kalshiTickers: [],
        keywords: ['climate', 'green', 'environment', 'energy']
    }
};

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
        };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API;

    try {
        const body = JSON.parse(event.body || '{}');
        const { promises, markets, kalshiMarkets, news, videos } = body;

        if (!promises || promises.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrichedPromises: [] })
            };
        }

        // Combine all markets
        const allMarkets = [
            ...(markets || []).map(m => ({ ...m, source: 'Polymarket' })),
            ...(kalshiMarkets || []).map(m => ({ ...m, source: 'Kalshi' }))
        ];

        // Keep full news and video objects for matching
        const newsItems = (news || []).slice(0, 20);
        const videoItems = (videos || []).slice(0, 20);

        // Enrich each promise
        const enrichedPromises = promises.map(promise => {
            const promiseId = promise.id || '';
            const mapping = PROMISE_MARKET_MAP[promiseId] || { polymarketSlugs: [], kalshiTickers: [], keywords: promise.keywordsFound || [] };

            // Find matching markets
            const matchedMarkets = allMarkets.filter(market => {
                const marketSlug = (market.slug || '').toLowerCase();
                const marketTitle = (market.title || '').toLowerCase();
                const marketTicker = (market.id || '').toUpperCase();

                // Check direct slug/ticker match
                const directMatch = mapping.polymarketSlugs.some(slug => marketSlug.includes(slug.toLowerCase())) ||
                    mapping.kalshiTickers.some(ticker => marketTicker.includes(ticker.toUpperCase()));

                // Check keyword match in title
                const keywordMatch = mapping.keywords.some(kw => marketTitle.includes(kw.toLowerCase()));

                return directMatch || keywordMatch;
            });

            // Find matching news items
            const keywords = mapping.keywords || [];
            const matchedNews = newsItems.filter(item => {
                const title = (item.title || '').toLowerCase();
                const description = (item.description || '').toLowerCase();
                const searchText = `${title} ${description}`;
                return keywords.some(kw => searchText.includes(kw.toLowerCase()));
            }).map(item => ({
                title: item.title,
                url: item.url,
                source: item.source || 'News'
            }));

            // Find matching videos
            const matchedVideos = videoItems.filter(item => {
                const title = (item.title || '').toLowerCase();
                return keywords.some(kw => title.includes(kw.toLowerCase()));
            }).map(item => ({
                title: item.title,
                url: item.url,
                source: item.source || 'Video',
                platform: item.platform
            }));

            // Calculate velocity based on total matches
            const matchCount = matchedNews.length + matchedVideos.length;

            // Determine velocity level
            let velocity = 'low';
            if (matchCount >= 5) {
                velocity = 'high';
            } else if (matchCount >= 2) {
                velocity = 'medium';
            }

            return {
                ...promise,
                markets: matchedMarkets.slice(0, 3).map(m => ({
                    title: m.title,
                    yesPrice: m.yesPrice,
                    source: m.source,
                    url: m.url
                })),
                velocity: {
                    level: velocity,
                    matchCount: matchCount,
                    totalContent: newsItems.length + videoItems.length
                },
                matchedContent: {
                    news: matchedNews.slice(0, 5),
                    videos: matchedVideos.slice(0, 5)
                }
            };
        });

        // Build content context for Claude
        const contentContext = [
            ...newsItems.map(n => n.title || '').filter(Boolean),
            ...videoItems.map(v => v.title || '').filter(Boolean)
        ];

        // If Claude API is available, use it for smarter velocity analysis
        if (CLAUDE_API_KEY && contentContext.length > 0) {
            try {
                const claudeEnriched = await enrichWithClaude(
                    CLAUDE_API_KEY,
                    enrichedPromises,
                    contentContext
                );
                if (claudeEnriched) {
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'public, max-age=300'
                        },
                        body: JSON.stringify({
                            enrichedPromises: claudeEnriched,
                            analyzedAt: new Date().toISOString(),
                            usedClaude: true
                        })
                    };
                }
            } catch (claudeError) {
                console.error('Claude enrichment failed, using keyword matching:', claudeError.message);
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            },
            body: JSON.stringify({
                enrichedPromises,
                analyzedAt: new Date().toISOString(),
                usedClaude: false
            })
        };

    } catch (error) {
        console.error('Error enriching promises:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to enrich promises', message: error.message })
        };
    }
}

async function enrichWithClaude(apiKey, promises, contentContext) {
    const promiseList = promises.map(p => `- ${p.title}: keywords [${(p.keywordsFound || []).join(', ')}]`).join('\n');
    const contentList = contentContext.slice(0, 20).map(c => `- ${c}`).join('\n');

    const prompt = `Analyze news/content velocity for these NYC Mayor Mamdani campaign promises.

CAMPAIGN PROMISES:
${promiseList}

RECENT NEWS & VIDEO TITLES:
${contentList}

For each promise, determine the news/content velocity (how much it's being discussed):
- "high": 4+ relevant mentions, actively trending
- "medium": 2-3 relevant mentions, moderate coverage
- "low": 0-1 mentions, minimal coverage

Respond in JSON format only:
{
  "velocities": [
    {"promiseId": "promise-id-here", "level": "high|medium|low", "reason": "brief explanation"}
  ]
}

Only respond with valid JSON, no extra text.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON response
    let velocities = [];
    try {
        const parsed = JSON.parse(content);
        velocities = parsed.velocities || [];
    } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            velocities = parsed.velocities || [];
        }
    }

    // Merge Claude's analysis back into promises
    return promises.map(promise => {
        const claudeVelocity = velocities.find(v =>
            v.promiseId === promise.id ||
            v.promiseId?.toLowerCase() === promise.id?.toLowerCase()
        );

        if (claudeVelocity) {
            return {
                ...promise,
                velocity: {
                    ...promise.velocity,
                    level: claudeVelocity.level,
                    reason: claudeVelocity.reason
                }
            };
        }
        return promise;
    });
}
