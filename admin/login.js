(function () {
  'use strict';

  const USER_KEY = 'shelfhub-admin-user';
  const $ = (sel) => document.querySelector(sel);

  async function api(path, options) {
    options = options || {};
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      throw new Error((data && data.error) || ('请求失败 ' + res.status));
    }
    return data;
  }

  const userInput = $('#loginUsername');
  const passInput = $('#loginPassword');
  const remember = $('#rememberUser');
  const err = $('#loginError');
  const btn = $('#loginBtn');
  const btnLabel = btn.querySelector('.btn-label') || btn;

  try {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      userInput.value = saved;
      remember.checked = true;
      passInput.focus();
    } else {
      userInput.focus();
    }
  } catch (_) {
    userInput.focus();
  }

  // Already logged in → go to console
  api('/admin/me').then(() => {
    location.replace('/admin/');
  }).catch(() => {});

  $('#togglePassword').addEventListener('click', () => {
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    const toggle = $('#togglePassword');
    toggle.textContent = show ? '隐藏' : '显示';
    toggle.setAttribute('aria-pressed', show ? 'true' : 'false');
    passInput.focus();
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    err.textContent = '';
    btn.disabled = true;
    btnLabel.textContent = '登录中…';

    const username = userInput.value.trim();
    const password = passInput.value;

    try {
      if (!username || !password) {
        throw new Error('请输入账号和密码');
      }

      await api('/admin/login', {
        method: 'POST',
        body: { username, password }
      });

      try {
        if (remember.checked) localStorage.setItem(USER_KEY, username);
        else localStorage.removeItem(USER_KEY);
      } catch (_) { /* ignore */ }

      location.replace('/admin/');
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      btnLabel.textContent = '进入后台';
      passInput.select();
    }
  });
})();
