# HR Command Center — Known Issues & Parking Lot

> **Purpose:** Track issues, blockers, and deferred decisions.
> **Related Docs:** [ROADMAP.md](./ROADMAP.md) | [PROGRESS.md](./PROGRESS.md)
> **Full Decision Log:** [reference/DECISIONS-LOG.md](./reference/DECISIONS-LOG.md)

---

## How to Use This Document

**Add issues here when:**
- You encounter a bug that isn't blocking current work
- You discover something that needs investigation later
- A decision needs to be made but can wait
- You find edge cases that need handling eventually

**Format:**
```markdown
### [PHASE-X] Brief description
**Status:** Open | In Progress | Resolved | Deferred
**Severity:** Blocker | High | Medium | Low
**Discovered:** YYYY-MM-DD
**Description:** What happened / what's the issue
**Workaround:** (if any)
**Resolution:** (when resolved)
```

---

## Locked Architectural Decisions (V1)

These decisions were made during planning and should NOT be revisited during implementation:

| Area | Decision | Rationale |
|------|----------|-----------|
| DB Security | OS sandbox only | Trust macOS security, simpler stack |
| Context | Auto-include relevant employees | Smart retrieval, no confirmation friction |
| PII Action | Auto-redact and notify | No blocking modals, brief notification |
| PII Scope | Financial only (SSN, CC, bank) | Narrow scope, fewer false positives |
| Platform | macOS only | Focus on polish, native Keychain |
| Pricing | $99 one-time | Simple, honest, no subscriptions |
| Offline | Read-only mode | Browse history + employees when offline |
| Memory | Cross-conversation | Compounding value over time |
| Company Profile | Required: name + state | Minimal friction, ensures context |
| License | One-time online validation | Works offline forever after |
| Telemetry | Opt-in anonymous | Onboarding choice |
| Disclaimers | Onboarding acknowledgment only | One-time acceptance |
| Employee Updates | CSV re-import + individual edit | Both bulk and quick-fix supported |
| Work Locations | Single primary per employee | Defer multi-state to V2 |
| Audit Log | Standard (redacted content) | Balance compliance + privacy |
| Crash Reports | Opt-in anonymous telemetry | Respect user choice |
| Doc Ingestion | Not in V1 | Focus on employee context |
| Multi-Company | Not in V1 | Single company per install |

*For full rationale, see [reference/DECISIONS-LOG.md](./reference/DECISIONS-LOG.md)*

---

## Open Issues

*(No issues yet - project in planning phase)*

---

## Resolved Issues

*(Move issues here when resolved)*

---

## Deferred Decisions

These decisions were explicitly deferred to V1.1 or later:

### Multi-State Employee Locations
**Status:** Deferred to V2
**Decision Date:** 2025-12-12
**Context:** Remote workers may work from multiple states. Single primary location chosen for V1 simplicity.
**Revisit When:** Users request this feature

### Document/PDF Ingestion
**Status:** Deferred to V2
**Decision Date:** 2025-12-12
**Context:** Uploading company handbooks/policies for context. Adds RAG complexity.
**Revisit When:** Employee context proves valuable and users request document support

### Multi-Company Support
**Status:** Deferred to V2
**Decision Date:** 2025-12-12
**Context:** HR consultants with multiple clients might want company switching.
**Revisit When:** Consultants become a significant user segment

### Keyboard Shortcuts
**Status:** Deferred to V1.1
**Decision Date:** 2025-12-12
**Context:** Cmd+N, Cmd+K, etc. Nice for power users but not essential for V1.
**Revisit When:** After launch, easy to add

### Windows/Linux Support
**Status:** Deferred to V2
**Decision Date:** 2025-12-12
**Context:** macOS only for V1 to focus on polish and use native Keychain.
**Revisit When:** Market demand proves significant

### Expanded PII Detection (Medical/Immigration)
**Status:** Deferred to V2
**Decision Date:** 2025-12-12
**Context:** Financial PII only (SSN, CC, bank) to reduce false positives.
**Revisit When:** Users report accidentally sending medical/immigration data

### Interactive Analytics Panel (Natural Language → Charts)
**Status:** Deferred to V2
**Decision Date:** 2025-12-13
**Context:** A collapsible analytics panel that renders beautiful, interactive charts/graphs in response to natural language queries in the chat. Examples:
- "Show me employee breakdown by department" → pie/bar chart appears
- "What's the gender breakdown on the engineering team?" → chart updates
- "Now show me by tenure" → drills deeper, chart animates to new view
- "Compare marketing vs sales headcount over time" → line chart

**Implementation Ideas:**
- Use a charting library (Recharts, Chart.js, or D3) for rich visualizations
- Claude extracts structured data intent from natural language
- Charts live in a dedicated panel (possibly replacing or alongside context panel)
- Smooth animations between chart states for "conversational" feel
- Export charts as images for reports

**Complexity:** High — requires structured data extraction, chart rendering, state management
**Value:** Very high — transforms the app from Q&A tool to visual analytics assistant
**Revisit When:** Core V1 features stable; could be flagship V2 feature

---

## Edge Cases to Handle

| Case | Phase | Priority | Notes |
|------|-------|----------|-------|
| CSV with 1000+ employees | 2 | Medium | May need pagination/lazy loading |
| Very long conversation history | 2 | Medium | Memory retrieval may slow down |
| Offline during onboarding | 4 | Low | Can't validate API key offline |
| License server unreachable | 5 | Medium | Need grace period strategy |

---

## Technical Debt

*(Track technical shortcuts that need revisiting)*

| Item | Phase Created | Priority | Notes |
|------|---------------|----------|-------|
| *(none yet)* | | | |

---

*Last updated: December 2025*
