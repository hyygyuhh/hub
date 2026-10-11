(function () {
  'use strict';

  const CATEGORY_NAMES = {
    development: '开发工具',
    office: '办公效率',
    design: '设计创意',
    entertainment: '影音娱乐',
    system: '系统工具',
    network: '网络传输',
    security: '安全隐私'
  };

  const state = {
    apps: [],
    editingId: null,
    view: 'dashboard'
  };

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  async function api(path, options) {
    options = options || {};
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('请求失败 ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function showLogin() {
    $('#loginView').hidden = false;
    $('#appView').hidden = true;
  }

  function showAppShell() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
  }

  async function checkAuth() {
    try {
      await api('/admin/me');
      showAppShell();
      await refreshAll();
      setView('dashboard');
      return true;
    } catch (_) {
      showLogin();
      return false;
    }
  }

  async function refreshAll() {
    const [appsRes, stats] = await Promise.all([
      api('/admin/apps'),
      api('/admin/stats')
    ]);
    state.apps = appsRes.apps || [];
    renderStats(stats);
    renderAppsTable();
  }

  function renderStats(stats) {
    const grid = $('#statGrid');
    const cards = [
      ['应用总数', stats.totalApps],
      ['Windows', (stats.byPlatform && stats.byPlatform.windows) || 0],
      ['Android', (stats.byPlatform && stats.byPlatform.android) || 0],
      ['7日浏览', stats.events && stats.events.views7],
      ['7日下载', stats.events && stats.events.downloads7],
      ['最近更新', stats.latestUpdated ? String(stats.latestUpdated).slice(0, 10) : '—']
    ];
    grid.innerHTML = cards.map(([label, value]) => `
      <div class="stat-card">
        <strong>${escapeHtml(value == null ? '—' : value)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    `).join('');

    renderNamedList($('#categoryList'), Object.entries(stats.byCategory || {}).map(([name, count]) => ({
      name, count
    })));
    renderNamedList($('#topViewsList'), (stats.events && stats.events.topViews7) || []);
    renderNamedList($('#topDownloadsList'), (stats.events && stats.events.topDownloads7) || []);
    renderIssueList($('#missingMirrorsList'), stats.missingMirrors || []);
    renderIssueList($('#missingGithubList'), stats.missingGithub || []);

    const link = $('#analyticsLink');
    if (stats.analyticsDashboardUrl) {
      link.href = stats.analyticsDashboardUrl;
      link.hidden = false;
      $('#analyticsNote').textContent = '全站 PV/UV 见 Cloudflare Web Analytics。';
    } else {
      link.hidden = true;
      $('#analyticsNote').textContent = '在 Cloudflare 开启 Web Analytics 后，将 ANALYTICS_DASHBOARD_URL 配到环境变量即可在此打开。';
    }
  }

  function renderNamedList(el, items) {
    if (!items.length) {
      el.innerHTML = '<li><span class="muted">暂无数据</span></li>';
      return;
    }
    el.innerHTML = items.map(item => `
      <li>
        <span>${escapeHtml(item.name)}</span>
        <strong>${escapeHtml(item.count)}</strong>
      </li>
    `).join('');
  }

  function renderIssueList(el, items) {
    if (!items.length) {
      el.innerHTML = '<li><span class="muted">无</span></li>';
      return;
    }
    el.innerHTML = items.map(item => `
      <li>
        <button type="button" class="btn-ghost issue-edit" data-id="${escapeAttr(item.id)}">${escapeHtml(item.name)}</button>
        <span class="muted">${escapeHtml(item.id)}</span>
      </li>
    `).join('');
    el.querySelectorAll('.issue-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditor(btn.dataset.id));
    });
  }

  function filteredApps() {
    const q = ($('#appSearch').value || '').trim().toLowerCase();
    const platform = $('#platformFilter').value;
    return state.apps.filter(app => {
      if (platform !== 'all' && app.platform !== platform) return false;
      if (!q) return true;
      return (app.name || '').toLowerCase().includes(q)
        || (app.id || '').toLowerCase().includes(q)
        || (app.categoryName || '').toLowerCase().includes(q);
    });
  }

  function renderAppsTable() {
    const apps = filteredApps();
    const body = $('#appsTableBody');
    const empty = $('#appsEmpty');
    if (!apps.length) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = apps.map(app => `
      <tr>
        <td>
          <strong>${escapeHtml(app.name)}</strong>
          <div class="muted">${escapeHtml(app.id)}</div>
        </td>
        <td>${escapeHtml(app.platform)}</td>
        <td>${escapeHtml(app.categoryName || app.category)}</td>
        <td>${(app.downloadSources || []).length}</td>
        <td>${escapeHtml(app.githubStars || 0)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn-secondary" data-edit="${escapeAttr(app.id)}">编辑</button>
            <button type="button" class="btn-danger" data-del="${escapeAttr(app.id)}">删除</button>
          </div>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditor(btn.dataset.edit));
    });
    body.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => deleteApp(btn.dataset.del));
    });
  }

  function setView(view) {
    state.view = view;
    $('#dashboardView').hidden = view !== 'dashboard';
    $('#appsView').hidden = view !== 'apps';
    $('#editorView').hidden = view !== 'editor';
    $('#newAppBtn').hidden = view !== 'apps';
    $('#viewTitle').textContent = view === 'dashboard' ? '仪表盘'
      : view === 'apps' ? '应用管理'
      : (state.editingId ? '编辑应用' : '新增应用');
    $$('.nav-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.view === view || (view === 'editor' && btn.dataset.view === 'apps'));
    });
  }

  function addMirrorRow(data) {
    data = data || { type: 'quark', name: '夸克网盘', url: '' };
    const wrap = document.createElement('div');
    wrap.className = 'mirror-row';
    wrap.innerHTML = `
      <select class="mirror-type">
        <option value="quark"${data.type === 'quark' ? ' selected' : ''}>夸克</option>
        <option value="baidu"${data.type === 'baidu' ? ' selected' : ''}>百度</option>
      </select>
      <input class="mirror-name" placeholder="显示名称" value="${escapeAttr(data.name || '')}">
      <input class="mirror-url" placeholder="https://..." value="${escapeAttr(data.url || '')}">
      <button type="button" class="btn-danger mirror-remove">移除</button>
    `;
    wrap.querySelector('.mirror-type').addEventListener('change', (e) => {
      const nameInput = wrap.querySelector('.mirror-name');
      if (!nameInput.value || nameInput.value === '夸克网盘' || nameInput.value === '百度网盘') {
        nameInput.value = e.target.value === 'quark' ? '夸克网盘' : '百度网盘';
      }
    });
    wrap.querySelector('.mirror-remove').addEventListener('click', () => wrap.remove());
    $('#mirrorsList').appendChild(wrap);
  }

  function collectMirrors() {
    return $$('.mirror-row', $('#mirrorsList')).map(row => ({
      type: row.querySelector('.mirror-type').value,
      name: row.querySelector('.mirror-name').value.trim(),
      url: row.querySelector('.mirror-url').value.trim()
    })).filter(s => s.url);
  }

  function openEditor(id) {
    state.editingId = id || null;
    const form = $('#appForm');
    form.reset();
    $('#formError').hidden = true;
    $('#mirrorsList').innerHTML = '';
    $('#fieldId').disabled = !!id;

    if (id) {
      const app = state.apps.find(a => a.id === id);
      if (!app) {
        toast('未找到应用');
        return;
      }
      $('#fieldId').value = app.id;
      $('#fieldName').value = app.name || '';
      $('#fieldPlatform').value = app.platform || 'windows';
      $('#fieldCategory').value = app.category || 'development';
      $('#fieldCategoryName').value = app.categoryName || CATEGORY_NAMES[app.category] || '';
      $('#fieldVersion').value = app.version || '';
      $('#fieldSize').value = app.size || '';
      $('#fieldUpdatedDate').value = (app.updatedDate || '').slice(0, 10);
      $('#fieldGithubStars').value = app.githubStars || 0;
      $('#fieldGithubUrl').value = app.githubUrl || '';
      $('#fieldDescription').value = app.description || '';
      $('#fieldFeatures').value = (app.features || []).join('\n');
      $('#fieldIcon').value = app.icon || '';
      const sources = app.downloadSources || [];
      if (sources.length) sources.forEach(addMirrorRow);
      else {
        addMirrorRow({ type: 'quark', name: '夸克网盘', url: '' });
        addMirrorRow({ type: 'baidu', name: '百度网盘', url: '' });
      }
    } else {
      $('#fieldCategoryName').value = CATEGORY_NAMES.development;
      $('#fieldUpdatedDate').value = new Date().toISOString().slice(0, 10);
      addMirrorRow({ type: 'quark', name: '夸克网盘', url: '' });
      addMirrorRow({ type: 'baidu', name: '百度网盘', url: '' });
    }

    setView('editor');
  }

  async function deleteApp(id) {
    const app = state.apps.find(a => a.id === id);
    if (!confirm('确定删除「' + ((app && app.name) || id) + '」？')) return;
    try {
      await api('/admin/apps/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('已删除');
      await refreshAll();
      setView('apps');
    } catch (e) {
      toast(e.message);
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function bindEvents() {
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#loginError');
      err.hidden = true;
      const btn = $('#loginBtn');
      btn.disabled = true;
      try {
        await api('/admin/login', {
          method: 'POST',
          body: { password: $('#loginPassword').value }
        });
        showAppShell();
        await refreshAll();
        setView('dashboard');
        toast('登录成功');
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });

    $('#logoutBtn').addEventListener('click', async () => {
      try { await api('/admin/logout', { method: 'POST' }); } catch (_) {}
      showLogin();
    });

    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    $('#newAppBtn').addEventListener('click', () => openEditor(null));
    $('#cancelEditBtn').addEventListener('click', () => setView('apps'));
    $('#addMirrorBtn').addEventListener('click', () => addMirrorRow());
    $('#appSearch').addEventListener('input', renderAppsTable);
    $('#platformFilter').addEventListener('change', renderAppsTable);

    $('#fieldCategory').addEventListener('change', (e) => {
      const name = CATEGORY_NAMES[e.target.value];
      if (name) $('#fieldCategoryName').value = name;
    });

    $('#appForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formError = $('#formError');
      formError.hidden = true;
      const payload = {
        id: $('#fieldId').value.trim(),
        name: $('#fieldName').value.trim(),
        platform: $('#fieldPlatform').value,
        category: $('#fieldCategory').value,
        categoryName: $('#fieldCategoryName').value.trim(),
        version: $('#fieldVersion').value.trim(),
        size: $('#fieldSize').value.trim(),
        updatedDate: $('#fieldUpdatedDate').value,
        githubStars: Number($('#fieldGithubStars').value) || 0,
        githubUrl: $('#fieldGithubUrl').value.trim(),
        description: $('#fieldDescription').value.trim(),
        features: $('#fieldFeatures').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
        icon: $('#fieldIcon').value.trim(),
        downloadSources: collectMirrors()
      };

      const btn = $('#saveAppBtn');
      btn.disabled = true;
      try {
        if (state.editingId) {
          await api('/admin/apps/' + encodeURIComponent(state.editingId), {
            method: 'PUT',
            body: payload
          });
          toast('已更新');
        } else {
          await api('/admin/apps', { method: 'POST', body: payload });
          toast('已创建');
        }
        await refreshAll();
        setView('apps');
      } catch (ex) {
        formError.textContent = ex.message;
        formError.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  bindEvents();
  checkAuth();
})();
