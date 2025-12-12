# HR Command Center — Gap Analysis & Stickiness Strategy

> **Purpose:** Identify missing considerations and lightweight features that increase user retention without bloat.

---

## Critical Gaps to Address

### 1. Error Handling & Resilience

**Missing:**
- API failure handling (rate limits, timeouts, invalid keys)
- Network connectivity detection
- SQLite corruption recovery
- CSV import validation and error messages
- Graceful degradation when context is too large

**Recommendation:**
```rust
// Add to chat.rs
pub enum ChatError {
    ApiKeyInvalid,
    ApiRateLimit,
    NetworkError,
    ContextTooLarge,
    DatabaseError,
}

// Frontend: Show friendly error messages, not stack traces
// "Can't reach Claude right now. Check your internet connection."
```

**Impact:** Prevents user frustration from cryptic failures.

---

### 2. Data Management & Migration

**Missing:**
- Backup/export strategy (mentioned but not detailed)
- Schema migration path for future updates
- Handling large employee datasets (1000+ employees)
- Data cleanup/archival strategy

**Recommendation:**
- **Export:** Add "Export all data" button in settings → JSON backup
- **Migration:** Use SQLx migrations with version tracking
- **Performance:** Add pagination for employee list, lazy-load context
- **Cleanup:** Auto-archive conversations older than 90 days (optional)

**Impact:** Users trust their data is safe and recoverable.

---

### 3. Onboarding Flow Details

**Missing:**
- Step-by-step first-launch experience
- CSV format guidance/template
- Sample questions to get started
- Empty state messaging

**Recommendation:**
```
First Launch Flow:
1. Welcome screen: "Let's set up your HR brain"
2. API key input (with link to Anthropic signup)
3. Company profile (name, state, industry) - optional but helpful
4. CSV import with format example
5. First question suggestion: "Who's been here longest?"
```

**Impact:** Reduces time-to-value from 2 minutes to 30 seconds.

---

### 4. Conversation Management

**Missing:**
- How to search past conversations
- How to reference/continue previous chats
- Conversation organization
- Export individual conversations

**Recommendation:**
- Add conversation list sidebar (collapsible, shows last 10)
- Cmd+F to search within current conversation
- Cmd+Shift+F to search all conversations
- Each conversation gets a title (auto-generated from first question)

**Impact:** Makes the tool a knowledge base, not just a chat.

---

### 5. Context Window Management

**Missing:**
- What happens with 500+ employees?
- How to prioritize which employees to include?
- Token usage tracking/limits

**Recommendation:**
```rust
// Smart context selection
pub fn build_context(query: &str, employees: Vec<Employee>) -> String {
    // 1. Use semantic search to find relevant employees (if query mentions names/departments)
    // 2. Limit to top 20 most relevant
    // 3. Fallback: Include all if < 50 employees
    // 4. Add note: "Showing 20 of 150 employees. Ask about specific people for more detail."
}
```

**Impact:** Handles scale without breaking.

---

### 6. Performance Considerations

**Missing:**
- Response time optimization
- Large conversation history handling
- UI responsiveness during API calls

**Recommendation:**
- Stream responses (Claude supports streaming)
- Virtualize message list for long conversations
- Show "thinking..." state immediately
- Cache recent employee queries

**Impact:** Feels instant, not sluggish.

---

### 7. Testing Strategy

**Missing:**
- How to validate PII detection
- How to test context injection accuracy
- Integration test approach

**Recommendation:**
- Unit tests for PII scanner (test cases: SSN formats, credit cards)
- Integration test: Mock Claude API, verify context format
- Manual QA checklist for each phase

**Impact:** Confidence in shipping.

---

## Stickiness Features (10% More Retention, Zero Bloat)

### Tier 1: Must-Have (Build in Phase 2-3)

#### 1. **Conversation History Sidebar**
- Collapsible panel showing last 10 conversations
- Click to resume
- Auto-generated titles ("Performance review process", "Sarah's leave request")
- **LOC:** ~150 lines
- **Impact:** Users return to find answers, not re-ask

#### 2. **Keyboard Shortcuts**
```
Cmd+K          → Quick actions menu
Cmd+/          → Show shortcuts help
Cmd+Shift+S    → Settings
Cmd+F          → Search current conversation
Esc            → Close modals/panels
```
- **LOC:** ~50 lines
- **Impact:** Power users feel fast, casual users discover gradually

#### 3. **Smart Prompt Suggestions**
- Show 3-4 contextual prompts below input when empty
- Examples: "Who's been here longest?", "Review our PTO policy", "Help with performance review"
- Rotate based on time of year (Q4 = reviews, Q1 = planning)
- **LOC:** ~100 lines
- **Impact:** Reduces blank page anxiety, guides new users

#### 4. **Export Conversation**
- Right-click message → "Copy as markdown"
- Settings → "Export all conversations" → JSON/Markdown
- **LOC:** ~80 lines
- **Impact:** Users can save/share answers, builds trust

### Tier 2: Nice-to-Have (Phase 4 Polish)

#### 5. **Window State Memory**
- Remember window size, position, panel state
- **LOC:** ~30 lines (Tauri built-in)
- **Impact:** Feels personalized, not reset every time

