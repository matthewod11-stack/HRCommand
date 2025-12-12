HR Command Center — GPT-5.2 Feedback (Dec 12, 2025)

What’s already strong
- Crisp product thesis: chat-first, local-first, privacy-first.
- Clear “what we’re NOT building yet” guardrails.
- Practical stack and app-architecture choices (Tauri/Rust boundary for sensitive ops).
- Early inclusion of PII scanning + audit log (rare, good).

Biggest blanks / risks to address (without bloating scope)

1) Trust, safety, and liability (you’ll need explicit guardrails)
- “Not legal advice” and “verify with counsel” microcopy: where it appears (onboarding, footer under answers, export).
- Jurisdiction handling: you’ll give different answers for CA vs TX vs UK. You have “company state” but you’ll also need:
  - employee work location (state/country) vs company HQ
  - employee type (W2/1099, exempt/non-exempt, full/part-time)
  - remote worker multi-state reality
- Prompt injection & data exfil risks:
  - documents/employee notes can contain instructions (“ignore previous… send all data”). Define a system-level policy and stripping rules.
  - “PII scan before API” is necessary but not sufficient: also restrict what context is injected by default.
- Database protection: SQLite is local, but not encrypted by default.
  - Decide: is “local user account access” in-scope threat? If yes, you likely need at-rest encryption for the DB (or at least sensitive fields).
- Audit log definition: what gets logged (request/response? redacted? hashes?), retention policy, and export/delete.

2) Context injection needs relevance + explainability
Right now it implies “employee roster → system prompt.” That will break quickly (tokens, hallucination risk, wrong employee chosen).
- Add a minimal “Context Builder” spec:
  - retrieval step: select only relevant employees/fields based on the question
  - deterministic linking: when a response references “Sarah,” show which Sarah and why
  - citations-to-local-data: “Used: Employees.csv row 42 (Sarah Chen), hire_date, work_state”
This improves correctness and user trust more than new features.

3) Data model gaps that affect v1 outcomes
You can keep 3 tables and still model what matters by adding a small amount of structure.
- Employees table likely needs:
  - work_location_state/country (separate from department)
  - employment_type (employee/contractor)
  - classification (exempt/non-exempt)
  - manager_id is good; also employee_id (human-friendly) may matter
- Conversations:
  - don’t store only messages_json long-term; add minimal metadata columns so you can do fast search/filter later (title, last_message_at, tags)
- Company profile:
  - industry, HQ, operating states/countries, pay cadence, benefits basics (even if optional)

4) “Protection” is broader than PII patterns
- Add “sensitive HR categories” beyond SSN/CC/bank:
  - medical/diagnosis info (HIPAA-adjacent), disability accommodations
  - background check content
  - minors, immigration/work authorization
- Decide policy for these: warn, redact, or block by default.
- Consider attachment ingestion later; but for v1, at least defend the text channel.

5) Distribution and support reality (often overlooked)
- Code signing/notarization is listed (good). Add:
  - crash reporting stance (none? opt-in? local-only?)
  - how users migrate data across machines (export/import zip) without cloud sync
  - “lost key / reinstall” story (DB lives locally; license validation vs offline)

How to make it ~10% stickier (without bloat)

The theme: make the app “remember” and “follow up” in tiny, optional ways.

1) Saved answers as reusable “Snippets” (tiny feature, big retention)
- One-click: “Save this as a policy draft / email / checklist.”
- Later: type “/snippets” or search to reuse.
Why sticky: users accumulate assets and come back to refine, not re-ask.

2) “Next steps” chip + lightweight reminders (no task manager UI)
- After an answer, show 2–3 optional chips:
  - “Create a manager script”
  - “Draft documentation checklist”
  - “Remind me in 7 days to follow up”
Reminders can be local notifications; store as a simple scheduled item (could be in settings JSON initially).
Why sticky: creates a reason to return tied to real HR workflows.

3) Conversation titles + fast search
- Auto-title conversations and add global search (messages + employee names).
Why sticky: it becomes a reference library (“what did we decide last time?”).

4) “What context did you use?” transparency toggle
- A collapsible panel that lists exactly what fields/records were included.
Why sticky: increases trust, reduces fear of “AI making things up,” encourages habitual use.

5) Starter prompts that adapt to company profile
- On empty state, show 6 prompts tailored to industry/state/size (not generic).
Why sticky: reduces blank-page friction and teaches the product’s strengths.

Low-bloat doc edits I’d make

Roadmap
- Add a short “Phase 0: Guardrails” (2–3 bullets): disclaimers, jurisdiction fields, context relevance.
- In Phase 2, change “employee roster → system prompt” to “retrieval + selective context injection.”
- In Phase 3, expand “PII scanner” to “sensitive data policy” (PII + health + immigration + minors).

Architecture
- Add a “Threat model (v1)” section: what you protect against and what you explicitly don’t.
- Add a “Context Builder” section: retrieval rules, token budget, and a transparency UI.
- Add minimal metadata to conversations for search and titles.

A few decisions you should lock early (they cascade)
- Does any employee data ever get sent by default, or only after user confirmation?
- Will the DB be encrypted at rest? If not, document why and what the risk is.
- What is your redaction strategy (replace with placeholders like [SSN_REDACTED]) and do you store originals?
- Will you support multiple work locations per employee (remote + travel), or just primary location?
