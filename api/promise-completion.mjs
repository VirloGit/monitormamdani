// Netlify Serverless Function for Promise Completion Tracking
// Endpoint: POST /api/promise-completion
// Analyzes news and viral content to determine which campaign promises are completed

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { promises, news, videos } = body;

        if (!promises || promises.length === 0) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    completed: 0,
                    total: 0,
                    completedPromises: [],
                    inProgressPromises: []
                })
            };
        }

        // Combine all content for searching
        const allContent = [
            ...(news || []).map(n => ({
                title: n.title || '',
                description: n.description || '',
                source: n.source || 'News',
                url: n.url || '',
                date: n.publishedAt || n.date || ''
            })),
            ...(videos || []).map(v => ({
                title: v.title || '',
                description: v.description || v.caption || '',
                source: v.source || v.platform || 'Video',
                url: v.url || '',
                date: v.ts || v.timestamp || ''
            }))
        ];

        // Analyze each promise for completion signals
        const analyzedPromises = promises.map(promise => {
            const result = analyzePromiseCompletion(promise, allContent);
            return {
                ...promise,
                completionStatus: result.status,
                completionConfidence: result.confidence,
                completionEvidence: result.evidence
            };
        });

        // Separate completed vs in-progress
        const completedPromises = analyzedPromises.filter(p => p.completionStatus === 'completed');
        const inProgressPromises = analyzedPromises.filter(p => p.completionStatus !== 'completed');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate'
            },
            body: JSON.stringify({
                completed: completedPromises.length,
                total: promises.length,
                completedPromises: completedPromises,
                inProgressPromises: inProgressPromises,
                lastChecked: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error analyzing promise completion:', error);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                completed: 0,
                total: 0,
                completedPromises: [],
                inProgressPromises: [],
                error: error.message
            })
        };
    }
}

// Analyze a single promise for completion signals in content
function analyzePromiseCompletion(promise, content) {
    const title = (promise.title || '').toLowerCase();
    const keywords = (promise.keywordsFound || promise.keywords || []).map(k => k.toLowerCase());

    // Completion indicator phrases - signals that something was achieved
    const completionPhrases = [
        'signed into law',
        'becomes law',
        'enacted',
        'approved',
        'passed',
        'implemented',
        'launched',
        'achieved',
        'completed',
        'fulfilled',
        'delivered',
        'announced today',
        'officially',
        'begins today',
        'now in effect',
        'takes effect',
        'rollout begins',
        'program launched',
        'initiative launched',
        'successfully',
        'milestone reached',
        'goal met',
        'target achieved'
    ];

    // Search content for evidence of completion
    const evidence = [];
    let completionScore = 0;

    for (const item of content) {
        const itemText = `${item.title} ${item.description}`.toLowerCase();

        // Check if content is related to this promise
        const isRelated = keywords.some(kw => itemText.includes(kw)) ||
                         itemText.includes(title.substring(0, 20));

        if (!isRelated) continue;

        // Check for completion phrases
        const foundPhrases = completionPhrases.filter(phrase => itemText.includes(phrase));

        if (foundPhrases.length > 0) {
            completionScore += foundPhrases.length;
            evidence.push({
                title: item.title,
                source: item.source,
                url: item.url,
                phrases: foundPhrases,
                date: item.date
            });
        }
    }

    // Determine status based on evidence
    // Require multiple pieces of evidence or strong signals for "completed"
    let status = 'in_progress';
    let confidence = 'low';

    if (completionScore >= 3 || evidence.length >= 2) {
        status = 'completed';
        confidence = completionScore >= 5 ? 'high' : 'medium';
    } else if (completionScore >= 1) {
        status = 'in_progress';
        confidence = 'medium';
    }

    return {
        status,
        confidence,
        evidence: evidence.slice(0, 3) // Return top 3 evidence items
    };
}
