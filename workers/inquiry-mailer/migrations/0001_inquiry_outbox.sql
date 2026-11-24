-- Additive, safe to run before deploying the queued mailer.
CREATE TABLE IF NOT EXISTS inquiry_outbox (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','submitted','failed','ambiguous')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  next_attempt_at INTEGER NOT NULL,
  enqueue_after INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_expires_at INTEGER,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS inquiry_dispatch_due ON inquiry_outbox(status, enqueue_after, next_attempt_at);
CREATE INDEX IF NOT EXISTS inquiry_retention ON inquiry_outbox(created_at);
