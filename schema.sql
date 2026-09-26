-- MDD Studio müşteri hesapları (Cloudflare D1, binding adı: DB)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  address TEXT,
  city TEXT,
  pass_hash TEXT,
  pass_salt TEXT,
  pass_iter INTEGER,
  google_sub TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS tokens (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Siparişler (havale/EFT ve ileride kartlı ödeme)
-- status: awaiting_payment → paid → invoiced | cancelled
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                 -- sipariş no (MDD...)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  pay_method TEXT NOT NULL,            -- havale | kart
  user_id TEXT,
  buyer_json TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  total INTEGER NOT NULL,
  admin_token_hash TEXT NOT NULL,      -- mağaza e-postasındaki yönetim bağlantısının özeti
  paid_at INTEGER,
  invoice_no TEXT,
  invoice_uuid TEXT,
  invoice_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
