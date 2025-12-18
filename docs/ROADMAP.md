# HR Command Center — Implementation Roadmap

> **Purpose:** Actionable checklist for implementation across multiple sessions.
> **Related Docs:** [SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md) | [PROGRESS.md](./PROGRESS.md)
> **Full Spec:** [HR-Command-Center-Roadmap.md](../HR-Command-Center-Roadmap.md)

---

## Session Management

This is a **long-running, multi-session implementation**. Follow these rules:

### Before Each Session
```bash
./scripts/dev-init.sh
```

### Single-Feature-Per-Session Rule
> **CRITICAL:** Work on ONE checkbox item per session when possible. This prevents scope creep and ensures proper documentation.

### After Each Session
1. Run verification (build, type-check, tests)
2. Update PROGRESS.md with session entry
3. Update features.json status
4. Check off completed tasks below
5. Commit with descriptive message

---

## Phase Overview

| Phase | Focus | Duration | Pause Points |
|-------|-------|----------|--------------|
| 0 | Pre-flight validation | 1 day | 0A: Tooling verified |
| 1 | Foundation | 2 weeks | 1A: App runs, API works |
| 2 | Context | 2 weeks | 2A: Context injection works |
| 3 | Protection | 1 week | 3A: PII redaction works |
| 4 | Polish | 2 weeks | 4A: Onboarding complete |
| 5 | Launch | 1 week | 5A: Beta ready |

---

## Phase 0: Pre-Flight Validation

**Goal:** Confirm tooling is ready and environment is set up

### Tasks
- [x] 0.1 Verify Rust toolchain installed (`rustc --version`) ✓ 1.92.0
- [x] 0.2 Verify Node.js installed (`node --version`) ✓ v22.21.0
- [x] 0.3 Verify Tauri CLI installed (`cargo tauri --version`) ✓ 2.9.6
- [x] 0.4 Create empty Git repository with .gitignore
- [x] 0.5 Document environment versions in PROGRESS.md

### Pause Point 0A ✓ COMPLETE
**Action Required:** Confirm all tooling works before proceeding — **VERIFIED**

---

## Phase 1: Foundation

**Goal:** App opens, stores data locally, talks to Claude

### 1.1 Project Scaffolding ✓ COMPLETE
- [x] 1.1.1 Initialize Tauri + React + Vite project
- [x] 1.1.2 Configure TypeScript
- [x] 1.1.3 Set up Tailwind CSS with design tokens
- [x] 1.1.4 Create basic folder structure per architecture doc
- [x] 1.1.5 Verify `npm run dev` launches app window

### 1.2 SQLite Setup ✓ COMPLETE
- [x] 1.2.1 Add SQLx dependency to Cargo.toml
- [x] 1.2.2 Create initial migration (employees, conversations, company, settings, audit_log)
- [x] 1.2.3 Create FTS virtual table for conversation search
- [x] 1.2.4 Implement db.rs with connection management
- [x] 1.2.5 Verify database creates on first launch

### 1.3 Basic Chat UI ✓ COMPLETE
- [x] 1.3.1 Create AppShell component (main layout)
- [x] 1.3.2 Create ChatInput component
- [x] 1.3.3 Create MessageBubble component (user/assistant variants)
- [x] 1.3.4 Create MessageList component with scroll
- [x] 1.3.5 Create TypingIndicator component
- [x] 1.3.6 Wire up basic message send/display flow

### 1.4 Claude API Integration
- [x] 1.4.1 Add keyring dependency for macOS Keychain
- [x] 1.4.2 Implement keyring.rs for API key storage
- [x] 1.4.3 Create ApiKeyInput component with validation
- [x] 1.4.4 Implement chat.rs with Claude API call
- [x] 1.4.5 Add response streaming support
- [x] 1.4.6 Wire frontend to backend via Tauri invoke

### 1.5 Network Detection ✓ COMPLETE
- [x] 1.5.1 Implement network check in Rust
- [x] 1.5.2 Create useNetwork hook in React
- [x] 1.5.3 Show offline indicator when disconnected

### Pause Point 1A ✓ VERIFIED
**Verification Required:**
- [x] App window opens
- [x] Can enter API key (validates against Claude)
- [x] Can send message and receive streamed response
- [x] Messages persist in SQLite
- [x] Network status displays correctly

---

## Phase 2: Context

**Goal:** Claude knows about your company and remembers past conversations

