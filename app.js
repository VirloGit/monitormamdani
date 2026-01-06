// Monitor Mamdani - Live Feed Application
// Virlo Trends + Comet + Firecrawl - Monitoring Zohran Mamdani

const POLL_INTERVAL = 60000; // 60 seconds
const MAX_ITEMS = 50;

let pollTimer = null;
let isFirstLoad = true;

// DOM Elements
const promisesContainer = document.getElementById('promisesContainer');
const newsContainer = document.getElementById('newsContainer');
const trendsContainer = document.getElementById('trendsContainer');
const videosContainer = document.getElementById('videosContainer');
const statusText = document.getElementById('statusText');

// Initialize the app
function init() {
    console.log('Monitor Mamdani initializing...');
    fetchAllData();
    startPolling();
}

// Start polling for updates
function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }

    pollTimer = setInterval(() => {
        fetchAllData();
    }, POLL_INTERVAL);
}

// Fetch all data sources
async function fetchAllData() {
    updateStatus('FETCHING...', 'loading');

    try {
        // Fetch all endpoints in parallel
        const [promisesResult, newsResult, trendsResult, videosResult] = await Promise.allSettled([
            fetchPromises(),
            fetchNews(),
            fetchTrends(),
            fetchVideos()
        ]);

        // Check if at least some succeeded
        const anySuccess = [promisesResult, newsResult, trendsResult, videosResult]
            .some(r => r.status === 'fulfilled');

        if (anySuccess) {
            updateStatus('LIVE', 'success');
        } else {
            updateStatus('ERROR', 'error');
        }

        isFirstLoad = false;

    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus('ERROR', 'error');
    }
}

// Fetch campaign promises from /api/platform-promises
async function fetchPromises() {
    try {
        const response = await fetch('/api/platform-promises');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderPromises(data);
        return data;

    } catch (error) {
        console.error('Error fetching promises:', error);
        if (promisesContainer && isFirstLoad) {
            promisesContainer.innerHTML = `<div class="feed-empty"><p>Platform unavailable</p></div>`;
        }
        throw error;
    }
}

// Fetch news from /api/firecrawl-search
async function fetchNews() {
    try {
        const response = await fetch('/api/firecrawl-search');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderNews(data);
        return data;

    } catch (error) {
        console.error('Error fetching news:', error);
        if (newsContainer && isFirstLoad) {
            newsContainer.innerHTML = `<div class="feed-empty"><p>News unavailable</p></div>`;
        }
        throw error;
    }
}

// Fetch trends from /api/trends
async function fetchTrends() {
    try {
        const response = await fetch('/api/trends');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderTrends(data);
        return data;

    } catch (error) {
        console.error('Error fetching trends:', error);
        if (trendsContainer && isFirstLoad) {
            trendsContainer.innerHTML = `<div class="feed-empty"><p>Trends unavailable</p></div>`;
        }
        throw error;
    }
}

