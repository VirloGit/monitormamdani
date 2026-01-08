// Monitor Mamdani - Live Feed Application
// Virlo Trends + Comet + Firecrawl - Monitoring Zohran Mamdani

const POLL_INTERVAL = 60000; // 60 seconds
const MAX_ITEMS = 50;

let pollTimer = null;
let isFirstLoad = true;

// Store fetched data for ticker
let tickerData = {
    news: [],
    markets: []
};

// DOM Elements
const promisesContainer = document.getElementById('promisesContainer');
const newsContainer = document.getElementById('newsContainer');
const trendsContainer = document.getElementById('trendsContainer');
const videosContainer = document.getElementById('videosContainer');
const marketsContainer = document.getElementById('marketsContainer');
const alertsContainer = document.getElementById('alertsContainer');
const statusText = document.getElementById('statusText');
const tickerTrack = document.getElementById('tickerTrack');

// Store fetched data for alerts generation
let fetchedData = {
    videos: [],
    news: [],
    markets: [],
    kalshiMarkets: [],
    promises: []
};

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
        // Fetch all endpoints in parallel (including Kalshi)
        const [promisesResult, newsResult, trendsResult, videosResult, marketsResult, kalshiResult] = await Promise.allSettled([
            fetchPromises(),
            fetchNews(),
            fetchTrends(),
            fetchVideos(),
            fetchMarkets(),
            fetchKalshiMarkets()
        ]);

        // Check if at least some succeeded
        const anySuccess = [promisesResult, newsResult, trendsResult, videosResult, marketsResult, kalshiResult]
            .some(r => r.status === 'fulfilled');

        if (anySuccess) {
            updateStatus('LIVE', 'success');
            // Generate alerts after data is fetched (only on first load or every 5 minutes)
            if (isFirstLoad || !window.lastAlertsTime || Date.now() - window.lastAlertsTime > 300000) {
                generateAlerts();
                window.lastAlertsTime = Date.now();
            }
        } else {
            updateStatus('ERROR', 'error');
        }

        isFirstLoad = false;

    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus('ERROR', 'error');
    }
}

// Fetch campaign promises from /api/platform-promises and enrich with markets/velocity
async function fetchPromises() {
    try {
        const response = await fetch('/api/platform-promises');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        fetchedData.promises = data.promises || [];

        // First render basic promises
        renderPromises(data);

        // Then enrich with markets and velocity (async, will re-render when done)
        enrichPromisesWithMarketsAndVelocity(data.promises || []);

        return data;

    } catch (error) {
        console.error('Error fetching promises:', error);
        if (promisesContainer && isFirstLoad) {
            promisesContainer.innerHTML = `<div class="feed-empty"><p>Platform unavailable</p></div>`;
        }
        throw error;
    }
}

