const STORAGE_KEY = 'ylhg-shortlink-drafts';
const manifestUrl = new URL('./data/links.json', window.location.href);

const els = {
  total: document.getElementById('stat-total'),
  lookupForm: document.getElementById('lookup-form'),
  lookupInput: document.getElementById('lookup-input'),
  lookupResult: document.getElementById('lookup-result'),
  filterInput: document.getElementById('filter-input'),
  body: document.getElementById('links-body'),
  template: document.getElementById('link-row-template'),
  adminForm: document.getElementById('admin-form'),
  draftList: document.getElementById('draft-list'),
  exportBtn: document.getElementById('export-json'),
  clearBtn: document.getElementById('clear-drafts'),
};

let officialLinks = [];
let drafts = loadDrafts();
let mergedLinks = [];

function loadDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrafts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

async function loadManifest() {
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`讀取失敗：${res.status}`);
  return res.json();
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function siteRoot() {
  return new URL('./', window.location.href);
}

function shortUrl(code) {
  return new URL(encodeURIComponent(code), siteRoot()).href;
}

function renderLookup(entry) {
  if (!entry) {
    els.lookupResult.className = 'result error';
    els.lookupResult.innerHTML = '找不到這個短碼。請確認拼字，或到「短碼列表」查看現有項目。';
    return;
  }
  const url = escapeHtml(entry.url);
  const title = escapeHtml(entry.title || '未命名');
  const code = escapeHtml(entry.code);
  els.lookupResult.className = 'result success';
  els.lookupResult.innerHTML = `
    <div class="result-grid">
      <div><strong>${code}</strong><span>${title}</span></div>
      <div class="result-url">${url}</div>
      <button class="button ghost copy-btn" data-copy="${entry.url}">複製原網址</button>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mergeData() {
  const map = new Map();
  for (const item of officialLinks) map.set(normalizeCode(item.code), item);
  for (const item of drafts) map.set(normalizeCode(item.code), item);
  mergedLinks = Array.from(map.values()).sort((a, b) => normalizeCode(a.code).localeCompare(normalizeCode(b.code), 'zh-Hant'));
}

function renderStats() {
  els.total.textContent = mergedLinks.length;
}

function renderTable(filterText = '') {
  const q = normalizeCode(filterText);
  els.body.innerHTML = '';
  const filtered = mergedLinks.filter(item => {
    const hay = `${item.code} ${item.title || ''} ${item.url || ''} ${item.owner || ''}`.toLowerCase();
    return !q || hay.includes(q);
  });

  if (!filtered.length) {
    els.body.innerHTML = '<tr><td colspan="4" class="empty-row">沒有符合的項目。</td></tr>';
    return;
  }

  for (const item of filtered) {
    const row = els.template.content.cloneNode(true);
    row.querySelector('.code-cell').innerHTML = `<code>${escapeHtml(item.code)}</code><div class="mini-url">${escapeHtml(shortUrl(item.code))}</div>`;
    row.querySelector('.title-cell').innerHTML = `<strong>${escapeHtml(item.title || '')}</strong><div class="mini-meta">${escapeHtml(item.owner || '—')}</div>`;
    row.querySelector('.url-cell').innerHTML = `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>`;
    row.querySelector('.action-cell').innerHTML = `<button class="button tiny copy-btn" data-copy="${item.code}">複製短碼</button>`;
    els.body.appendChild(row);
  }
}

function renderDrafts() {
  els.draftList.innerHTML = '';
  if (!drafts.length) {
    els.draftList.innerHTML = '<li class="muted">目前沒有暫存項目。</li>';
    return;
  }
  for (const item of drafts) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(item.code)}</strong>
        <span>${escapeHtml(item.title || '')}</span>
        <small>${escapeHtml(item.url)}</small>
      </div>
      <button class="button tiny danger" data-remove="${escapeHtml(item.code)}">刪除</button>
    `;
    els.draftList.appendChild(li);
  }
}

function addDraft(payload) {
  const code = normalizeCode(payload.code);
  if (!code || !/^[a-z0-9][a-z0-9-]{1,31}$/.test(code)) {
    throw new Error('短碼格式不正確。');
  }
  if (mergedLinks.some(item => normalizeCode(item.code) === code)) {
    throw new Error('這個短碼已經存在。');
  }
  drafts = [
    ...drafts,
    {
      code,
      title: payload.title.trim(),
      url: payload.url.trim(),
      owner: payload.owner.trim(),
      updatedAt: new Date().toISOString(),
    },
  ];
  saveDrafts();
  mergeData();
  renderAll();
}

function removeDraft(code) {
  const target = normalizeCode(code);
  drafts = drafts.filter(item => normalizeCode(item.code) !== target);
  saveDrafts();
  mergeData();
  renderAll();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(mergedLinks, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'links.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAll() {
  renderStats();
  renderTable(els.filterInput.value);
  renderDrafts();
}

function findEntry(code) {
  const c = normalizeCode(code);
  return mergedLinks.find(item => normalizeCode(item.code) === c);
}

function handleLookup(code) {
  const entry = findEntry(code);
  if (entry) {
    renderLookup(entry);
  } else {
    renderLookup(null);
  }
}

function setupCopyButtons() {
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('.copy-btn');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    const code = normalizeCode(text);
    const value = text.includes('http') ? text : shortUrl(code);
    try {
      btn.dataset.originalText = btn.textContent;
      await navigator.clipboard.writeText(value);
      btn.textContent = '已複製';
      setTimeout(() => { btn.textContent = btn.dataset.originalText || '複製'; }, 1200);
    } catch {
      alert(`已準備複製內容：${value}`);
    }
  });
}

function setupAdminDelete() {
  els.draftList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove]');
    if (!btn) return;
    removeDraft(btn.getAttribute('data-remove'));
  });
}

async function boot() {
  try {
    const data = await loadManifest();
    officialLinks = Array.isArray(data.links) ? data.links : [];
  } catch (err) {
    officialLinks = [];
    console.warn(err);
  }
  mergeData();
  renderAll();
  setupCopyButtons();
  setupAdminDelete();

  els.lookupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleLookup(els.lookupInput.value);
  });

  els.filterInput.addEventListener('input', () => renderTable(els.filterInput.value));

  els.adminForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(els.adminForm);
    try {
      addDraft({
        code: form.get('code'),
        title: form.get('title'),
        url: form.get('url'),
        owner: form.get('owner') || '',
      });
      els.adminForm.reset();
    } catch (error) {
      alert(error.message || '新增失敗');
    }
  });

  els.exportBtn.addEventListener('click', exportJson);
  els.clearBtn.addEventListener('click', () => {
    if (!confirm('確定要清空所有暫存項目嗎？')) return;
    drafts = [];
    saveDrafts();
    mergeData();
    renderAll();
  });
}

boot();