// Fetch videos from /api/comet-mamdani
async function fetchVideos() {
    try {
        const response = await fetch('/api/comet-mamdani', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderVideos(data);
        return data;

    } catch (error) {
        console.error('Error fetching videos:', error);
        if (videosContainer && isFirstLoad) {
            videosContainer.innerHTML = `<div class="feed-empty"><p>Videos unavailable</p></div>`;
        }
        throw error;
    }
}

// Update status indicator
function updateStatus(text, type) {
    if (!statusText) return;
    statusText.textContent = text;
}

// Render campaign promises
function renderPromises(data) {
    if (!promisesContainer) return;

    const promises = data.promises || [];

    if (promises.length === 0) {
        promisesContainer.innerHTML = `
            <div class="feed-empty">
                <p>NO PLATFORM DATA</p>
            </div>
        `;
        return;
    }

    const cards = promises.map(promise => `
        <div class="promise-card">
            <div class="promise-header">
                <span class="promise-icon">${promise.icon || '📋'}</span>
                <h3 class="promise-title">${escapeHtml(promise.title)}</h3>
                <span class="promise-status ${promise.status === 'pending' ? 'pending' : ''}">${promise.status || 'ACTIVE'}</span>
            </div>
            <p class="promise-excerpt">${escapeHtml(promise.excerpt || '')}</p>
            ${promise.keywordsFound && promise.keywordsFound.length > 0 ? `
                <div class="promise-keywords">
                    ${promise.keywordsFound.slice(0, 3).map(kw => `<span class="promise-keyword">${escapeHtml(kw)}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    promisesContainer.innerHTML = cards;
}

// Render news items
function renderNews(data) {
    if (!newsContainer) return;

    const items = data.items || [];

    if (items.length === 0) {
        const debugMsg = data.debug || data.error || '';
        newsContainer.innerHTML = `
            <div class="feed-empty">
                <p>NO NEWS AVAILABLE</p>
                ${debugMsg ? `<p style="font-size: 12px; color: var(--muted);">${escapeHtml(debugMsg)}</p>` : ''}
            </div>
        `;
        return;
    }

    const newsItems = items.slice(0, 10).map(item => `
        <div class="news-item">
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="news-title">${escapeHtml(item.title)}</a>
            ${item.description ? `<p class="news-description">${escapeHtml(truncate(item.description, 150))}</p>` : ''}
            <div class="news-meta">
                <span class="news-source">${escapeHtml(item.source || 'Web')}</span>
            </div>
        </div>
    `).join('');

    newsContainer.innerHTML = newsItems;
}

// Render trends section
function renderTrends(data) {
    if (!trendsContainer) return;

    const mamdaniTrends = data.items || [];
    const allTrends = data.allTrends || [];

    // Show Mamdani-related trends if any, otherwise show top general trends
    const trendsToShow = mamdaniTrends.length > 0 ? mamdaniTrends : allTrends.slice(0, 10);
    const isFiltered = mamdaniTrends.length > 0;

    if (trendsToShow.length === 0) {
        trendsContainer.innerHTML = `
            <div class="feed-empty">
                <p>NO TRENDS AVAILABLE</p>
            </div>
        `;
        return;
    }

    const header = `
        <div class="feed-header">
            <div>RANK</div>
            <div>TYPE</div>
            <div>TREND</div>
            <div>DESCRIPTION</div>
            <div>GROUP</div>
        </div>
    `;

    const rows = trendsToShow.map(trend => {
        const severity = trend.severity || determineTrendSeverity(trend.ranking);
        return `
            <div class="feed-row">
                <div class="timestamp">#${trend.ranking || '-'}</div>
                <div><span class="tag ${severity}">${severity.toUpperCase()}</span></div>
                <div class="title">${escapeHtml(trend.name || 'Unknown')}</div>
                <div class="metric neutral">${escapeHtml(truncate(trend.description || '', 80))}</div>
                <div class="source">${escapeHtml(trend.groupTitle || '')}</div>
            </div>
        `;
    }).join('');

    const subtitle = isFiltered
        ? `<div class="feed-subtitle">Found ${mamdaniTrends.length} Mamdani-related trend(s)</div>`
        : `<div class="feed-subtitle">Showing top trends (no Mamdani matches today)</div>`;

    trendsContainer.innerHTML = subtitle + header + rows;
}

// Render videos section
function renderVideos(data) {
    if (!videosContainer) return;

    const items = data.items || [];

    if (items.length === 0) {
        videosContainer.innerHTML = `
            <div class="feed-empty">
                <p>NO VIDEOS YET</p>
                <p>Comet is collecting videos daily</p>
            </div>
        `;
        return;
    }

    // Sort by timestamp (newest first)
    const sortedItems = items.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, MAX_ITEMS);

    const header = `
        <div class="feed-header">
            <div>TIME</div>
            <div>TYPE</div>
            <div>TITLE</div>
            <div>METRICS</div>
            <div>PLATFORM</div>
            <div></div>
        </div>
    `;

    const rows = sortedItems.map(item => {
        const severityClass = item.severity || 'trending';
        return `
            <div class="feed-row">
                <div class="timestamp">${formatTimestamp(item.ts)}</div>
                <div><span class="tag ${severityClass}">${severityClass.toUpperCase()}</span></div>
                <div class="title">${escapeHtml(truncate(item.title || 'Untitled', 60))}</div>
                <div class="metric neutral">${escapeHtml(item.metric || 'N/A')}</div>
                <div class="source">${escapeHtml(item.source || 'Unknown')}</div>
                <div>
                    ${item.url ? `<a href="${item.url}" target="_blank" rel="noopener" class="icon-link" title="Watch">↗</a>` : ''}
                </div>
            </div>
        `;
    }).join('');

    videosContainer.innerHTML = header + rows;
}

// Determine severity based on ranking
function determineTrendSeverity(ranking) {
    if (ranking <= 3) return 'hot';
    if (ranking <= 7) return 'spike';
    if (ranking <= 15) return 'new';
    return 'trending';
}

// Truncate text
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Format timestamp
function formatTimestamp(ts) {
    try {
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'NOW';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${Math.floor(diffHours / 24)}d`;
    } catch (e) {
        return '--';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Term Countdown - Jan 1, 2026 to Jan 1, 2030 (4-year mayoral term)
const TERM_START = new Date('2026-01-01T00:00:00');
const TERM_END = new Date('2030-01-01T00:00:00');

function updateCountdown() {
    const now = new Date();

    // If before term starts, show time until term starts
    // If during term, show time remaining
    // If after term, show 0

    let targetDate = TERM_END;
    let diff = targetDate - now;

    if (diff < 0) {
        diff = 0;
    }

    // Calculate time units
    const totalSeconds = Math.floor(diff / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    const years = Math.floor(totalDays / 365);
    const days = totalDays % 365;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    // Update DOM
    const yearsEl = document.getElementById('countdownYears');
    const daysEl = document.getElementById('countdownDays');
    const hoursEl = document.getElementById('countdownHours');
    const minutesEl = document.getElementById('countdownMinutes');
    const secondsEl = document.getElementById('countdownSeconds');

    if (yearsEl) yearsEl.textContent = years;
    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
}

// Start countdown timer
let countdownTimer = null;

function startCountdown() {
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        startCountdown();
    });
} else {
    init();
    startCountdown();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
});
