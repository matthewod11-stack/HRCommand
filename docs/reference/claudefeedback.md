# HR Command Center — Strategic Feedback

> Review of Roadmap and Architecture documents
> Focus: Gaps, blind spots, and low-bloat stickiness improvements

---

## Executive Summary

**Strengths:**
- Clear constraint-setting ("What we're NOT building")
- Strong local-first privacy story
- Realistic LOC budget (~3,000)
- Well-defined target personas with shared pain point

**Gaps identified:** 6 critical, 4 moderate
**Stickiness opportunities:** 5 low-bloat additions

---

## Part 1: Critical Gaps

### 1. Data Portability & Backup

**The problem:** Local-first is the selling point, but local-only is a liability. When a user's Mac dies, gets stolen, or they upgrade machines—what happens to their employee data and conversation history?

**What's missing:**
- Export/backup mechanism (encrypted JSON? SQLite dump?)
- Import from backup flow
- Clear documentation of "where is my data?"

**Recommendation:** Add to Phase 4 (Polish):
```
- [ ] Export all data (employees, conversations, settings) to encrypted file
- [ ] Import from backup file
- [ ] "Your data" indicator in settings (path to SQLite file)
```

**Why it matters:** Users paying $99 need confidence their data survives hardware changes. This is table-stakes for a paid local-first app.

---

### 2. Employee Data Lifecycle

**The problem:** CSV import is mentioned, but what happens *after* initial import?

**Unanswered questions:**
- How do users add a single new hire?
- How do they edit an employee's info (promotion, name change)?
- How do they mark someone as terminated?
- What happens to terminated employees in AI context?

**Recommendation:** Add to Phase 2 (Context):
```
- [ ] Add/edit individual employee from UI
- [ ] Status toggle (active/terminated/leave)
- [ ] Terminated employees excluded from AI context by default
- [ ] "Re-import CSV" merges by email, doesn't duplicate
```

---

### 3. Conversation Organization

**The problem:** Schema has `conversations` table, but no UX for finding past conversations.

**Scenario:** User has been using the app for 6 months. They had a conversation about handling a difficult termination in March. How do they find it?

**What's missing:**
- Conversation list/history view
- Search across conversations
- Conversation titling (auto or manual)

**Recommendation:** Add to Phase 2:
```
- [ ] Conversation sidebar (collapsible, left side)
- [ ] Auto-title conversations from first message
- [ ] Search conversations (full-text on messages_json)
- [ ] "New conversation" button (Cmd+N)
```

**Note:** This doesn't violate "chat-first"—it's chat *organization*.

---

### 4. Offline/Error State UX

**The problem:** What does the user see when:
- Claude API is down?
- They hit rate limits?
- Their API key is invalid/expired?
- They have no internet?

**What's missing:**
- Error state designs
- Graceful degradation strategy
- User-friendly error messages (not raw API errors)

**Recommendation:** Add to Architecture doc, section 6 (Micro-Interactions):
```
ERROR STATES
┌─────────────────────────────────────────┐
│  ⚠️ Couldn't reach Claude               │
│                                         │
│  Your message is saved. We'll retry     │
│  when connection is restored.           │
│                                         │
│  [Retry Now]  [Copy Message]            │
└─────────────────────────────────────────┘
```

---

### 5. Onboarding Specifics

**The problem:** "Onboarding flow (first launch experience)" is a single checkbox, but this is the most critical UX for non-technical users.

**What's missing:**
- Step-by-step first-run flow
- What if they don't have employee data yet?
- API key acquisition guidance

**Recommendation:** Detail the onboarding flow:
```
FIRST LAUNCH SEQUENCE

1. Welcome screen
   "HR Command Center keeps your company data private.
    Let's get you set up in under 2 minutes."
   [Get Started]

2. API Key setup
   "You'll need a Claude API key from Anthropic."
   [I have one] → Input field
   [Get an API key] → Opens anthropic.com/api in browser

3. Company basics (optional, skippable)
   - Company name
   - State/jurisdiction
   - Industry (dropdown)

4. Employee import (optional, skippable)
   "Drag a CSV here, or start chatting without employee data"
   [Import CSV]  [Skip for now]

5. First conversation prompt
   Pre-filled: "What can you help me with?"
   → Claude responds with capabilities overview
```

---

### 6. State/Jurisdiction Intelligence

**The problem:** HR law varies dramatically by state. California vs. Texas vs. New York have completely different requirements for:
- Final paycheck timing
- PTO payout requirements
- At-will employment exceptions
- Required notices

**Currently:** Company profile captures "state" but architecture doesn't show how this affects AI responses.

**Recommendation:** Add to context injection (Phase 2):
```rust
// Context builder includes jurisdiction
let system_prompt = format!(
    "Company: {}\nState: {}\nIndustry: {}\n\n\
     When answering HR questions, consider {} employment law. \
     Flag when federal vs state law differs.",
    company.name, company.state, company.industry, company.state
);
```

**Stretch:** Link to your state-specific knowledge base, or add "⚖️ Check your state's specific requirements" disclaimer on legal-adjacent responses.

---

## Part 2: Moderate Gaps

### 7. Sample Data / Demo Mode

How does someone evaluate before committing their real employee data? Consider:
- 5-employee sample dataset ("Acme Corp")
- "Try with sample data" option in onboarding
- Clear "This is demo data" indicator

### 8. Chat Input Multiline

Architecture shows single-line input. HR questions are often multi-part:
- Allow Shift+Enter for newlines
- Auto-expand input height (max 4 lines)

### 9. Message Actions

