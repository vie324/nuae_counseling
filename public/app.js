(function() {
  'use strict';

  let allCustomers = [];
  let noticeItems = [];
  let filteredCustomers = [];

  const els = {};

  function init() {
    cacheEls();
    bindLogin();
    bootstrap();
  }

  function cacheEls() {
    els.loginScreen = document.getElementById('loginScreen');
    els.loginForm = document.getElementById('loginForm');
    els.loginPassword = document.getElementById('loginPassword');
    els.loginBtn = document.getElementById('loginBtn');
    els.loginError = document.getElementById('loginError');
    els.appShell = document.getElementById('appShell');
    els.grid = document.getElementById('customerGrid');
    els.loading = document.getElementById('loadingState');
    els.empty = document.getElementById('emptyState');
    els.search = document.getElementById('searchInput');
    els.refresh = document.getElementById('refreshBtn');
    els.logout = document.getElementById('logoutBtn');
    els.totalCount = document.getElementById('totalCount');
    els.recentCount = document.getElementById('recentCount');
    els.visibleCount = document.getElementById('visibleCount');
    els.modal = document.getElementById('detailModal');
    els.modalContent = document.getElementById('modalContent');
    els.modalClose = document.getElementById('modalClose');
    els.backdrop = document.querySelector('.modal-backdrop');
  }

  function bindLogin() {
    els.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      els.loginError.textContent = '';
      const password = els.loginPassword.value;
      if (!password) {
        els.loginError.textContent = 'パスワードを入力してください';
        return;
      }
      els.loginBtn.disabled = true;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          els.loginError.textContent = data.error || 'ログインに失敗しました';
          els.loginPassword.select();
          return;
        }
        await enterApp();
      } catch (err) {
        els.loginError.textContent = '通信エラー: ' + err.message;
      } finally {
        els.loginBtn.disabled = false;
      }
    });
  }

  function bindAppEvents() {
    if (bindAppEvents._bound) return;
    bindAppEvents._bound = true;

    els.search.addEventListener('input', debounce(handleSearch, 180));
    els.refresh.addEventListener('click', () => {
      els.refresh.style.pointerEvents = 'none';
      loadData().finally(() => {
        setTimeout(() => { els.refresh.style.pointerEvents = ''; }, 600);
      });
    });
    els.logout.addEventListener('click', handleLogout);
    els.modalClose.addEventListener('click', closeModal);
    els.backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.modal.classList.contains('is-open')) closeModal();
    });
  }

  async function bootstrap() {
    const ok = await tryLoadData();
    if (ok) {
      showApp();
    } else {
      showLogin();
    }
  }

  async function enterApp() {
    showApp();
    await loadData();
  }

  function showLogin() {
    els.appShell.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    setTimeout(() => els.loginPassword.focus(), 100);
  }

  function showApp() {
    els.loginScreen.classList.add('hidden');
    els.appShell.classList.remove('hidden');
    bindAppEvents();
  }

  async function tryLoadData() {
    try {
      const res = await fetch('/api/customers', { credentials: 'same-origin' });
      if (res.status === 401) return false;
      if (!res.ok) {
        showError(`データ取得に失敗しました (HTTP ${res.status})`);
        return true;
      }
      const data = await res.json();
      applyData(data);
      return true;
    } catch (err) {
      return false;
    }
  }

  async function loadData() {
    els.loading.classList.remove('hidden');
    els.empty.classList.add('hidden');
    els.grid.innerHTML = '';

    try {
      const res = await fetch('/api/customers', { credentials: 'same-origin' });
      if (res.status === 401) {
        showLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data.error || `データ取得に失敗しました (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      applyData(data);
    } catch (err) {
      showError('通信エラー: ' + err.message);
    }
  }

  function applyData(data) {
    allCustomers = (data && data.customers) || [];
    noticeItems = (data && data.notices) || [];
    filteredCustomers = allCustomers.slice();
    updateStats();
    render();
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (err) {}
    allCustomers = [];
    noticeItems = [];
    filteredCustomers = [];
    els.loginPassword.value = '';
    els.loginError.textContent = '';
    showLogin();
  }

  function handleSearch() {
    const q = els.search.value.trim().toLowerCase();
    if (!q) {
      filteredCustomers = allCustomers.slice();
    } else {
      filteredCustomers = allCustomers.filter(c => {
        return [c.name, c.furigana, c.phone, c.address]
          .some(v => v && String(v).toLowerCase().includes(q));
      });
    }
    render();
  }

  function updateStats() {
    els.totalCount.textContent = allCustomers.length;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recent = allCustomers.filter(c => {
      if (!c.timestamp) return false;
      const t = parseDate(c.timestamp);
      return t && t.getTime() >= thirtyDaysAgo;
    }).length;
    els.recentCount.textContent = recent;
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(String(str).replace(/-/g, '/'));
    return isNaN(d.getTime()) ? null : d;
  }

  function render() {
    els.loading.classList.add('hidden');
    els.grid.innerHTML = '';

    if (!filteredCustomers.length) {
      els.empty.classList.remove('hidden');
      els.visibleCount.textContent = '';
      return;
    }
    els.empty.classList.add('hidden');
    els.visibleCount.textContent = filteredCustomers.length + '件';

    const frag = document.createDocumentFragment();
    filteredCustomers.forEach((c, i) => frag.appendChild(buildCard(c, i)));
    els.grid.appendChild(frag);
  }

  function buildCard(c, index) {
    const card = document.createElement('article');
    card.className = 'customer-card';
    card.style.animationDelay = Math.min(index * 0.04, 0.5) + 's';

    card.innerHTML = `
      <div class="card-head">
        <div class="avatar">${escapeHtml(c.initial)}</div>
        <div class="card-name-block">
          <div class="card-name">${escapeHtml(c.name) || '（お名前未入力）'}</div>
          <div class="card-furigana">${escapeHtml(c.furigana)}</div>
        </div>
      </div>
      <div class="card-info">
        ${c.phone ? `<div class="card-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>${escapeHtml(c.phone)}</span>
        </div>` : ''}
        ${c.birthday ? `<div class="card-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/><path d="M22 9 12 2 2 9"/><path d="M6 13h4"/></svg>
          <span>${escapeHtml(c.birthday)}${c.age != null ? ` (${c.age}歳)` : ''}</span>
        </div>` : ''}
        ${c.address ? `<div class="card-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${escapeHtml(c.address)}</span>
        </div>` : ''}
      </div>
      <div class="card-foot">
        <div class="card-date">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${escapeHtml(c.timestamp)}
        </div>
        <div class="card-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openDetail(c));
    return card;
  }

  function openDetail(c) {
    els.modalContent.innerHTML = buildDetailHtml(c);
    els.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    els.modalContent.querySelectorAll('.notice-head').forEach(head => {
      head.addEventListener('click', () => head.parentElement.classList.toggle('is-open'));
    });
    els.modalContent.querySelectorAll('.copyable').forEach(el => {
      el.addEventListener('click', () => copyToClipboard(el.dataset.copy));
    });
  }

  function buildDetailHtml(c) {
    const snsConsent = c.snsConsent || '';
    const isYes = /はい|yes|可|協力|OK|ok/.test(snsConsent);
    const isNo = /いいえ|no|不可|遠慮|難しい/.test(snsConsent);
    const consentClass = isYes ? 'consent-yes' : 'consent-no';
    const consentText = snsConsent || '未回答';

    const noticesHtml = noticeItems.map((n, i) => {
      const num = String(i + 1).padStart(2, '0');
      const body = [];
      if (n.content) body.push('<p>' + escapeHtml(n.content) + '</p>');
      if (n.list && n.list.length) {
        body.push('<ul>' + n.list.map(li => '<li>' + escapeHtml(li) + '</li>').join('') + '</ul>');
      }
      return `
        <div class="notice-item">
          <div class="notice-head">
            <div class="notice-num">${num}</div>
            <div class="notice-title">${escapeHtml(n.title)}</div>
            <div class="notice-toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div class="notice-body">${body.join('')}</div>
        </div>`;
    }).join('');

    return `
      <div class="detail-hero">
        <div class="detail-avatar">${escapeHtml(c.initial)}</div>
        <div class="detail-name-block">
          <div class="detail-eyebrow">— Customer —</div>
          <div class="detail-name">${escapeHtml(c.name) || '（お名前未入力）'}</div>
          <div class="detail-furigana">${escapeHtml(c.furigana)}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">BASIC INFORMATION</div>
        <div class="detail-grid">
          <div class="detail-row">
            <div class="detail-label">生年月日</div>
            <div class="detail-value">${escapeHtml(c.birthday) || '—'}${c.age != null ? `<span class="detail-value-sub">（${c.age}歳）</span>` : ''}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">電話番号</div>
            <div class="detail-value copyable" data-copy="${escapeAttr(c.phone)}" title="クリックでコピー">${escapeHtml(c.phone) || '—'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">ご住所</div>
            <div class="detail-value copyable" data-copy="${escapeAttr(c.address)}" title="クリックでコピー">${escapeHtml(c.address) || '—'}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">登録日時</div>
            <div class="detail-value">${escapeHtml(c.timestamp) || '—'}</div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">SNS掲載のご協力</div>
        <div class="detail-row" style="grid-template-columns: 1fr;">
          <div class="detail-value">
            <span class="consent-badge ${consentClass}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${isYes ? '<path d="M20 6 9 17l-5-5"/>' : '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'}
              </svg>
              ${escapeHtml(consentText)}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">ご注意事項</div>
        ${c.notesConfirmed ? `
        <div class="notice-confirmed">
          <div class="notice-confirmed-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="notice-confirmed-text">
            <strong>ご確認済み</strong> ／ ${escapeHtml(c.notesConfirmed)}
          </div>
        </div>` : ''}
        <div class="notice-list">${noticesHtml}</div>
      </div>
    `;
  }

  function closeModal() {
    els.modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function copyToClipboard(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('コピーしました'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast('コピーしました'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function showToast(msg) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function showError(msg) {
    els.loading.classList.add('hidden');
    els.empty.classList.remove('hidden');
    els.empty.querySelector('.empty-title').textContent = 'エラーが発生しました';
    els.empty.querySelector('.empty-desc').textContent = msg;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(s) { return escapeHtml(s); }

  function debounce(fn, wait) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
