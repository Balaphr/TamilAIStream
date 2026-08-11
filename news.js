'use strict';

// ============================================
// Tamil News - Client Side Module
// News rendering, management, auto-refresh
// ============================================

const TamilNews = (() => {
    let _articles = [];
    let _config = null;
    let _refreshTimer = null;
    let _autoRefreshInterval = 5 * 60 * 1000;

    const NEWS_API = '/api/news';
    const CONFIG_API = '/api/news/config';

    // ---- API Helpers ----
    async function apiGet(url) {
        try {
            const r = await fetch(url, { cache: 'no-store' });
            return await r.json();
        } catch (e) {
            console.warn('[TamilNews] API GET failed:', url, e);
            return null;
        }
    }

    async function apiPost(url, body) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return await r.json();
        } catch (e) {
            console.warn('[TamilNews] API POST failed:', url, e);
            return null;
        }
    }

    // ---- Data Loading ----
    async function loadNews() {
        const data = await apiGet(NEWS_API);
        if (data && data.articles) {
            _articles = data.articles.filter(a => a.published !== false);
        }
        return _articles;
    }

    async function loadConfig() {
        _config = await apiGet(CONFIG_API);
        if (_config && _config.refreshInterval) {
            _autoRefreshInterval = _config.refreshInterval * 60 * 1000;
        }
        return _config;
    }

    async function refreshFeeds() {
        return await apiPost(NEWS_API + '/refresh', {});
    }

    // ---- Home Page Rendering ----
    function renderNewsSection(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!_articles.length) {
            container.innerHTML = '<div class="news-empty"><i class="fas fa-newspaper"></i><p>No news available yet. Feeds will be fetched automatically.</p></div>';
            return;
        }

        const published = _articles.filter(a => a.published !== false).slice(0, 20);

        container.innerHTML = published.map(article => {
            const timeAgo = getTimeAgo(article.pubDate);
            const catClass = getCatClass(article.category);
            const thumbHtml = article.thumbnail
                ? `<div class="news-card-thumb"><img src="${escapeAttr(article.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'news-card-thumb-placeholder\\'><i class=\\'fas fa-newspaper\\'></i></div>'"></div>`
                : `<div class="news-card-thumb"><div class="news-card-thumb-placeholder"><i class="fas fa-newspaper"></i></div></div>`;

            return `
            <article class="news-card" data-id="${escapeAttr(article.id)}">
                ${thumbHtml}
                <div class="news-card-body">
                    <div class="news-card-meta">
                        <span class="news-card-category ${catClass}">${escapeHtml(article.category || 'General')}</span>
                        <span class="news-card-source">${escapeHtml(article.feedName || article.sourceCategory || 'News')}</span>
                        <span class="news-card-time">${timeAgo}</span>
                    </div>
                    <h3 class="news-card-title">${escapeHtml(article.title)}</h3>
                    <p class="news-card-desc">${escapeHtml((article.description || '').substring(0, 120))}${(article.description || '').length > 120 ? '...' : ''}</p>
                    <a class="news-card-btn" href="${escapeAttr(article.url)}" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-external-link-alt"></i> Read Full News
                    </a>
                </div>
            </article>`;
        }).join('');
    }

    // ---- Builder: Feed Management ----
    function renderFeedsTable(tableBodyId) {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody || !_config) return;

        const feeds = _config.feeds || [];
        if (!feeds.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#888;">No feeds configured</td></tr>';
            return;
        }

        tbody.innerHTML = feeds.map(feed => `
            <tr>
                <td><strong>${escapeHtml(feed.name)}</strong></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#aaa;">${escapeHtml(feed.url)}</td>
                <td><span class="news-cat-badge">${escapeHtml(feed.category || 'General')}</span></td>
                <td><span class="status-badge ${feed.enabled ? 'active' : 'inactive'}">${feed.enabled ? 'Enabled' : 'Disabled'}</span></td>
                <td style="font-size:12px;color:#888;">${feed.lastFetched ? getTimeAgo(feed.lastFetched) : 'Never'}</td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="TamilNews.toggleFeed('${feed.id}')" title="${feed.enabled ? 'Disable' : 'Enable'}">
                            <i class="fas fa-${feed.enabled ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="action-btn" onclick="TamilNews.testFeed('${feed.id}')" title="Test Feed"><i class="fas fa-flask"></i></button>
                        <button class="action-btn" onclick="TamilNews.editFeed('${feed.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="action-btn delete" onclick="TamilNews.removeFeed('${feed.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function renderNewsList(tableBodyId) {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;

        if (!_articles.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#888;">No news articles yet. Click Refresh to fetch.</td></tr>';
            return;
        }

        tbody.innerHTML = _articles.slice(0, 50).map(article => {
            const catClass = getCatClass(article.category);
            return `
            <tr>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(article.title)}</td>
                <td><span class="news-cat-badge ${catClass}">${escapeHtml(article.category || 'General')}</span></td>
                <td>${escapeHtml(article.feedName || '')}</td>
                <td style="font-size:12px;color:#888;">${article.pubDate ? new Date(article.pubDate).toLocaleDateString() : ''}</td>
                <td><span class="status-badge ${article.published !== false ? 'active' : 'inactive'}">${article.published !== false ? 'Published' : 'Hidden'}</span></td>
                <td>
                    <div class="actions">
                        <button class="action-btn" onclick="TamilNews.togglePublish('${article.id}', ${article.published === false})" title="${article.published === false ? 'Publish' : 'Unpublish'}">
                            <i class="fas fa-${article.published === false ? 'eye' : 'eye-slash'}"></i>
                        </button>
                        <button class="action-btn delete" onclick="TamilNews.deleteArticle('${article.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ---- Feed CRUD ----
    function openAddFeedModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'newsFeedModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('newsFeedModal').remove()"></div>
            <div class="modal-content" style="max-width:550px;">
                <div class="modal-header">
                    <h2>Add RSS Feed</h2>
                    <button class="modal-close" onclick="document.getElementById('newsFeedModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Feed Name *</label>
                        <input type="text" class="form-input" id="nfName" placeholder="e.g. Tamil OneIndia">
                    </div>
                    <div class="form-group">
                        <label class="form-label">RSS Feed URL *</label>
                        <input type="url" class="form-input" id="nfUrl" placeholder="https://example.com/rss/feed.xml">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select class="form-input" id="nfCategory">
                            <option value="General">General</option>
                            <option value="Breaking News">Breaking News</option>
                            <option value="Tamil Nadu">Tamil Nadu</option>
                            <option value="India">India</option>
                            <option value="Cinema">Cinema</option>
                            <option value="Sports">Sports</option>
                            <option value="Technology">Technology</option>
                            <option value="Business">Business</option>
                            <option value="World">World</option>
                            <option value="Latest">Latest</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button class="builder-btn primary" onclick="TamilNews.saveFeed()"><i class="fas fa-save"></i> Save Feed</button>
                        <button class="builder-btn" onclick="document.getElementById('newsFeedModal').remove()">Cancel</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    function openEditFeedModal(feedId) {
        const feed = (_config?.feeds || []).find(f => f.id === feedId);
        if (!feed) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'newsFeedModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="document.getElementById('newsFeedModal').remove()"></div>
            <div class="modal-content" style="max-width:550px;">
                <div class="modal-header">
                    <h2>Edit RSS Feed</h2>
                    <button class="modal-close" onclick="document.getElementById('newsFeedModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Feed Name *</label>
                        <input type="text" class="form-input" id="nfName" value="${escapeAttr(feed.name)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">RSS Feed URL *</label>
                        <input type="url" class="form-input" id="nfUrl" value="${escapeAttr(feed.url)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select class="form-input" id="nfCategory">
                            ${['General','Breaking News','Tamil Nadu','India','Cinema','Sports','Technology','Business','World','Latest'].map(c =>
                                `<option value="${c}" ${feed.category === c ? 'selected' : ''}>${c}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <input type="hidden" id="nfEditId" value="${feedId}">
                    <div class="form-actions">
                        <button class="builder-btn primary" onclick="TamilNews.saveFeed()"><i class="fas fa-save"></i> Update Feed</button>
                        <button class="builder-btn" onclick="document.getElementById('newsFeedModal').remove()">Cancel</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    async function saveFeed() {
        const name = document.getElementById('nfName')?.value.trim();
        const url = document.getElementById('nfUrl')?.value.trim();
        const category = document.getElementById('nfCategory')?.value || 'General';
        const editId = document.getElementById('nfEditId')?.value;

        if (!name || !url) {
            if (typeof showToast === 'function') showToast('Name and URL are required', 'error');
            return;
        }

        if (!_config) _config = { feeds: [], maxItems: 100, refreshInterval: 5, autoPublish: true };
        if (!_config.feeds) _config.feeds = [];

        if (editId) {
            const idx = _config.feeds.findIndex(f => f.id === editId);
            if (idx !== -1) {
                _config.feeds[idx] = { ..._config.feeds[idx], name, url, category };
            }
        } else {
            _config.feeds.push({
                id: 'feed_' + Date.now(),
                name, url, category,
                enabled: true, lastFetched: null, error: null
            });
        }

        await apiPost(CONFIG_API, { feeds: _config.feeds });
        document.getElementById('newsFeedModal')?.remove();
        renderFeedsTable('newsFeedsTable');
        if (typeof showToast === 'function') showToast(editId ? 'Feed updated!' : 'Feed added!', 'success');
    }

    async function toggleFeed(feedId) {
        if (!_config?.feeds) return;
        const feed = _config.feeds.find(f => f.id === feedId);
        if (feed) feed.enabled = !feed.enabled;
        await apiPost(CONFIG_API, { feeds: _config.feeds });
        renderFeedsTable('newsFeedsTable');
    }

    async function removeFeed(feedId) {
        if (!confirm('Delete this RSS feed?')) return;
        if (!_config?.feeds) return;
        _config.feeds = _config.feeds.filter(f => f.id !== feedId);
        await apiPost(CONFIG_API, { feeds: _config.feeds });
        renderFeedsTable('newsFeedsTable');
        if (typeof showToast === 'function') showToast('Feed removed', 'success');
    }

    async function testFeed(feedId) {
        const feed = (_config?.feeds || []).find(f => f.id === feedId);
        if (!feed) return;
        if (typeof showToast === 'function') showToast('Testing feed: ' + feed.name + '...', 'info');
        const result = await refreshFeeds();
        if (result && result.success) {
            if (typeof showToast === 'function') showToast(`Feed test complete. ${result.newCount || 0} new articles found.`, 'success');
        } else {
            if (typeof showToast === 'function') showToast('Feed test failed', 'error');
        }
    }

    function editFeed(feedId) { openEditFeedModal(feedId); }

    // ---- Article Actions ----
    async function togglePublish(articleId, shouldPublish) {
        await apiPost(NEWS_API + '/publish', { articleId, published: shouldPublish });
        const art = _articles.find(a => a.id === articleId);
        if (art) art.published = shouldPublish;
        renderNewsList('newsArticlesTable');
    }

    async function deleteArticle(articleId) {
        if (!confirm('Delete this article?')) return;
        await apiPost(NEWS_API + '/delete', { articleId });
        _articles = _articles.filter(a => a.id !== articleId);
        renderNewsList('newsArticlesTable');
    }

    // ---- Auto Refresh ----
    function startAutoRefresh() {
        stopAutoRefresh();
        _refreshTimer = setInterval(async () => {
            await loadNews();
            const section = document.getElementById('newsSectionTrack');
            if (section) renderNewsSection('newsSectionTrack');
        }, _autoRefreshInterval);
    }

    function stopAutoRefresh() {
        if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
    }

    // ---- Helpers ----
    function getTimeAgo(dateStr) {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        const days = Math.floor(hrs / 24);
        return days + 'd ago';
    }

    function getCatClass(category) {
        const map = {
            'Breaking News': 'cat-breaking',
            'Tamil Nadu': 'cat-tn',
            'India': 'cat-india',
            'Cinema': 'cat-cinema',
            'Sports': 'cat-sports',
            'Technology': 'cat-tech',
            'Business': 'cat-business',
            'World': 'cat-world',
            'Trending': 'cat-trending'
        };
        return map[category] || 'cat-general';
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ---- Public API ----
    return {
        loadNews, loadConfig, refreshFeeds,
        renderNewsSection, renderFeedsTable, renderNewsList,
        openAddFeedModal, openEditFeedModal, saveFeed,
        toggleFeed, removeFeed, testFeed, editFeed,
        togglePublish, deleteArticle,
        startAutoRefresh, stopAutoRefresh,
        get articles() { return _articles; },
        get config() { return _config; }
    };
})();

if (typeof window !== 'undefined') window.TamilNews = TamilNews;