Users will want to:
- Copy Claude's response
- Copy a specific code block or list
- Regenerate a response

Add subtle hover actions on message bubbles.

### 10. Rate Limit Awareness

Claude API has token limits. For users sending full employee rosters as context:
- Calculate context size before sending
- Warn if approaching limits
- Suggest trimming context ("Include only active employees?")

---

## Part 3: Stickiness Without Bloat

These additions increase user retention with minimal complexity:

### 1. Conversation Memory References (High Impact)

**What:** Let Claude reference past conversations naturally.

**Example:**
```
User: "Sarah is late again"
Claude: "I remember we discussed Sarah's tardiness pattern in March.
         You documented two verbal warnings then. Based on your
         progressive discipline approach, a written warning would
         be the next step. Would you like me to draft one?"
```

**Implementation:**
- Store conversation summaries
- Include recent relevant summaries in context
- ~50 LOC addition

**Why sticky:** Creates compounding value. The longer they use it, the more "memory" it has.

---

### 2. Employee Quick-Notes from Chat (High Impact)

**What:** When Claude suggests documenting something, offer one-click note attachment.

**Example:**
```
Claude: "Good call documenting this conversation with Sarah.
         [📎 Save as note for Sarah Chen]"
```

Clicking saves the relevant portion as a note attached to that employee record.

**Implementation:**
- Add `employee_notes` table
- Add "attach note" action in chat
- ~100 LOC addition

**Why sticky:** Turns conversations into permanent records. Data accumulates.

---

### 3. Proactive Monday Digest (Medium Impact)

**What:** On first launch of the week, surface a brief digest.

**Example:**
```
┌─────────────────────────────────────────────────┐
│  📅 This week at Acme Corp                      │
│                                                 │
│  🎂 Anniversaries: Sarah Chen (3 years Wed)     │
│  👋 New: Mike Ross (day 45 - check-in due?)     │
│  ⏰ No PTO logged for 3 months: 2 employees     │
│                                                 │
│  [Start a conversation about this]  [Dismiss]  │
└─────────────────────────────────────────────────┘
```

**Implementation:**
- Calculate dates from employee records
- Show on Monday between 6am-12pm
- Dismissible, never blocks
- ~150 LOC addition

**Why sticky:** Creates habit. Users open the app to see "what's this week."

---

### 4. Quick Employee Mention in Chat (Medium Impact)

**What:** Type `@` to autocomplete employee names in chat input.

**Example:**
```
Input: "What's the best way to give @Sar[ah Chen] feedback on..."
```

Selected employee's full context loads automatically.

**Implementation:**
- Autocomplete dropdown in chat input
- Highlighted employee in context panel
- ~75 LOC addition

**Why sticky:** Makes it faster to ask contextual questions. Reduces friction.

---

### 5. Keyboard-First Power User Mode (Low Impact, High Delight)

**What:** For the "solo HR hero" persona who values speed:

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New conversation |
| `Cmd+K` | Quick employee lookup |
| `Cmd+/` | Focus chat input |
| `Cmd+E` | Toggle employee panel |
| `Esc` | Close any overlay |

**Implementation:**
- Global keyboard listener
- ~50 LOC addition

**Why sticky:** Power users become advocates. They'll feel the difference vs. competitors.

---

## Part 4: Suggested Additions to Roadmap

### Phase 2 Additions
```
- [ ] Add/edit individual employee (not just CSV)
- [ ] Conversation list sidebar with search
- [ ] Employee status management (active/termed/leave)
- [ ] @-mention autocomplete for employees in chat
```

### Phase 3 Additions
```
- [ ] Graceful error states (API down, rate limits)
- [ ] Context size calculator (warn before hitting limits)
```

### Phase 4 Additions
```
- [ ] Data export (encrypted backup)
- [ ] Data import (restore from backup)
- [ ] Keyboard shortcuts (Cmd+N, Cmd+K, etc.)
- [ ] Monday digest (optional, dismissible)
```

---

## Part 5: Questions to Resolve

1. **Pricing validation:** Has $99 one-time been tested? Consider: $49 first year, $29/year renewal (still simple, but recurring).

2. **API cost transparency:** "~$2-8/month" is vague. Show estimated cost per conversation in settings? Help users understand Claude pricing.

3. **Multi-company support:** Solo HR consultants might have multiple clients. Is this a v2 feature or never?

4. **Audit trail depth:** "Audit log of what was sent to AI" — is this legally sufficient? Consider: exportable, timestamped, with PII redaction notes.

5. **Template/snippet library:** If users keep asking Claude for the same documents (offer letters, PIPs), should there be a saved templates feature? Or is "just ask again" good enough?

---

## Summary: The 10% Stickier Formula

| Addition | Effort | Stickiness Impact |
|----------|--------|-------------------|
| Conversation memory | ~50 LOC | Very High |
| Employee quick-notes | ~100 LOC | High |
| Monday digest | ~150 LOC | Medium |
| @-mention employees | ~75 LOC | Medium |
| Keyboard shortcuts | ~50 LOC | Low-Medium |
| Data export/import | ~200 LOC | Table-stakes |

**Total additional LOC:** ~625 (staying well under 3,000 target)

**The stickiness thesis:** Every feature above creates *compounding value*. The longer someone uses HR Command Center, the more:
- Conversations it remembers
- Employee notes accumulate
- Historical context deepens

This is the moat. Generic AI doesn't remember. HR Command Center does.

---

*Feedback generated: December 2025*
*Recommendation: Address critical gaps (1-6) before launch. Add stickiness features (1-2) in Phase 4.*