### 2.1 Employee & Performance Data
> **Expanded Scope:** Full HR Suite schema with performance ratings, reviews, eNPS, and demographics.
> **Reference:** [SCHEMA_EXPANSION_V1.md](./SCHEMA_EXPANSION_V1.md)

#### 2.1.A Schema & Backend
- [x] 2.1.1 Create migration 002_performance_enps.sql (new tables + employee fields)
- [x] 2.1.2 Update employees.rs with demographics + termination fields
- [x] 2.1.3 Create review_cycles.rs CRUD operations
- [x] 2.1.4 Create performance_ratings.rs CRUD operations
- [x] 2.1.5 Create performance_reviews.rs CRUD operations (+ FTS triggers)
- [x] 2.1.6 Create enps.rs CRUD operations

#### 2.1.B File Ingestion
- [x] 2.1.7 Add calamine dependency for Excel parsing
- [x] 2.1.8 Create unified file parser (CSV, XLSX, TSV)
- [x] 2.1.9 Create FileDropzone component (multi-format)
- [x] 2.1.10 Implement employee import with merge-by-email
- [x] 2.1.11 Implement performance ratings import
- [x] 2.1.12 Implement performance reviews import
- [x] 2.1.13 Implement eNPS import

#### 2.1.C UI Components ✓ COMPLETE
- [x] 2.1.14 Create EmployeePanel component (sidebar with performance summary)
- [x] 2.1.15 Create EmployeeDetail component (full profile view)
- [x] 2.1.16 Create EmployeeEdit component (modal)
- [x] 2.1.17 Create ImportWizard component (guides through data import)

#### 2.1.D Test Data
> **Implementation Plan:** [PLAN_2.1.D_TEST_DATA.md](./PLAN_2.1.D_TEST_DATA.md)
> **Sessions Required:** 2-3 | **Est. LOC:** ~1,050 TypeScript

- [x] 2.1.18 Create test data generator script infrastructure
- [x] 2.1.19 Generate "Acme Corp" dataset (100 employees)
- [x] 2.1.20 Generate 3 review cycles with ratings + reviews
- [x] 2.1.21 Generate 3 eNPS survey responses per employee

### 2.2 Company Profile ✓ COMPLETE
- [x] 2.2.1 Create CompanySetup component
- [x] 2.2.2 Implement company table operations
- [x] 2.2.3 Require name + state during onboarding
- [x] 2.2.4 Store company data in SQLite

### 2.3 Context Builder
> **Reference:** [HR_PERSONA.md](./HR_PERSONA.md) for Claude's HR leader persona

- [x] 2.3.1 Implement context.rs with retrieval logic
- [x] 2.3.2 Add employee name/department extraction from query
- [x] 2.3.3 Build system prompt with HR persona ("Alex") + company context
- [x] 2.3.4 Include performance/eNPS data in employee context
- [x] 2.3.5 Add context to Claude API calls (+ user_name setting support)
- [x] 2.3.6 Implement context size trimming

### 2.4 Cross-Conversation Memory ✓ COMPLETE
- [x] 2.4.1 Implement memory.rs for conversation summaries
- [x] 2.4.2 Generate summaries after conversations (frontend trigger)
- [x] 2.4.3 Implement summary search/retrieval
- [x] 2.4.4 Include relevant memories in context

### 2.5 Conversation Management ✓ COMPLETE
- [x] 2.5.1 Create ConversationSidebar component
- [x] 2.5.2 Implement auto-title generation
- [x] 2.5.3 Create ConversationSearch component (FTS)
- [x] 2.5.4 Add "New conversation" action
- [x] 2.5.5 Wire sidebar to chat area

### 2.6 Stickiness Features + UI Polish
> **Implementation Plan:** `~/.claude/plans/silly-splashing-eagle.md`

#### UI Polish (from testing feedback)
- [x] 2.6.0a Add react-markdown for chat message rendering
- [x] 2.6.0b Fix email overflow in EmployeeDetail
- [x] 2.6.0c Show manager name instead of ID
- [x] 2.6.0d Make eNPS/review tiles expandable (modal)
- [x] 2.6.0e Add department and manager filters to EmployeePanel

#### Stickiness Features
- [x] 2.6.1 Create PromptSuggestions component
- [x] 2.6.2 Implement contextual prompt generation
- [x] 2.6.3 Create empty state guidance

### 2.7 Context Scaling (Query-Adaptive)
> **Architecture Doc:** [CONTEXT_SCALING_ARCHITECTURE.md](./CONTEXT_SCALING_ARCHITECTURE.md)
> **Problem:** Current 10-employee limit prevents accurate aggregate queries at scale

