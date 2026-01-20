// Netlify Serverless Function for Claude AI-powered Notable Alerts
// Endpoint: GET /api/claude-alerts
// Analyzes videos, news, and markets to find connections and generate actionable insights
// OPTIMIZED: Daily caching to reduce Claude API credits usage

// In-memory cache for daily alert analysis
let dailyAlertsCache = {
    data: null,
    timestamp: null,
    cacheDate: null,
    inputHash: null
};

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Simple hash function for cache key
function hashInput(videos, news, markets) {
    const str = JSON.stringify({ videos, news, markets });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
        };
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API;
    const SUPBASE_URL = process.env.SUPBASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!CLAUDE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Claude API key not configured' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { videos, news, markets } = body;

        // Check if we have valid cached data from today
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        const currentInputHash = hashInput(videos, news, markets);

        const isCacheValid = dailyAlertsCache.data &&
                            dailyAlertsCache.cacheDate === todayDate &&
                            dailyAlertsCache.timestamp &&
                            (now.getTime() - dailyAlertsCache.timestamp) < CACHE_DURATION_MS;

        if (isCacheValid) {
            console.log(`[CACHE HIT] Serving cached alerts from ${dailyAlertsCache.cacheDate}`);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
                    'X-Cache-Status': 'HIT',
                    'X-Cache-Date': dailyAlertsCache.cacheDate
                },
                body: JSON.stringify(dailyAlertsCache.data)
            };
        }

        console.log('[CACHE MISS] Generating fresh alerts with Claude API');

        // Build context from all data sources
        const videoContext = (videos || []).slice(0, 5).map(v =>
            `- Video: "${v.title}" (${v.source || 'Unknown'}) - ${v.metric || 'N/A'}`
        ).join('\n');

        const newsContext = (news || []).slice(0, 5).map(n =>
            `- News: "${n.title}" - ${n.source || 'Web'}`
        ).join('\n');

        const marketContext = (markets || []).slice(0, 7).map(m =>
            `- Market: "${m.title}" - ${m.yesPrice ? Math.round(m.yesPrice * 100) + '% YES' : 'N/A'}`
        ).join('\n');

        const prompt = `You are an analyst monitoring NYC Mayor Zohran Mamdani's term. Analyze the following data sources and identify 2-4 notable connections, trends, or actionable alerts.

VIRAL VIDEOS:
${videoContext || 'No videos available'}

NEWS HEADLINES:
${newsContext || 'No news available'}

PREDICTION MARKETS:
${marketContext || 'No markets available'}

Generate 2-4 brief, actionable alerts that connect dots between these sources. Each alert should:
1. Have a clear category tag (TREND, OPPORTUNITY, RISK, or MOMENTUM)
2. Be 1-2 sentences max
3. Reference specific data points when possible
4. Help people understand what's happening and potential actions

Respond in JSON format:
{
  "alerts": [
    {
      "type": "TREND|OPPORTUNITY|RISK|MOMENTUM",
      "title": "Brief headline",
      "description": "1-2 sentence explanation connecting the dots"
    }
  ]
}

Only respond with valid JSON, no markdown or extra text.`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API error:', response.status, errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Claude API request failed', details: errorText })
            };
        }

        const data = await response.json();
        const content = data.content?.[0]?.text || '';

        // Parse JSON response from Claude
        let alerts = [];
        try {
            const parsed = JSON.parse(content);
            alerts = parsed.alerts || [];
        } catch (e) {
            console.error('Failed to parse Claude response:', content);
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    alerts = parsed.alerts || [];
                } catch (e2) {
                    console.error('Second parse attempt failed');
                }
            }
        }

        // Enrich alerts with source URLs from news/videos
        const enrichedAlerts = enrichAlertsWithUrls(alerts, news, videos);

        // Save alerts to Supabase (non-blocking - don't wait for response)
        if (SUPBASE_URL && SUPABASE_KEY && enrichedAlerts.length > 0) {
            saveAlertsToSupabase(enrichedAlerts, SUPBASE_URL, SUPABASE_KEY)
                .catch(err => console.error('Failed to save alerts to Supabase:', err));
        }

        const responseData = {
            alerts: enrichedAlerts,
            generatedAt: new Date().toISOString()
        };

        // Update the daily cache
        dailyAlertsCache = {
            data: responseData,
            timestamp: now.getTime(),
            cacheDate: todayDate,
            inputHash: currentInputHash
        };

        console.log(`[CACHE UPDATED] New cache set for ${todayDate}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24 hours
                'X-Cache-Status': 'MISS',
                'X-Cache-Date': todayDate
            },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Error generating alerts:', error);

        // If we have stale cache data, return it instead of erroring
        if (dailyAlertsCache.data) {
            console.log('[ERROR RECOVERY] Serving stale cache data due to API error');
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=300',
                    'X-Cache-Status': 'STALE',
                    'X-Cache-Date': dailyAlertsCache.cacheDate
                },
                body: JSON.stringify(dailyAlertsCache.data)
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate alerts', message: error.message })
        };
    }
}

// Enrich alerts with URLs from news/videos that likely inspired them
function enrichAlertsWithUrls(alerts, news, videos) {
    return alerts.map(alert => {
        // Try to find a matching news article or video based on title keywords
        const titleWords = (alert.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);

        // Check news first
        const matchingNews = (news || []).find(item => {
            const itemTitle = (item.title || '').toLowerCase();
            return titleWords.some(word => itemTitle.includes(word));
        });

        if (matchingNews && matchingNews.url) {
            return {
                ...alert,
                url: matchingNews.url,
                source: matchingNews.source || 'News'
            };
        }

        // Check videos second
        const matchingVideo = (videos || []).find(item => {
            const itemTitle = (item.title || '').toLowerCase();
            return titleWords.some(word => itemTitle.includes(word));
        });

        if (matchingVideo && matchingVideo.url) {
            return {
                ...alert,
                url: matchingVideo.url,
                source: matchingVideo.source || 'Video'
            };
        }

        // No match found - still return alert without URL
        return alert;
    });
}

// Save alerts to Supabase notable_alerts table
async function saveAlertsToSupabase(alerts, supabaseUrl, supabaseKey) {
    const alertsToSave = alerts.map(alert => ({
        type: alert.type,
        title: alert.title,
        description: alert.description,
        url: alert.url || null,
        source: alert.source || null,
        sent_in_digest: false
    }));

    const response = await fetch(`${supabaseUrl}/rest/v1/notable_alerts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(alertsToSave)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    return true;
}