// Enrich promises with prediction market odds and news velocity
async function enrichPromisesWithMarketsAndVelocity(promises) {
    if (!promises || promises.length === 0) return;

    // Wait a bit for other data to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const response = await fetch('/api/promise-enrichment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                promises: promises,
                markets: fetchedData.markets,
                kalshiMarkets: fetchedData.kalshiMarkets,
                news: fetchedData.news,
                videos: fetchedData.videos
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.enrichedPromises && data.enrichedPromises.length > 0) {
            renderEnrichedPromises(data.enrichedPromises);
        }
    } catch (error) {
        console.error('Error enriching promises:', error);
        // Keep basic render, don't break
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
        fetchedData.news = data.items || [];
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
        fetchedData.videos = data.items || [];
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

// Fetch prediction markets from /api/polymarket
async function fetchMarkets() {
    try {
        const response = await fetch('/api/polymarket');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        fetchedData.markets = data.markets || [];
        renderMarkets();
        return data;

    } catch (error) {
        console.error('Error fetching markets:', error);
        if (marketsContainer && isFirstLoad) {
            marketsContainer.innerHTML = `<div class="feed-empty"><p>Markets unavailable</p></div>`;
        }
        throw error;
    }
}

// Fetch Kalshi prediction markets from /api/kalshi
async function fetchKalshiMarkets() {
    try {
        const response = await fetch('/api/kalshi');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        fetchedData.kalshiMarkets = data.markets || [];
        renderMarkets();
        return data;

    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        // Don't break if Kalshi fails - just log
        fetchedData.kalshiMarkets = [];
        throw error;
    }
}

// Update status indicator
function updateStatus(text, type) {
    if (!statusText) return;
    statusText.textContent = text;
}

// Generate AI-powered alerts by calling Claude API
async function generateAlerts() {
    if (!alertsContainer) return;

    try {
        const response = await fetch('/api/claude-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videos: fetchedData.videos,
                news: fetchedData.news,
                markets: fetchedData.markets
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderAlerts(data.alerts || []);

    } catch (error) {
        console.error('Error generating alerts:', error);
        alertsContainer.innerHTML = `
            <div class="feed-empty">
                <p>ALERTS UNAVAILABLE</p>
            </div>
        `;
    }
}

// Render AI-generated alerts
function renderAlerts(alerts) {
    if (!alertsContainer) return;

    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="feed-empty">
                <p>NO ALERTS AT THIS TIME</p>
            </div>
        `;
        return;
    }

    const alertItems = alerts.map(alert => {
        const typeClass = (alert.type || 'trend').toLowerCase();
        return `
            <div class="alert-item alert-${typeClass}">
                <div class="alert-header">
                    <span class="alert-type ${typeClass}">${escapeHtml(alert.type || 'ALERT')}</span>
                    <span class="alert-title">${escapeHtml(alert.title || '')}</span>
                </div>
                <p class="alert-description">${escapeHtml(alert.description || '')}</p>
            </div>
        `;
    }).join('');

    alertsContainer.innerHTML = alertItems;
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
                <span class="promise-status in-progress">IN PROGRESS</span>
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

// Store enriched promises for modal access
let enrichedPromisesData = [];

// Render enriched promises with markets and velocity
function renderEnrichedPromises(promises) {
    if (!promisesContainer) return;

    if (promises.length === 0) {
        return; // Keep existing render
    }

    // Store for modal access
    enrichedPromisesData = promises;

    const cards = promises.map((promise, index) => {
        // Build markets section
        let marketsHtml = '';
        if (promise.markets && promise.markets.length > 0) {
            const marketItems = promise.markets.map(m => {
                const yesP = m.yesPrice !== null ? Math.round(m.yesPrice * 100) : null;
                return `
                    <a href="${escapeHtml(m.url || '#')}" target="_blank" rel="noopener" class="promise-market-item">
                        <span class="promise-market-source">${escapeHtml(m.source || 'Market')}</span>
                        <span class="promise-market-odds">${yesP !== null ? yesP + '% YES' : '--'}</span>
                    </a>
                `;
            }).join('');

            marketsHtml = `
                <div class="promise-markets">
                    <div class="promise-markets-label">Prediction Markets</div>
                    <div class="promise-markets-list">${marketItems}</div>
                </div>
            `;
        }

        // Build velocity section with click handler
        let velocityHtml = '';
        if (promise.velocity) {
            const level = promise.velocity.level || 'low';
            const levelClass = `velocity-${level}`;
            const levelLabel = level.toUpperCase();

            velocityHtml = `
                <div class="promise-velocity">
                    <div class="promise-velocity-label">News & Content</div>
                    <div class="promise-velocity-badge ${levelClass}" onclick="openVelocityModal(${index})" title="Click to see related content">
                        <span class="velocity-indicator"></span>
                        <span class="velocity-text">${levelLabel}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="promise-card ${promise.markets && promise.markets.length > 0 ? 'has-markets' : ''}">
                <div class="promise-header">
                    <span class="promise-icon">${promise.icon || '📋'}</span>
                    <h3 class="promise-title">${escapeHtml(promise.title)}</h3>
                    <span class="promise-status in-progress">IN PROGRESS</span>
                </div>
                <p class="promise-excerpt">${escapeHtml(promise.excerpt || '')}</p>
                ${promise.keywordsFound && promise.keywordsFound.length > 0 ? `
                    <div class="promise-keywords">
                        ${promise.keywordsFound.slice(0, 3).map(kw => `<span class="promise-keyword">${escapeHtml(kw)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="promise-data-row">
                    ${marketsHtml}
                    ${velocityHtml}
                </div>
            </div>
        `;
    }).join('');

    promisesContainer.innerHTML = cards;
}

// Open velocity modal with related content
function openVelocityModal(promiseIndex) {
    const promise = enrichedPromisesData[promiseIndex];
    if (!promise) return;

    const modal = document.getElementById('velocityModal');
    const modalTitle = document.getElementById('velocityModalTitle');
    const modalBody = document.getElementById('velocityModalBody');

    if (!modal || !modalTitle || !modalBody) return;

    // Set title
    modalTitle.textContent = `${promise.title} - Related Content`;

    // Build modal content
    const level = promise.velocity?.level || 'low';
    const matchedContent = promise.matchedContent || { news: [], videos: [] };
    const newsItems = matchedContent.news || [];
    const videoItems = matchedContent.videos || [];

    let bodyHtml = `
        <div class="velocity-badge-level velocity-${level}">
            <span class="velocity-indicator"></span>
            <span>${level.toUpperCase()} VELOCITY</span>
            <span style="margin-left: auto; font-size: 11px;">${promise.velocity?.matchCount || 0} matches</span>
        </div>
    `;

    // News section
    if (newsItems.length > 0) {
        bodyHtml += `
            <div class="velocity-modal-section">
                <div class="velocity-modal-section-title">Related News Articles</div>
                ${newsItems.map(item => `
                    <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener" class="velocity-modal-item">
                        <div class="velocity-modal-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                        <div class="velocity-modal-item-meta">
                            <span class="velocity-modal-item-source">${escapeHtml(item.source || 'News')}</span>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    // Videos section
    if (videoItems.length > 0) {
        bodyHtml += `
            <div class="velocity-modal-section">
                <div class="velocity-modal-section-title">Related Videos</div>
                ${videoItems.map(item => `
                    <a href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener" class="velocity-modal-item">
                        <div class="velocity-modal-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                        <div class="velocity-modal-item-meta">
                            <span class="velocity-modal-item-source">${escapeHtml(item.platform || item.source || 'Video')}</span>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    // Empty state
    if (newsItems.length === 0 && videoItems.length === 0) {
        bodyHtml += `
            <div class="velocity-modal-empty">
                <p>No related content found for this topic.</p>
                <p style="font-size: 11px; margin-top: 10px;">Keywords searched: ${(promise.keywordsFound || []).join(', ')}</p>
            </div>
        `;
    }

    modalBody.innerHTML = bodyHtml;
    modal.classList.add('active');

    // Close on escape key
    document.addEventListener('keydown', handleModalEscape);
}

// Close velocity modal
function closeVelocityModal() {
    const modal = document.getElementById('velocityModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.removeEventListener('keydown', handleModalEscape);
}

// Handle escape key for modal
function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeVelocityModal();
    }
}

// Render news items
function renderNews(data) {
    if (!newsContainer) return;

    const items = data.items || [];

    // Store for ticker
    tickerData.news = items.slice(0, 5).map(item => item.title).filter(Boolean);
    updateTicker();

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

// Render prediction markets in sidebar format (watchlist style)
// Combines Polymarket and Kalshi markets
function renderMarkets() {
    if (!marketsContainer) return;

    // Get markets from both sources
    const polymarketMarkets = (fetchedData.markets || []).map(m => ({ ...m, source: 'Polymarket' }));
    const kalshiMarkets = (fetchedData.kalshiMarkets || []).map(m => ({ ...m, source: 'Kalshi' }));

    // Combine: Polymarket first, then Kalshi
    const allMarkets = [...polymarketMarkets, ...kalshiMarkets];

    // Store for ticker - include both sources
    tickerData.markets = allMarkets.slice(0, 8).map(m => {
        const yesP = m.yesPrice !== null ? Math.round(m.yesPrice * 100) : null;
        return {
            title: m.title,
            yes: yesP,
            source: m.source
        };
    }).filter(m => m.title && m.yes !== null);
    updateTicker();

    // Build watchlist
    if (allMarkets.length === 0) {
        marketsContainer.innerHTML = `<div class="feed-empty" style="padding: 30px 15px;"><p>NO MARKETS FOUND</p></div>`;
        return;
    }

    // Simple watchlist format with source label
    const items = allMarkets.map(m => {
        const yesP = m.yesPrice !== null ? Math.round(m.yesPrice * 100) : null;
        const noP = m.noPrice !== null ? Math.round(m.noPrice * 100) : null;
        const title = m.title || 'Unknown Market';
        const url = m.url || '#';
        const source = m.source || 'Unknown';

        return `
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="watchlist-item">
                <div class="watchlist-title">
                    ${escapeHtml(title)}
                    <span class="watchlist-source">${escapeHtml(source)}</span>
                </div>
                <div class="watchlist-odds">
                    <span class="watchlist-yes">${yesP !== null ? yesP + '%' : '--'} YES</span>
                    <span class="watchlist-no">${noP !== null ? noP + '%' : '--'} NO</span>
                </div>
            </a>
        `;
    }).join('');

    marketsContainer.innerHTML = items;
}

// Format percentage (0-1 to %)
function formatPercent(value) {
    if (value === null || value === undefined) return '--';
    return Math.round(value * 100) + '%';
}

// Format date for display
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
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

// Update ticker with dynamic content
function updateTicker() {
    if (!tickerTrack) return;

    const items = [];

    // Build alternating pattern: MONITOR MAMDANI, news, MONITOR MAMDANI, market, repeat
    const newsItems = tickerData.news || [];
    const marketItems = tickerData.markets || [];

    // Get random items
    const getRandomNews = () => newsItems.length > 0 ? newsItems[Math.floor(Math.random() * newsItems.length)] : null;
    const getRandomMarket = () => marketItems.length > 0 ? marketItems[Math.floor(Math.random() * marketItems.length)] : null;

    // Build ticker items (need enough for seamless scroll)
    for (let i = 0; i < 8; i++) {
        items.push('MONITOR MAMDANI');

        const news = getRandomNews();
        if (news) {
            items.push(`📰 ${truncate(news, 60)}`);
        }

        items.push('MONITOR MAMDANI');

        const market = getRandomMarket();
        if (market) {
            items.push(`📊 ${truncate(market.title, 50)} — ${market.yes}% YES`);
        }
    }

    // If no data yet, fall back to just MONITOR MAMDANI
    if (newsItems.length === 0 && marketItems.length === 0) {
        tickerTrack.innerHTML = Array(6).fill('<span>MONITOR MAMDANI</span>').join('');
        return;
    }

    tickerTrack.innerHTML = items.map(item => `<span>${escapeHtml(item)}</span>`).join('');
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

// ============================================
// Contact Modal Functions
// ============================================

function openContactModal() {
    const modal = document.getElementById('contactModal');
    const form = document.getElementById('contactForm');
    const success = document.getElementById('contactSuccess');

    if (modal) {
        // Reset state
        if (form) {
            form.classList.remove('hidden');
            form.reset();
        }
        if (success) {
            success.classList.remove('active');
        }

        modal.classList.add('active');
        document.addEventListener('keydown', handleContactModalEscape);
    }
}

function closeContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.removeEventListener('keydown', handleContactModalEscape);
}

function handleContactModalEscape(e) {
    if (e.key === 'Escape') {
        closeContactModal();
    }
}

// Handle contact form submission via Formspree
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('contactSubmitBtn');
            const success = document.getElementById('contactSuccess');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }

            try {
                const formData = new FormData(contactForm);
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    // Show success message
                    contactForm.classList.add('hidden');
                    if (success) {
                        success.classList.add('active');
                    }

                    // Auto-close modal after 2 seconds
                    setTimeout(() => {
                        closeContactModal();
                    }, 2000);
                } else {
                    throw new Error('Form submission failed');
                }
            } catch (error) {
                console.error('Contact form error:', error);
                alert('Failed to send message. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Message';
                }
            }
        });
    }
});

// ============================================
// Share Button Functions
// ============================================

const SHARE_TEXT = 'monitoring mamdani: odds, viral content, and news in one place';
const SHARE_URL = window.location.href;

function handleShare() {
    // Check if Web Share API is available
    if (navigator.share) {
        navigator.share({
            title: 'Monitor Mamdani',
            text: SHARE_TEXT,
            url: SHARE_URL
        }).catch((error) => {
            // User cancelled or error - fall back to dropdown
            if (error.name !== 'AbortError') {
                toggleShareDropdown();
            }
        });
    } else {
        // No Web Share API - show dropdown
        toggleShareDropdown();
    }
}

function toggleShareDropdown() {
    const dropdown = document.getElementById('shareDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function closeShareDropdown() {
    const dropdown = document.getElementById('shareDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

function shareOn(platform) {
    const encodedText = encodeURIComponent(SHARE_TEXT);
    const encodedUrl = encodeURIComponent(SHARE_URL);

    let shareUrl = '';

    switch (platform) {
        case 'x':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
            break;
        case 'reddit':
            shareUrl = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
            break;
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    closeShareDropdown();
}

function copyLink() {
    navigator.clipboard.writeText(SHARE_URL).then(() => {
        showCopyToast();
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = SHARE_URL;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyToast();
    });

    closeShareDropdown();
}

function showCopyToast() {
    // Create toast if it doesn't exist
    let toast = document.querySelector('.copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = 'Link copied!';
        document.body.appendChild(toast);
    }

    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
    }, 2000);
}

// Close share dropdown when clicking outside
document.addEventListener('click', (e) => {
    const shareWrapper = document.querySelector('.share-wrapper');
    if (shareWrapper && !shareWrapper.contains(e.target)) {
        closeShareDropdown();
    }
});
