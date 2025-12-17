# HR Command Center — Claude Code Instructions

> **Vision:** Your company's HR brain—private, always in context, always ready to help.
> **Stack:** Tauri + React + Vite + SQLite + Claude API
> **Platform:** macOS only (V1)

---

## Quick Start

```bash
# Start every session with:
./scripts/dev-init.sh
```

This verifies the environment and shows current progress.

---

## Project Structure

```
HRCommand/
├── README.md                 # Project overview & status (update on phase change)
├── CLAUDE.md                 # ← You are here
├── HR-Command-Center-Roadmap.md      # Full product roadmap
├── HR-Command-Center-Design-Architecture.md  # Technical specification
├── features.json             # Pass/fail feature tracking
│
├── docs/
│   ├── PROGRESS.md           # Session log (most recent at TOP)
│   ├── ROADMAP.md            # Task checklist with phases
│   ├── SESSION_PROTOCOL.md   # How to run sessions
│   ├── KNOWN_ISSUES.md       # Blockers + locked decisions
│   └── reference/            # Archive: feedback, decisions log
│
├── scripts/
│   ├── dev-init.sh           # Session initialization
│   └── generate-test-data.ts # Test data generator
│
├── src/                      # React frontend
│   ├── components/           # UI components (chat, employees, import, settings)
│   ├── contexts/             # React context providers
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Types, Tauri command wrappers
│
└── src-tauri/                # Rust backend
    ├── src/
    │   ├── lib.rs            # Tauri command exports
    │   ├── db.rs             # SQLite connection + migrations
    │   ├── chat.rs           # Claude API client + streaming
    │   ├── context.rs        # Context builder + Alex persona
    │   ├── employees.rs      # Employee CRUD
    │   └── ...               # Additional modules
    └── migrations/           # SQL migration files
```

---

## Session Protocol

### This is a Multi-Session Project

Follow the **single-feature-per-session rule** to prevent scope creep.

### Before Working
1. Run `./scripts/dev-init.sh`
2. Read `docs/PROGRESS.md` for context
3. Check `docs/ROADMAP.md` for next task
4. Check `docs/KNOWN_ISSUES.md` for blockers

### After Each Task
1. Update `docs/PROGRESS.md` (entry at TOP)
2. Update `features.json` status
3. Check off task in `docs/ROADMAP.md`
4. Update `README.md` if phase status changed
5. Commit with descriptive message

### Session End Prompt
```
Before ending: Please follow session end protocol:
1. Run verification (build, type-check, tests)
2. Add session entry to TOP of docs/PROGRESS.md
3. Update features.json with pass/fail status
4. Check off completed task in docs/ROADMAP.md
5. Update README.md project status table if phase changed
6. Commit with descriptive message

What's the "Next Session Should" note for PROGRESS.md?
```

---

## Current Phase

**Phase:** 2 (Context)
**Status:** Phase 2.5 (Conversation Management) in progress

**In Progress (2.5):**
- 2.5.1: Backend complete (conversations.rs CRUD, 7 Tauri commands, 7 tests)
- Implementation plan: `~/.claude/plans/glowing-zooming-kite.md`

**Remaining (2.5):**
- ConversationContext.tsx (state management)
- ConversationSidebar UI (tabbed layout with Employees)
- Wire sidebar to chat area

**Completed (2.4):**
- memory.rs, useConversationSummary hook, Cmd+N shortcut, memories in context

**Next Steps:**
1. Complete Phase 2.5 frontend (ConversationContext, ConversationSidebar)
2. Phase 2.6: Stickiness features (prompt suggestions)

---

## Key Decisions (Do NOT Revisit)

| Area | Decision |
|------|----------|
| DB Security | OS sandbox only (no encryption at rest) |
| Context | Auto-include relevant employees |
| PII | Auto-redact and notify (no blocking modal) |
| PII Scope | Financial only (SSN, CC, bank) |
| Platform | macOS only |
| Offline | Read-only mode |
| Memory | Cross-conversation |
| Pricing | $99 one-time |

Full list in `docs/KNOWN_ISSUES.md` under "Locked Architectural Decisions"

---

## Architecture Summary

### Data Flow
```
User Input → PII Scan → Context Builder → Memory Lookup → Claude API → Audit Log → Response
```

### Key Components
- **Frontend (React):** Chat UI, employee panels, import wizards, settings
- **Backend (Rust):** SQLite, context builder, Claude API client, Keychain

### Database Tables (9)
- `employees` - Core employee data with work_state, demographics, termination
- `conversations` - Chat history with title, summary
- `company` - Required: name + state
- `settings` - Key-value app config
- `audit_log` - Redacted request/response log
- `review_cycles` - Performance review periods
- `performance_ratings` - Numeric ratings (1.0-5.0)
- `performance_reviews` - Text narratives with FTS
- `enps_responses` - Employee Net Promoter Score

### Key Modules (Rust)
| Module | Purpose | Tests |
|--------|---------|-------|
| `context.rs` | Query extraction, employee retrieval, Alex persona prompt | 25 |
| `chat.rs` | Claude API, streaming, conversation trimming | 8 |
| `memory.rs` | Cross-conversation memory, summary generation, hybrid search | 8 |
| `conversations.rs` | Conversation CRUD, FTS search, title generation | 7 |
| `employees.rs` | Employee CRUD | - |
| `company.rs` | Company profile CRUD | - |
| `settings.rs` | Key-value settings store | - |

---

## Code Style

### React/TypeScript
- Functional components with hooks
- React Context for state (no Redux/Zustand)
- Tailwind CSS with design tokens from architecture doc
- TypeScript strict mode

### Rust
- SQLx for database (raw SQL, no ORM)
- Tauri commands for frontend communication
- All sensitive operations in Rust (API keys, PII scanning)

---

## Testing Approach

- **Context Builder:** 25 unit tests (query extraction, token estimation)
- **Chat Module:** 8 unit tests (trimming, message handling)
- **PII Scanner:** Unit tests for regex patterns (Phase 3)
- **UI:** Manual verification at pause points
- **E2E:** Verify at each phase pause point

Run tests: `cargo test --manifest-path src-tauri/Cargo.toml`

---

## Reference Documents

| Document | When to Read |
|----------|--------------|
| `HR-Command-Center-Roadmap.md` | For phase context |
| `HR-Command-Center-Design-Architecture.md` | When implementing |
| `docs/reference/DECISIONS-LOG.md` | When questioning approach |
| `docs/HR_PERSONA.md` | Alex persona system prompt |

---

## Common Commands

```bash
# Session start
./scripts/dev-init.sh

# Development
npm run dev           # Start Vite dev server
npm run build         # Production build
npm run type-check    # TypeScript check
cargo tauri dev       # Run Tauri app
cargo tauri build     # Build for distribution

# Testing
cargo test --manifest-path src-tauri/Cargo.toml           # All Rust tests
cargo test --manifest-path src-tauri/Cargo.toml context   # Context tests
cargo test --manifest-path src-tauri/Cargo.toml chat      # Chat tests

# Test data
npm run generate-test-data     # Generate test employees
npm run import-test-data       # Import to SQLite
```

---

## Commit Message Format

```
[Phase X.Y] Brief description

- Detail 1
- Detail 2

Session: YYYY-MM-DD
```

---

*Last updated: December 2025*
*Status: Phase 2.3 complete (Context Builder with trimming)*
