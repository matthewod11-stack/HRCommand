-- HR Command Center - Initial Schema
-- 5 core tables as defined in HR-Command-Center-Design-Architecture.md

-- Employees: The core employee data
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    job_title TEXT,
    manager_id TEXT,
    hire_date TEXT,
    work_state TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'leave')),
    extra_fields TEXT,  -- JSON for flexible fields
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Conversations: Chat history with metadata
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,  -- For cross-conversation memory
    messages_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Company: Required profile (single row expected)
CREATE TABLE IF NOT EXISTS company (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    industry TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Settings: App configuration (non-secret)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit Log: What was sent to AI (with redacted content)
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    request_redacted TEXT NOT NULL,
    response_text TEXT NOT NULL,
    context_used TEXT,  -- JSON of employee IDs used
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_work_state ON employees(work_state);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_conversation ON audit_log(conversation_id);

-- Full-text search for conversations
CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
    title,
    messages_json,
    summary,
    content='conversations',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS conversations_ai AFTER INSERT ON conversations BEGIN
    INSERT INTO conversations_fts(rowid, title, messages_json, summary)
    VALUES (NEW.rowid, NEW.title, NEW.messages_json, NEW.summary);
END;

CREATE TRIGGER IF NOT EXISTS conversations_ad AFTER DELETE ON conversations BEGIN
    INSERT INTO conversations_fts(conversations_fts, rowid, title, messages_json, summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.messages_json, OLD.summary);
END;

CREATE TRIGGER IF NOT EXISTS conversations_au AFTER UPDATE ON conversations BEGIN
    INSERT INTO conversations_fts(conversations_fts, rowid, title, messages_json, summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.messages_json, OLD.summary);
    INSERT INTO conversations_fts(rowid, title, messages_json, summary)
    VALUES (NEW.rowid, NEW.title, NEW.messages_json, NEW.summary);
END;
