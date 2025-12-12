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
│   └── dev-init.sh           # Session initialization
│
├── src/                      # React frontend (when created)
└── src-tauri/                # Rust backend (when created)
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

**Phase:** 1 (Foundation)
**Status:** Phase 0 complete, beginning implementation

**Next Steps:**
1. Phase 1.1: Project scaffolding (Tauri + React + Vite)
2. Phase 1.2: SQLite setup

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
- **Frontend (React):** ~2,200 LOC - Chat UI, sidebars, onboarding
- **Backend (Rust):** ~1,200 LOC - SQLite, PII scanner, Claude API, Keychain

### Database Tables (5)
- `employees` - Core employee data with work_state
- `conversations` - Chat history with title, summary
- `company` - Required: name + state
- `settings` - App config
- `audit_log` - Redacted request/response log

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

## LOC Budget

| Area | Target |
|------|--------|
| React components | ~1,400 |
| React contexts/hooks | ~600 |
| React utilities | ~100 |
| Rust backend | ~1,200 |
| **Total** | **~3,300** |

Stay lean. If approaching budget, reconsider complexity.

---

## Testing Approach

- **PII Scanner:** Unit tests for regex patterns
- **Context Builder:** Integration tests with mock data
- **UI:** Manual verification at pause points
- **E2E:** Verify at each phase pause point

---

## Reference Documents

| Document | When to Read |
|----------|--------------|
| `HR-Command-Center-Roadmap.md` | For phase context |
| `HR-Command-Center-Design-Architecture.md` | When implementing |
| `docs/reference/DECISIONS-LOG.md` | When questioning approach |
| `docs/reference/MASTER-FEEDBACK-CONSOLIDATED.md` | For feature prioritization |

---

## Common Commands

```bash
# Session start
./scripts/dev-init.sh

# Development (after Phase 1 scaffolding)
npm run dev           # Start dev server
npm run build         # Production build
npm run type-check    # TypeScript check
npm test              # Run tests

# Tauri
cargo tauri dev       # Run Tauri app
cargo tauri build     # Build for distribution
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
*Status: Planning complete, ready for Phase 0*
