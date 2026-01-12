// Netlify Serverless Function for Changelog (GitHub Commits)
// Endpoint: GET /api/changelog

const GITHUB_REPO = 'VirloGit/monitormamdani';
const COMMITS_LIMIT = 20;

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching GitHub commits...');

        const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=${COMMITS_LIMIT}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'MonitorMamdani-Changelog'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API response:', response.status, errorText);
            throw new Error(`GitHub API error: ${response.status} - repo may be private`);
        }

        const commits = await response.json();
        console.log('Commits received:', commits.length);

        if (!Array.isArray(commits)) {
            console.error('Unexpected response format:', commits);
            throw new Error('Invalid response from GitHub');
        }

        // Process and normalize commits
        const normalizedCommits = normalizeCommits(commits);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedCommits)
        };

    } catch (error) {
        console.error('Error fetching commits:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch changelog',
                message: error.message,
                updatedAt: new Date().toISOString(),
                commits: []
            })
        };
    }
}

function normalizeCommits(commits) {
    const updatedAt = new Date().toISOString();

    const items = commits.map(commit => {
        const message = commit.commit?.message || '';
        const lines = message.split('\n');
        const title = lines[0] || 'No message';
        const body = lines.slice(1).filter(l => l.trim() && !l.includes('Co-Authored-By')).join(' ').trim();

        const date = commit.commit?.author?.date || commit.commit?.committer?.date;
        const author = commit.commit?.author?.name || commit.author?.login || 'Unknown';
        const sha = commit.sha?.substring(0, 7) || '';
        const url = commit.html_url || '';

        return {
            sha,
            title: cleanTitle(title),
            body: body ? truncate(body, 150) : '',
            date: formatDate(date),
            dateRaw: date,
            author,
            url
        };
    }).filter(commit => !isAutoCommit(commit.title));

    return {
        updatedAt,
        commits: items,
        count: items.length
    };
}

function cleanTitle(title) {
    // Remove common prefixes and emojis for cleaner display
    return title
        .replace(/^🤖\s*/, '')
        .replace(/^Generated with \[Claude Code\].*$/, '')
        .trim();
}

function isAutoCommit(title) {
    // Filter out merge commits only
    const lower = title.toLowerCase();
    return lower.startsWith('merge pull request') ||
           lower.startsWith('merge branch');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
            }
            return `${diffHours}h ago`;
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    } catch {
        return dateStr;
    }
}

function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
