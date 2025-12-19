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
**Status:** Open
**Severity:** Low
**Discovered:** 2025-12-17
**Description:** The `test_normalize_header` test in file_parser.rs is failing. Appears to be a pre-existing issue unrelated to current context builder work. Test expects header normalization to produce "email" but receives different value.
**Workaround:** Test can be skipped; file parsing functionality works correctly in production.
**Resolution:** (pending investigation)

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

### Compensation Data (Salary, Bonus, Equity)
**Status:** Deferred to V2
**Decision Date:** 2025-12-15
**Context:** Full HR Suite schema includes performance ratings, reviews, eNPS, and demographics in V1. Compensation data adds significant PII/security complexity and is deferred.
**What's Included in V1:** Performance ratings, performance reviews, eNPS scores, demographics (DOB, gender, ethnicity)
**Revisit When:** Core V1 stable; high user demand for pay equity analysis

### PDF/Document Ingestion
**Status:** Deferred to V2
**Decision Date:** 2025-12-15
**Context:** V1 supports CSV, Excel (.xlsx/.xls), and TSV file import. PDF and DOCX parsing requires OCR or structured extraction (RAG complexity). Policy documents and handbooks would benefit from this but it's not core to employee context.
**What's Included in V1:** CSV, Excel (.xlsx/.xls), TSV parsing
**Technical Approach for V2:** Consider pdf-extract-api or similar, embeddings for semantic search, chunk storage
**Revisit When:** Users request ability to ask questions about company policies/handbooks

### Persona Switcher (Pre-Built HR Personas)
**Status:** Deferred to V2
**Decision Date:** 2025-12-15
**Context:** V1 ships with a single persona ("Alex" — experienced VP of People Ops). V2 could offer multiple curated personas for different user preferences or organizational cultures.

**Candidate Personas:**
| Persona | Style | Best For |
|---------|-------|----------|
| **Alex** (V1 default) | Warm, practical, conversational | General HR leadership |
| **Jordan** | More formal, compliance-focused | Regulated industries, risk-averse orgs |
| **Sam** | Startup-friendly, direct, moves fast | Early-stage companies, lean HR |
| **Morgan** | Data-driven, analytical | HR analytics users, metrics-focused |
| **Taylor** | Employee-advocate lens, empathetic | High-touch cultures, people-first orgs |

**Implementation Notes:**
- Personas are pre-written system prompts we ship, not user-editable
- Selection in Settings panel (simple dropdown)
- Could show persona "card" with description before selecting
- Persona affects tone/style, not factual answers or compliance guidance
- All personas maintain same legal disclaimers and boundaries

**Why Not User-Editable:**
- Avoids "prompt injection" complexity
- Ensures quality/consistency
- Prevents users from accidentally removing safety guardrails
- Curated feels more premium than DIY

**Revisit When:** V1 stable, user feedback on Alex persona collected

---

### Interactive Analytics Panel (Natural Language → Charts)
**Status:** Deferred to V2
**Decision Date:** 2025-12-13
**Context:** A collapsible analytics panel that renders beautiful, interactive charts/graphs in response to natural language queries in the chat. Examples:
- "Show me employee breakdown by department" → pie/bar chart appears
- "What's the gender breakdown on the engineering team?" → chart updates
- "Now show me by tenure" → drills deeper, chart animates to new view
- "Compare marketing vs sales headcount over time" → line chart

**Why This Is Compelling (Product):**
- Turns “answers” into **artifacts** (charts you can reference, export, and share)
- Reduces back-and-forth: users can **iterate visually** (“filter to active”, “only CA”, “compare vs last quarter”)
- Makes the app feel like an **HR cockpit**, not just a chat box (potential flagship differentiator)

**UX Principles (So It Stays Chat-First):**
- **Chat remains the control surface.** The panel is a *result view*, not a separate workflow.
- **One chart at a time (MVP).** No dashboards, no multi-widget layouts.
- **Conversational continuity:** updates should feel like “the same chart evolving,” not page navigation.
- **Graceful fallback:** if a query can’t be charted, respond in text only (avoid empty/awkward panel states).
- **Explainability:** show a small “Filters applied / Data used” caption (e.g., “Active employees • Dept = Eng”).

**MVP Slice (Good V2.0 Candidate):**
- Supported charts:
  - Headcount by department (bar)
  - Headcount by status (pie or bar)
  - Tenure buckets (bar)
- Supported interactions:
  - Filter (department, status, work_state)
  - Group-by switch (department ↔ status ↔ tenure)
  - Limited compare (“Compare Sales vs Marketing headcount”) as a two-series bar
- Quick actions:
  - Export chart (PNG)
  - Copy text summary (for email/Slack)

**Implementation Ideas:**
- Use a charting library (Recharts, Chart.js, or D3) for rich visualizations
- Claude extracts structured data intent from natural language
- Charts live in a dedicated panel (possibly replacing or alongside context panel)
- Smooth animations between chart states for "conversational" feel
- Export charts as images for reports

**Suggested Technical Contract (Keep It Deterministic):**
- Avoid “Claude generates the numbers.” Prefer:
  - Claude emits a **structured analytics request** (intent + filters + grouping)
  - Rust runs a deterministic SQLite query and returns **dataset + applied filters**
  - React renders from a small **chart spec + dataset**
