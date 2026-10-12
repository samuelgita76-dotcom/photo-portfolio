CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS links_created_at_idx ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS links_expires_at_idx ON links(expires_at);
