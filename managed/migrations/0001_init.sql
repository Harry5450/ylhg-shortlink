DROP TABLE IF EXISTS clicks;
DROP TABLE IF EXISTS links;

CREATE TABLE links (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  referer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY(code) REFERENCES links(code) ON DELETE CASCADE
);

CREATE INDEX idx_links_updated_at ON links(updated_at DESC);
CREATE INDEX idx_links_click_count ON links(click_count DESC);
CREATE INDEX idx_clicks_code_created_at ON clicks(code, created_at DESC);

INSERT INTO links (code, title, url, owner, note, enabled, click_count, created_at, updated_at) VALUES
  ('meeting', '縣務會議入口', 'https://www.ylhg.gov.tw/', '秘書處', '官方入口', 1, 0, '2026-06-23T00:00:00Z', '2026-06-23T00:00:00Z'),
  ('news2026', '年度新聞稿彙整', 'https://www.ylhg.gov.tw/news', '新聞科', '年度專區', 1, 0, '2026-06-23T00:00:00Z', '2026-06-23T00:00:00Z'),
  ('procurement', '採購資訊專區', 'https://www.ylhg.gov.tw/procurement', '採購課', '採購公告', 1, 0, '2026-06-23T00:00:00Z', '2026-06-23T00:00:00Z'),
  ('contact', '聯絡窗口', 'https://www.ylhg.gov.tw/contact', '資訊室', '聯絡我們', 1, 0, '2026-06-23T00:00:00Z', '2026-06-23T00:00:00Z');
