-- Roadmap III — WidgetFeed portal + platform event bus
-- portal_widgets: per-operator mounted dashboard widgets (user_id, platform)
-- feed_events: platform webhook / simulation events that surface inside widgets

CREATE TABLE IF NOT EXISTS portal_widgets (
  user_id    TEXT NOT NULL,
  platform   TEXT NOT NULL,
  config     TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, platform)
);

CREATE TABLE IF NOT EXISTS feed_events (
  id         TEXT PRIMARY KEY,
  platform   TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_feed_events_platform ON feed_events(platform, created_at);