- [x] 2.7.0 Pass selected_employee_id from UI to context builder (prioritize selected employee)
- [x] 2.7.1 Add OrgAggregates struct and build_org_aggregates() SQL queries
- [x] 2.7.2 Implement QueryType enum and classify_query() function
- [x] 2.7.3 Refactor build_chat_context() for query-adaptive retrieval
- [x] 2.7.4 Update format functions and system prompt with aggregates
- [x] 2.7.5 Add unit tests for classification and aggregates

### Pause Point 2A ✓ VERIFIED
**Verification Required:**
- [x] Can import employee CSV/Excel and see employees with demographics
- [x] Can import performance ratings and reviews
- [x] Can import eNPS survey data
- [x] Can edit individual employee
- [x] Asking "Who's been here longest?" returns correct answer
- [x] Asking "Who's underperforming?" uses ratings data
- [x] Asking "What's our eNPS?" calculates correctly
- [x] Asking about employee by name includes their performance context
- [x] Conversation sidebar shows history
- [x] Search finds past conversations
- [x] Memory references past discussions naturally

---

## Phase 3: Protection

**Goal:** Users can't accidentally leak sensitive data

### 3.1 PII Scanner ✓ COMPLETE
- [x] 3.1.1 Implement pii.rs with regex patterns
- [x] 3.1.2 Add SSN detection (XXX-XX-XXXX, XXXXXXXXX)
- [x] 3.1.3 Add credit card detection
- [x] 3.1.4 Add bank account detection (with context)
- [x] 3.1.5 Create unit tests for PII patterns

### 3.2 Auto-Redaction ✓ COMPLETE
- [x] 3.2.1 Implement scan_and_redact function
- [x] 3.2.2 Replace PII with placeholders ([SSN_REDACTED], etc.)
- [x] 3.2.3 Return redaction list for notification

### 3.3 Notification UI ✓ COMPLETE
- [x] 3.3.1 Create PIINotification component
- [x] 3.3.2 Show brief notification on redaction
- [x] 3.3.3 Auto-dismiss after 3 seconds

### 3.4 Audit Logging
- [ ] 3.4.1 Implement audit.rs
- [ ] 3.4.2 Log redacted requests and responses
- [ ] 3.4.3 Store context employee IDs used
- [ ] 3.4.4 Add audit log export capability

### 3.5 Error Handling
- [ ] 3.5.1 Create ErrorState component
- [ ] 3.5.2 Handle API errors gracefully
- [ ] 3.5.3 Show "Retry" and "Copy Message" actions
- [ ] 3.5.4 Implement read-only offline mode

### Pause Point 3A
**Verification Required:**
- [ ] Pasting SSN auto-redacts before sending
- [ ] Notification shows briefly
- [ ] Audit log captures redacted content
- [ ] Offline mode allows browsing but not chatting
- [ ] API errors show friendly messages

---

## Phase 4: Polish

**Goal:** Feels like a real product

### 4.1 Onboarding Flow
- [ ] 4.1.1 Create OnboardingFlow component
- [ ] 4.1.2 Step 1: Welcome screen
- [ ] 4.1.3 Step 2: API key setup (with Anthropic link)
- [ ] 4.1.4 Step 3: Company profile (required)
- [ ] 4.1.5 Step 4: Employee import (optional, sample data available)
- [ ] 4.1.6 Step 5: Legal disclaimer acknowledgment
- [ ] 4.1.7 Step 6: Telemetry opt-in choice
- [ ] 4.1.8 Step 7: First conversation prompt

### 4.2 Settings Panel
- [ ] 4.2.1 Create SettingsPanel component
- [ ] 4.2.2 API key management (change/remove)
- [ ] 4.2.3 Company profile editing
- [ ] 4.2.4 Data location display
- [ ] 4.2.5 Telemetry toggle

### 4.3 Data Export/Import
- [ ] 4.3.1 Implement encrypted data export
- [ ] 4.3.2 Implement data import from backup
- [ ] 4.3.3 Add export/import to Settings panel

### 4.4 Monday Digest
- [ ] 4.4.1 Create MondayDigest component
- [ ] 4.4.2 Query anniversaries from hire_date
- [ ] 4.4.3 Query new hires (<90 days)
- [ ] 4.4.4 Show on Monday mornings, dismissible

### 4.5 Distribution
- [ ] 4.5.1 Create app icon
- [ ] 4.5.2 Configure macOS code signing
- [ ] 4.5.3 Configure notarization
- [ ] 4.5.4 Set up tauri-plugin-updater
- [ ] 4.5.5 Configure GitHub Releases for updates

