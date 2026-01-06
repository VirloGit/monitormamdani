// Netlify Serverless Function for Virlo Comet - Monitor Zohran Mamdani
// Endpoint: GET /api/comet-mamdani
// IMPORTANT: Uses an existing Comet configuration - does NOT create new ones

export async function handler(event, context) {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
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

    try {
        // Step 1: Find the existing Mamdani Comet (do NOT create new ones)
        const cometId = await findExistingComet(VIRLO_API_KEY);

        if (!cometId) {
            // No comet found - return empty but don't error
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: new Date().toISOString(),
                    items: [],
                    debug: { message: 'No Mamdani Comet found. Please create one manually via Virlo dashboard.' }
                })
            };
        }

        // Step 2: Fetch videos from the Comet configuration
        console.log('Fetching videos for Comet ID:', cometId);
        const videosUrl = `https://api.virlo.ai/comet/${cometId}/videos?limit=50&orderBy=views&orderDirection=desc`;

        const videosResponse = await fetch(videosUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VIRLO_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Videos response status:', videosResponse.status);

        if (!videosResponse.ok) {
            const errorText = await videosResponse.text();
            console.error(`Virlo Comet videos error: ${videosResponse.status}`, errorText);

            // Return empty items instead of erroring
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updatedAt: new Date().toISOString(),
                    items: [],
                    debug: {
                        cometId,
                        error: `Videos API returned ${videosResponse.status}`,
                        message: 'Comet may still be collecting videos'
                    }
                })
            };
        }

        const videosData = await videosResponse.json();
        console.log('Videos data keys:', Object.keys(videosData));
        console.log('Videos data sample:', JSON.stringify(videosData).substring(0, 500));

        // Normalize the response
        const normalizedData = normalizeCometData(videosData);

        // Add debug info
        normalizedData.debug = {
            cometId: cometId,
            rawDataKeys: Object.keys(videosData),
            rawDataLength: Array.isArray(videosData) ? videosData.length :
                          (videosData.data?.length || videosData.videos?.length || videosData.items?.length || 0)
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate' // Cache for 5 minutes
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error with Virlo Comet:', error);

        return {
            statusCode: 200, // Return 200 with empty data
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch Comet data',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: []
            })
        };
    }
}

// Find existing Mamdani Comet - does NOT create new ones
async function findExistingComet(apiKey) {
    try {
        console.log('Listing existing comets...');
        const listResponse = await fetch('https://api.virlo.ai/comet/list', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('List comets response status:', listResponse.status);

        if (!listResponse.ok) {
            const errorText = await listResponse.text();
            console.log('List comets failed:', listResponse.status, errorText);
            return null;
        }

        const comets = await listResponse.json();
        console.log('Comets response:', JSON.stringify(comets).substring(0, 1000));

        const cometArray = comets.data || comets || [];

        // Find ANY Mamdani-related comet (use the first one found)
        const existingComet = cometArray.find(c =>
            c.name?.toLowerCase().includes('mamdani') ||
            c.name?.toLowerCase().includes('monitor')
        );

        if (existingComet && existingComet.id) {
            console.log('Found existing Comet:', existingComet.id, existingComet.name);
            return existingComet.id;
        }

        console.log('No Mamdani Comet found in', cometArray.length, 'comets');
        return null;

    } catch (e) {
        console.error('Error listing comets:', e.message);
        return null;
    }
}

// Normalize Virlo Comet API data into our expected format
function normalizeCometData(cometData) {
    const updatedAt = new Date().toISOString();

    // Handle different possible API response structures
    let rawItems = [];

    if (Array.isArray(cometData)) {
        rawItems = cometData;
    } else if (cometData.data && Array.isArray(cometData.data)) {
        rawItems = cometData.data;
    } else if (cometData.results && Array.isArray(cometData.results)) {
        rawItems = cometData.results;
    } else if (cometData.items && Array.isArray(cometData.items)) {
        rawItems = cometData.items;
    } else if (cometData.videos && Array.isArray(cometData.videos)) {
        rawItems = cometData.videos;
    }

    // Map items to our normalized format
    const items = rawItems.map(item => {
        return {
            ts: item.timestamp || item.publishedAt || item.published_at || item.createdAt || item.created_at || item.date || updatedAt,
            severity: determineSeverity(item),
            title: item.title || item.caption || item.description || 'Untitled',
            metric: formatMetric(item),
            source: item.platform || item.source || 'Social Media',
            url: item.url || item.link || item.videoUrl || item.video_url || ''
        };
    });

    return {
        updatedAt,
        items
    };
}

// Determine severity level based on item data
function determineSeverity(item) {
    if (item.severity) {
        return item.severity.toLowerCase();
    }

    const views = item.views || item.viewCount || item.view_count || 0;
    const engagement = item.engagement || item.likes || item.interactions || 0;
    const engagementRate = item.engagementRate || item.engagement_rate || 0;

    if (views > 1000000 || engagement > 100000 || engagementRate > 10) {
        return 'hot';
    }
    if (views > 500000 || engagement > 50000 || engagementRate > 5) {
        return 'spike';
    }

    const publishDate = new Date(item.timestamp || item.publishedAt || item.published_at || item.createdAt || item.created_at || Date.now());
    const hoursSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60);

    if (hoursSincePublish < 24) {
        return 'new';
    }

    return 'trending';
}

// Format metric display string
function formatMetric(item) {
    if (item.metric) {
        return item.metric;
    }

    const parts = [];

    if (item.views || item.viewCount || item.view_count) {
        const views = item.views || item.viewCount || item.view_count;
        parts.push(`Views: ${formatNumber(views)}`);
    }

    if (item.likes) {
        parts.push(`Likes: ${formatNumber(item.likes)}`);
    }

    if (item.comments || item.comment_count) {
        parts.push(`Comments: ${formatNumber(item.comments || item.comment_count)}`);
    }

    if (item.shares || item.share_count) {
        parts.push(`Shares: ${formatNumber(item.shares || item.share_count)}`);
    }

    if (item.engagementRate || item.engagement_rate) {
        parts.push(`ER: ${(item.engagementRate || item.engagement_rate).toFixed(2)}%`);
    }

    if (item.engagement && !item.likes) {
        parts.push(`Engagement: ${formatNumber(item.engagement)}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'Tracking';
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
