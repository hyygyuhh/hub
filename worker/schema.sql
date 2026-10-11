-- ShelfHub D1 schema

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'android')),
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '[]',
  github_url TEXT NOT NULL DEFAULT '',
  github_stars INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  updated_date TEXT NOT NULL DEFAULT '',
  popularity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS download_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('quark', 'baidu')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_download_sources_app ON download_sources(app_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('app_view', 'download_click')),
  app_id TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_app_created ON events(app_id, created_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
