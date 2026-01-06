// Netlify Serverless Function for Campaign Platform Scraping
// Endpoint: GET /api/platform-promises
// Scrapes https://www.zohranfornyc.com/platform for campaign promises

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
        // Return fallback promises instead of error
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updatedAt: new Date().toISOString(),
                sourceUrl: 'https://www.zohranfornyc.com/platform',
                promises: getFallbackPromises(),
                usingFallback: true,
                debug: 'FIREBASE_KEY env var missing'
            })
        };
    }

    const PLATFORM_URL = 'https://www.zohranfornyc.com/platform';

    try {
        // Scrape the platform page
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FIRECRAWL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: PLATFORM_URL,
                formats: ['markdown', 'html'],
                onlyMainContent: true,
                waitFor: 2000,
                timeout: 30000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Firecrawl scrape error: ${response.status}`, errorText);
            throw new Error(`Firecrawl API error: ${response.status}`);
        }

        const data = await response.json();

        // Extract and structure campaign promises from the scraped content
        const promises = extractPromises(data.data?.markdown || '');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate' // Cache 1 hour
            },
            body: JSON.stringify({
                updatedAt: new Date().toISOString(),
                sourceUrl: PLATFORM_URL,
                promises: promises,
                rawMarkdown: data.data?.markdown?.substring(0, 5000) || '' // First 5000 chars for context
            })
        };

    } catch (error) {
        console.error('Error scraping platform:', error);

        // Return cached/fallback promises if scrape fails
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                updatedAt: new Date().toISOString(),
                sourceUrl: PLATFORM_URL,
                promises: getFallbackPromises(),
                error: error.message,
                usingFallback: true
            })
        };
    }
}

// Extract campaign promises from markdown content
function extractPromises(markdown) {
    const promises = [];

    // Key campaign areas to look for
    const campaignAreas = [
        {
            id: 'housing',
            title: 'Housing & Rent',
            keywords: ['rent', 'housing', 'tenant', 'landlord', 'affordable', 'freeze'],
            icon: '🏠'
        },
        {
            id: 'transit',
            title: 'Free Transit',
            keywords: ['bus', 'transit', 'fare', 'transportation', 'mta', 'subway'],
            icon: '🚌'
        },
        {
            id: 'safety',
            title: 'Community Safety',
            keywords: ['safety', 'police', 'community', 'violence', 'crisis'],
            icon: '🛡️'
        },
        {
            id: 'grocery',
            title: 'City-Owned Groceries',
            keywords: ['grocery', 'food', 'supermarket', 'city-owned'],
            icon: '🛒'
        },
        {
            id: 'healthcare',
            title: 'Healthcare',
            keywords: ['health', 'hospital', 'medical', 'care', 'mental'],
            icon: '🏥'
        },
        {
            id: 'workers',
            title: 'Workers Rights',
            keywords: ['worker', 'union', 'wage', 'labor', 'job'],
            icon: '✊'
        },
        {
            id: 'environment',
            title: 'Climate & Environment',
            keywords: ['climate', 'green', 'environment', 'energy', 'sustainable'],
            icon: '🌱'
        },
        {
            id: 'democracy',
            title: 'Democracy & Engagement',
            keywords: ['democracy', 'vote', 'engagement', 'participatory', 'budget'],
            icon: '🗳️'
        }
    ];

    const lowerMarkdown = markdown.toLowerCase();

    // Check each campaign area
    for (const area of campaignAreas) {
        const relevantKeywords = area.keywords.filter(kw => lowerMarkdown.includes(kw));

        if (relevantKeywords.length > 0) {
            // Extract relevant section from markdown
            const excerpt = extractRelevantSection(markdown, area.keywords);

            promises.push({
                id: area.id,
                title: area.title,
                icon: area.icon,
                status: 'active', // All promises are active campaign positions
                excerpt: excerpt,
                keywordsFound: relevantKeywords
            });
        }
    }

    // If no promises found from parsing, return the major known ones
    if (promises.length === 0) {
        return getFallbackPromises();
    }

    return promises;
}

// Extract relevant section around keywords
function extractRelevantSection(markdown, keywords) {
    const lines = markdown.split('\n');

    for (const keyword of keywords) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(keyword)) {
                // Get this line and next 2 lines for context
                const excerpt = lines.slice(i, i + 3).join(' ').trim();
                if (excerpt.length > 20) {
                    return truncate(excerpt, 200);
                }
            }
        }
    }

    return '';
}

// Fallback promises based on known campaign positions
function getFallbackPromises() {
    return [
        {
            id: 'rent-freeze',
            title: 'Rent Freeze',
            icon: '🏠',
            status: 'active',
            excerpt: 'Implement a rent freeze for NYC tenants to combat the housing affordability crisis.',
            keywordsFound: ['rent', 'freeze', 'housing']
        },
        {
            id: 'fare-free',
            title: 'Fare-Free Buses',
            icon: '🚌',
            status: 'active',
            excerpt: 'Make all NYC buses fare-free to improve transit access for all New Yorkers.',
            keywordsFound: ['bus', 'fare', 'free', 'transit']
        },
        {
            id: 'community-safety',
            title: 'Department of Community Safety',
            icon: '🛡️',
            status: 'active',
            excerpt: 'Create a new Department of Community Safety with non-police crisis responders.',
            keywordsFound: ['community', 'safety', 'crisis']
        },
        {
            id: 'city-grocery',
            title: 'City-Owned Grocery Stores',
            icon: '🛒',
            status: 'active',
            excerpt: 'Establish city-owned grocery stores in food deserts to ensure affordable access to fresh food.',
            keywordsFound: ['grocery', 'city-owned', 'food']
        },
        {
            id: 'bad-landlords',
            title: 'Crack Down on Bad Landlords',
            icon: '⚖️',
            status: 'active',
            excerpt: 'Strengthen enforcement against negligent landlords and protect tenant rights.',
            keywordsFound: ['landlord', 'tenant', 'housing']
        },
        {
            id: 'mass-engagement',
            title: 'Office of Mass Engagement',
            icon: '🗳️',
            status: 'active',
            excerpt: 'Create an Office of Mass Engagement to increase participatory democracy.',
            keywordsFound: ['engagement', 'democracy', 'participatory']
        }
    ];
}

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