#### 6. **Quick Employee Reference**
- Type "@" in chat input → autocomplete employee names
- Inserts: "Sarah Chen (Marketing Manager, hired 2021)"
- **LOC:** ~120 lines
- **Impact:** Faster context building, less typing

#### 7. **Copy-Friendly Responses**
- Each assistant message has subtle "Copy" button on hover
- Copies formatted text (not markdown)
- **LOC:** ~40 lines
- **Impact:** Users share answers with team/employees

#### 8. **Empty State Guidance**
- If no employees imported: "Start by importing your employee roster"
- If no conversations: "Try asking: 'Who's been here longest?'"
- **LOC:** ~60 lines
- **Impact:** Reduces confusion, guides action

### Tier 3: Future (Post-Launch)

#### 9. **Conversation Search**
- Full-text search across all conversations
- **LOC:** ~200 lines (SQLite FTS)
- **Impact:** Becomes knowledge base

#### 10. **Templates/Saved Prompts**
- Save common questions as templates
- "Review PTO policy", "Performance review checklist"
- **LOC:** ~150 lines
- **Impact:** Repeat workflows become faster

---

## What NOT to Add (Bloat Prevention)

| Feature | Why Skip | Alternative |
|---------|----------|-------------|
| Notifications | Desktop app, user opens when needed | None needed |
| Analytics dashboard | Users want answers, not metrics | Export data if they want |
| Multi-account switching | Solo user focus | Single company per install |
| Chat themes/customization | One good theme is enough | System appearance respect |
| Voice input | Keyboard is faster for HR | Skip |
| Collaboration features | Solo user first | Export/share if needed |
| Mobile app | Desktop workflow | Responsive if window resized |

---

## Implementation Priority

### Phase 2 (Context) - Add:
- [ ] Conversation history sidebar
- [ ] Smart prompt suggestions
- [ ] Empty state guidance

### Phase 3 (Protection) - Add:
- [ ] Export conversation (markdown)
- [ ] Error handling improvements

### Phase 4 (Polish) - Add:
- [ ] Keyboard shortcuts
- [ ] Window state memory
- [ ] Copy-friendly responses
- [ ] Quick employee reference (@ mentions)

**Total Additional LOC:** ~730 lines (well within 3,000 budget)

---

## The Stickiness Formula

**Retention = (Value × Speed × Trust) / Friction**

- **Value:** Context-aware answers (already planned)
- **Speed:** Keyboard shortcuts, quick actions, smart suggestions
- **Trust:** Export, backup, error handling
- **Friction:** Onboarding, empty states, helpful guidance

**10% improvement comes from:**
1. Making it faster to use (shortcuts, suggestions)
2. Making it easier to find past answers (history sidebar)
3. Making users feel safe (export, error handling)
4. Reducing cognitive load (empty states, guidance)

---

## Missing Technical Details

### 1. License Validation Flow
```
User purchases → Receives license key → Enters in app → 
Validates against server (one-time) → Stores locally → 
Future launches check local validation
```

### 2. Auto-Update Mechanism
- Use `tauri-plugin-updater`
- Check GitHub Releases on launch (weekly)
- Show update notification, user chooses when

### 3. API Key Validation
- Test API key on entry (make test call)
- Show "Valid ✓" or "Invalid ✗" immediately
- Don't store invalid keys

### 4. Context Size Limits
- Monitor token count (Claude has 200k context window)
- If > 150k tokens, truncate oldest messages
- Show warning: "Long conversation, some context may be truncated"

---

## Questions to Answer Before Building

1. **CSV Format:** What's the expected format? Provide template?
2. **Company Profile:** Required or optional? What fields?
3. **Conversation Limits:** Unlimited or cap at N conversations?
4. **Employee Limits:** Test with 10, 100, 1000 employees?
5. **Offline Mode:** What happens if no internet? (Show cached answers?)
6. **Multi-language:** English only or i18n?
7. **Windows/Linux:** macOS only or cross-platform?

---

## Recommended Additions to Roadmap

### Phase 1.5: Error Handling (Add 2-3 days)
- [ ] API error handling
- [ ] Network detection
- [ ] Friendly error messages

### Phase 2.5: Conversation Management (Add 2-3 days)
- [ ] History sidebar
- [ ] Conversation titles
- [ ] Search within conversation

### Phase 4.5: Polish Enhancements (Add 2-3 days)
- [ ] Keyboard shortcuts
- [ ] Export functionality
- [ ] Window state memory

**Total addition:** ~1 week, but significantly improves stickiness.

---

## Final Recommendation

**Build these 5 features for maximum stickiness with minimal bloat:**

1. ✅ **Conversation History Sidebar** - Makes it a knowledge base
2. ✅ **Keyboard Shortcuts** - Makes power users feel fast
3. ✅ **Smart Prompt Suggestions** - Guides new users
4. ✅ **Export Conversations** - Builds trust and utility
5. ✅ **Error Handling** - Prevents frustration

**Total:** ~500 lines of code, massive impact on retention.

Everything else can wait for v1.1 based on real user feedback.

---

*Generated: December 2025*
*Focus: Stickiness without bloat*

