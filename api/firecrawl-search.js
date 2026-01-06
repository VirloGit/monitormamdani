// Netlify Serverless Function for Firecrawl Search - Zohran Mamdani News
// Endpoint: GET /api/firecrawl-search

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const FIRECRAWL_KEY = process.env.FIREBASE_KEY;

    if (!FIRECRAWL_KEY) {
        console.error('FIREBASE_KEY environment variable is not set');
        return {
            statusCode: 200, // Return 200 with empty data instead of 500
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Firecrawl API key not configured',
                updatedAt: new Date().toISOString(),
                items: [],
                debug: 'FIREBASE_KEY env var missing'
            })
        };
    }

    // Single search query to reduce API calls
    const searchQuery = 'Zohran Mamdani NYC mayor campaign 2025';

    try {
        console.log('Starting Firecrawl search for:', searchQuery);

        const results = await searchFirecrawl(FIRECRAWL_KEY, searchQuery);

        console.log('Firecrawl returned', results.length, 'results');

        // Normalize results
        const normalizedData = normalizeSearchResults(results);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error with Firecrawl search:', error);

        return {
            statusCode: 200, // Return 200 with empty data
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to search news',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: []
            })
        };
    }
}

// Search Firecrawl for a query
async function searchFirecrawl(apiKey, query) {
    try {
        console.log('Calling Firecrawl API with query:', query);

        const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                limit: 10
            })
        });

        console.log('Firecrawl response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Firecrawl search error: ${response.status}`, errorText);
            return [];
        }

        const data = await response.json();
        console.log('Firecrawl data keys:', Object.keys(data));

        // Handle different response structures
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        } else if (data.results && Array.isArray(data.results)) {
            return data.results;
        } else if (Array.isArray(data)) {
            return data;
        }

        console.log('Unexpected Firecrawl response structure:', JSON.stringify(data).substring(0, 500));
        return [];

    } catch (error) {
        console.error('Firecrawl search failed:', error.message);
        return [];
    }
}

// Normalize search results
function normalizeSearchResults(results) {
    const updatedAt = new Date().toISOString();

    const items = results.map(item => ({
        title: item.title || item.metadata?.title || 'Untitled',
        description: item.description || item.metadata?.description || truncate(item.markdown || item.content || '', 200),
        url: item.url || item.sourceURL || '',
        source: extractDomain(item.url || item.sourceURL),
        publishedAt: item.publishedAt || item.metadata?.publishedAt || null,
        severity: 'news'
    }));

    return {
        updatedAt,
        items,
        source: 'firecrawl',
        count: items.length
    };
}

// Extract domain from URL
function extractDomain(url) {
    try {
        if (!url) return 'Web';
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return 'Web';
    }
}

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
