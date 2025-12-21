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

## V2 Features

> **Note:** High and medium impact V2 features have been promoted to **Phase V2** in [ROADMAP.md](./ROADMAP.md).
> This section tracks remaining low-priority features and future ideas.

---

### Promoted to Roadmap (Phase V2)

The following features are now tracked in `docs/ROADMAP.md` under **Phase V2: Intelligence & Visualization**:

| Feature | Roadmap Section | Status |
|---------|-----------------|--------|
| Interactive Analytics Panel + Insight Canvas | V2.3.2 | Not started |
| API Key Setup Guide (Enhanced) | V2.1.1 | Not started |
| Org Chart View + Heatmap Overlay | V2.3.1 | Not started |
| Persona Switcher | V2.1.3 | Not started |
| Command Palette + Shortcuts | V2.1.2 | Not started |
| Answer Verification Mode | V2.1.4 | Not started |
| Structured Data Extraction (Review Highlights) | V2.2.1 | Not started |
| Query-Adaptive Retrieval v2 | V2.2.2 | Not started |
| Attrition & Sentiment Signals | V2.4.1 | Not started |
| DEI & Fairness Lens | V2.4.2 | Not started |
| Data Quality Center | V2.5.1 | Not started |

---

### V2 Parking Lot (Lower Priority)

Features deferred until demand is established. Track user requests.

#### Data & Platform

| Feature | Impact | Complexity | Notes |
|---------|--------|------------|-------|
| Document/PDF Ingestion | ⚡ Medium | High | Phase 1: FTS only, Phase 2: embeddings |
| Compensation Data | ⚡ Medium | High | Requires sensitive mode + encryption |
| Multi-State Locations | 💡 Low | Medium | Location history with effective dates |
| Multi-Company/Workspaces | 💡 Low | Medium | Separate SQLite DBs per company |
| Windows/Linux Support | 💡 Low | High | Keyring abstraction, packaging matrix |

#### Security Enhancements

| Feature | Impact | Complexity | Notes |
|---------|--------|------------|-------|
| Expanded PII Detection | 💡 Low | Medium | Medical, immigration, DL numbers |
| Safe Share Packs | ⚡ Medium | Medium | Redacted exports with watermarking |
| Tamper-Evident Audit | 💡 Low | Medium | Hash-chained audit log entries |
| Optional Local DB Encryption | 💡 Low | Medium | SQLCipher for comp-enabled installs |

#### Import/Export Enhancements

| Feature | Impact | Complexity | Notes |
|---------|--------|------------|-------|
| HRIS Templates | ⚡ Medium | Medium | BambooHR, Gusto, Rippling mappings |
| Bulk Actions & Backfills | ⚡ Medium | Medium | Post-import fix workflows |

#### UX & Accessibility

| Feature | Impact | Complexity | Notes |
|---------|--------|------------|-------|
| Keyboard Navigation Complete | 💡 Low | Low | WCAG AA, screen reader support |
| Branding & Theming | 💡 Low | Low | Company logo, accent colors |

**Legend:** 🔥 High impact | ⚡ Medium | 💡 Low priority

---

### Parking Lot Feature Details

<details>
<summary><strong>Document/PDF Ingestion</strong> (⚡ Medium impact, High complexity)</summary>

V1 supports CSV, Excel, TSV. This adds PDF/DOCX for policy documents.

**Use Cases:**
- Ask questions about company policies/handbooks
- Reference employee handbook during conversations
- Search across policy documents

**Phased Approach:**
1. Phase 1: Text-only DOCX/PDF → FTS indexing
2. Phase 2: Section-aware chunking, embeddings for semantic search

**Enhancements:**
- Section-aware chunking respecting document structure
- Citations to page/section ("See Employee Handbook, Section 4.2")
- Policy-tag filters for targeted context

</details>

<details>
<summary><strong>Compensation Data</strong> (⚡ Medium impact, High complexity)</summary>

Add salary, bonus, and equity data with enhanced security.

**Would Add:**
- Salary history and current compensation
- Bonus targets and payouts
- Equity grants and vesting schedules
- Pay equity analysis capabilities

**Security Requirements:**
- "Sensitive mode" requiring explicit unlock
- Guardrailed pay equity templates
- Banding/bucketing (ranges, not exact figures)
- AES-at-rest for comp tables only
- Audit trail for all comp data access

</details>

<details>
<summary><strong>Multi-State Locations</strong> (💡 Low impact, Medium complexity)</summary>

Remote workers may work from multiple states.

**Implementation:**
- Location history table with effective dates
- Compliance calendar using latest state
- UI timeline on Employee detail
- Import support for location history

</details>

<details>
<summary><strong>Multi-Company/Workspaces</strong> (💡 Low impact, Medium complexity)</summary>

HR consultants with multiple clients.

**Implementation:**
- Separate SQLite databases per company
- Explicit workspace switcher in UI
- Separate settings/export per workspace
- No cross-workspace search (data isolation)

</details>

<details>
<summary><strong>Windows/Linux Support</strong> (💡 Low impact, High complexity)</summary>

macOS only for V1. Cross-platform adds significant complexity.

**Challenges:**
- Keyring abstraction (Keychain → Credential Manager → Secret Service)
- Path differences for app data
- Platform-specific auto-update mechanisms
- Packaging matrix (.dmg, .msi/.exe, .deb/.AppImage)

**Recommendation:** Defer until demand is real. Track requests.

</details>

<details>
<summary><strong>Expanded PII Detection</strong> (💡 Low impact, Medium complexity)</summary>

V1 detects financial PII only (SSN, CC, bank).

**Could Add:**
- Medical record numbers
- Immigration document numbers (visa, I-9)
- Driver's license numbers

**Enhancements:**
- Confidence scoring for each detection
- Preview mask before sending
- Domain-specific patterns (opt-in)

</details>

<details>
<summary><strong>Safe Share Packs</strong> (⚡ Medium impact, Medium complexity)</summary>

One-click redacted exports for sharing.

**Use Cases:**
- Share employee brief with manager (no PII)
- Export team report for leadership
- Prepare materials for legal/compliance

**Features:**
- Redacted employee briefs
- Team reports with aggregate data only
- Watermarking with user/date
- Export logs

</details>

<details>
<summary><strong>HRIS Templates</strong> (⚡ Medium impact, Medium complexity)</summary>

Pre-built mappings for common HRIS exports.

**Supported HRIS:**
- BambooHR, Gusto, Rippling
- ADP (basic), Workday (basic)

**Features:**
- Guided import templates
- Header auto-detection for known HRIS
- Validation rules per HRIS

*Note: Basic HRIS header mappings included in V2.5.1 Data Quality Center.*

</details>

<details>
<summary><strong>Bulk Actions & Backfills</strong> (⚡ Medium impact, Medium complexity)</summary>

"Fix common issues" quick actions post-import.

**Quick Actions:**
- Add missing managers by inference
- Standardize titles ("Sr. Engineer" → "Senior Engineer")
- Normalize locations ("CA" → "California")
- Fix date format inconsistencies

</details>

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
**Status:** Planned → See ROADMAP.md V2.2.1

Current test data has 1-2 sentence performance reviews. Real-world reviews could be 500-2000+ words each.

**Solution:** Implement **Structured Data Extraction** (ROADMAP.md V2.2.1)
- Extract structured entities (strengths, opportunities, quotes, themes)
- Precompute per-employee profile summaries
- Use highlights in context, full reviews on-demand

**Additional Mitigations:**
- Token budgets by query type (V2.2.2)
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
