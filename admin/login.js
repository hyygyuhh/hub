(function () {
  'use strict';

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

  // Already logged in → go to console
  api('/admin/me').then(() => {
    location.replace('/admin/');
  }).catch(() => {});

  $('#togglePassword').addEventListener('click', () => {
    const input = $('#loginPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#togglePassword').textContent = show ? '隐藏' : '显示';
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    const btn = $('#loginBtn');
    err.hidden = true;
    btn.disabled = true;
    try {
      await api('/admin/login', {
        method: 'POST',
        body: { password: $('#loginPassword').value }
      });
      location.replace('/admin/');
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });
})();