### Pause Point 4A
**Verification Required:**
- [ ] Fresh install goes through onboarding smoothly
- [ ] Can export and re-import data
- [ ] Monday digest appears with correct data
- [ ] App is signed and notarized
- [ ] Auto-update works

---

We'll pause before phase 5 and contemplate V2 features to implement prior to launch. 
## Phase 5: Launch

**Goal:** Real users, real feedback

### 5.1 License System
- [ ] 5.1.1 Create license validation API endpoint
- [ ] 5.1.2 Implement license check in app
- [ ] 5.1.3 Store validation locally after success
- [ ] 5.1.4 Add license input to onboarding

### 5.2 Payment Integration
- [ ] 5.2.1 Set up Stripe product ($99)
- [ ] 5.2.2 Create checkout flow on website
- [ ] 5.2.3 Implement license key generation
- [ ] 5.2.4 Set up email delivery of keys

### 5.3 Landing Page
- [ ] 5.3.1 Update hrcommandcenter.com
- [ ] 5.3.2 Add download links
- [ ] 5.3.3 Add purchase button

### 5.4 Beta Distribution
- [ ] 5.4.1 Identify 5-10 beta users
- [ ] 5.4.2 Distribute beta builds
- [ ] 5.4.3 Set up feedback collection (in-app button)
- [ ] 5.4.4 Triage and prioritize feedback

### Pause Point 5A (Launch Ready)
**Verification Required:**
- [ ] Payment flow works end-to-end
- [ ] License validation works
- [ ] Beta users successfully using product
- [ ] Critical feedback addressed

---

## Linear Checklist (All Tasks)

Copy this to external tracking if needed:

```
PHASE 0 - PRE-FLIGHT
[ ] 0.1 Verify Rust
[ ] 0.2 Verify Node
[ ] 0.3 Verify Tauri CLI
[ ] 0.4 Create Git repo
[ ] 0.5 Document versions
[ ] PAUSE 0A: Tooling verified

PHASE 1 - FOUNDATION
[ ] 1.1.1-1.1.5 Project scaffolding (5 tasks)
[ ] 1.2.1-1.2.5 SQLite setup (5 tasks)
[ ] 1.3.1-1.3.6 Basic chat UI (6 tasks)
[ ] 1.4.1-1.4.6 Claude API integration (6 tasks)
[ ] 1.5.1-1.5.3 Network detection (3 tasks)
[ ] PAUSE 1A: App runs, API works

PHASE 2 - CONTEXT
[ ] 2.1.1-2.1.6 Employee data (6 tasks)
[ ] 2.2.1-2.2.4 Company profile (4 tasks)
[ ] 2.3.1-2.3.5 Context builder (5 tasks)
[ ] 2.4.1-2.4.4 Cross-conversation memory (4 tasks)
[ ] 2.5.1-2.5.5 Conversation management (5 tasks)
[ ] 2.6.1-2.6.3 Stickiness features (3 tasks)
[ ] PAUSE 2A: Context injection works

PHASE 3 - PROTECTION
[ ] 3.1.1-3.1.5 PII scanner (5 tasks)
[ ] 3.2.1-3.2.3 Auto-redaction (3 tasks)
[ ] 3.3.1-3.3.3 Notification UI (3 tasks)
[ ] 3.4.1-3.4.4 Audit logging (4 tasks)
[ ] 3.5.1-3.5.4 Error handling (4 tasks)
[ ] PAUSE 3A: PII redaction works

PHASE 4 - POLISH
[ ] 4.1.1-4.1.8 Onboarding flow (8 tasks)
[ ] 4.2.1-4.2.5 Settings panel (5 tasks)
[ ] 4.3.1-4.3.3 Data export/import (3 tasks)
[ ] 4.4.1-4.4.4 Monday digest (4 tasks)
[ ] 4.5.1-4.5.5 Distribution (5 tasks)
[ ] PAUSE 4A: Onboarding complete

PHASE 5 - LAUNCH
[ ] 5.1.1-5.1.4 License system (4 tasks)
[ ] 5.2.1-5.2.4 Payment integration (4 tasks)
[ ] 5.3.1-5.3.3 Landing page (3 tasks)
[ ] 5.4.1-5.4.4 Beta distribution (4 tasks)
[ ] PAUSE 5A: Launch ready
```

**Total: ~100 discrete tasks across 5 phases**

---

*Last updated: December 2025*
*Session tracking: See PROGRESS.md*
