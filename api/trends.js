// Vercel Serverless Function for Virlo.ai API Integration
// Endpoint: /api/trends
// OPTIMIZED: Daily caching to reduce Claude API credits usage

// In-memory cache for daily trend analysis
// Note: This resets on each cold start, but Vercel keeps functions warm for ~5 minutes
let dailyCache = {
    data: null,
    timestamp: null,
    cacheDate: null
};

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const VIRLO_API_KEY = process.env.VIRLO_API_KEY;

    if (!VIRLO_API_KEY) {
        console.error('VIRLO_API_KEY environment variable is not set');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'API key not configured'
        });
    }

    try {
        // Check if we have valid cached data from today
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

        const isCacheValid = dailyCache.data &&
                            dailyCache.cacheDate === todayDate &&
                            dailyCache.timestamp &&
                            (now.getTime() - dailyCache.timestamp) < CACHE_DURATION_MS;

        if (isCacheValid) {
            console.log(`[CACHE HIT] Serving cached data from ${dailyCache.cacheDate}`);

            // Set aggressive cache headers for cached responses (24 hours)
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Cache-Status', 'HIT');
            res.setHeader('X-Cache-Date', dailyCache.cacheDate);

            return res.status(200).json(dailyCache.data);
        }

        console.log('[CACHE MISS] Fetching fresh data from Virlo.ai API');

        // Call Virlo.ai API (which includes Claude analysis)
        const virloResponse = await fetch('https://api.virlo.ai/v1/trends', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VIRLO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!virloResponse.ok) {
            throw new Error(`Virlo API error: ${virloResponse.status} ${virloResponse.statusText}`);
        }

        const virloData = await virloResponse.json();

        // Normalize the API response
        const normalizedData = normalizeVirloData(virloData);

        // Update the daily cache
        dailyCache = {
            data: normalizedData,
            timestamp: now.getTime(),
            cacheDate: todayDate
        };

        console.log(`[CACHE UPDATED] New cache set for ${todayDate}`);

        // Set cache headers for fresh responses (24 hours)
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache-Status', 'MISS');
        res.setHeader('X-Cache-Date', todayDate);

        return res.status(200).json(normalizedData);

    } catch (error) {
        console.error('Error fetching Virlo trends:', error);

        // If we have stale cache data, return it instead of erroring
        if (dailyCache.data) {
            console.log('[ERROR RECOVERY] Serving stale cache data due to API error');
            res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Cache-Status', 'STALE');
            res.setHeader('X-Cache-Date', dailyCache.cacheDate);
            return res.status(200).json(dailyCache.data);
        }

        return res.status(500).json({
            error: 'Failed to fetch trends',
            message: error.message,
            updatedAt: new Date().toISOString(),
            items: []
        });
    }
}

// Normalize Virlo.ai API data into our expected format
function normalizeVirloData(virloData) {
    const updatedAt = new Date().toISOString();

    // Handle different possible API response structures
    let rawItems = [];

    if (Array.isArray(virloData)) {
        rawItems = virloData;
    } else if (virloData.data && Array.isArray(virloData.data)) {
        rawItems = virloData.data;
    } else if (virloData.trends && Array.isArray(virloData.trends)) {
        rawItems = virloData.trends;
    } else if (virloData.items && Array.isArray(virloData.items)) {
        rawItems = virloData.items;
    }

    // Map items to our normalized format
    const items = rawItems.map(item => {
        return {
            ts: item.timestamp || item.ts || item.date || updatedAt,
            severity: determineSeverity(item),
            title: item.title || item.name || item.topic || 'Trending Topic',
            metric: formatMetric(item),
            source: item.source || item.platform || 'Virlo.ai',
            url: item.url || item.link || ''
        };
    });

    return {
        updatedAt,
        items
    };
}

// Determine severity level based on item data
function determineSeverity(item) {
    // Check for explicit severity
    if (item.severity) {
        return item.severity.toLowerCase();
    }

    // Infer severity from metrics
    const score = item.score || item.engagement || item.volume || 0;
    const growth = item.growth || item.change || 0;

    if (growth > 100 || score > 1000000) {
        return 'hot';
    } else if (growth > 50 || score > 500000) {
        return 'spike';
    } else if (item.isNew || growth > 20) {
        return 'new';
    } else {
        return 'trending';
    }
}

// Format metric display string
function formatMetric(item) {
    if (item.metric) {
        return item.metric;
    }

    const parts = [];

    if (item.score) {
        parts.push(`Score: ${formatNumber(item.score)}`);
    }

    if (item.volume) {
        parts.push(`Volume: ${formatNumber(item.volume)}`);
    }

    if (item.engagement) {
        parts.push(`Engagement: ${formatNumber(item.engagement)}`);
    }

    if (item.growth || item.change) {
        const growthVal = item.growth || item.change;
        parts.push(`Growth: ${growthVal > 0 ? '+' : ''}${growthVal}%`);
    }

    if (item.mentions) {
        parts.push(`Mentions: ${formatNumber(item.mentions)}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Trending';
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
