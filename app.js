// Monitor Mamdani - Live Feed Application
// Virlo Trends + Comet + Firecrawl - Monitoring Zohran Mamdani

const POLL_INTERVAL = 60000; // 60 seconds
const NEWS_POLL_INTERVAL = 3600000; // 1 hour for Firecrawl news (save credits)
const VIRLO_POLL_INTERVAL = 86400000; // 24 hours for Virlo API (save credits)
const NYC_OPEN_DATA_POLL_INTERVAL = 3600000; // 1 hour for NYC Open Data (free API, but no need for frequent updates)
const MAX_ITEMS = 50;

let pollTimer = null;
let isFirstLoad = true;
let lastNewsFetchTime = 0; // Track last news fetch to limit to once per hour
let lastVirloFetchTime = 0; // Track last Virlo fetch to limit to once per day
let lastNYCDataFetchTime = 0; // Track last NYC Open Data fetch

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

// NYC Open Data DOM Elements
const nyc311Container = document.getElementById('nyc311Container');
const nycLegislationContainer = document.getElementById('nycLegislationContainer');
const nycBudgetContainer = document.getElementById('nycBudgetContainer');
const nycMMRContainer = document.getElementById('nycMMRContainer');

// Promises Tracker DOM Elements
const promisesCompletedEl = document.getElementById('promisesCompleted');
const promisesTotalEl = document.getElementById('promisesTotal');
const promisesProgressBarEl = document.getElementById('promisesProgressBar');
const promisesStatusEl = document.getElementById('promisesStatus');

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
        // Only fetch news if it's been more than 1 hour (save Firecrawl credits)
        // Only fetch Virlo (trends/videos) if it's been more than 24 hours (save credits)
        // Only fetch NYC Open Data if it's been more than 1 hour
        const now = Date.now();
        const shouldFetchNews = (now - lastNewsFetchTime) >= NEWS_POLL_INTERVAL;
        const shouldFetchVirlo = (now - lastVirloFetchTime) >= VIRLO_POLL_INTERVAL;
        const shouldFetchNYCData = (now - lastNYCDataFetchTime) >= NYC_OPEN_DATA_POLL_INTERVAL;

        // Build fetch array - conditionally include news, Virlo, and NYC data
        const fetchPromises_arr = [
            fetchPromises(),
            shouldFetchNews ? fetchNews() : Promise.resolve(null),
            shouldFetchVirlo ? fetchTrends() : Promise.resolve(null),
            shouldFetchVirlo ? fetchVideos() : Promise.resolve(null),
            fetchMarkets(),
            fetchKalshiMarkets()
        ];

        // Fetch all endpoints in parallel (including Kalshi)
        const [promisesResult, newsResult, trendsResult, videosResult, marketsResult, kalshiResult] = await Promise.allSettled(fetchPromises_arr);

        // Update last fetch times
        if (shouldFetchNews && newsResult.status === 'fulfilled') {
            lastNewsFetchTime = now;
        }
        if (shouldFetchVirlo && (trendsResult.status === 'fulfilled' || videosResult.status === 'fulfilled')) {
            lastVirloFetchTime = now;
        }

        // Fetch NYC Open Data separately (non-blocking, lower priority)
        if (shouldFetchNYCData) {
            fetchNYCOpenData().then(() => {
                lastNYCDataFetchTime = Date.now();
            }).catch(() => {});
        }

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

        // Check promise completion after enrichment
        checkPromiseCompletion(promises);
    } catch (error) {
        // Keep basic render, still try to check completion
        checkPromiseCompletion(promises);
    }
}

