// Netlify Serverless Function for Virlo Trends - Filtered for Mamdani
// Endpoint: /api/trends

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const VIRLO_API_KEY = process.env.VIRLO_API;

    if (!VIRLO_API_KEY) {
        console.error('VIRLO_API environment variable is not set');
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Server configuration error',
                message: 'API key not configured'
            })
        };
    }

    // Keywords to filter trends for Mamdani relevance
    const mamdaniKeywords = [
        'mamdani', 'zohran', 'nyc mayor', 'new york mayor',
        'rent freeze', 'affordable housing', 'nyc housing',
        'fare free', 'free bus', 'queens', 'astoria',
        'socialist', 'progressive', 'landlord'
    ];

    try {
        // Call Virlo Trends Digest API
        const trendsResponse = await fetch('https://api.virlo.ai/trends/digest', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VIRLO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!trendsResponse.ok) {
            const errorText = await trendsResponse.text();
            console.error(`Virlo Trends API error: ${trendsResponse.status}`, errorText);
            throw new Error(`Virlo Trends API error: ${trendsResponse.status}`);
        }

        const trendsData = await trendsResponse.json();

        // Normalize and filter for Mamdani-related trends
        const normalizedData = normalizeTrendsData(trendsData, mamdaniKeywords);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=60, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error fetching Virlo trends:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch trends',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: [],
                allTrends: []
            })
        };
    }
}

// Normalize Virlo Trends Digest data
function normalizeTrendsData(trendsData, filterKeywords) {
    const updatedAt = new Date().toISOString();

    // Extract trend groups from response
    let trendGroups = [];
    if (trendsData.data && Array.isArray(trendsData.data)) {
        trendGroups = trendsData.data;
    } else if (Array.isArray(trendsData)) {
        trendGroups = trendsData;
    }

    // Flatten all trends from all groups
    const allTrends = [];
    const mamdaniTrends = [];

    for (const group of trendGroups) {
        const groupTitle = group.title || 'Trends';
        const trends = group.trends || [];

        for (const trendItem of trends) {
            const trend = trendItem.trend || trendItem;
            const trendName = trend.name || trend.title || '';
            const trendDescription = trend.description || '';
            const combinedText = `${trendName} ${trendDescription}`.toLowerCase();

            const normalizedTrend = {
                id: trend.id || trendItem.id,
                name: trendName,
                description: trendDescription,
                ranking: trendItem.ranking || 0,
                groupTitle: groupTitle,
                type: trend.trend_type || 'content'
            };

            allTrends.push(normalizedTrend);

            // Check if this trend is Mamdani-related
            const isRelevant = filterKeywords.some(keyword =>
                combinedText.includes(keyword.toLowerCase())
            );

            if (isRelevant) {
                mamdaniTrends.push({
                    ...normalizedTrend,
                    severity: determineTrendSeverity(trendItem.ranking)
                });
            }
        }
    }

    return {
        updatedAt,
        items: mamdaniTrends,           // Mamdani-filtered trends
        allTrends: allTrends.slice(0, 20), // Top 20 general trends for context
        totalTrends: allTrends.length,
        mamdaniCount: mamdaniTrends.length
    };
}

// Determine severity based on ranking
function determineTrendSeverity(ranking) {
    if (ranking <= 3) return 'hot';
    if (ranking <= 7) return 'spike';
    if (ranking <= 15) return 'new';
    return 'trending';
}
