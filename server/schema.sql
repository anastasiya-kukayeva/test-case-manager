CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  release_number TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  test_object TEXT NOT NULL DEFAULT '',
  test_object_links JSONB NOT NULL DEFAULT '[]',
  application TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT '',
  test_goal JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  general_provisions TEXT NOT NULL DEFAULT '',
  functional_requirements JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  risks_and_limitations JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  number TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  developer TEXT NOT NULL DEFAULT '',
  business_analyst TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  goal JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  goal_images JSONB NOT NULL DEFAULT '[]',
  preconditions TEXT NOT NULL DEFAULT '',
  steps JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  verification_result JSONB NOT NULL DEFAULT '{"html":"","plainText":""}',
  verification_attachments JSONB NOT NULL DEFAULT '[]',
  test_outcome TEXT NOT NULL,
  include_in_regression BOOLEAN NOT NULL DEFAULT false,
  include_in_task_regression BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS test_cases_task_id_idx ON test_cases(task_id);

CREATE TABLE IF NOT EXISTS directory_people (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('author', 'developer', 'businessAnalyst')),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS directory_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS directory_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS directory_environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('task', 'case')),
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_log (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
