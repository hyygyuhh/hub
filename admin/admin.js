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
    view: 'dashboard',
    me: null,
    confirmResolver: null
  };

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  async function api(path, options) {
    options = options || {};
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(options.headers || {})
      },
      method: options.method || 'GET',
      body: options.body
        ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body))
        : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      if (res.status === 401 && path !== '/admin/login' && path !== '/admin/me') {
        goLogin();
      }
      const err = new Error((data && data.error) || ('请求失败 ' + res.status));
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('is-error', 'is-ok');
    if (type === 'error') el.classList.add('is-error');
    if (type === 'ok') el.classList.add('is-ok');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function setBusy(on) {
    $('#busy').hidden = !on;
  }

  function goLogin() {
    location.replace('./login');
  }

  function showAppShell() {
    const el = $('#appView');
    if (el) el.hidden = false;
  }

  function askConfirm(title, message) {
    return new Promise(resolve => {
      state.confirmResolver = resolve;
      $('#confirmTitle').textContent = title;
      $('#confirmMessage').textContent = message;
      $('#confirmModal').hidden = false;
    });
  }

  function closeConfirm(result) {
    $('#confirmModal').hidden = true;
    if (state.confirmResolver) {
      const r = state.confirmResolver;
      state.confirmResolver = null;
      r(result);
    }
  }

  async function checkAuth() {
    try {
      state.me = await api('/admin/me');
      showAppShell();
      updateSecurityUi();
      setView('dashboard');
      await refreshAll();
      return true;
    } catch (e) {
      if (e.status === 403) {
        document.body.innerHTML = '<div style="padding:2rem;font-family:sans-serif"><h1>403</h1><p>' +
          escapeHtml(e.message) + '</p></div>';
        return false;
      }
      goLogin();
      return false;
    }
  }

  function updateSecurityUi() {
    const ip = (state.me && state.me.ip) || '—';
    $('#sidebarIp').textContent = 'IP ' + ip;
    $('#securityIp').textContent = ip;
    const status = $('#securityAllowStatus');
    if (state.me && state.me.ipAllowlistEnabled) {
      status.textContent = '已启用（' + state.me.ipAllowlistCount + ' 条规则）';
      status.classList.remove('is-off');
    } else {
      status.textContent = '未启用（所有 IP 可访问后台）';
      status.classList.add('is-off');
    }
  }

  async function refreshAll() {
    setBusy(true);
    try {
      const [appsRes, stats, me] = await Promise.all([
        api('/admin/apps'),
        api('/admin/stats'),
        api('/admin/me')
      ]);
      state.apps = appsRes.apps || [];
      state.me = me;
      updateSecurityUi();
      renderStats(stats);
      renderAppsTable();
    } finally {
      setBusy(false);
    }
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

  function iconThumbHtml(icon) {
    if (!icon) return '<span class="app-thumb">无</span>';
    if (/<svg/i.test(icon)) {
      return '<span class="app-thumb">' + icon + '</span>';
    }
    return '<span class="app-thumb"><img src="' + escapeAttr(icon) + '" alt=""></span>';
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
    $('#appsCount').textContent = '共 ' + apps.length + ' 个';
    if (!apps.length) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    body.innerHTML = apps.map(app => `
      <tr>
        <td>
          <div class="app-cell">
            ${iconThumbHtml(app.icon)}
            <div>
              <strong>${escapeHtml(app.name)}</strong>
              <div class="muted">${escapeHtml(app.id)}</div>
            </div>
          </div>
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
    $('#securityView').hidden = view !== 'security';
    $('#newAppBtn').hidden = view !== 'apps';

    const titles = {
      dashboard: ['概览', '站点台账与近七日动向'],
      apps: ['应用', '检索、编辑与上架软件'],
      editor: [state.editingId ? '编辑应用' : '新增应用', '资料、图标与镜像'],
      security: ['安全', 'IP 白名单与密码']
    };
    const t = titles[view] || titles.dashboard;
    $('#viewTitle').textContent = t[0];
    $('#viewSubtitle').textContent = t[1];

    $$('.nav-btn').forEach(btn => {
      const active = btn.dataset.view === view || (view === 'editor' && btn.dataset.view === 'apps');
      btn.classList.toggle('is-active', active);
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

  function renderIconPreview(icon) {
    const box = $('#iconPreview');
    if (!icon) {
      box.innerHTML = '';
      return;
    }
    if (/<svg/i.test(icon)) {
      box.innerHTML = icon;
      return;
    }
    box.innerHTML = '<img src="' + escapeAttr(icon) + '" alt="图标预览">';
  }

  function openEditor(id) {
    state.editingId = id || null;
    $('#appForm').reset();
    $('#formError').hidden = true;
    $('#mirrorsList').innerHTML = '';
    $('#fieldId').disabled = !!id;

    if (id) {
      const app = state.apps.find(a => a.id === id);
      if (!app) {
        toast('未找到应用', 'error');
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
      renderIconPreview(app.icon || '');
      const sources = app.downloadSources || [];
      if (sources.length) sources.forEach(addMirrorRow);
      else {
        addMirrorRow({ type: 'quark', name: '夸克网盘', url: '' });
        addMirrorRow({ type: 'baidu', name: '百度网盘', url: '' });
      }
    } else {
      $('#fieldCategoryName').value = CATEGORY_NAMES.development;
      $('#fieldUpdatedDate').value = new Date().toISOString().slice(0, 10);
      $('#fieldIcon').value = '';
      renderIconPreview('');
      addMirrorRow({ type: 'quark', name: '夸克网盘', url: '' });
      addMirrorRow({ type: 'baidu', name: '百度网盘', url: '' });
    }

    setView('editor');
  }

  async function deleteApp(id) {
    const app = state.apps.find(a => a.id === id);
    const ok = await askConfirm('删除应用', '确定删除「' + ((app && app.name) || id) + '」？此操作不可恢复。');
    if (!ok) return;
    try {
      setBusy(true);
      await api('/admin/apps/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('已删除', 'ok');
      await refreshAll();
      setView('apps');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = src;
    });
  }

  async function compressImageFile(file) {
    if (file.type === 'image/svg+xml') {
      const text = await file.text();
      if (text.length > 120000) throw new Error('SVG 过大');
      return text.trim();
    }

    const rawUrl = await fileToDataUrl(file);
    const img = await loadImage(rawUrl);
    const max = 256;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    while (dataUrl.length > 350000 && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL(
        dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
        quality
      );
    }
    return dataUrl;
  }

  async function handleIconFile(file) {
    if (!file) return;
    const okTypes = /image\/(png|jpeg|jpg|webp|gif|svg\+xml)/i.test(file.type)
      || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
    if (!okTypes) {
      toast('仅支持 PNG / JPG / WebP / GIF / SVG', 'error');
      return;
    }
    try {
      setBusy(true);
      const icon = await compressImageFile(file);
      if (typeof icon === 'string' && icon.startsWith('data:')) {
        const res = await api('/admin/upload-icon', {
          method: 'POST',
          body: { dataUrl: icon }
        });
        $('#fieldIcon').value = res.icon;
        renderIconPreview(res.icon);
      } else {
        $('#fieldIcon').value = icon;
        renderIconPreview(icon);
      }
      toast('图标已就绪', 'ok');
    } catch (e) {
      toast(e.message || '上传失败', 'error');
    } finally {
      setBusy(false);
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
    $('#logoutBtn').addEventListener('click', async () => {
      try { await api('/admin/logout', { method: 'POST' }); } catch (_) {}
      goLogin();
    });

    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    const mastBrand = document.querySelector('.mast-brand');
    if (mastBrand) {
      mastBrand.addEventListener('click', (e) => {
        e.preventDefault();
        setView('dashboard');
      });
    }

    $('#newAppBtn').addEventListener('click', () => openEditor(null));
    $('#cancelEditBtn').addEventListener('click', () => setView('apps'));
    $('#addMirrorBtn').addEventListener('click', () => addMirrorRow());
    $('#appSearch').addEventListener('input', renderAppsTable);
    $('#platformFilter').addEventListener('change', renderAppsTable);
    $('#refreshBtn').addEventListener('click', async () => {
      try {
        await refreshAll();
        toast('已刷新', 'ok');
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    $('#fieldCategory').addEventListener('change', (e) => {
      const name = CATEGORY_NAMES[e.target.value];
      if (name) $('#fieldCategoryName').value = name;
    });

    $('#fieldIcon').addEventListener('input', () => {
      renderIconPreview($('#fieldIcon').value.trim());
    });

    $('#clearIconBtn').addEventListener('click', () => {
      $('#fieldIcon').value = '';
      $('#iconFile').value = '';
      renderIconPreview('');
    });

    const drop = $('#iconDrop');
    const fileInput = $('#iconFile');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', () => handleIconFile(fileInput.files[0]));
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-dragover');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleIconFile(file);
    });

    $('#confirmCancel').addEventListener('click', () => closeConfirm(false));
    $('#confirmOk').addEventListener('click', () => closeConfirm(true));
    $('#confirmModal').addEventListener('click', (e) => {
      if (e.target.id === 'confirmModal') closeConfirm(false);
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
      setBusy(true);
      try {
        if (state.editingId) {
          await api('/admin/apps/' + encodeURIComponent(state.editingId), {
            method: 'PUT',
            body: payload
          });
          toast('已更新', 'ok');
        } else {
          await api('/admin/apps', { method: 'POST', body: payload });
          toast('已创建', 'ok');
        }
        await refreshAll();
        setView('apps');
      } catch (ex) {
        formError.textContent = ex.message;
        formError.hidden = false;
        toast(ex.message, 'error');
      } finally {
        btn.disabled = false;
        setBusy(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#confirmModal').hidden) closeConfirm(false);
    });
  }

  bindEvents();
  checkAuth();
})();
