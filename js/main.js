(function () {
    'use strict';

    const state = {
        platform: 'all',
        category: 'all',
        search: '',
        sort: 'popular',
        view: 'grid',
        page: 1
    };

    const PAGE_SIZE = 8;

    let appsData = [];
    let detailAppId = null;
    let aboutViewActive = false;
    let hasInitialRender = false;
    let savedListScrollY = 0;
    let modalReturnFocus = null;

    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

    const PLATFORMS = {
        windows: 'Windows',
        android: 'Android'
    };

    function scrollMainToTop(options) {
        options = options || {};
        window.scrollTo({ top: 0, behavior: options.behavior || 'auto' });
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/'/g, '&#39;');
    }

    function escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Render an app's icon markup.
     * - If app.icon is a file path/URL (no <svg>/<img> tag), wrap it in an <img>.
     * - If it's inline SVG or already an <img> tag, return as-is.
     * - Empty/missing returns ''.
     * Supports both image path/URL icons and inline SVG markup.
     */
    function iconHtml(app) {
        const icon = app && app.icon;
        if (!icon) return '';
        if (/<svg|<img/i.test(icon)) return icon;
        const alt = escapeAttr((app && app.name) || '') + ' 图标';
        const src = escapeAttr(icon);
        // Built via concatenation (not a template literal) so the closing
        // backtick can never get mangled into a quote by tooling.
        return '<img class="app-icon-img" src="' + src + '" alt="' + alt +
            '" loading="lazy" decoding="async" onerror="this.classList.add(\'app-icon-img-broken\')">';
    }

    function normalizeGithubUrl(url) {
        if (!url || !String(url).trim()) return '';
        const raw = String(url).trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        if (/^github\.com\//i.test(raw)) return 'https://' + raw.replace(/^\/+/, '');
        if (/^[\w.-]+\/[\w.-]+/.test(raw)) return 'https://github.com/' + raw.replace(/^\/+/, '');
        return raw;
    }

    const ALLOWED_MIRROR_TYPES = ['quark', 'baidu'];
    const MIRROR_PREF_KEY = 'shelfhub-mirror-pref';

    function getMirrorPref() {
        try {
            const v = localStorage.getItem(MIRROR_PREF_KEY);
            if (v === 'baidu' || v === 'quark') return v;
        } catch (_) { /* ignore */ }
        return 'quark';
    }

    function setMirrorPref(type) {
        const next = type === 'baidu' ? 'baidu' : 'quark';
        try { localStorage.setItem(MIRROR_PREF_KEY, next); } catch (_) { /* ignore */ }
        const select = $('#mirrorPrefSelect');
        if (select) select.value = next;
        return next;
    }

    function mirrorSortOrder() {
        const pref = getMirrorPref();
        return pref === 'baidu' ? { baidu: 0, quark: 1 } : { quark: 0, baidu: 1 };
    }

    function filterDownloadSources(sources) {
        if (!Array.isArray(sources)) return [];
        const order = mirrorSortOrder();
        return sources
            .filter(s => s && ALLOWED_MIRROR_TYPES.indexOf(s.type) !== -1)
            .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    }

    function normalizeApp(app) {
        if (!app || typeof app !== 'object') return app;
        const next = Object.assign({}, app);
        next.githubUrl = normalizeGithubUrl(app.githubUrl);
        next.downloadSources = filterDownloadSources(app.downloadSources);
        return next;
    }

    function placeholderIconSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></svg>';
    }

    const FAVORITES_KEY = 'shelfhub-favorites';
    const RECENT_KEY = 'shelfhub-recent';
    const RECENT_LIMIT = 8;

    function readIdList(key) {
        try {
            let raw = localStorage.getItem(key);
            // Migrate legacy SoftHub / EchoHub keys once.
            if (!raw && key === FAVORITES_KEY) {
                raw = localStorage.getItem('echohub-favorites') || localStorage.getItem('softhub-favorites');
            }
            if (!raw && key === RECENT_KEY) {
                raw = localStorage.getItem('echohub-recent') || localStorage.getItem('softhub-recent');
            }
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list.map(String) : [];
        } catch (e) {
            return [];
        }
    }

    function writeIdList(key, list) {
        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) { /* ignore quota */ }
    }

    function getFavorites() {
        return readIdList(FAVORITES_KEY);
    }

    function isFavorite(id) {
        return getFavorites().indexOf(String(id)) !== -1;
    }

    function toggleFavorite(id) {
        const list = getFavorites();
        const key = String(id);
        const idx = list.indexOf(key);
        if (idx === -1) list.unshift(key);
        else list.splice(idx, 1);
        writeIdList(FAVORITES_KEY, list.slice(0, 40));
        renderFavoritesList();
        return idx === -1;
    }

    function pushRecent(id) {
        const key = String(id);
        const list = readIdList(RECENT_KEY).filter(x => x !== key);
        list.unshift(key);
        writeIdList(RECENT_KEY, list.slice(0, RECENT_LIMIT));
        renderRecentList();
    }

    function renderSidebarAppList(containerId, ids, emptyText) {
        const list = document.getElementById(containerId);
        if (!list) return;

        const apps = ids
            .map(id => appsData.find(a => a.id === id))
            .filter(Boolean);

        if (!apps.length) {
            list.innerHTML = '<p class="hot-empty">' + escapeHtml(emptyText) + '</p>';
            return;
        }

        list.innerHTML = apps.map(app => `
            <button class="hot-item" type="button" data-id="${escapeAttr(app.id)}">
                <span class="hot-item-icon">${iconHtml(app) || placeholderIconSvg()}</span>
                <span class="hot-item-body">
                    <span class="hot-item-name">${escapeHtml(app.name)}</span>
                    <span class="hot-item-meta">${escapeHtml(app.categoryName || '')}</span>
                </span>
            </button>
        `).join('');

        list.querySelectorAll('.hot-item').forEach(btn => {
            btn.addEventListener('click', () => showAppDetail(btn.dataset.id));
        });
    }

    function renderFavoritesList() {
        renderSidebarAppList('favoritesList', getFavorites(), '点击详情页收藏按钮添加');
    }

    function renderRecentList() {
        renderSidebarAppList('recentList', readIdList(RECENT_KEY), '浏览软件后会出现在这里');
    }

    const DEFAULT_META = {
        title: '架集 ShelfHub - GitHub 开源软件国内镜像下载',
        description: '架集 ShelfHub - 收录 GitHub 优质开源软件，提供夸克与百度网盘镜像下载，无需加速器即可极速获取',
        keywords: 'GitHub下载,GitHub镜像,开源软件,Windows软件,Android应用,软件下载,夸克网盘,百度网盘,架集,ShelfHub'
    };

    function siteOrigin() {
        return location.origin && location.origin !== 'null'
            ? location.origin
            : 'https://scumguide.site';
    }

    function truncateMeta(str, max) {
        const s = String(str || '').replace(/\s+/g, ' ').trim();
        if (s.length <= max) return s;
        return s.slice(0, max - 1).trimEnd() + '…';
    }

    function buildHomeMetaFromApps() {
        const count = appsData.length;
        if (!count) return Object.assign({}, DEFAULT_META);

        const win = appsData.filter(a => a.platform === 'windows').length;
        const android = appsData.filter(a => a.platform === 'android').length;
        const names = appsData.slice(0, 8).map(a => a.name).filter(Boolean);
        const namePart = names.length ? '，当前收录：' + names.join('、') : '';
        const description = truncateMeta(
            '架集 ShelfHub 收录 ' + count + ' 款 GitHub 开源软件（Windows ' + win +
            ' / Android ' + android + '），提供夸克与百度网盘镜像下载' + namePart + '。',
            160
        );

        const keywords = Array.from(new Set(
            DEFAULT_META.keywords.split(',').concat(
                appsData.flatMap(app => [
                    app.name,
                    app.name ? app.name + '下载' : '',
                    app.categoryName || ''
                ]).filter(Boolean)
            )
        )).slice(0, 40).join(',');

        return {
            title: DEFAULT_META.title,
            description: description,
            keywords: keywords,
            url: siteOrigin() + '/'
        };
    }

    function buildAppMeta(app) {
        const platform = app.platform === 'windows' ? 'Windows' : 'Android';
        const mirrors = (app.downloadSources || []).length;
        const description = truncateMeta([
            app.description || '',
            app.name + ' ' + platform + ' 版镜像下载',
            app.version ? '版本 ' + app.version : '',
            mirrors ? mirrors + ' 个国内网盘镜像' : '国内网盘镜像',
            '架集 ShelfHub'
        ].filter(Boolean).join(' · '), 160);

        const keywords = Array.from(new Set([
            app.name,
            app.name + '下载',
            app.name + ' GitHub',
            platform + '软件',
            app.categoryName,
            'GitHub镜像',
            '夸克网盘',
            '百度网盘',
            '架集',
            'ShelfHub'
        ].filter(Boolean))).join(',');

        return {
            title: app.name + ' 下载（' + platform + '）- 架集 ShelfHub',
            description: description,
            keywords: keywords,
            url: getAppShareUrl(app.id)
        };
    }

    const CHIP_LABELS = {
        all: '全部',
        ai: 'AI 工具',
        development: '开发工具',
        office: '办公效率',
        design: '设计创意',
        entertainment: '影音娱乐',
        system: '系统工具',
        network: '网络通讯',
        security: '安全防护',
        tools: '实用工具',
        games: '游戏娱乐'
    };

    const SIDEBAR_LABELS = {
        all: '推荐',
        ai: 'AI',
        development: '开发',
        office: '办公',
        design: '创作',
        entertainment: '影音',
        system: '系统',
        network: '网络',
        security: '安全',
        tools: '工具',
        games: '游戏'
    };

    function highlightSearch(text, query) {
        const safe = escapeHtml(text);
        if (!query) return safe;
        try {
            const regex = new RegExp('(' + escapeRegExp(query) + ')', 'gi');
            return safe.replace(regex, '<mark class="search-highlight">$1</mark>');
        } catch (e) {
            return safe;
        }
    }

    function isHomeView() {
        return state.platform === 'all' && state.category === 'all' && !state.search;
    }

    function isInputFocused() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function updatePageMeta(meta) {
        meta = meta || buildHomeMetaFromApps();
        document.title = meta.title;

        const descEl = $('#metaDescription');
        if (descEl) descEl.setAttribute('content', meta.description);

        const keywordsEl = $('#metaKeywords');
        if (keywordsEl && meta.keywords) keywordsEl.setAttribute('content', meta.keywords);

        const pageUrl = meta.url || (siteOrigin() + '/');
        const canonical = $('#canonicalLink');
        if (canonical) canonical.setAttribute('href', pageUrl);
        const ogUrl = $('#ogUrl');
        if (ogUrl) ogUrl.setAttribute('content', pageUrl);

        ['ogTitle', 'twitterTitle'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.setAttribute('content', meta.title);
        });

        ['ogDescription', 'twitterDescription'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.setAttribute('content', meta.description);
        });
    }

    function updateJsonLd(app) {
        let script = $('#jsonLd');
        if (!script) {
            script = document.createElement('script');
            script.id = 'jsonLd';
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }

        const origin = siteOrigin();

        if (app) {
            const ld = {
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: app.name,
                description: app.description,
                applicationCategory: app.categoryName,
                operatingSystem: app.platform === 'windows' ? 'Windows' : 'Android',
                softwareVersion: app.version,
                url: getAppShareUrl(app.id),
                offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'CNY'
                }
            };
            if (app.githubUrl) ld.codeRepository = app.githubUrl;
            if (app.githubStars > 0) {
                ld.interactionStatistic = {
                    '@type': 'InteractionCounter',
                    interactionType: 'https://schema.org/LikeAction',
                    userInteractionCount: app.githubStars
                };
            }
            script.textContent = JSON.stringify(ld);
            return;
        }

        script.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'WebSite',
                    name: '架集 ShelfHub',
                    url: origin + '/',
                    description: buildHomeMetaFromApps().description,
                    inLanguage: 'zh-CN',
                    potentialAction: {
                        '@type': 'SearchAction',
                        target: origin + '/?q={search_term_string}',
                        'query-input': 'required name=search_term_string'
                    }
                },
                {
                    '@type': 'ItemList',
                    name: '架集 ShelfHub 开源软件列表',
                    numberOfItems: appsData.length,
                    itemListElement: appsData.slice(0, 30).map((item, index) => ({
                        '@type': 'ListItem',
                        position: index + 1,
                        name: item.name,
                        url: getAppShareUrl(item.id)
                    }))
                }
            ]
        });
    }

    function parseUrlState() {
        const params = new URLSearchParams(location.search);
        const platform = params.get('p');
        const category = params.get('c');
        const query = params.get('q');
        const sort = params.get('sort');
        const page = parseInt(params.get('page'), 10);

        if (platform === 'windows' || platform === 'android') state.platform = platform;
        if (category && CHIP_LABELS[category]) state.category = category;
        if (query) state.search = query;
        if (sort === 'name' || sort === 'updated' || sort === 'popular') state.sort = sort;
        if (!isNaN(page) && page > 1) state.page = page;
    }

    function syncUrlState() {
        if (detailAppId) return;

        const params = new URLSearchParams();
        if (state.platform !== 'all') params.set('p', state.platform);
        if (state.category !== 'all') params.set('c', state.category);
        if (state.search) params.set('q', state.search);
        if (state.sort !== 'popular') params.set('sort', state.sort);
        if (state.page > 1) params.set('page', String(state.page));

        const qs = params.toString();
        const newUrl = location.pathname + (qs ? '?' + qs : '') + location.hash;
        const currentUrl = location.pathname + location.search + location.hash;
        if (newUrl !== currentUrl) {
            history.replaceState(null, '', newUrl);
        }
    }

    function applyStateToUI() {
        updateNavAria();
        updateSidebarActive();
        const sortSelect = $('#sortSelect');
        if (sortSelect) sortSelect.value = state.sort;

        const input = $('#searchInput');
        const clearBtn = $('#searchClear');
        const panel = $('#searchPanel');
        if (state.search && input) {
            input.value = state.search;
            if (clearBtn) clearBtn.style.display = 'flex';
            if (panel) panel.hidden = false;
            const toggle = $('#searchToggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
        }

        updateMobileNavActive();
    }

    function updateSidebarActive() {
        $$('.store-nav-item, .site-nav-item').forEach(item => {
            if (item.dataset.scrollTo === 'about') {
                item.classList.toggle('active', aboutViewActive);
                return;
            }

            const cat = item.dataset.category;
            const plat = item.dataset.platform;
            let active = false;
            if (!aboutViewActive) {
                if (plat) {
                    active = state.platform === plat && state.category === 'all';
                } else if (cat === 'all') {
                    active = state.category === 'all' && state.platform === 'all';
                } else if (cat) {
                    active = state.category === cat && state.platform === 'all';
                }
            }
            item.classList.toggle('active', active);
        });
    }

    function updateNavAria() {
        $$('.nav-link[data-platform]').forEach(l => {
            const selected = l.dataset.platform === state.platform;
            l.classList.toggle('active', selected);
            l.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        $$('.chip').forEach(c => {
            const selected = c.dataset.category === state.category;
            c.classList.toggle('active', selected);
            c.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
    }

    async function shareApp(id, app) {
        const url = getAppShareUrl(id);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: app.name + ' - 架集 ShelfHub',
                    text: app.description,
                    url: url
                });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        copyToClipboard(url);
        showToast('链接已复制，可分享给好友', 'success');
    }

    const API_BASE = (typeof window !== 'undefined' && window.SHELFHUB_API_BASE) || '';

    function localAppsFallback() {
        return (typeof APPS_DATA !== 'undefined' && Array.isArray(APPS_DATA) ? APPS_DATA : [])
            .map(normalizeApp);
    }

    async function loadAppsData() {
        try {
            const res = await fetch(API_BASE + '/api/apps', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error('API ' + res.status);
            const data = await res.json();
            const list = Array.isArray(data.apps) ? data.apps.map(normalizeApp) : [];
            console.info('[ShelfHub] Loaded ' + list.length + ' apps from /api/apps');
            return list;
        } catch (err) {
            const fallback = localAppsFallback();
            console.warn('[ShelfHub] /api/apps unavailable, fallback to apps-data.js', err);
            if (!fallback.length) {
                setTimeout(() => showToast('暂时无法加载应用数据', 'error'), 0);
            }
            return fallback;
        }
    }

    function trackEvent(type, appId, meta) {
        if (!type || !appId) return;
        const body = JSON.stringify({
            type: type,
            appId: String(appId),
            meta: meta || {}
        });
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon(API_BASE + '/api/events', blob);
                return;
            }
        } catch (_) { /* fall through */ }
        fetch(API_BASE + '/api/events', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
        }).catch(() => {});
    }

    function countDownloadSources() {
        const types = new Set();
        appsData.forEach(app => {
            (app.downloadSources || []).forEach(s => {
                if (s.type) types.add(s.type);
            });
        });
        return types.size || 2;
    }

    function updateDynamicStats() {
        const count = appsData.length;
        const sourceCount = countDownloadSources();
        const winCount = appsData.filter(a => a.platform === 'windows').length;
        const androidCount = appsData.filter(a => a.platform === 'android').length;

        const badgeCount = $('.hero-badge-count');
        if (badgeCount) badgeCount.textContent = count + '+';

        const subtitle = $('#heroSubtitle');
        if (subtitle && winCount && androidCount) {
            subtitle.textContent = `收录 ${count} 款 GitHub 开源软件 · ${winCount} 款 Windows · ${androidCount} 款 Android · 夸克 / 百度镜像`;
        }

        $$('[data-stat="apps"]').forEach(el => {
            el.dataset.counter = String(count);
            el.textContent = '0';
        });

        $$('[data-stat="sources"]').forEach(el => {
            if (el.dataset.counter != null) el.dataset.counter = String(sourceCount);
            else el.textContent = String(sourceCount);
        });

        const yearEl = $('#footerYear');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        updateCategoryFilters();
        renderHotList();
        renderFavoritesList();
        renderRecentList();
        renderCatalogBrowse();
        if (!detailAppId) {
            updatePageMeta(buildHomeMetaFromApps());
            updateJsonLd();
        }
    }

    function daysSince(dateStr) {
        if (!dateStr) return Infinity;
        const t = new Date(dateStr).getTime();
        if (isNaN(t)) return Infinity;
        return (Date.now() - t) / 864e5;
    }

    function sortByUpdated(apps) {
        return [...apps].sort((a, b) => {
            const ta = new Date(a.updatedDate || a.updatedAt || 0).getTime() || 0;
            const tb = new Date(b.updatedDate || b.updatedAt || 0).getTime() || 0;
            if (tb !== ta) return tb - ta;
            return getGithubStars(b) - getGithubStars(a);
        });
    }

    function setHomeBrowseVisible(on) {
        ['catalogStats', 'discoverSection', 'hotShowcase', 'recentShowcase'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = !on;
        });
    }

    function renderCatalogBrowse() {
        if (!appsData.length) {
            setHomeBrowseVisible(false);
            return;
        }
        const show = isHomeView() && !detailAppId && !aboutViewActive;
        setHomeBrowseVisible(show);
        if (!show) return;

        renderCatalogStats();
        renderDiscoverGrids();
        renderHotShowcase();
        renderRecentShowcase();
    }

    function renderCatalogStats() {
        const el = $('#catalogStats');
        if (!el) return;
        const mirrored = appsData.filter(a => (a.downloadSources || []).length > 0).length;
        const recent = appsData.filter(a => daysSince(a.updatedDate || a.createdAt) <= 30).length;
        const win = appsData.filter(a => a.platform === 'windows').length;
        const android = appsData.filter(a => a.platform === 'android').length;
        const items = [
            [appsData.length, '收录软件'],
            [win, 'Windows'],
            [android, 'Android'],
            [mirrored, '已配镜像'],
            [recent, '近 30 日更新']
        ];
        el.innerHTML = items.map(([n, label]) =>
            '<div class="catalog-stat"><strong>' + escapeHtml(n) + '</strong><span>' + escapeHtml(label) + '</span></div>'
        ).join('');
    }

    function renderDiscoverGrids() {
        const platEl = $('#platformDiscover');
        const catEl = $('#categoryDiscover');
        if (platEl) {
            const plats = [
                { key: 'all', label: '全部', count: appsData.length, platform: 'all' },
                { key: 'windows', label: 'Windows', count: appsData.filter(a => a.platform === 'windows').length, platform: 'windows' },
                { key: 'android', label: 'Android', count: appsData.filter(a => a.platform === 'android').length, platform: 'android' }
            ];
            platEl.innerHTML = plats.map(p => {
                const active = (p.platform === 'all' && state.platform === 'all') || state.platform === p.platform;
                return '<button type="button" class="discover-tile' + (active ? ' is-active' : '') +
                    '" data-discover-platform="' + escapeAttr(p.platform) + '">' +
                    '<span class="discover-tile-label">' + escapeHtml(p.label) + '</span>' +
                    '<span class="discover-tile-count">' + escapeHtml(p.count) + '</span></button>';
            }).join('');
            platEl.querySelectorAll('[data-discover-platform]').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectStoreNav({
                        platform: btn.dataset.discoverPlatform === 'all' ? 'all' : btn.dataset.discoverPlatform,
                        category: 'all'
                    });
                    scrollToFeed();
                });
            });
        }
        if (catEl) {
            const cats = Object.keys(CHIP_LABELS).filter(k => k !== 'all').map(slug => ({
                slug,
                label: CHIP_LABELS[slug],
                count: appsData.filter(a => a.category === slug).length
            })).filter(c => c.count > 0)
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'));

            catEl.innerHTML = cats.map(c =>
                '<button type="button" class="discover-tile' + (state.category === c.slug ? ' is-active' : '') +
                '" data-discover-category="' + escapeAttr(c.slug) + '">' +
                '<span class="discover-tile-label">' + escapeHtml(c.label) + '</span>' +
                '<span class="discover-tile-count">' + escapeHtml(c.count) + '</span></button>'
            ).join('');
            catEl.querySelectorAll('[data-discover-category]').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectStoreNav({ category: btn.dataset.discoverCategory, platform: 'all' });
                    scrollToFeed();
                });
            });
        }
    }

    function scrollToFeed() {
        const feed = document.querySelector('.content-layout') || $('#essentialList');
        if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderHotShowcase() {
        const grid = $('#hotShowcaseGrid');
        if (!grid) return;
        const hot = sortByGithubStars(appsData).filter(a => getGithubStars(a) > 0).slice(0, 9);
        if (!hot.length) {
            grid.innerHTML = '<p class="muted">暂无热门数据</p>';
            return;
        }
        grid.innerHTML = hot.map(app => {
            const stars = getGithubStars(app);
            const mirrors = (app.downloadSources || []).length;
            return '<button type="button" class="showcase-card" data-id="' + escapeAttr(app.id) + '">' +
                '<span class="showcase-card-icon">' + (iconHtml(app) || placeholderIconSvg()) + '</span>' +
                '<span>' +
                '<span class="showcase-card-name">' + escapeHtml(app.name) + '</span>' +
                '<span class="showcase-card-meta">' +
                (app.platform === 'windows' ? 'Windows' : 'Android') +
                (app.categoryName ? ' · ' + escapeHtml(app.categoryName) : '') +
                (stars ? ' · ★ ' + formatGithubStars(stars) : '') +
                (app.version ? ' · v' + escapeHtml(app.version) : '') +
                (mirrors ? ' · ' + mirrors + ' 镜像' : ' · 待补镜像') +
                '</span>' +
                '<span class="showcase-card-desc">' + escapeHtml(app.description || '') + '</span>' +
                '</span></button>';
        }).join('');
        grid.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', () => showAppDetail(btn.dataset.id));
        });
    }

    function renderRecentShowcase() {
        const list = $('#recentShowcaseList');
        if (!list) return;
        const recent = sortByUpdated(appsData).filter(a => a.updatedDate || a.updatedAt).slice(0, 8);
        if (!recent.length) {
            list.innerHTML = '<p class="muted">暂无更新日期</p>';
            return;
        }
        list.innerHTML = recent.map(app =>
            '<button type="button" class="showcase-row" data-id="' + escapeAttr(app.id) + '">' +
            '<span><span class="showcase-row-name">' + escapeHtml(app.name) + '</span>' +
            '<span class="showcase-row-desc">' + escapeHtml(app.description || '') + '</span></span>' +
            '<span class="showcase-row-meta">' +
            (app.version ? 'v' + escapeHtml(app.version) + ' · ' : '') +
            formatAppDate(app.updatedDate || app.updatedAt) +
            '</span></button>'
        ).join('');
        list.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', () => showAppDetail(btn.dataset.id));
        });
    }

    function updateCategoryFilters() {
        const platformApps = state.platform === 'all'
            ? appsData
            : appsData.filter(a => a.platform === state.platform);

        const counts = {};
        platformApps.forEach(app => {
            counts[app.category] = (counts[app.category] || 0) + 1;
        });

        $$('.chip').forEach(chip => {
            const cat = chip.dataset.category;
            if (!cat) return;

            const label = chip.querySelector('.tag-chip-label');
            const setLabel = (text) => {
                if (label) label.textContent = text;
                else chip.textContent = text;
            };

            if (cat === 'all') {
                setLabel(CHIP_LABELS.all);
                let countEl = chip.querySelector('.tag-chip-count');
                if (!countEl) {
                    countEl = document.createElement('span');
                    countEl.className = 'tag-chip-count';
                    chip.appendChild(countEl);
                }
                countEl.textContent = String(platformApps.length);
                chip.hidden = false;
                return;
            }

            const count = counts[cat] || 0;
            setLabel(CHIP_LABELS[cat] || cat);
            let countEl = chip.querySelector('.tag-chip-count');
            if (count > 0) {
                if (!countEl) {
                    countEl = document.createElement('span');
                    countEl.className = 'tag-chip-count';
                    chip.appendChild(countEl);
                }
                countEl.textContent = String(count);
            } else if (countEl) {
                countEl.remove();
            }
            chip.hidden = count === 0;

            if (count === 0 && state.category === cat) {
                state.category = 'all';
                chip.classList.remove('active');
                const allChip = $('.chip[data-category="all"]');
                if (allChip) allChip.classList.add('active');
            }
        });

        updatePlatformCounts();
    }

    function setChipCount(chip, count) {
        if (!chip) return;
        let countEl = chip.querySelector('.tag-chip-count');
        if (count == null) {
            if (countEl) countEl.remove();
            return;
        }
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.className = 'tag-chip-count';
            chip.appendChild(countEl);
        }
        countEl.textContent = String(count);
    }

    function updatePlatformCounts() {
        const win = appsData.filter(a => a.platform === 'windows').length;
        const android = appsData.filter(a => a.platform === 'android').length;
        const allChip = $('#platformTags .store-nav-item[data-category="all"]');
        const winChip = $('#platformTags .store-nav-item[data-platform="windows"]');
        const androidChip = $('#platformTags .store-nav-item[data-platform="android"]');
        setChipCount(allChip, appsData.length);
        setChipCount(winChip, win);
        setChipCount(androidChip, android);
    }

    function renderHotList() {
        const list = $('#hotList');
        if (!list) return;

        const hot = sortByGithubStars(appsData).filter(a => getGithubStars(a) > 0).slice(0, 6);
        if (!hot.length) {
            list.innerHTML = '<p class="hot-empty">暂无 Star 数据</p>';
            return;
        }

        list.innerHTML = hot.map(app => `
            <button class="hot-item" type="button" data-id="${escapeAttr(app.id)}">
                <span class="hot-item-icon">${iconHtml(app) || placeholderIconSvg()}</span>
                <span class="hot-item-body">
                    <span class="hot-item-name">${escapeHtml(app.name)}</span>
                    <span class="hot-item-meta">★ ${formatGithubStars(getGithubStars(app))}</span>
                </span>
            </button>
        `).join('');

        list.querySelectorAll('.hot-item').forEach(btn => {
            btn.addEventListener('click', () => showAppDetail(btn.dataset.id));
        });
    }

    function getGithubStars(app) {
        const stars = Number(app.githubStars);
        return !isNaN(stars) && stars >= 0 ? stars : 0;
    }

    function sortByGithubStars(apps) {
        return [...apps].sort((a, b) => {
            const diff = getGithubStars(b) - getGithubStars(a);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name, 'zh');
        });
    }

    function isHotApp(app) {
        return getGithubStars(app) >= 5000;
    }

    function formatGithubStars(stars) {
        if (stars >= 10000) return (stars / 1000).toFixed(stars >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
        if (stars >= 1000) return (stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return String(stars);
    }

    function bindStoreCardEvents(container) {
        if (!container) return;

        container.querySelectorAll('[data-id]').forEach(card => {
            if (card.classList.contains('store-app-row') ||
                card.classList.contains('store-featured-card') ||
                card.classList.contains('store-promo-card') ||
                card.classList.contains('post-card')) {
                const open = (e) => {
                    if (e.target.closest('.store-install-btn, .btn-download, .btn-ghost, .tag-chip-action, .btn-icon-fav, [data-fav-id]')) return;
                    showAppDetail(card.dataset.id);
                };
                card.addEventListener('click', open);
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        if (e.target.closest('.store-install-btn, .btn-download, .btn-ghost, .tag-chip-action, .btn-icon-fav, [data-fav-id]')) return;
                        e.preventDefault();
                        showAppDetail(card.dataset.id);
                    }
                });
            }
        });

        container.querySelectorAll('.store-install-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showDownloadModal(btn.dataset.id);
            });
        });
    }

    let featuredAutoplayTimer = null;

    function getFeaturedScrollStep(track) {
        return Math.min(track.clientWidth * 0.85, 420);
    }

    function advanceFeaturedCarousel(options) {
        options = options || {};
        const track = $('#featuredTrack');
        if (!track || track.children.length <= 1) return;

        const maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll <= 4) return;

        const step = getFeaturedScrollStep(track);
        const behavior = options.instant ? 'auto' : 'smooth';

        if (track.scrollLeft >= maxScroll - 4) {
            track.scrollTo({ left: 0, behavior });
        } else {
            track.scrollBy({ left: step, behavior });
        }

        refreshFeaturedNav();
    }

    function stopFeaturedAutoplay() {
        if (featuredAutoplayTimer) {
            clearInterval(featuredAutoplayTimer);
            featuredAutoplayTimer = null;
        }
    }

    function startFeaturedAutoplay() {
        stopFeaturedAutoplay();
        const track = $('#featuredTrack');
        if (!track || !isHomeView() || track.children.length <= 1) return;

        featuredAutoplayTimer = setInterval(() => {
            if (!isHomeView() || detailAppId || aboutViewActive) {
                stopFeaturedAutoplay();
                return;
            }
            advanceFeaturedCarousel();
        }, 5000);
    }

    function setupFeaturedAutoplay() {
        const track = $('#featuredTrack');
        const wrap = $('#featuredWrap');
        if (!track || track.dataset.autoplayBound) return;

        track.dataset.autoplayBound = '1';

        if (wrap) {
            wrap.addEventListener('mouseenter', stopFeaturedAutoplay);
            wrap.addEventListener('mouseleave', startFeaturedAutoplay);
            wrap.addEventListener('focusin', stopFeaturedAutoplay);
            wrap.addEventListener('focusout', (e) => {
                if (!wrap.contains(e.relatedTarget)) startFeaturedAutoplay();
            });
        }

        let touchTimer;
        track.addEventListener('touchstart', () => {
            stopFeaturedAutoplay();
            clearTimeout(touchTimer);
        }, { passive: true });
        track.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
            touchTimer = setTimeout(startFeaturedAutoplay, 3000);
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopFeaturedAutoplay();
            else if (isHomeView()) startFeaturedAutoplay();
        });
    }

    function formatAppDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return escapeHtml(dateStr);
        return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    }

    function renderFeaturedHero(apps) {
        const card = $('#featuredCard');
        const title = $('#featuredTitle');
        const desc = $('#featuredDesc');
        const meta = $('#featuredMeta');
        if (!card || !title || !desc) return;

        const featured = sortByGithubStars(apps)[0];
        if (!featured) {
            card.hidden = true;
            card.removeAttribute('data-id');
            return;
        }

        const stars = getGithubStars(featured);
        card.hidden = false;
        card.dataset.id = featured.id;
        title.textContent = featured.name;
        desc.textContent = featured.description || '';
        if (meta) {
            meta.innerHTML = [
                '<span>' + (featured.platform === 'windows' ? 'Windows' : 'Android') + '</span>',
                featured.categoryName ? '<span>' + escapeHtml(featured.categoryName) + '</span>' : '',
                stars ? '<span>★ ' + formatGithubStars(stars) + '</span>' : ''
            ].filter(Boolean).join('<span class="featured-meta-sep" aria-hidden="true">·</span>');
        }
        card.setAttribute('aria-label', '查看 ' + featured.name);
        card.onclick = (e) => {
            e.preventDefault();
            showAppDetail(featured.id);
        };
    }

    function renderPromoRow() { /* editorial layout: promo row removed */ }

    function renderFeaturedTrack(apps) {
        renderFeaturedHero(apps);
        stopFeaturedAutoplay();
    }

    function appTagsHtml(app) {
        const parts = [];
        parts.push(
            '<button class="tag-chip tag-chip-sm tag-chip-action" type="button" data-filter-platform="' +
            escapeAttr(app.platform) + '"><span class="tag-chip-label">' +
            (app.platform === 'windows' ? 'Windows' : 'Android') + '</span></button>'
        );
        if (app.category && app.categoryName) {
            parts.push(
                '<button class="tag-chip tag-chip-sm tag-chip-action" type="button" data-filter-category="' +
                escapeAttr(app.category) + '"><span class="tag-chip-label">' +
                escapeHtml(app.categoryName) + '</span></button>'
            );
        }
        parts.push('<span class="tag-chip tag-chip-sm"><span class="tag-chip-label">开源</span></span>');
        const mirrors = (app.downloadSources || []).length;
        if (mirrors) {
            parts.push(
                '<span class="tag-chip tag-chip-sm"><span class="tag-chip-label">' +
                mirrors + ' 个镜像</span></span>'
            );
        }
        return parts.join('');
    }

    function renderStoreList(apps, container) {
        if (!container) return;

        const query = state.search;
        container.innerHTML = apps.map((app, index) => {
            const stars = getGithubStars(app);
            const icon = iconHtml(app) || placeholderIconSvg();
            const mirrors = (app.downloadSources || []).length;
            return `
            <article class="post-card" data-id="${escapeAttr(app.id)}" tabindex="0" role="button" aria-label="查看 ${escapeAttr(app.name)}" style="--reveal-delay:${Math.min(index, 7) * 55}ms">
                <div class="post-card-grid">
                    <div class="post-cover" aria-hidden="true">${icon}</div>
                    <div>
                        <div class="post-meta">
                            <time datetime="${escapeAttr(app.updatedDate || '')}">${formatAppDate(app.updatedDate)}</time>
                            ${stars ? '<span>★ ' + formatGithubStars(stars) + '</span>' : ''}
                            ${app.version ? '<span>v' + escapeHtml(app.version) + '</span>' : ''}
                        </div>
                        <h3 class="post-title">${highlightSearch(app.name, query)}</h3>
                        <p class="post-desc">${highlightSearch(app.description, query)}</p>
                        <div class="post-tags">${appTagsHtml(app)}</div>
                        <div class="post-actions">
                            <button class="btn-download store-install-btn" data-id="${escapeAttr(app.id)}" type="button">镜像下载${mirrors ? ' · ' + mirrors : ''}</button>
                            <button class="btn-ghost" data-id="${escapeAttr(app.id)}" type="button">查看详情</button>
                            <button class="btn-icon-fav${isFavorite(app.id) ? ' is-active' : ''}" data-fav-id="${escapeAttr(app.id)}" type="button" aria-label="${isFavorite(app.id) ? '取消收藏' : '收藏'}" aria-pressed="${isFavorite(app.id) ? 'true' : 'false'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFavorite(app.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </article>`;
        }).join('');

        bindStoreCardEvents(container);
        container.querySelectorAll('.btn-ghost').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAppDetail(btn.dataset.id);
            });
        });
        container.querySelectorAll('[data-fav-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.favId;
                const added = toggleFavorite(id);
                btn.classList.toggle('is-active', added);
                btn.setAttribute('aria-pressed', added ? 'true' : 'false');
                btn.setAttribute('aria-label', added ? '取消收藏' : '收藏');
                const svg = btn.querySelector('svg');
                if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
                showToast(added ? '已加入收藏' : '已取消收藏', 'success');
            });
        });
        container.querySelectorAll('[data-filter-platform]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (detailAppId) hideAppDetail({ skipScroll: true });
                selectStoreNav({ platform: btn.dataset.filterPlatform });
                scrollMainToTop({ behavior: 'smooth' });
            });
        });
        container.querySelectorAll('[data-filter-category]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (detailAppId) hideAppDetail({ skipScroll: true });
                selectStoreNav({ category: btn.dataset.filterCategory });
                scrollMainToTop({ behavior: 'smooth' });
            });
        });

        requestAnimationFrame(() => {
            container.querySelectorAll('.post-card').forEach(card => card.classList.add('is-revealed'));
        });
    }

    function updateStoreWidgets(apps) {
        const widgets = $('#storeWidgets');
        if (widgets) widgets.hidden = false;

        const tagline = $('#storeTagline');
        if (tagline) tagline.hidden = true;

        const home = isHomeView();
        const faq = document.querySelector('.faq-strip');
        if (faq) faq.hidden = !home;

        renderCatalogBrowse();

        if (home && apps.length) {
            renderFeaturedHero(apps);
        } else {
            const card = $('#featuredCard');
            if (card) card.hidden = true;
            stopFeaturedAutoplay();
        }
    }

    function setupFeaturedNav() {
        const track = $('#featuredTrack');
        const next = $('#featuredNext');
        if (!track || !next || next.dataset.bound) return;

        next.dataset.bound = '1';
        next.addEventListener('click', () => {
            stopFeaturedAutoplay();
            advanceFeaturedCarousel();
            startFeaturedAutoplay();
        });

        const updateNext = () => {
            const maxScroll = track.scrollWidth - track.clientWidth;
            next.disabled = track.scrollLeft >= maxScroll - 4;
        };

        track.addEventListener('scroll', updateNext, { passive: true });
        updateNext();

        track._refreshFeaturedNav = updateNext;
    }

    function refreshFeaturedNav() {
        const track = $('#featuredTrack');
        if (track && track._refreshFeaturedNav) track._refreshFeaturedNav();
    }

    function getEssentialApps(apps) {
        const total = apps.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (state.page > pages) state.page = pages;
        if (state.page < 1) state.page = 1;
        const start = (state.page - 1) * PAGE_SIZE;
        return apps.slice(start, start + PAGE_SIZE);
    }

    function renderActiveFilters() {
        const bar = $('#activeFilters');
        if (!bar) return;

        const chips = [];
        if (state.platform !== 'all') {
            chips.push({
                label: PLATFORMS[state.platform] || state.platform,
                clear: () => { state.platform = 'all'; }
            });
        }
        if (state.category !== 'all') {
            chips.push({
                label: CHIP_LABELS[state.category] || state.category,
                clear: () => { state.category = 'all'; }
            });
        }
        if (state.search) {
            chips.push({
                label: '搜索：' + state.search,
                clear: () => {
                    state.search = '';
                    const input = $('#searchInput');
                    const clearBtn = $('#searchClear');
                    if (input) input.value = '';
                    if (clearBtn) clearBtn.style.display = 'none';
                }
            });
        }

        if (!chips.length) {
            bar.hidden = true;
            bar.innerHTML = '';
            return;
        }

        bar.hidden = false;
        bar.innerHTML = chips.map((c, i) => `
            <button class="filter-pill" type="button" data-filter-index="${i}">
                <span>${escapeHtml(c.label)}</span>
                <span aria-hidden="true">×</span>
            </button>
        `).join('') + '<button class="filter-pill filter-pill-clear" type="button" data-clear-all>清除全部</button>';

        bar.querySelectorAll('[data-filter-index]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.filterIndex);
                if (chips[idx]) chips[idx].clear();
                state.page = 1;
                updateNavAria();
                updateSidebarActive();
                updateMobileNavActive();
                applyFilters();
            });
        });

        const clearAll = bar.querySelector('[data-clear-all]');
        if (clearAll) {
            clearAll.addEventListener('click', () => resetFilters());
        }
    }

    function renderPagination(total) {
        const nav = $('#pagination');
        if (!nav) return;

        const pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) {
            nav.hidden = true;
            nav.innerHTML = '';
            return;
        }

        nav.hidden = false;
        let nums = '';
        for (let i = 1; i <= pages; i++) {
            if (pages > 7 && Math.abs(i - state.page) > 2 && i !== 1 && i !== pages) {
                if (i === 2 || i === pages - 1) nums += '<span class="page-ellipsis">…</span>';
                continue;
            }
            nums += `<button type="button" class="page-num${i === state.page ? ' is-active' : ''}" data-goto="${i}">${i}</button>`;
        }

        nav.innerHTML = `
            <button type="button" class="page-btn" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
            <div class="page-nums">${nums}</div>
            <button type="button" class="page-btn" data-page="next" ${state.page >= pages ? 'disabled' : ''}>下一页</button>
        `;

        const go = (page) => {
            state.page = page;
            applyFilters();
            const feed = $('.feed');
            if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        nav.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                if (btn.dataset.page === 'prev') go(state.page - 1);
                if (btn.dataset.page === 'next') go(state.page + 1);
            });
        });
        nav.querySelectorAll('.page-num').forEach(btn => {
            btn.addEventListener('click', () => go(Number(btn.dataset.goto)));
        });
    }

    function getRelatedApps(app, limit) {
        limit = limit || 3;
        return sortByGithubStars(
            appsData.filter(a => a.id !== app.id && (
                a.category === app.category || a.platform === app.platform
            ))
        ).slice(0, limit);
    }

    function renderRelatedApps(app) {
        const related = getRelatedApps(app);
        if (!related.length) return '';

        return `
            <section class="store-section related-section">
                <h2 class="store-section-title">相关推荐</h2>
                <div class="related-grid">
                    ${related.map(item => `
                        <button class="related-card" type="button" data-id="${escapeAttr(item.id)}">
                            <span class="related-icon">${iconHtml(item) || placeholderIconSvg()}</span>
                            <span class="related-body">
                                <span class="related-name">${escapeHtml(item.name)}</span>
                                <span class="related-desc">${escapeHtml(item.categoryName || '')}${getGithubStars(item) ? ' · ★ ' + formatGithubStars(getGithubStars(item)) : ''}</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
            </section>`;
    }

    function renderDownloadSources(sources) {
        return (sources || []).map(s => `
            <div class="download-source-item">
                <div class="source-icon tag-${escapeAttr(s.type)}">${escapeHtml(s.name.charAt(0))}</div>
                <div class="download-source-info">
                    <span class="source-name">${escapeHtml(s.name)}</span>
                    <span class="source-hint">点击直接打开网盘链接</span>
                </div>
                <div class="source-actions">
                    <button class="download-source-go" data-url="${escapeAttr(s.url)}" data-name="${escapeAttr(s.name)}" data-type="${escapeAttr(s.type || '')}" type="button">
                        前往下载
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </button>
                </div>
            </div>`).join('');
    }

    function bindDownloadSourceEvents(container, options) {
        if (!container) return;
        options = options || {};

        container.querySelectorAll('.download-source-go').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.url;
                const name = btn.dataset.name;
                if (options.appId) {
                    trackEvent('download_click', options.appId, {
                        source: name || '',
                        type: btn.dataset.type || ''
                    });
                }
                showToast(`即将跳转${name}...`, 'info');
                if (options.closeModal) hideModal();
                const delay = options.closeModal ? 250 : 150;
                setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), delay);
            });
        });
    }

    function parseAppHash() {
        const match = location.hash.match(/^#app\/([^/?#]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function setAppHash(id) {
        const hash = id ? '#app/' + encodeURIComponent(id) : '';
        if (location.hash !== hash) {
            if (id) location.hash = hash;
            else history.replaceState(null, '', location.pathname + location.search);
        }
    }

    function getAppShareUrl(id) {
        return siteOrigin() + '/a/' + encodeURIComponent(id);
    }

    function setupHashRouting() {
        window.addEventListener('hashchange', () => {
            const appId = parseAppHash();
            if (appId) {
                if (appsData.some(a => a.id === appId)) showAppDetail(appId, { skipHash: true });
                else showToast('未找到该应用', 'error');
            } else if (detailAppId) {
                hideAppDetail({ skipHash: true });
            }
        });
    }

    function syncThemeColorMeta() {
        const meta = $('#themeColorMeta');
        if (!meta) return;
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        meta.setAttribute('content', dark ? '#18202a' : '#0f6e64');
    }

    function initTheme() {
        const saved = localStorage.getItem('shelfhub-theme') || localStorage.getItem('echohub-theme') || localStorage.getItem('softhub-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        syncThemeColorMeta();

        $('#themeToggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('shelfhub-theme', next);
            syncThemeColorMeta();
        });
    }

    function initViewPreference() {
        const gridBtn = $('#gridViewBtn');
        const listBtn = $('#listViewBtn');
        if (!gridBtn || !listBtn) return;

        const saved = localStorage.getItem('shelfhub-view') || localStorage.getItem('echohub-view') || localStorage.getItem('softhub-view');
        if (saved === 'grid' || saved === 'list') {
            state.view = saved;
            gridBtn.classList.toggle('active', saved === 'grid');
            listBtn.classList.toggle('active', saved === 'list');
            gridBtn.setAttribute('aria-pressed', saved === 'grid');
            listBtn.setAttribute('aria-pressed', saved === 'list');
        }
    }

    function animateCounters() {
        const counters = $$('[data-counter]');
        if (!counters.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const target = parseInt(el.dataset.counter, 10);
                    const duration = 1200;
                    const start = performance.now();

                    function update(now) {
                        const elapsed = now - start;
                        const progress = Math.min(elapsed / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        el.textContent = Math.round(eased * target);
                        if (progress < 1) requestAnimationFrame(update);
                    }

                    requestAnimationFrame(update);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(c => observer.observe(c));
    }

    function initScrollReveal() {
        const elements = $$('.reveal-on-scroll, .app-card, .detail-content');
        if (!elements.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        elements.forEach(el => {
            if (el.classList.contains('app-card')) return;
            observer.observe(el);
        });
    }

    function initScrollEffects() {
        const header = $('#header');
        const backToTop = $('#backToTop');

        let ticking = false;
        let lastY = window.scrollY;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    if (header) {
                        header.classList.toggle('is-scrolled', scrollY > 10);
                        // Hide header when scrolling down, reveal when scrolling up.
                        if (scrollY > 120 && scrollY > lastY + 4 && !detailAppId) {
                            header.classList.add('is-hidden');
                        } else if (scrollY < lastY - 4 || scrollY < 80) {
                            header.classList.remove('is-hidden');
                        }
                    }
                    if (backToTop) backToTop.classList.toggle('is-visible', scrollY > 400);
                    lastY = scrollY;
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        if (backToTop) {
            backToTop.addEventListener('click', () => {
                scrollMainToTop({ behavior: 'smooth' });
            });
        }

        document.querySelectorAll('[data-scroll-to]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const target = el.getAttribute('data-scroll-to');
                if (target === 'top') {
                    if (detailAppId) hideAppDetail({ skipScroll: true });
                    hideAboutPage();
                    showStoreHome();
                    scrollMainToTop({ behavior: 'smooth' });
                } else if (target === 'about') {
                    showAboutPage();
                } else {
                    if (detailAppId) hideAppDetail();
                    const targetEl = document.querySelector('#' + target) || document.querySelector(target);
                    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                closeMobileDrawer();
            });
        });
    }

    function showStoreHome() {
        const storeHome = $('#storeHome');
        if (storeHome) storeHome.style.display = 'block';
    }

    function hideAboutPage() {
        aboutViewActive = false;
        const about = $('#about');
        if (about) {
            about.style.display = 'none';
            about.classList.remove('is-visible');
        }
        updateSidebarActive();
        updateMobileNavActive();
    }

    function showAboutPage() {
        if (detailAppId) hideAppDetail({ skipScroll: true });
        aboutViewActive = true;
        hideDetailStickyBar();

        const storeHome = $('#storeHome');
        const about = $('#about');
        const appDetail = $('#appDetail');
        if (storeHome) storeHome.style.display = 'none';
        if (appDetail) {
            appDetail.style.display = 'none';
            appDetail.classList.remove('is-visible');
        }
        if (about) {
            about.style.display = 'block';
            requestAnimationFrame(() => about.classList.add('is-visible'));
        }

        updateSidebarActive();
        updateMobileNavActive();
        scrollMainToTop();
    }

    function renderGrid(apps) {
        const grid = $('#appsGrid');
        grid.classList.remove('is-animating');
        const query = state.search;

        const html = apps.map((app, i) => `
            <article class="app-card" data-id="${escapeAttr(app.id)}" tabindex="0" style="animation-delay:${Math.min(i, 8) * 40}ms">
                ${isHotApp(app) ? '<span class="app-hot-badge">热门</span>' : ''}
                <div class="app-icon-wrapper">
                    <span class="platform-badge ${escapeAttr(app.platform)}">${app.platform === 'windows' ? 'Win' : '安卓'}</span>
                    ${iconHtml(app)}
                </div>
                <div class="app-body">
                    <h3 class="app-name">${highlightSearch(app.name, query)}</h3>
                    <p class="app-desc">${highlightSearch(app.description, query)}</p>
                    <div class="app-meta">
                        <span class="app-category">${highlightSearch(app.categoryName, query)}</span>
                        <span class="app-version">v${escapeHtml(app.version)}</span>
                        <span class="app-size">${escapeHtml(app.size)}</span>
                    </div>
                    <button class="app-download-btn" data-id="${escapeAttr(app.id)}" aria-label="下载 ${escapeAttr(app.name)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        下载
                    </button>
                </div>
            </article>
        `).join('');

        grid.innerHTML = html;
        requestAnimationFrame(() => grid.classList.add('is-animating'));

        grid.querySelectorAll('.app-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.app-download-btn')) return;
                showAppDetail(card.dataset.id);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.closest('.app-download-btn')) return;
                    e.preventDefault();
                    showAppDetail(card.dataset.id);
                }
            });

            const downloadBtn = card.querySelector('.app-download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDownloadModal(downloadBtn.dataset.id);
                });
            }
        });
    }

    function renderList(apps) {
        const list = $('#appsList');
        const query = state.search;
        list.innerHTML = apps.map(app => `
            <div class="app-list-item" data-id="${escapeAttr(app.id)}" tabindex="0">
                <div class="app-list-icon">${iconHtml(app)}</div>
                <div class="app-list-info">
                    <div class="app-list-name">${highlightSearch(app.name, query)}</div>
                    <div class="app-list-desc">${highlightSearch(app.description, query)}</div>
                </div>
                <div class="app-list-meta">
                    <span>${escapeHtml(app.categoryName)}</span>
                    <span>v${escapeHtml(app.version)}</span>
                    <span>${escapeHtml(app.size)}</span>
                </div>
                <button class="app-list-download" data-id="${escapeAttr(app.id)}">下载</button>
            </div>
        `).join('');

        list.querySelectorAll('.app-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.app-list-download')) return;
                showAppDetail(item.dataset.id);
            });

            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.closest('.app-list-download')) return;
                    e.preventDefault();
                    showAppDetail(item.dataset.id);
                }
            });
        });

        list.querySelectorAll('.app-list-download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showDownloadModal(btn.dataset.id);
            });
        });
    }

    function filterApps() {
        let apps = [...appsData];

        if (state.platform !== 'all') {
            apps = apps.filter(a => a.platform === state.platform);
        }
        if (state.category !== 'all') {
            apps = apps.filter(a => a.category === state.category);
        }
        if (state.search) {
            const q = state.search.toLowerCase();
            apps = apps.filter(a =>
                a.name.toLowerCase().includes(q) ||
                a.description.toLowerCase().includes(q) ||
                a.categoryName.toLowerCase().includes(q)
            );
        }

        switch (state.sort) {
            case 'name': apps.sort((a, b) => a.name.localeCompare(b.name, 'zh')); break;
            case 'updated': apps.sort((a, b) => new Date(b.updatedDate) - new Date(a.updatedDate)); break;
            default: apps = sortByGithubStars(apps);
        }

        return apps;
    }

    function updateSectionTitle() {
        if (state.search) {
            $('#sectionTitle').textContent = '搜索结果';
            return;
        }
        if (state.platform !== 'all' && state.category === 'all') {
            $('#sectionTitle').textContent = PLATFORMS[state.platform];
            return;
        }
        if (state.category !== 'all') {
            $('#sectionTitle').textContent = SIDEBAR_LABELS[state.category] || CHIP_LABELS[state.category];
            return;
        }
        $('#sectionTitle').textContent = '推荐';
    }

    function updateEssentialTitle() {
        const el = $('#essentialTitle');
        if (!el) return;
        if (isHomeView()) {
            el.textContent = '精选开源';
        } else if (state.search) {
            el.textContent = '搜索结果';
        } else {
            el.textContent = '软件列表';
        }
    }

    function showSkeleton() {
        const skeleton = $('#skeletonGrid');
        const essentialList = $('#essentialList');
        const widgets = $('#storeWidgets');

        if (essentialList) essentialList.innerHTML = '';
        if (!skeleton) return;

        skeleton.style.display = 'flex';
        skeleton.innerHTML = '';

        for (let i = 0; i < 4; i++) {
            const card = document.createElement('div');
            card.className = 'skeleton-card';
            card.innerHTML = `
                <div class="skeleton-banner"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-btn"></div>
                </div>
            `;
            skeleton.appendChild(card);
        }
    }

    function setupSearchPanel() {
        const toggle = $('#searchToggle');
        const panel = $('#searchPanel');
        const input = $('#searchInput');
        if (!toggle || !panel) return;

        const open = () => {
            panel.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            requestAnimationFrame(() => input && input.focus());
        };

        const close = () => {
            if (state.search) return;
            panel.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            hideSearchSuggestions();
        };

        toggle.addEventListener('click', () => {
            if (panel.hidden) open();
            else close();
        });

        document.addEventListener('click', (e) => {
            if (panel.hidden) return;
            if (panel.contains(e.target) || toggle.contains(e.target)) return;
            if (!state.search && !(input && input.value.trim())) close();
            else hideSearchSuggestions();
        });

        // Keep panel open when there is an active query
        if (state.search) open();
    }

    function hideSkeleton() {
        const skeleton = $('#skeletonGrid');
        skeleton.style.display = 'none';
        skeleton.innerHTML = '';
    }

    function renderFiltersResult() {
        const apps = filterApps();
        const empty = $('#emptyState');
        const count = $('#appCount');
        const essentialList = $('#essentialList');
        const essentialSection = $('.store-essential-section') || $('.feed');
        const pagination = $('#pagination');

        hideSkeleton();

        if (!apps.length) {
            if (essentialList) essentialList.innerHTML = '';
            if (essentialSection && essentialSection.classList.contains('store-essential-section')) {
                essentialSection.style.display = 'none';
            }
            if (pagination) {
                pagination.hidden = true;
                pagination.innerHTML = '';
            }
            empty.style.display = 'block';
            count.textContent = '';
            updateStoreWidgets([]);
            renderActiveFilters();
            updateSectionTitle();
            updateEssentialTitle();
            updateSidebarActive();
            updateCategoryFilters();
            syncUrlState();
            return;
        }

        empty.style.display = 'none';
        if (essentialSection && essentialSection.classList.contains('store-essential-section')) {
            essentialSection.style.display = 'block';
        }
        count.textContent = `共 ${apps.length} 个应用`;

        updateStoreWidgets(apps);
        renderStoreList(getEssentialApps(apps), essentialList);
        renderPagination(apps.length);
        renderActiveFilters();
        updateSectionTitle();
        updateEssentialTitle();
        updateSidebarActive();
        updateCategoryFilters();
        syncUrlState();
    }

    function applyFilters() {
        const viewEl = $('#essentialList');

        if (!hasInitialRender) {
            showSkeleton();
            requestAnimationFrame(() => {
                renderFiltersResult();
                hasInitialRender = true;
            });
            return;
        }

        if (viewEl) viewEl.classList.add('is-updating');
        requestAnimationFrame(() => {
            renderFiltersResult();
            if (viewEl) {
                requestAnimationFrame(() => viewEl.classList.remove('is-updating'));
            }
        });
    }

    function hideAppDetail(options) {
        options = options || {};
        detailAppId = null;
        updatePageMeta(buildHomeMetaFromApps());
        updateJsonLd();

        $('#appDetail').style.display = 'none';
        $('#appDetail').classList.remove('is-visible');
        const storeMain = $('#storeMain');
        if (storeMain) storeMain.classList.remove('is-detail-view');
        document.body.classList.remove('is-detail-open');
        hideAboutPage();
        showStoreHome();
        hideDetailStickyBar();

        if (!options.skipHash && parseAppHash()) {
            setAppHash(null);
        }

        if (!options.skipScroll) {
            // Restore previous list scroll position when leaving detail.
            const y = savedListScrollY || 0;
            requestAnimationFrame(() => {
                window.scrollTo({ top: y, behavior: options.instant ? 'auto' : 'smooth' });
            });
        }

        const header = $('#header');
        if (header) header.classList.remove('is-hidden');

        if (isHomeView()) startFeaturedAutoplay();
    }

    function normalizeFeatureTitles(app) {
        if (!app || !Array.isArray(app.features) || !app.features.length) return [];
        if (typeof app.features[0] === 'string') {
            return app.features.map(f => String(f).trim()).filter(Boolean);
        }
        return app.features
            .map(f => (f && f.title ? String(f.title).trim() : ''))
            .filter(Boolean);
    }

    function renderDetailIntro(app) {
        const desc = app.description || '';
        const features = normalizeFeatureTitles(app);
        if (!desc && !features.length) return '';

        return `
            <section class="store-section detail-intro-block">
                <h2 class="store-section-title">应用介绍</h2>
                <div class="store-intro" id="detailIntro">
                    ${desc ? `<p class="store-intro-text">${escapeHtml(desc)}</p>` : ''}
                    ${features.length ? `
                    <ul class="feature-list">
                        ${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>` : ''}
                </div>
            </section>`;
    }

    function renderDetailPage(app) {
        const desc = app.description || '';
        const githubUrl = normalizeGithubUrl(app.githubUrl);
        const stars = getGithubStars(app);
        const mirrors = app.downloadSources || [];
        const icon = iconHtml(app) || placeholderIconSvg();

        return `
            <div class="store-detail">
                <nav class="detail-breadcrumb" aria-label="面包屑">
                    <button type="button" class="crumb-link" id="crumbHome">首页</button>
                    <span aria-hidden="true">/</span>
                    <button type="button" class="crumb-link" data-filter-category="${escapeAttr(app.category || 'all')}">${escapeHtml(app.categoryName || '分类')}</button>
                    <span aria-hidden="true">/</span>
                    <span class="crumb-current">${escapeHtml(app.name)}</span>
                </nav>

                <header class="store-hero">
                    <div class="store-hero-icon">${icon}</div>
                    <div class="store-hero-info">
                        <div class="store-hero-title-row">
                            <h1 class="store-hero-name">${escapeHtml(app.name)}</h1>
                            <span class="store-hero-version">${escapeHtml(app.version)}</span>
                        </div>
                        <p class="store-hero-tagline">${escapeHtml(desc)}</p>
                        <div class="store-hero-badges">
                            <span class="store-badge">${app.platform === 'windows' ? 'Windows' : 'Android'}</span>
                            <span class="store-badge">${escapeHtml(app.categoryName)}</span>
                            <span class="store-badge store-badge-github">GitHub 开源</span>
                            ${stars ? '<span class="store-badge">★ ' + formatGithubStars(stars) + '</span>' : ''}
                            ${isHotApp(app) ? '<span class="store-badge store-badge-hot">热门</span>' : ''}
                            ${mirrors.length ? '<span class="store-badge">' + mirrors.length + ' 个镜像</span>' : ''}
                        </div>
                        ${githubUrl ? `
                        <a class="store-github-link" href="${escapeAttr(githubUrl)}" target="_blank" rel="noopener noreferrer">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                            查看 GitHub 仓库
                        </a>` : ''}
                    </div>
                    <div class="store-hero-action">
                        <span class="store-hero-size">${escapeHtml(app.size || '—')}</span>
                        <div class="store-hero-action-row">
                            <button class="store-install-btn" id="detailDownloadBtn" type="button">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                镜像下载
                            </button>
                            <button class="store-fav-btn${isFavorite(app.id) ? ' is-active' : ''}" id="detailFavBtn" type="button" aria-pressed="${isFavorite(app.id) ? 'true' : 'false'}" aria-label="${isFavorite(app.id) ? '取消收藏' : '收藏'}">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFavorite(app.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
                            <button class="store-share-btn" id="detailCopyLinkBtn" type="button" aria-label="复制链接" title="复制链接">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                </svg>
                            </button>
                            <button class="store-share-btn" id="detailShareBtn" type="button" aria-label="分享应用链接" title="分享">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                ${renderDetailIntro(app)}

                ${mirrors.length ? `
                <section class="store-section">
                    <h2 class="store-section-title">国内镜像</h2>
                    <div class="download-sources-list detail-mirrors" id="detailMirrors">
                        ${renderDownloadSources(mirrors)}
                    </div>
                </section>` : ''}

                <section class="store-section">
                    <h2 class="store-section-title">应用信息</h2>
                    <div class="store-info-grid">
                        <div class="store-info-item">
                            <span class="store-info-label">资费</span>
                            <span class="store-info-value">免费</span>
                        </div>
                        <div class="store-info-item">
                            <span class="store-info-label">大小</span>
                            <span class="store-info-value">${escapeHtml(app.size || '—')}</span>
                        </div>
                        <div class="store-info-item">
                            <span class="store-info-label">版本</span>
                            <span class="store-info-value">${escapeHtml(app.version || '—')}</span>
                        </div>
                        <div class="store-info-item">
                            <span class="store-info-label">更新时间</span>
                            <span class="store-info-value">${escapeHtml(app.updatedDate || '—')}</span>
                        </div>
                        <div class="store-info-item">
                            <span class="store-info-label">平台</span>
                            <span class="store-info-value">${app.platform === 'windows' ? 'Windows' : 'Android'}</span>
                        </div>
                        <div class="store-info-item">
                            <span class="store-info-label">镜像源</span>
                            <span class="store-info-value">${mirrors.length || 0} 个</span>
                        </div>
                    </div>
                </section>

                ${renderRelatedApps(app)}
            </div>`;
    }


    function showAppDetail(id, options) {
        options = options || {};
        const app = appsData.find(a => a.id === id);
        if (!app) return;

        if (!detailAppId) {
            savedListScrollY = window.scrollY;
        }

        detailAppId = id;
        aboutViewActive = false;
        pushRecent(id);
        trackEvent('app_view', id);
        updatePageMeta(buildAppMeta(app));
        updateJsonLd(app);

        const content = $('#detailContent');
        content.innerHTML = renderDetailPage(app);

        const storeHome = $('#storeHome');
        if (storeHome) storeHome.style.display = 'none';
        const about = $('#about');
        if (about) {
            about.style.display = 'none';
            about.classList.remove('is-visible');
        }
        const detailSection = $('#appDetail');
        const storeMain = $('#storeMain');
        scrollMainToTop();
        if (storeMain) storeMain.classList.add('is-detail-view');
        document.body.classList.add('is-detail-open');
        const header = $('#header');
        if (header) header.classList.remove('is-hidden');
        stopFeaturedAutoplay();
        detailSection.style.display = 'block';
        detailSection.classList.remove('is-visible');
        requestAnimationFrame(() => detailSection.classList.add('is-visible'));

        if (!options.skipHash) setAppHash(id);

        $('#backBtn').onclick = () => hideAppDetail();

        const crumbHome = $('#crumbHome');
        if (crumbHome) {
            crumbHome.addEventListener('click', () => {
                hideAppDetail({ skipScroll: true });
                resetFilters();
                scrollMainToTop({ behavior: 'smooth' });
            });
        }

        content.querySelectorAll('.crumb-link[data-filter-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.filterCategory;
                hideAppDetail({ skipScroll: true });
                if (cat && cat !== 'all') selectStoreNav({ category: cat });
                else resetFilters();
                scrollMainToTop({ behavior: 'smooth' });
            });
        });

        $('#detailDownloadBtn').addEventListener('click', () => showDownloadModal(id));
        $('#detailShareBtn').addEventListener('click', () => shareApp(id, app));

        const favBtn = $('#detailFavBtn');
        if (favBtn) {
            favBtn.addEventListener('click', () => {
                const added = toggleFavorite(id);
                favBtn.classList.toggle('is-active', added);
                favBtn.setAttribute('aria-pressed', added ? 'true' : 'false');
                favBtn.setAttribute('aria-label', added ? '取消收藏' : '收藏');
                const svg = favBtn.querySelector('svg');
                if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
                showToast(added ? '已加入收藏' : '已取消收藏', 'success');
            });
        }

        const mirrors = content.querySelector('#detailMirrors');
        if (mirrors) bindDownloadSourceEvents(mirrors, { appId: id });

        content.querySelectorAll('.related-card').forEach(btn => {
            btn.addEventListener('click', () => showAppDetail(btn.dataset.id));
        });

        setupDetailStickyBar(app);
        updateSidebarActive();
        updateMobileNavActive();

        const copyLinkBtn = $('#detailCopyLinkBtn');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => {
                copyToClipboard(getAppShareUrl(id));
                showToast('链接已复制', 'success');
            });
        }
    }

    function setupDetailStickyBar(app) {
        let bar = $('#detailStickyBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'detailStickyBar';
            bar.className = 'detail-sticky-bar';
            document.body.appendChild(bar);
        }

        const mirrors = (app.downloadSources || []).length;
        bar.innerHTML = `
            <div class="detail-sticky-inner">
                <div class="detail-sticky-info">
                    <strong>${escapeHtml(app.name)}</strong>
                    <span>${escapeHtml(app.version || '')}${mirrors ? ' · ' + mirrors + ' 镜像' : ''}</span>
                </div>
                <button type="button" class="btn-download" id="stickyDownloadBtn">下载</button>
            </div>
        `;
        bar.hidden = false;

        const stickyBtn = $('#stickyDownloadBtn');
        if (stickyBtn) {
            stickyBtn.addEventListener('click', () => showDownloadModal(app.id));
        }
    }

    function hideDetailStickyBar() {
        const bar = $('#detailStickyBar');
        if (bar) bar.hidden = true;
    }

    function showDownloadModal(appId) {
        const app = appsData.find(a => a.id === appId);
        if (!app) return;

        modalReturnFocus = document.activeElement;
        $('#modalAppName').textContent = app.name;

        const modalIcon = $('#modalAppIcon');
        if (modalIcon) modalIcon.innerHTML = iconHtml(app) || placeholderIconSvg();

        const list = $('#downloadSourcesList');
        const sources = filterDownloadSources(app.downloadSources || []);
        if (!sources.length) {
            const gh = app.githubUrl
                ? '<p class="modal-empty">暂无国内镜像。<a href="' + escapeAttr(app.githubUrl) +
                  '" target="_blank" rel="noopener noreferrer">前往 GitHub 仓库下载</a></p>'
                : '<p class="modal-empty">暂无国内镜像，请稍后再试。</p>';
            list.innerHTML = gh;
        } else {
            list.innerHTML = renderDownloadSources(sources);
            bindDownloadSourceEvents(list, { closeModal: true, appId: appId });
        }

        const modal = $('#downloadModal');
        modal.style.display = 'flex';
        modal.classList.remove('is-visible');
        requestAnimationFrame(() => {
            modal.classList.add('is-visible');
            const closeBtn = $('#modalClose');
            if (closeBtn) closeBtn.focus();
        });
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        const modal = $('#downloadModal');
        modal.classList.remove('is-visible');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') {
            modalReturnFocus.focus();
        }
        modalReturnFocus = null;
    }

    function copyToClipboard(text) {
        if (!text) return;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            ta.remove();
        }
    }

    function showToast(message, type) {
        const container = $('#toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast' + (type ? ' ' + type : '');

        const icon = type === 'success'
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : type === 'error'
                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6366f1" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

        toast.innerHTML = icon + '<span>' + escapeHtml(message) + '</span>';
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            toast.style.transition = 'opacity 0.3s, transform 0.3s';
            setTimeout(() => toast.remove(), 350);
        }, 2500);
    }

    function selectStoreNav(options) {
        options = options || {};
        hideAboutPage();
        showStoreHome();
        if (options.category != null) state.category = options.category;
        if (options.platform != null) state.platform = options.platform;
        // Single-dimension nav (header/sidebar chips) clears the other axis.
        if (options.category != null && options.platform == null) state.platform = 'all';
        if (options.platform != null && options.category == null) state.category = 'all';
        state.page = 1;
        updateSidebarActive();
        updateNavAria();
        updateMobileNavActive();
        applyFilters();
    }

    function setupFilters() {
        $$('.store-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.scrollTo) return;
                if (detailAppId) hideAppDetail({ skipScroll: true });

                const category = item.dataset.category;
                const platform = item.dataset.platform;

                if (category) selectStoreNav({ category });
                else if (platform) selectStoreNav({ platform });

                closeMobileDrawer();
                scrollMainToTop({ behavior: 'smooth' });
            });
        });

        $$('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const platform = link.dataset.platform;
                if (!platform) return;
                if (detailAppId) hideAppDetail({ skipScroll: true });
                $$('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                selectStoreNav({ platform });
            });
        });

        $$('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (detailAppId) hideAppDetail({ skipScroll: true });
                hideAboutPage();
                showStoreHome();
                $$('.chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.category = chip.dataset.category;
                state.platform = 'all';
                state.page = 1;
                updateNavAria();
                updateSidebarActive();
                updateMobileNavActive();
                applyFilters();
            });
        });

        const sortSelect = $('#sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.sort = e.target.value;
                state.page = 1;
                applyFilters();
            });
        }

        const resetBtn = $('#resetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    }

    function resetFilters() {
        if (detailAppId) hideAppDetail({ skipScroll: true });
        hideAboutPage();
        showStoreHome();
        state.search = '';
        state.category = 'all';
        state.platform = 'all';
        state.sort = 'popular';
        state.page = 1;
        const searchInput = $('#searchInput');
        if (searchInput) searchInput.value = '';
        const searchClear = $('#searchClear');
        if (searchClear) searchClear.style.display = 'none';
        hideSearchSuggestions();
        $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
        updateNavAria();
        updateSidebarActive();
        const sortSelect = $('#sortSelect');
        if (sortSelect) sortSelect.value = 'popular';
        applyFilters();
        updateMobileNavActive();
    }

    function hideSearchSuggestions() {
        const box = $('#searchSuggestions');
        if (!box) return;
        box.hidden = true;
        box.innerHTML = '';
    }

    function renderSearchSuggestions(query) {
        const box = $('#searchSuggestions');
        if (!box) return;

        const q = (query || '').trim().toLowerCase();
        if (q.length < 1) {
            hideSearchSuggestions();
            return;
        }

        const matches = appsData.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.description || '').toLowerCase().includes(q) ||
            (a.categoryName || '').toLowerCase().includes(q)
        ).slice(0, 6);

        if (!matches.length) {
            box.hidden = false;
            box.innerHTML = '<div class="search-suggestion-empty">没有匹配的软件</div>';
            return;
        }

        box.hidden = false;
        box.innerHTML = matches.map(app => `
            <button class="search-suggestion" type="button" role="option" data-id="${escapeAttr(app.id)}">
                <span class="search-suggestion-icon">${iconHtml(app) || placeholderIconSvg()}</span>
                <span class="search-suggestion-body">
                    <span class="search-suggestion-name">${highlightSearch(app.name, query)}</span>
                    <span class="search-suggestion-meta">${escapeHtml(app.categoryName || '')} · ${app.platform === 'windows' ? 'Windows' : 'Android'}</span>
                </span>
            </button>
        `).join('');

        box.querySelectorAll('.search-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                hideSearchSuggestions();
                showAppDetail(btn.dataset.id);
            });
        });
    }

    function openSearchPanel() {
        const panel = $('#searchPanel');
        const toggle = $('#searchToggle');
        const input = $('#searchInput');
        if (panel) panel.hidden = false;
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
        if (input) {
            input.focus();
            input.select();
        }
    }

    function setupFooterExtras() {
        const searchBtn = $('#footerSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                if (detailAppId) hideAppDetail({ skipScroll: true });
                hideAboutPage();
                showStoreHome();
                openSearchPanel();
                scrollMainToTop({ behavior: 'smooth' });
            });
        }

        const mirrorSelect = $('#mirrorPrefSelect');
        if (mirrorSelect) {
            mirrorSelect.value = getMirrorPref();
            mirrorSelect.addEventListener('change', () => {
                setMirrorPref(mirrorSelect.value);
                appsData = appsData.map(normalizeApp);
                showToast(
                    mirrorSelect.value === 'baidu' ? '已优先显示百度镜像' : '已优先显示夸克镜像',
                    'success'
                );
            });
        }

        const bindSortBrowse = (id, sort) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (detailAppId) hideAppDetail({ skipScroll: true });
                hideAboutPage();
                showStoreHome();
                state.category = 'all';
                state.platform = 'all';
                state.search = '';
                state.sort = sort;
                state.page = 1;
                const sortSelect = $('#sortSelect');
                if (sortSelect) sortSelect.value = sort;
                applyStateToUI();
                applyFilters();
                scrollToFeed();
            });
        };
        bindSortBrowse('hotViewAll', 'popular');
        bindSortBrowse('recentViewAll', 'updated');
    }

    function setupSearch() {
        const input = $('#searchInput');
        const clearBtn = $('#searchClear');
        const btn = $('#searchBtn');
        let debounce;
        let suggestIndex = -1;

        if (!input) return;

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            renderSearchSuggestions(input.value);
            suggestIndex = -1;
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (detailAppId) hideAppDetail({ skipScroll: true });
                hideAboutPage();
                showStoreHome();
                state.search = input.value.trim();
                state.page = 1;
                const panel = $('#searchPanel');
                if (panel && state.search) panel.hidden = false;
                applyFilters();
            }, 300);
        });

        input.addEventListener('keydown', (e) => {
            const box = $('#searchSuggestions');
            const items = box && !box.hidden ? $$('.search-suggestion', box) : [];

            if (e.key === 'ArrowDown' && items.length) {
                e.preventDefault();
                suggestIndex = Math.min(suggestIndex + 1, items.length - 1);
                items.forEach((el, i) => el.classList.toggle('is-active', i === suggestIndex));
                return;
            }
            if (e.key === 'ArrowUp' && items.length) {
                e.preventDefault();
                suggestIndex = Math.max(suggestIndex - 1, 0);
                items.forEach((el, i) => el.classList.toggle('is-active', i === suggestIndex));
                return;
            }
            if (e.key === 'Enter') {
                if (suggestIndex >= 0 && items[suggestIndex]) {
                    e.preventDefault();
                    items[suggestIndex].click();
                    return;
                }
                hideSearchSuggestions();
                if (detailAppId) hideAppDetail({ skipScroll: true });
                hideAboutPage();
                showStoreHome();
                state.search = input.value.trim();
                state.page = 1;
                applyFilters();
            }
            if (e.key === 'Escape') {
                hideSearchSuggestions();
            }
        });

        clearBtn && clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            state.search = '';
            state.page = 1;
            hideSearchSuggestions();
            applyFilters();
            input.focus();
        });

        btn && btn.addEventListener('click', () => {
            hideSearchSuggestions();
            if (detailAppId) hideAppDetail({ skipScroll: true });
            hideAboutPage();
            showStoreHome();
            state.search = input.value.trim();
            state.page = 1;
            applyFilters();
        });

        document.addEventListener('click', (e) => {
            const panel = $('#searchPanel');
            if (!panel || panel.hidden) return;
            if (panel.contains(e.target) || e.target.closest('#searchToggle')) return;
            hideSearchSuggestions();
        });
    }

    function setupViewToggle() {
        const gridBtn = $('#gridViewBtn');
        const listBtn = $('#listViewBtn');
        if (!gridBtn || !listBtn) return;

        gridBtn.addEventListener('click', () => {
            state.view = 'grid';
            localStorage.setItem('shelfhub-view', 'grid');
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
            gridBtn.setAttribute('aria-pressed', 'true');
            listBtn.setAttribute('aria-pressed', 'false');
            applyFilters();
        });

        listBtn.addEventListener('click', () => {
            state.view = 'list';
            localStorage.setItem('shelfhub-view', 'list');
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
            listBtn.setAttribute('aria-pressed', 'true');
            gridBtn.setAttribute('aria-pressed', 'false');
            applyFilters();
        });
    }

    function setupModal() {
        $('#modalClose').addEventListener('click', hideModal);
        $('#modalOverlay').addEventListener('click', hideModal);
        document.addEventListener('keydown', (e) => {
            const modal = $('#downloadModal');
            if (!modal || modal.style.display !== 'flex') return;

            if (e.key === 'Escape') {
                hideModal();
                return;
            }

            // Basic focus trap inside download modal.
            if (e.key === 'Tab') {
                const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
                    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    function openMobileDrawer() {
        const drawer = $('#mobileDrawer');
        const overlay = $('#drawerOverlay');
        const toggle = $('#drawerToggle');

        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-visible');
        toggle.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileDrawer() {
        const drawer = $('#mobileDrawer');
        const overlay = $('#drawerOverlay');
        const toggle = $('#drawerToggle');

        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('is-visible');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    function updateMobileNavActive() {
        $$('.mobile-nav-item').forEach(item => {
            if (item.dataset.scrollTo === 'about') {
                item.classList.toggle('active', aboutViewActive);
                return;
            }

            const platform = item.dataset.platform;
            const category = item.dataset.category;
            if (aboutViewActive) {
                item.classList.remove('active');
                return;
            }
            if (platform) {
                item.classList.toggle('active', state.platform === platform && state.category === 'all');
            } else if (category) {
                item.classList.toggle('active', state.category === category && state.platform === 'all');
            }
        });
    }

    function setupMobileDrawer() {
        const toggle = $('#drawerToggle');
        const closeBtn = $('#drawerClose');
        const overlay = $('#drawerOverlay');

        toggle.addEventListener('click', () => {
            if (toggle.classList.contains('is-open')) {
                closeMobileDrawer();
            } else {
                openMobileDrawer();
            }
        });

        closeBtn.addEventListener('click', closeMobileDrawer);
        overlay.addEventListener('click', closeMobileDrawer);

        $$('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const platform = item.dataset.platform;
                const category = item.dataset.category;
                if (platform || category) {
                    if (detailAppId) hideAppDetail({ skipScroll: true });
                    if (category) selectStoreNav({ category });
                    else if (platform) selectStoreNav({ platform });
                    scrollMainToTop({ behavior: 'smooth' });
                }
                closeMobileDrawer();
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $('#mobileDrawer').classList.contains('is-open')) {
                closeMobileDrawer();
            }
        });
    }

    function setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !isInputFocused()) {
                e.preventDefault();
                if (detailAppId) hideAppDetail({ skipScroll: true });
                openSearchPanel();
                scrollMainToTop({ behavior: 'smooth' });
                return;
            }

            if (e.key === 'Escape') {
                const suggestions = $('#searchSuggestions');
                if (suggestions && !suggestions.hidden) {
                    hideSearchSuggestions();
                    return;
                }
                if ($('#downloadModal').style.display === 'flex') {
                    hideModal();
                    return;
                }
                if ($('#mobileDrawer').classList.contains('is-open')) {
                    closeMobileDrawer();
                    return;
                }
                if (detailAppId) {
                    hideAppDetail();
                }
            }
        });
    }

    function init() {
        parseUrlState();
        updateDynamicStats();
        applyStateToUI();
        initTheme();
        initViewPreference();
        initScrollEffects();
        animateCounters();
        initScrollReveal();
        setupFilters();
        setupSearch();
        setupSearchPanel();
        setupFooterExtras();
        setupViewToggle();
        setupModal();
        setupMobileDrawer();
        setupHashRouting();
        setupKeyboard();
        setupFeaturedNav();
        setupFeaturedAutoplay();
        applyFilters();
    }

    async function start() {
        appsData = await loadAppsData();
        init();

        const appId = parseAppHash();
        if (appId && appsData.some(a => a.id === appId)) {
            showAppDetail(appId, { skipHash: true });
        } else if (appId) {
            showToast('未找到该应用', 'error');
            setAppHash(null);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
