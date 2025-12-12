# Codex Feedback — HR Command Center

## Key Gaps to Close
- Data lifecycle: backup/export/import plan, schema versioning/migrations, and secure wipe behavior. Decide on SQLite at-rest protection (OS sandbox only vs SQLCipher or Keychain-wrapped key).
- Trust & safety: prompt guardrails for legal tone/disclaimers/refusals; PII handling policy; “do-not-send” list; redact-and-continue flow with preview.
- Observability/reliability: local logs, redaction before logging, offline handling, retry/backoff, error surfaces, crash recovery/reporting stance.
- Context coverage: ingest handbooks/policies/state rules; context chips for employee/policy/state; show citations/sources.
- Evaluation: golden HR scenarios, regression prompts, latency/cost checks; fake Claude stub; Rust unit tests + Playwright smoke for chat/import.
- Updates/licensing: license validation flow, air-gapped grace, key revocation, update rollback for corrupted releases.

## Roadmap Tightening (no bloat)
- Phase 1: Add fake Claude stub + smoke tests; decide encryption stance; seed sample data and a first-run checklist.
- Phase 2: Add policy/handbook ingestion (PDF/text), simple chunked search + summarization, context chips, and citations format.
- Phase 3: Expand PII to “do-not-send” list + redact preview; add audit/export of sent payloads.
- Phase 4: Onboarding flow with scenario cards; signed build verification step; basic telemetry plan (local-only by default, optional anonymized if acceptable).
- Phase 5: Activation/retention metrics (day-1/7 repeat use, % importing data, % reaching first helpful answer); weekly feedback triage loop.

## 10% Stickier Ideas
- First-run value: starter dataset + “Try a scenario” cards (e.g., “Performance concern about Sarah (CA)”) so value shows in 30 seconds.
- Persistent context chips so answers stay anchored without retyping.
- Responses end with a 3-point action checklist plus a reusable artifact (email/letter/template) so it feels like work is done.
- Confidence + source callouts from local data/policies (“Using: Handbook PTO policy, Sarah’s tenure 3y”) to build trust fast.
- Weekly local-only recap of topics and open items—light nudge to return without heavy notifications.
- PII guardrail UX: redact-and-continue with preview and “always redact these terms” list to reduce friction when flagged.
