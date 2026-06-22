const CODE_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const RESERVED = new Set(['api', 'assets', 'favicon.svg', 'favicon.ico', '404.html', 'index.html']);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function text(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

function validateUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('只允許 http / https 網址');
  }
  return url.toString();
}

function requireAdmin(request, env) {
  const token = env.ADMIN_TOKEN || '';
  if (!token) return null;
  const auth = request.headers.get('authorization') || request.headers.get('x-admin-token') || '';
  const provided = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : auth.trim();
  if (provided && provided === token) return null;
  return json({ ok: false, error: 'unauthorized' }, 401, {
    'www-authenticate': 'Bearer realm="YLHG Shortlink"',
  });
}

function requireJson(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type 必須是 application/json');
  }
}

async function readJson(request) {
  return await request.json();
}

function isAssetPath(pathname) {
  if (pathname === '/' || pathname === '/index.html') return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/favicon.svg' || pathname === '/favicon.ico' || pathname === '/404.html') return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

function toShortUrl(origin, code) {
  return new URL(`/${encodeURIComponent(code)}`, origin).toString();
}

async function listLinks(env, origin) {
  const rows = await env.DB.prepare(
    `SELECT code, title, url, owner, note, enabled, click_count, last_clicked_at, created_at, updated_at
     FROM links
     ORDER BY updated_at DESC, code ASC`
  ).all();
  const links = (rows.results || []).map((row) => ({
    ...row,
    short_url: toShortUrl(origin, row.code),
    enabled: Boolean(row.enabled),
  }));
  return links;
}

async function getLink(env, code) {
  return await env.DB.prepare(
    `SELECT code, title, url, owner, note, enabled, click_count, last_clicked_at, created_at, updated_at
     FROM links WHERE code = ?`
  ).bind(code).first();
}

async function getStats(env) {
  const total = await env.DB.prepare('SELECT COUNT(*) AS total FROM links').first();
  const active = await env.DB.prepare('SELECT COUNT(*) AS active FROM links WHERE enabled = 1').first();
  const clicks = await env.DB.prepare('SELECT COALESCE(SUM(click_count), 0) AS clicks FROM links').first();
  const latest = await env.DB.prepare('SELECT MAX(updated_at) AS latest FROM links').first();
  const top = await env.DB.prepare(
    `SELECT code, title, click_count, last_clicked_at
     FROM links
     ORDER BY click_count DESC, updated_at DESC
     LIMIT 5`
  ).all();
  const recentClicks = await env.DB.prepare(
    `SELECT code, referer, user_agent, ip, created_at
     FROM clicks
     ORDER BY created_at DESC
     LIMIT 8`
  ).all();
  return {
    summary: {
      total_links: total?.total || 0,
      active_links: active?.active || 0,
      total_clicks: clicks?.clicks || 0,
      latest_update: latest?.latest || null,
    },
    top_links: top.results || [],
    recent_clicks: recentClicks.results || [],
  };
}

function badRequest(message) {
  return json({ ok: false, error: message }, 400);
}

function notFound(message = 'not found') {
  return json({ ok: false, error: message }, 404);
}

function conflict(message) {
  return json({ ok: false, error: message }, 409);
}

function sanitizePayload(payload, { partial = false } = {}) {
  const out = {};
  if (!partial || payload.code !== undefined) {
    const code = normalizeCode(payload.code);
    if (!CODE_RE.test(code) || RESERVED.has(code)) {
      throw new Error('短碼格式不正確，或已保留');
    }
    out.code = code;
  }
  if (!partial || payload.title !== undefined) {
    const title = String(payload.title || '').trim();
    if (!title) throw new Error('標題不可空白');
    out.title = title;
  }
  if (!partial || payload.url !== undefined) {
    out.url = validateUrl(payload.url);
  }
  if (payload.owner !== undefined) out.owner = String(payload.owner || '').trim();
  if (payload.note !== undefined) out.note = String(payload.note || '').trim();
  if (payload.enabled !== undefined) out.enabled = Boolean(payload.enabled);
  return out;
}

async function createLink(request, env, origin) {
  requireJson(request);
  const body = sanitizePayload(await readJson(request));
  const exists = await getLink(env, body.code);
  if (exists) return conflict('短碼已存在');
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO links (code, title, url, owner, note, enabled, click_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(body.code, body.title, body.url, body.owner || '', body.note || '', body.enabled !== false ? 1 : 0, now, now).run();
  const created = await getLink(env, body.code);
  return json({ ok: true, link: { ...created, enabled: Boolean(created.enabled), short_url: toShortUrl(origin, created.code) } }, 201);
}

async function updateLink(request, env, code, origin) {
  requireJson(request);
  const existing = await getLink(env, code);
  if (!existing) return notFound('短碼不存在');
  const body = sanitizePayload(await readJson(request), { partial: true });
  const next = {
    title: body.title ?? existing.title,
    url: body.url ?? existing.url,
    owner: body.owner ?? existing.owner ?? '',
    note: body.note ?? existing.note ?? '',
    enabled: body.enabled ?? Boolean(existing.enabled),
  };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE links
     SET title = ?, url = ?, owner = ?, note = ?, enabled = ?, updated_at = ?
     WHERE code = ?`
  ).bind(next.title, next.url, next.owner, next.note, next.enabled ? 1 : 0, now, code).run();
  const updated = await getLink(env, code);
  return json({ ok: true, link: { ...updated, enabled: Boolean(updated.enabled), short_url: toShortUrl(origin, updated.code) } });
}

async function deleteLink(env, code) {
  const existing = await getLink(env, code);
  if (!existing) return notFound('短碼不存在');
  await env.DB.prepare('DELETE FROM links WHERE code = ?').bind(code).run();
  await env.DB.prepare('DELETE FROM clicks WHERE code = ?').bind(code).run();
  return json({ ok: true, deleted: code });
}

async function recordClick(env, code, request) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE links SET click_count = click_count + 1, last_clicked_at = ?, updated_at = ? WHERE code = ?`
  ).bind(now, now, code).run();
  await env.DB.prepare(
    `INSERT INTO clicks (code, referer, user_agent, ip, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    code,
    request.headers.get('referer') || '',
    request.headers.get('user-agent') || '',
    request.headers.get('cf-connecting-ip') || '',
    now
  ).run();
}

async function routeApi(request, env) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // api / links / code

  if (parts[1] === 'links' && parts.length === 2) {
    if (request.method === 'GET') {
      const links = await listLinks(env, url.origin);
      const stats = await getStats(env);
      return json({ ok: true, links, stats });
    }
    if (request.method === 'POST') return await createLink(request, env, url.origin);
    return text('Method Not Allowed', 405, { allow: 'GET, POST' });
  }

  if (parts[1] === 'links' && parts.length === 3) {
    const code = normalizeCode(parts[2]);
    if (!CODE_RE.test(code) || RESERVED.has(code)) return notFound('短碼不存在');
    if (request.method === 'GET') {
      const link = await getLink(env, code);
      if (!link) return notFound('短碼不存在');
      return json({ ok: true, link: { ...link, enabled: Boolean(link.enabled), short_url: toShortUrl(url.origin, link.code) } });
    }
    if (request.method === 'PUT' || request.method === 'PATCH') return await updateLink(request, env, code, url.origin);
    if (request.method === 'DELETE') return await deleteLink(env, code);
    return text('Method Not Allowed', 405, { allow: 'GET, PUT, PATCH, DELETE' });
  }

  if (parts[1] === 'stats' && parts.length === 2) {
    if (request.method !== 'GET') return text('Method Not Allowed', 405, { allow: 'GET' });
    return json({ ok: true, ...(await getStats(env)) });
  }

  return notFound('API not found');
}

async function serveStatic(request, env) {
  if (!env.ASSETS) return text('Static assets binding missing', 500);
  return env.ASSETS.fetch(request);
}

async function handleRedirect(request, env, code) {
  code = normalizeCode(code);
  if (!CODE_RE.test(code) || RESERVED.has(code)) {
    return serveStatic(new Request(new URL('/404.html', request.url), request), env);
  }
  const row = await env.DB.prepare(
    'SELECT code, url, title, enabled FROM links WHERE code = ?'
  ).bind(code).first();
  if (!row || !row.enabled) {
    return serveStatic(new Request(new URL('/404.html', request.url), request), env);
  }
  await recordClick(env, code, request);
  return Response.redirect(row.url, 302);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return routeApi(request, env, ctx);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return text('Method Not Allowed', 405, { allow: 'GET, HEAD' });
    }
    if (url.pathname === '/' || url.pathname === '/index.html' || isAssetPath(url.pathname)) {
      return serveStatic(request, env);
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 1) {
      return handleRedirect(request, env, parts[0]);
    }
    return serveStatic(new Request(new URL('/404.html', url), request), env);
  },
};
