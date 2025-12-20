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

### [PHASE-2.1] file_parser::tests::test_normalize_header test failure
**Status:** Open → Planned fix in Feature #14
**Severity:** Low
**Discovered:** 2025-12-17
**Description:** The `test_normalize_header` test in file_parser.rs is failing. Test expects header normalization to produce "email" but receives different value.
**Workaround:** Test can be skipped; file parsing works correctly in production.
**Resolution:** Will be addressed by **Data Quality Center** (Feature #14) — strengthen normalization rules and add HRIS-specific header mappings with golden tests.

---

## Resolved Issues

### [PHASE-2.6] Selected employee not prioritized in context
**Status:** Resolved
**Severity:** Medium
**Discovered:** 2025-12-18
**Resolved:** 2025-12-18
**Description:** When a user selects an employee from the People tab and asks a question about them (e.g., "How does Amanda compare to the team?"), the context builder didn't know about the selection. It extracted "Amanda" from the query and returned all employees with that name instead of prioritizing the selected one.
**Resolution:** Task 2.7.0 implemented — `selected_employee_id` is now passed from UI → ConversationContext → getSystemPrompt → build_chat_context → find_relevant_employees. The selected employee is always fetched first and prepended to the context results.

---

## V2 Feature Candidates

Features deferred from V1, organized by category. Use this to prioritize pre-launch additions.

---

### Recommended V2 Cutline

**🚀 Pre-Launch Wins (Low lift, high value):**
| Feature | Sessions | Why Now |
|---------|----------|---------|
| API Key Guide (enhanced) | 1 | Removes biggest onboarding friction |
| Command Palette + Shortcuts | 1 | Power user polish, easy win |
| Review Highlights Pipeline | 1-2 | Fixes long review context issue |
| Explainability & Citations | 1 | Trust + transparency |

**⚡ Stretch Goals (Medium lift):**
| Feature | Sessions | Why Consider |
|---------|----------|--------------|
| Org Chart MVP | 2-3 | Visual hierarchy, data exists |
| Analytics Panel MVP | 3-4 | Templated queries + drilldowns |
| Data Quality Center | 2-3 | Mapping + validation + fix workflow |
| Attrition Signals (basic) | 2 | Proactive value, strong disclaimers |

**📅 Later (High lift, defer until demand):**
- Document/PDF Ingestion (3-4 sessions)
- Compensation Data with sensitive mode (3-4 sessions)
- Multi-Company / Workspaces (3+ sessions)
- Windows/Linux Support (5+ sessions)
- DEI & Fairness Lens (3-4 sessions)

---

### Summary Table — All Features

#### Core Product Features

| # | Feature | Impact | Complexity | Sessions | Category |
|---|---------|--------|------------|----------|----------|
| 1 | Interactive Analytics Panel | 🔥 Very High | High | 4-6 | Visualization |
| 2 | API Key Guide (enhanced) | 🔥 High | Low | 1 | Onboarding |
| 3 | Org Chart View | 🔥 High | Medium | 2-3 | Visualization |
| 4 | Persona Switcher | ⚡ Medium | Low | 1 | UX |
| 5 | Document/PDF Ingestion | ⚡ Medium | High | 3-4 | Data |
| 6 | Compensation Data | ⚡ Medium | High | 3-4 | Data |
| 7 | Command Palette + Shortcuts | ⚡ Medium | Low | 1 | UX |
| 8 | Multi-State Locations | 💡 Low | Medium | 1-2 | Data |
| 9 | Expanded PII Detection | 💡 Low | Medium | 1-2 | Security |
| 10 | Multi-Company Support | 💡 Low | Medium | 3 | Data |
| 11 | Windows/Linux Support | 💡 Low | High | 5+ | Platform |

#### New Feature Categories

| # | Feature | Impact | Complexity | Sessions | Category |
|---|---------|--------|------------|----------|----------|
| 12 | Attrition & Sentiment Signals | 🔥 High | Medium | 2-3 | Intelligence |
| 13 | DEI & Fairness Lens | ⚡ Medium | High | 3-4 | Intelligence |
| 14 | Data Quality Center | 🔥 High | Medium | 2-3 | Import/Export |
| 15 | Review Highlights Pipeline | 🔥 High | Medium | 1-2 | Context/LLM |
| 16 | Query-Adaptive Retrieval v2 | ⚡ Medium | Medium | 2 | Context/LLM |
| 17 | Answer Verification Mode | ⚡ Medium | Low | 1 | Context/LLM |
| 18 | Safe Share Packs | ⚡ Medium | Medium | 2 | Security |
| 19 | Tamper-Evident Audit | 💡 Low | Medium | 1-2 | Security |
| 20 | Optional Local DB Encryption | 💡 Low | Medium | 2 | Security |
| 21 | HRIS Templates | ⚡ Medium | Medium | 2 | Import/Export |
| 22 | Bulk Actions & Backfills | ⚡ Medium | Medium | 1-2 | Import/Export |
| 23 | Keyboard Navigation Complete | 💡 Low | Low | 1 | Accessibility |
| 24 | Branding & Theming | 💡 Low | Low | 1 | UX |

**Legend:** 🔥 High impact | ⚡ Medium | 💡 Low priority

---

### 1. Interactive Analytics Panel (Natural Language → Charts)
**Impact:** 🔥 Very High | **Complexity:** High | **Est. Sessions:** 4-6
**Category:** Visualization

A collapsible analytics panel that renders beautiful, interactive charts/graphs in response to natural language queries in the chat.

**Examples:**
- "Show me employee breakdown by department" → pie/bar chart appears
- "What's the gender breakdown on the engineering team?" → chart updates
- "Now show me by tenure" → drills deeper, chart animates to new view
- "Compare marketing vs sales headcount over time" → line chart

**Why This Is Compelling (Product):**
- Turns "answers" into **artifacts** (charts you can reference, export, and share)
- Reduces back-and-forth: users can **iterate visually** ("filter to active", "only CA")
- Makes the app feel like an **HR cockpit**, not just a chat box (flagship differentiator)

**V2 Enhancements (beyond MVP):**
- Whitelisted NL→SQL templates (safe, deterministic queries)
- Live breakdowns by dept/level/location
- Drilldowns from chart → employee list
- Saved charts / pinned insights
- Export to CSV/PDF
- "Insert chart into chat" for sharing context

**Technical Contract (Keep It Deterministic):**
- Claude emits **structured analytics request** (intent + filters + grouping)
- Rust runs deterministic SQLite query, returns **dataset + applied filters**
- React renders from **chart spec + dataset**
- Never let Claude generate numbers — source all aggregates from SQL

**UX Principles:**
- Chat remains control surface; panel is result view
- One chart at a time (no dashboards)
- Graceful fallback to text if query can't be charted
- Show "Filters applied" caption for explainability

**Why Flagship V2:** Transforms the app from Q&A tool to visual analytics assistant.

---

### 2. Beginner-Friendly API Key Setup Guide (Enhanced)
**Impact:** 🔥 High | **Complexity:** Low | **Est. Sessions:** 1
**Category:** Onboarding | **Pre-Launch:** ✅ Recommended

The current API key setup just links to console.anthropic.com with minimal guidance — intimidating for HR professionals who've never used an API.

**The Problem:**
- Target users are HR leaders, not developers
- "Get your key from console.anthropic.com" is jargon
- No explanation of what an API key is or why it costs money

**Proposed Solution — In-App Guided Walkthrough:**
1. **What is this?** — Plain-English: "An API key lets this app talk to Claude. Think of it like a password that connects you to the brain behind the app."
2. **Why does it cost money?** — "Claude is powered by Anthropic. You pay them directly — typically $5-20/month for normal HR use."
3. **Step-by-step screenshots:** Account creation → billing → key generation → paste here
4. **Troubleshooting tips:** Common errors (invalid key, billing not set up)

**V2 Enhancements:**
- **Inline test call** — Verify key works before proceeding
- **Usage cost estimator** — "Based on typical usage, expect ~$X/month"
- **Masked copy** — Show key as `sk-ant-...xxxx` with copy button
- **Error-specific fixes** — Detect billing/permissions issues, show targeted guidance
- **Sample mode** — "Try before you buy" with limited free queries to demonstrate value

---

### 3. Org Chart View (Interactive Hierarchy Visualization)
**Impact:** 🔥 High | **Complexity:** Medium | **Est. Sessions:** 2-3
**Category:** Visualization

Visual organizational hierarchy — data already exists via `employees.manager_id`.

**Why This Is Compelling:**
- **Visual understanding** of reporting relationships at a glance
- **Navigate by clicking** — expand direct reports, see chain of command
- **Natural complement** to chat — "Who reports to Sarah?" becomes visual
- **Onboarding tool** — new HR users quickly understand org structure

**MVP Features:**
- Tree/hierarchy view with manager → direct reports
- Click to expand/collapse branches
- Click employee to select (syncs with People panel)
- Search/filter to find people in tree
- Zoom/pan for large orgs
- Department color coding

**V2 Enhancements:**
- **Metric overlays** — Span of control, tenure, latest rating on hover
- **Search + mini-map** — Quick navigation in large orgs
- **Export to PNG/PDF** — For presentations and reports
- **"What-if" sandbox** — Drag to simulate reorg (not persisted), see impact on span of control

**Technical Approach:**
- Tree visualization library (react-org-chart, D3 hierarchy, or GoJS)
- New Rust query: `get_org_tree()` returns nested structure
- Separate route/page or People panel view toggle

---

### 4. Persona Switcher (Pre-Built HR Personas)
**Impact:** ⚡ Medium | **Complexity:** Low | **Est. Sessions:** 1
**Category:** UX

V1 ships with "Alex" (warm, practical VP of People Ops). V2 offers multiple curated personas.

**Candidate Personas:**

| Persona | Style | Best For |
|---------|-------|----------|
| **Alex** (default) | Warm, practical, conversational | General HR leadership |
| **Jordan** | Formal, compliance-focused | Regulated industries |
| **Sam** | Startup-friendly, direct | Early-stage, lean HR |
| **Morgan** | Data-driven, analytical | Metrics-focused users |
| **Taylor** | Employee-advocate, empathetic | People-first cultures |

**Implementation:**
- Pre-written system prompts (not user-editable)
- Selection in Settings panel (dropdown)
- Persona cards with tone preview before selecting
- All maintain same legal disclaimers and boundaries

**V2 Enhancements:**
- **Per-conversation persona** — Switch persona mid-session for different contexts
- **Compliance persona** — Tighter phrasing, stronger disclaimers for regulated industries
- **Tone preview** — Sample response showing persona style before committing

---

### 5. Document/PDF Ingestion
**Impact:** ⚡ Medium | **Complexity:** High | **Est. Sessions:** 3-4
**Category:** Data

V1 supports CSV, Excel, TSV. V2 adds PDF/DOCX for policy documents and handbooks.

**Use Cases:**
- Ask questions about company policies/handbooks
- Reference employee handbook during conversations
- Search across policy documents

**Phased Approach:**
1. **Phase 1 (simpler):** Text-only DOCX/PDF → FTS indexing (no vectors initially)
2. **Phase 2:** Section-aware chunking, embeddings for semantic search

**V2 Enhancements:**
- **Section-aware chunking** — Respect document structure (headings, paragraphs)
- **Citations to page/section** — "See Employee Handbook, Section 4.2"
- **Policy-tag filters** — Tag documents (handbook, benefits, compliance) for targeted context
- **No vectors initially** — Start with FTS, add embeddings later if needed

---

### 6. Compensation Data (Salary, Bonus, Equity)
**Impact:** ⚡ Medium | **Complexity:** High | **Est. Sessions:** 3-4
**Category:** Data

V1 has performance/eNPS/demographics. Compensation adds significant security complexity.

**V2 Would Add:**
- Salary history and current compensation
- Bonus targets and payouts
- Equity grants and vesting schedules
- Pay equity analysis capabilities

**V2 Enhancements (Security-First):**
- **"Sensitive mode"** — Requires explicit unlock to view/query comp data
- **Guardrailed pay equity templates** — Pre-built queries prevent misuse
- **Banding/bucketing** — Show ranges, not exact salaries ("$120-140K band")
- **AES-at-rest for comp tables** — Encrypt compensation-specific tables only
- **Audit trail** — Log all comp data access for compliance

---

### 7. Command Palette + Keyboard Shortcuts
**Impact:** ⚡ Medium | **Complexity:** Low | **Est. Sessions:** 1
**Category:** UX | **Pre-Launch:** ✅ Recommended

Wrap shortcuts into a command palette (Cmd+K) for discoverability.

**Command Palette Features:**
- `Cmd+K` — Open palette, fuzzy search all actions
- List all available actions with keyboard hints
- Search conversations, employees, settings
- Quick employee jump ("Go to Sarah Chen")
- Recent conversations list

**Core Shortcuts:**
- `Cmd+N` — New conversation
- `Cmd+K` — Command palette
- `Cmd+/` — Focus chat input
- `Cmd+E` — Toggle employee panel
- `Cmd+,` — Open settings

---

### 8. Multi-State Employee Locations
**Impact:** 💡 Low | **Complexity:** Medium | **Est. Sessions:** 1-2
**Category:** Data

Remote workers may work from multiple states. V1 uses single primary location.

**V2 Implementation:**
- **Location history table** — Track locations with effective dates
- **Compliance calendar** — Uses latest state for compliance context
- **Simple UI timeline** — Show location history on Employee detail
- **Import support** — Handle location history in CSV imports

---

### 9. Expanded PII Detection (Medical/Immigration)
**Impact:** 💡 Low | **Complexity:** Medium | **Est. Sessions:** 1-2
**Category:** Security

V1 detects financial PII only (SSN, CC, bank) to reduce false positives.

**V2 Could Add:**
- Medical record numbers
- Immigration document numbers (visa, I-9)
- Driver's license numbers

**V2 Enhancements:**
- **Confidence scoring** — Show confidence level for each detection
- **Preview mask** — Show what will be redacted before sending
- **Domain-specific patterns** — Opt-in for medical/immigration (may have false positives)
- **Golden tests** — Add tests with realistic false positive scenarios

---

### 10. Multi-Company Support (Workspaces)
**Impact:** 💡 Low | **Complexity:** Medium | **Est. Sessions:** 3
**Category:** Data

HR consultants with multiple clients might want company switching.

**V2 Implementation ("Workspaces"):**
- **Workspaces in data dir** — Separate SQLite databases per company
- **Explicit switcher** — Clear workspace selector in UI
- **Separate settings/export per workspace** — No cross-contamination
- **No cross-workspace search** — Keep data isolated
- **Separate API key per workspace** — Or shared, user choice

---

### 11. Windows/Linux Support
**Impact:** 💡 Low | **Complexity:** High | **Est. Sessions:** 5+
**Category:** Platform

macOS only for V1. Cross-platform adds significant complexity.

**Implementation Challenges:**
- **Keyring abstraction** — macOS Keychain → Windows Credential Manager → Linux Secret Service
- **Path differences** — App data, config, temp directories
- **Updater differences** — Platform-specific auto-update mechanisms
- **Packaging matrix** — .dmg, .msi/.exe, .deb/.AppImage

**Recommendation:** Defer until demand is real. Track requests.

---

## New V2 Feature Categories

### 12. Attrition & Sentiment Signals
**Impact:** 🔥 High | **Complexity:** Medium | **Est. Sessions:** 2-3
**Category:** Intelligence

Proactive risk identification with strong disclaimers.

**Core Features:**
- **Heuristic risk flags** — Tenure dip + poor performance trend + negative eNPS
- **Themed topic mining** — Extract themes from review/eNPS comments
- **Flight risk indicators** — Combined signals, not individual predictions

**Guardrails:**
- **Strong disclaimers** — "This is a heuristic, not a prediction"
- **Opt-in controls** — User must enable risk indicators
- **No individual predictions** — Show patterns, not "John will leave"
- **Explainability** — Show which factors contributed to flags

---

### 13. DEI & Fairness Lens
**Impact:** ⚡ Medium | **Complexity:** High | **Est. Sessions:** 3-4
**Category:** Intelligence

Representation and fairness analysis with appropriate guardrails.

**Core Features:**
- **Representation dashboards** — Gender/ethnicity breakdown by dept/level
- **Rating distribution analysis** — Compare ratings across demographic groups
- **Promotion delta tracking** — Who's being promoted at what rates

**Guardrails:**
- **Bias disclaimers** — "Data may reflect historical bias"
- **Bucketed results** — Never show individual-level demographic comparisons
- **No small-n suppression** — Hide results for groups <5 to prevent identification
- **Audit trail** — Log all DEI queries for compliance

---

### 14. Data Quality Center
**Impact:** 🔥 High | **Complexity:** Medium | **Est. Sessions:** 2-3
**Category:** Import/Export | **Pre-Launch:** ⚡ Stretch Goal

Better import experience with validation and fix workflow.

**Core Features:**
- **Pre-import mapping UI** — Map CSV columns to fields visually
- **Header normalization preview** — Show how headers will be interpreted
- **Dedupe by email/name+DOB** — Identify potential duplicates before import
- **Validation rules** — Flag missing managers, invalid dates, orphan records
- **"Fix-and-retry" workflow** — Edit issues in-app before committing

**Ties to Known Issue:** Fixes `file_parser::tests::test_normalize_header` by strengthening normalization rules and adding HRIS-specific header mappings.

---

### 15. Review Highlights Pipeline
**Impact:** 🔥 High | **Complexity:** Medium | **Est. Sessions:** 1-2
**Category:** Context/LLM | **Pre-Launch:** ✅ Recommended

Precompute summaries to handle long performance reviews.

**The Problem:** Real reviews can be 500-2000+ words. Including full reviews in context blows token budgets.

**Solution:**
- **Precompute per-review "highlights"** — Key strengths, areas for improvement (run on import)
- **Precompute per-employee "profile summaries"** — Aggregate career narrative
- **Cache and update on data changes** — Invalidate when reviews added/edited
- **Use highlights in context** — Full reviews available on-demand via drilldown

**Ties to Known Issue:** Addresses "Long performance reviews in context" edge case.

---

### 16. Query-Adaptive Retrieval v2
**Impact:** ⚡ Medium | **Complexity:** Medium | **Est. Sessions:** 2
**Category:** Context/LLM

Enhance V1's query classification with smarter retrieval.

**V2 Enhancements:**
- **Dynamic excerpting for long reviews** — Pull relevant sentences, not full text
- **Theme extraction for aggregates** — "What are common concerns?" → mine themes
- **Token budgets by query type** — Measurable limits, not just heuristics
- **Retrieval metrics** — Track what context was used, measure quality

---

### 17. Answer Verification Mode
**Impact:** ⚡ Medium | **Complexity:** Low | **Est. Sessions:** 1
**Category:** Context/LLM | **Pre-Launch:** ⚡ Stretch Goal

Trust but verify numeric answers.

**Implementation:**
- For numeric questions, compute aggregates locally (SQL)
- Compare Claude's answer to ground truth
- Show **verification badge** ✓ if match, **mismatch warning** ⚠️ if different
- User can click to see SQL query and result

**Examples:**
- "How many engineers?" → SQL says 23, Claude says 23 → ✓ Verified
- "What's average tenure?" → SQL says 2.3 years, Claude says 2.5 → ⚠️ Check

---

### 18. Safe Share Packs
**Impact:** ⚡ Medium | **Complexity:** Medium | **Est. Sessions:** 2
**Category:** Security

One-click redacted exports for sharing.

**Use Cases:**
- Share employee brief with manager (no PII, no comp unless unlocked)
- Export team report for leadership
- Prepare materials for legal/compliance

**Features:**
- **Redacted employee briefs** — Performance summary without SSN/comp
- **Team reports** — Aggregate data, no individual PII
- **Watermarking** — "Generated for [User] on [Date]"
- **Export logs** — Track what was shared and when

---

### 19. Tamper-Evident Audit
**Impact:** 💡 Low | **Complexity:** Medium | **Est. Sessions:** 1-2
**Category:** Security

Increase trust with legal/compliance reviewers.

**Implementation:**
- **Hash-chained audit log entries** — Each entry includes hash of previous
- **"Export Audit Pack"** — One-click export for compliance review
- **Integrity verification** — Detect if any entries were modified

---

### 20. Optional Local DB Encryption
**Impact:** 💡 Low | **Complexity:** Medium | **Est. Sessions:** 2
**Category:** Security

Revisit V1 decision for comp-enabled installs.

**Implementation:**
- **Opt-in for sensitive data** — Enable when compensation data imported
- **Passphrase-on-open** — Require passphrase to unlock database
- **macOS Keychain escrow** — Store passphrase in Keychain for convenience
- **Transparent to app** — SQLCipher or similar, no code changes needed

---

### 21. HRIS Templates
**Impact:** ⚡ Medium | **Complexity:** Medium | **Est. Sessions:** 2
**Category:** Import/Export

Pre-built mappings for common HRIS exports.

**Supported HRIS:**
- BambooHR
- Gusto
- Rippling
- ADP (basic)
- Workday (basic)

**Features:**
- **Guided import templates** — "I'm importing from BambooHR"
- **Header auto-detection** — Recognize known HRIS column names
- **Validation rules per HRIS** — Know what fields to expect
- **Export back to common formats** — Round-trip support

---

### 22. Bulk Actions & Backfills
**Impact:** ⚡ Medium | **Complexity:** Medium | **Est. Sessions:** 1-2
**Category:** Import/Export

"Fix common issues" quick actions post-import.

**Quick Actions:**
- **Add missing managers by inference** — "Sarah reports to Engineering Director"
- **Standardize titles** — "Sr. Engineer" → "Senior Engineer"
- **Normalize locations** — "CA" → "California"
- **Fix date formats** — Detect and convert date inconsistencies

---

### 23. Keyboard Navigation Complete
**Impact:** 💡 Low | **Complexity:** Low | **Est. Sessions:** 1
**Category:** Accessibility

Full keyboard accessibility and screen reader support.

**Features:**
- **Focus styles** — Visible focus indicators throughout
- **Skip links** — Jump to main content
- **High-contrast theme** — WCAG AA compliant
- **Screen-reader friendly** — Proper ARIA labels, message reading

---

### 24. Branding & Theming
**Impact:** 💡 Low | **Complexity:** Low | **Est. Sessions:** 1
**Category:** UX

Personalization for company identity.

**Features:**
- **Company logo in shell** — Replace default logo with uploaded image
- **Accent color** — Company brand color for buttons/highlights
- **Logo in exports** — Branded PDFs and reports
- **Light/dark auto-switch** — Follow system preference

---

## Edge Cases to Handle

| Case | Phase | Priority | Notes |
|------|-------|----------|-------|
| CSV with 1000+ employees | 2 | Medium | May need pagination/lazy loading |
| Very long conversation history | 2 | Medium | Memory retrieval may slow down |
| Offline during onboarding | 4 | Low | Can't validate API key offline |
| License server unreachable | 5 | Medium | Need grace period strategy |
| Long performance reviews in context | 2.7 | Medium | See note below |

### Performance Review Length vs Context Budget

**Discovered:** 2025-12-19
**Status:** Planned → See Feature #15

Current test data has 1-2 sentence performance reviews. Real-world reviews could be 500-2000+ words each.

**Solution:** Implement **Review Highlights Pipeline** (Feature #15)
- Precompute per-review highlights on import
- Cache per-employee profile summaries
- Use highlights in context, full reviews on-demand

**Additional Mitigations:**
- Token budgets by query type (Feature #16)
- Dynamic excerpting for relevant sentences

---

## UI Polish (Future)

### Conversation Sidebar Title Truncation

**Discovered:** 2025-12-19
**Status:** Low priority polish item

The conversation card title text in the sidebar is too large/not adaptive. Titles almost never fit in the available space, resulting in ellipsis truncation ("Betty's Performance ...").

**Potential Fixes:**
- Reduce title font size (currently appears to be text-lg/font-semibold)
- Use smaller font with more lines (2-line clamp instead of 1)
- Show full title on hover (tooltip)
- Auto-generate shorter titles (currently using Claude, could request brevity)
- Responsive font size based on title length

**Component:** `src/components/conversations/ConversationCard.tsx`
**Revisit When:** Phase 4 Polish

---

## Technical Debt

*(Track technical shortcuts that need revisiting)*

| Item | Phase Created | Priority | Notes |
|------|---------------|----------|-------|
| *(none yet)* | | | |

---

*Last updated: December 2025*
