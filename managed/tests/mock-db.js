export class MockDB {
  constructor(seed = []) {
    this.links = new Map(seed.map((item) => [item.code, { ...item }]));
    this.clicks = [];
  }
  prepare(sql) {
    const db = this;
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      _binds: [],
      bind(...args) { this._binds = args; return this; },
      async first() { return db._first(normalized, this._binds); },
      async all() { return db._all(normalized, this._binds); },
      async run() { return db._run(normalized, this._binds); },
    };
  }
  _first(sql, binds) {
    if (sql.includes('FROM links WHERE code = ?')) return this.links.get(binds[0]) || null;
    if (sql.includes('SELECT COUNT(*) AS total FROM links')) return { total: this.links.size };
    if (sql.includes('SELECT COUNT(*) AS active FROM links WHERE enabled = 1')) return { active: [...this.links.values()].filter(x => x.enabled).length };
    if (sql.includes('SELECT COALESCE(SUM(click_count), 0) AS clicks FROM links')) return { clicks: [...this.links.values()].reduce((n, x) => n + (x.click_count || 0), 0) };
    if (sql.includes('SELECT MAX(updated_at) AS latest FROM links')) return { latest: [...this.links.values()].reduce((m, x) => !m || x.updated_at > m ? x.updated_at : m, null) };
    return null;
  }
  _all(sql, binds) {
    if (sql.includes('ORDER BY updated_at DESC, code ASC')) {
      const rows = [...this.links.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.code.localeCompare(b.code));
      return { results: rows };
    }
    if (sql.includes('ORDER BY click_count DESC, updated_at DESC')) {
      const rows = [...this.links.values()].sort((a, b) => (b.click_count || 0) - (a.click_count || 0) || b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
      return { results: rows };
    }
    if (sql.includes('FROM clicks ORDER BY created_at DESC LIMIT 8')) {
      return { results: [...this.clicks].slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8) };
    }
    return { results: [] };
  }
  _run(sql, binds) {
    if (sql.startsWith('INSERT INTO links')) {
      const [code, title, url, owner, note, enabled, created_at, updated_at] = binds;
      this.links.set(code, { code, title, url, owner, note, enabled: !!enabled, click_count: 0, last_clicked_at: null, created_at, updated_at });
      return { success: true };
    }
    if (sql.startsWith('UPDATE links SET title = ?, url = ?, owner = ?, note = ?, enabled = ?, updated_at = ? WHERE code = ?')) {
      const [title, url, owner, note, enabled, updated_at, code] = binds;
      const row = this.links.get(code);
      if (row) Object.assign(row, { title, url, owner, note, enabled: !!enabled, updated_at });
      return { success: true };
    }
    if (sql.startsWith('UPDATE links SET click_count = click_count + 1')) {
      const [last_clicked_at, updated_at, code] = binds;
      const row = this.links.get(code);
      if (row) Object.assign(row, { click_count: (row.click_count || 0) + 1, last_clicked_at, updated_at });
      return { success: true };
    }
    if (sql.startsWith('INSERT INTO clicks')) {
      const [code, referer, user_agent, ip, created_at] = binds;
      this.clicks.push({ code, referer, user_agent, ip, created_at });
      return { success: true };
    }
    if (sql.startsWith('DELETE FROM links WHERE code = ?')) {
      this.links.delete(binds[0]);
      return { success: true };
    }
    if (sql.startsWith('DELETE FROM clicks WHERE code = ?')) {
      this.clicks = this.clicks.filter((x) => x.code !== binds[0]);
      return { success: true };
    }
    return { success: true };
  }
}