// Check which campaign promises are completed based on news and video evidence
async function checkPromiseCompletion(promises) {
    if (!promises || promises.length === 0) {
        updatePromisesTracker(0, 0);
        return;
    }

    // Update total immediately
    if (promisesTotalEl) {
        promisesTotalEl.textContent = promises.length;
    }
    if (promisesStatusEl) {
        promisesStatusEl.textContent = 'Scanning news & videos...';
    }

    try {
        const response = await fetch('/api/promise-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                promises: promises,
                news: fetchedData.news,
                videos: fetchedData.videos
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        updatePromisesTracker(data.completed, data.total, data.completedPromises);

    } catch (error) {
        updatePromisesTracker(0, promises.length);
    }
}

// Update the promises tracker UI
function updatePromisesTracker(completed, total, completedPromises = []) {
    if (promisesCompletedEl) {
        promisesCompletedEl.textContent = completed;
    }
    if (promisesTotalEl) {
        promisesTotalEl.textContent = total;
    }
    if (promisesProgressBarEl) {
        const percentage = total > 0 ? (completed / total) * 100 : 0;
        promisesProgressBarEl.style.width = `${percentage}%`;
    }
    if (promisesStatusEl) {
        if (completed === 0 && total > 0) {
            promisesStatusEl.textContent = 'No completions verified yet';
            promisesStatusEl.classList.remove('verified');
        } else if (completed > 0) {
            promisesStatusEl.textContent = `${completed} verified via news/content`;
            promisesStatusEl.classList.add('verified');
        } else {
            promisesStatusEl.textContent = 'Awaiting data...';
            promisesStatusEl.classList.remove('verified');
        }
    }

    // Store completed promises for potential display elsewhere
    window.completedPromisesData = completedPromises;
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

// Render trends section - only show if Mamdani-related trends exist
function renderTrends(data) {
    if (!trendsContainer) return;

    const trendsPanel = document.getElementById('trendsPanel');
    const mamdaniTrends = data.items || [];

    // Only show the panel if there are Mamdani-related trends
    if (mamdaniTrends.length === 0) {
        // Hide the entire panel if no Mamdani trends
        if (trendsPanel) {
            trendsPanel.style.display = 'none';
        }
        return;
    }

    // Show the panel since we have Mamdani trends
    if (trendsPanel) {
        trendsPanel.style.display = 'block';
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

    const rows = mamdaniTrends.map(trend => {
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

    const subtitle = `<div class="feed-subtitle">Found ${mamdaniTrends.length} Mamdani-related trend(s)</div>`;

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
// NYC Open Data Functions
// ============================================

// Fetch all NYC Open Data endpoints
async function fetchNYCOpenData() {
    // Fetch all NYC data in parallel
    const [data311, legislation, budget, mmr] = await Promise.allSettled([
        fetch('/api/nyc-311').then(r => r.json()),
        fetch('/api/nyc-legislation').then(r => r.json()),
        fetch('/api/nyc-budget').then(r => r.json()),
        fetch('/api/nyc-mmr').then(r => r.json())
    ]);

    // Render each dataset
    if (data311.status === 'fulfilled') {
        render311Data(data311.value);
    }
    if (legislation.status === 'fulfilled') {
        renderLegislationData(legislation.value);
    }
    if (budget.status === 'fulfilled') {
        renderBudgetData(budget.value);
    }
    if (mmr.status === 'fulfilled') {
        renderMMRData(mmr.value);
    }
}

// Render 311 Service Requests
function render311Data(data) {
    if (!nyc311Container) return;

    if (data.error || !data.topComplaintTypes || data.topComplaintTypes.length === 0) {
        nyc311Container.innerHTML = `<div class="feed-empty"><p>311 DATA UNAVAILABLE</p></div>`;
        return;
    }

    const totalFormatted = data.totalComplaints ? data.totalComplaints.toLocaleString() : '0';

    let html = `
        <div class="nyc-data-summary">
            <div class="nyc-stat">
                <span class="nyc-stat-value">${totalFormatted}</span>
                <span class="nyc-stat-label">Total Requests (${data.period || 'Last 7 days'})</span>
            </div>
        </div>
        <div class="nyc-311-grid">
            <div class="nyc-311-section">
                <h4 class="nyc-section-title">Top Complaint Types</h4>
                <div class="nyc-311-list">
    `;

    data.topComplaintTypes.slice(0, 10).forEach((item, idx) => {
        const pct = data.totalComplaints ? ((item.count / data.totalComplaints) * 100).toFixed(1) : 0;
        html += `
            <div class="nyc-311-item">
                <span class="nyc-311-rank">${idx + 1}</span>
                <span class="nyc-311-type">${escapeHtml(item.type)}</span>
                <span class="nyc-311-count">${item.count.toLocaleString()}</span>
                <span class="nyc-311-pct">${pct}%</span>
            </div>
        `;
    });

    html += `</div></div>`;

    // Top agencies section
    if (data.topAgencies && data.topAgencies.length > 0) {
        html += `
            <div class="nyc-311-section">
                <h4 class="nyc-section-title">Top Responding Agencies</h4>
                <div class="nyc-311-list">
        `;

        data.topAgencies.slice(0, 5).forEach((agency, idx) => {
            html += `
                <div class="nyc-311-item">
                    <span class="nyc-311-rank">${idx + 1}</span>
                    <span class="nyc-311-type">${escapeHtml(agency.agency)}</span>
                    <span class="nyc-311-count">${agency.count.toLocaleString()}</span>
                </div>
            `;
        });

        html += `</div></div>`;
    }

    html += `</div>`;

    nyc311Container.innerHTML = html;
}

// Render City Council Legislation
function renderLegislationData(data) {
    if (!nycLegislationContainer) return;

    if (data.error) {
        nycLegislationContainer.innerHTML = `<div class="feed-empty"><p>LEGISLATION DATA UNAVAILABLE</p></div>`;
        return;
    }

    let html = `<div class="nyc-legislation-grid">`;

    // Local Laws section
    if (data.localLaws && data.localLaws.length > 0) {
        html += `
            <div class="nyc-legislation-section">
                <h4 class="nyc-section-title">Recent Local Laws</h4>
                <div class="nyc-legislation-list">
        `;

        data.localLaws.slice(0, 8).forEach(law => {
            html += `
                <div class="nyc-legislation-item local-law">
                    <div class="legislation-header">
                        <span class="legislation-number">${escapeHtml(law.localLaw || law.introNumber)}</span>
                        <span class="legislation-status enacted">ENACTED</span>
                    </div>
                    <div class="legislation-name">${escapeHtml(law.name)}</div>
                    <div class="legislation-meta">
                        ${law.sponsor ? `<span>Sponsor: ${escapeHtml(law.sponsor)}</span>` : ''}
                        ${law.enactmentDate ? `<span>Enacted: ${escapeHtml(law.enactmentDate)}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    }

    // Pending Bills section
    if (data.pendingBills && data.pendingBills.length > 0) {
        html += `
            <div class="nyc-legislation-section">
                <h4 class="nyc-section-title">Recent Bills</h4>
                <div class="nyc-legislation-list">
        `;

        data.pendingBills.slice(0, 10).forEach(bill => {
            const statusClass = (bill.status || '').toLowerCase().includes('enacted') ? 'enacted' :
                               (bill.status || '').toLowerCase().includes('committee') ? 'committee' : 'pending';
            html += `
                <div class="nyc-legislation-item">
                    <div class="legislation-header">
                        <span class="legislation-number">${escapeHtml(bill.introNumber)}</span>
                        <span class="legislation-status ${statusClass}">${escapeHtml(bill.status || 'PENDING')}</span>
                    </div>
                    <div class="legislation-name">${escapeHtml(bill.name)}</div>
                    <div class="legislation-meta">
                        ${bill.sponsor ? `<span>Sponsor: ${escapeHtml(bill.sponsor)}</span>` : ''}
                        ${bill.introDate ? `<span>Introduced: ${escapeHtml(bill.introDate)}</span>` : ''}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    }

    html += `</div>`;

    nycLegislationContainer.innerHTML = html;
}

// Render NYC Budget Data
function renderBudgetData(data) {
    if (!nycBudgetContainer) return;

    if (data.error || !data.items || data.items.length === 0) {
        nycBudgetContainer.innerHTML = `<div class="feed-empty"><p>BUDGET DATA UNAVAILABLE</p></div>`;
        return;
    }

    let html = `
        <div class="nyc-data-summary">
            <div class="nyc-stat">
                <span class="nyc-stat-value">${escapeHtml(data.totalAdopted || '--')}</span>
                <span class="nyc-stat-label">Total Adopted Budget</span>
            </div>
            <div class="nyc-stat">
                <span class="nyc-stat-value">${escapeHtml(data.totalModified || '--')}</span>
                <span class="nyc-stat-label">Modified Budget</span>
            </div>
            ${data.fiscalYear ? `<div class="nyc-stat"><span class="nyc-stat-value">FY${escapeHtml(data.fiscalYear)}</span><span class="nyc-stat-label">Fiscal Year</span></div>` : ''}
        </div>
        <div class="nyc-budget-grid">
            <h4 class="nyc-section-title">Top Agency Budgets</h4>
            <div class="nyc-budget-list">
    `;

    data.items.slice(0, 12).forEach((item, idx) => {
        const changeClass = item.change && item.change.startsWith('+') ? 'positive' :
                           item.change && item.change.startsWith('-') ? 'negative' : '';
        html += `
            <div class="nyc-budget-item">
                <span class="nyc-budget-rank">${idx + 1}</span>
                <div class="nyc-budget-info">
                    <span class="nyc-budget-agency">${escapeHtml(item.agency)}</span>
                    <span class="nyc-budget-categories">${item.topCategories ? item.topCategories.map(c => c.name).join(', ') : ''}</span>
                </div>
                <div class="nyc-budget-amounts">
                    <span class="nyc-budget-adopted">${escapeHtml(item.adoptedBudget)}</span>
                    <span class="nyc-budget-change ${changeClass}">${escapeHtml(item.change || '')}</span>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;

    nycBudgetContainer.innerHTML = html;
}

// Render Mayor's Management Report
function renderMMRData(data) {
    if (!nycMMRContainer) return;

    if (data.error || !data.items || data.items.length === 0) {
        nycMMRContainer.innerHTML = `<div class="feed-empty"><p>MMR DATA UNAVAILABLE</p></div>`;
        return;
    }

    let html = `
        <div class="nyc-data-summary">
            <div class="nyc-stat">
                <span class="nyc-stat-value">${data.count || 0}</span>
                <span class="nyc-stat-label">Agencies Tracked</span>
            </div>
            <div class="nyc-stat">
                <span class="nyc-stat-value">${data.totalRecords || 0}</span>
                <span class="nyc-stat-label">Performance Indicators</span>
            </div>
        </div>
        <div class="nyc-mmr-grid">
            <h4 class="nyc-section-title">Agency Performance Metrics</h4>
            <div class="nyc-mmr-list">
    `;

    data.items.slice(0, 10).forEach(agency => {
        html += `
            <div class="nyc-mmr-item">
                <div class="nyc-mmr-header">
                    <span class="nyc-mmr-agency">${escapeHtml(agency.agency)}</span>
                    <span class="nyc-mmr-count">${agency.metricCount} indicators</span>
                </div>
                <div class="nyc-mmr-metrics">
        `;

        agency.metrics.slice(0, 3).forEach(metric => {
            html += `
                <div class="nyc-mmr-metric">
                    <span class="metric-name">${escapeHtml(truncate(metric.indicator, 60))}</span>
                    <span class="metric-value">${escapeHtml(metric.actual)}</span>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    html += `</div></div>`;

    nycMMRContainer.innerHTML = html;
}

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
// Changelog Modal Functions
// ============================================

let changelogLoaded = false;

function openChangelogModal() {
    const modal = document.getElementById('changelogModal');
    if (modal) {
        modal.classList.add('active');
        document.addEventListener('keydown', handleChangelogModalEscape);

        // Load changelog if not already loaded
        if (!changelogLoaded) {
            fetchChangelog();
        }
    }
}

function closeChangelogModal() {
    const modal = document.getElementById('changelogModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.removeEventListener('keydown', handleChangelogModalEscape);
}

function handleChangelogModalEscape(e) {
    if (e.key === 'Escape') {
        closeChangelogModal();
    }
}

async function fetchChangelog() {
    const body = document.getElementById('changelogModalBody');
    if (!body) return;

    try {
        const response = await fetch('/api/changelog');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        renderChangelog(data);
        changelogLoaded = true;

    } catch (error) {
        body.innerHTML = `
            <div class="changelog-error">
                <p>Failed to load changelog</p>
            </div>
        `;
    }
}

function renderChangelog(data) {
    const body = document.getElementById('changelogModalBody');
    if (!body) return;

    const commits = data.commits || [];

    if (commits.length === 0) {
        body.innerHTML = `
            <div class="changelog-empty">
                <p>No changelog entries found</p>
            </div>
        `;
        return;
    }

    const items = commits.map(commit => `
        <div class="changelog-item">
            <div class="changelog-item-header">
                <span class="changelog-sha">${escapeHtml(commit.sha)}</span>
                <span class="changelog-date">${escapeHtml(commit.date)}</span>
            </div>
            <div class="changelog-title">${escapeHtml(commit.title)}</div>
            ${commit.body ? `<div class="changelog-body">${escapeHtml(commit.body)}</div>` : ''}
        </div>
    `).join('');

    body.innerHTML = `
        <div class="changelog-list">
            ${items}
        </div>
        <div class="changelog-footer">
            <a href="https://github.com/VirloGit/monitormamdani/commits/main" target="_blank" rel="noopener">
                View all commits on GitHub
            </a>
        </div>
    `;
}

// ============================================
// Notify Modal Functions
// ============================================

function openNotifyModal() {
    const modal = document.getElementById('notifyModal');
    const form = document.getElementById('notifyForm');
    const success = document.getElementById('notifySuccess');

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
        document.addEventListener('keydown', handleNotifyModalEscape);
    }
}

function closeNotifyModal() {
    const modal = document.getElementById('notifyModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.removeEventListener('keydown', handleNotifyModalEscape);
}

function handleNotifyModalEscape(e) {
    if (e.key === 'Escape') {
        closeNotifyModal();
    }
}

// Handle notify form submission via Buttondown API
document.addEventListener('DOMContentLoaded', () => {
    const notifyForm = document.getElementById('notifyForm');
    if (notifyForm) {
        notifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('notifySubmitBtn');
            const success = document.getElementById('notifySuccess');
            const emailInput = notifyForm.querySelector('input[name="email"]');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Subscribing...';
            }

            try {
                // Collect tags from checkboxes
                const tags = [];
                const checkboxes = notifyForm.querySelectorAll('input[type="checkbox"]:checked');
                checkboxes.forEach(cb => {
                    if (cb.name && cb.name !== 'email') {
                        tags.push(cb.name);
                    }
                });

                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: emailInput.value,
                        tags: tags
                    })
                });

                const data = await response.json();

                console.log('Subscription response:', response.status, data);

                if (data.success) {
                    notifyForm.classList.add('hidden');
                    if (success) {
                        success.classList.add('active');
                    }

                    // Auto-close modal after 2.5 seconds
                    setTimeout(() => {
                        closeNotifyModal();
                        // Reset form for next use
                        notifyForm.reset();
                        notifyForm.classList.remove('hidden');
                        if (success) {
                            success.classList.remove('active');
                        }
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Subscribe';
                        }
                    }, 2500);
                } else {
                    const errorMsg = data.error || data.message || JSON.stringify(data);
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Subscription error:', error);
                let errorMessage = 'An unexpected error occurred';
                if (error.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'object') {
                    errorMessage = JSON.stringify(error);
                }
                alert('Failed to subscribe: ' + errorMessage);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Subscribe';
                }
            }
        });
    }
});

// ShareThis handles share buttons - no custom code needed