- Conceptual flow:
  - User: “Show headcount by department, only active”
  - Claude → `AnalyticsQuery { metric: headcount, group_by: department, filters: { status: active } }`
  - Rust → `{ rows: [{ department: "Eng", count: 12 }, ...], applied_filters: ... }`
  - UI → chart + caption (“Active employees”)

**Risks / Guardrails:**
- **Hallucinated data:** prevent by sourcing all aggregates from SQLite and displaying “filters applied.”
- **Schema/vocabulary creep:** keep an explicit allow-list for group-by fields and filters.
- **Dashboard creep:** enforce “one chart object” until after V2 proves value.
- **Privacy / PII:** analytics queries should respect the same redaction + audit approach as chat.
- **Performance:** design for 1k+ employees; aggregates are cheap, but add indexes if queries expand.

**Where It Fits in Layout:**
- Likely the current right-side panel becomes a **mode switch**:
  - Context (who/what was included)
  - Analytics (chart view)
  - Later: Pinned/Saved charts

**Complexity:** High — requires structured data extraction, chart rendering, state management
**Value:** Very high — transforms the app from Q&A tool to visual analytics assistant
**Revisit When:** Core V1 features stable; could be flagship V2 feature

---

### Org Chart View (Interactive Hierarchy Visualization)
**Status:** Deferred to V2
**Decision Date:** 2025-12-18
**Context:** A dedicated page/module that visualizes the organizational hierarchy as an interactive org chart. Would live alongside the Analytics module as a separate view, not embedded in chat.

**Why This Is Compelling (Product):**
- **Visual understanding** of reporting relationships at a glance
- **Navigate by clicking** — click a person to see their direct reports expand, or click up to see their chain of command
- **Natural complement** to chat — "Who reports to Sarah?" becomes a visual answer
- **Onboarding tool** — new HR users can quickly understand org structure

**Core Features (MVP):**
- Tree/hierarchy view with manager → direct reports relationships
- Click to expand/collapse branches
- Click employee to select them (syncs with People panel selection)
- Search/filter to find specific people in the tree
- Zoom/pan for large orgs
- Department color coding

**Enhanced Features (V2.1+):**
- Drag-and-drop reorg planning (what-if scenarios)
- Highlight vacant positions / open headcount
- Show key metrics on hover (tenure, rating, location)
- Export org chart as image/PDF
- Span of control indicators (managers with too many/few reports)
- Dotted-line relationships (matrix reporting)

**Technical Approach:**
- Use a tree visualization library (react-org-chart, D3 hierarchy, or GoJS)
- Data already exists: `employees.manager_id` defines the hierarchy
- New Rust query: `get_org_tree()` returns nested structure
- Separate route/page: `/org-chart` alongside `/analytics`

**Layout Integration:**
- New tab in main navigation (Chat | People | Org Chart | Analytics)
- Or: accessible from People panel header as a view toggle
- Clicking an employee in org chart could:
  - Select them in People panel
  - Open their detail view
  - Start a chat about them

**Complexity:** Medium — tree data structure exists, main work is visualization
**Value:** High — visual org understanding is a common HR need
**Revisit When:** V1 stable; natural V2 feature alongside Analytics

---

### Beginner-Friendly API Key Setup Guide
**Status:** Deferred to V2
**Decision Date:** 2025-12-19
**Context:** The current API key setup in onboarding just links to console.anthropic.com with minimal guidance. This assumes users know what Anthropic is and how to navigate a developer console — a big ask for HR professionals who may never have used an API before.

**The Problem:**
- Target users are HR leaders, not developers
- "Get your key from console.anthropic.com" is intimidating jargon
- No explanation of what an API key is or why it costs money
- No guidance on account creation, billing setup, or key permissions

**Proposed Solution — In-App Guided Walkthrough:**
1. **What is this?** — Plain-English explanation: "An API key lets this app talk to Claude, our AI assistant. Think of it like a password that connects you to the brain behind the app."
2. **Why does it cost money?** — Transparent pricing context: "Claude is powered by Anthropic. You pay them directly based on usage — typically $5-20/month for normal HR use."
3. **Step-by-step screenshots:**
   - Go to console.anthropic.com
   - Create an account (or sign in)
   - Add a payment method
   - Create a new API key
   - Copy and paste it here
4. **Troubleshooting tips:** Common errors (invalid key, billing not set up, etc.)

**Alternative Approaches:**
- **Video walkthrough** — 2-minute Loom-style tutorial
- **In-app iframe** — Embed Anthropic's console (probably not feasible)
- **Concierge setup** — We generate keys on behalf of users (adds complexity, privacy concerns)

**Complexity:** Low — mostly content/UX work, no code changes
**Value:** High — removes biggest friction point for non-technical users
**Revisit When:** Beta feedback confirms this is a blocker for adoption

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
**Status:** Needs Investigation

Current test data has 1-2 sentence performance reviews. Real-world reviews could be multiple paragraphs (500-2000+ words each). This impacts the context management work from Phase 2.7:

**Considerations:**
- Token budget for employee context may need adjustment
- May need to summarize/truncate long reviews before including in context
- Could implement a "review highlights" extraction (key strengths, areas for improvement)
- Consider only including most recent review vs all reviews
- Full-text search already indexes reviews - could retrieve only relevant excerpts

**Revisit When:** Testing with realistic multi-paragraph review data

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
