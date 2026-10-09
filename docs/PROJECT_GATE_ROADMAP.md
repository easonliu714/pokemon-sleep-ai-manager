# Pokémon Sleep AI Manager — Canonical Gate Roadmap & Completion Authority

Updated: 2026-10-05  
Current production baseline at audit: `main@851997f9b3fae8466df8ee337f142becd22fb270` / `v0.4.27.55.3.3.18`  
Active successor implementation: `feature/v0427553319-g62-recipe-attempt-feedback` / target `v0.4.27.55.3.3.19`

This document is the canonical roadmap/status authority for future implementation conversations. Before implementing a "next Gate", re-read current `main`, this document, the parent issue, and exact runtime/regression evidence. **Do not rebuild a Gate only because an old issue checklist is stale.**

## 1. Frozen product / data authority decisions

### Recipe authority
- **Public Recipe Master is the only recipe identity authority.**
- Recipe name, category, fixed formula and ingredient quantities are Public/Shared data.
- Player SQLite stores player state only: `unlocked`, `recipe_level`, `current_energy`, optional notes/evidence metadata.
- The old `player_manual` / 「我的食譜」 / 「新增個人食譜」 parallel recipe-master concept is retired and must be removed from runtime/UI.
- UNKNOWN / AMBIGUOUS recipe evidence must fail closed to REVIEW_REQUIRED; it must never create a new recipe identity.

### General frozen boundaries
- Provider/Raw evidence is immutable.
- UNKNOWN is not zero/null authority.
- Shared/Public data and player-private data remain isolated.
- Public Master updates must not overwrite player state.
- AI may observe/propose/explain; deterministic platform authority owns canonical identity, calculation and writes.
- Migration 15 (Candy family storage) and Migration 16 (G12.1 authority) are frozen.
- Candy screenshot 24/20 explicit visible-target confirmation and ABSOLUTE_SNAPSHOT vs DELTA_EVENT semantics remain frozen.
- G14.1 CURRENT/FUTURE unlock state is derived from current level, not legacy `is_unlocked`.

## 2. Status vocabulary

- **CLOSED** — implementation + governed release/required validation are complete. Do not rebuild.
- **IMPLEMENTED / ISSUE-CLOSURE READY** — runtime/contracts already satisfy the Gate; issue metadata is stale and may be closed after recording evidence.
- **IMPLEMENTED / OWNER OR TARGETED CLOSURE PENDING** — implementation exists; only a focused validation/cleanup remains.
- **PARTIAL** — meaningful implementation exists, but stated product outcome is not complete.
- **OPEN** — substantial implementation is still required.
- **RETIRED / SUPERSEDED** — historical design is no longer a valid product direction.

## 3. Current Gate completion matrix

| Gate | Current status | What already exists | Remaining work / disposition |
| --- | --- | --- | --- |
| P0-B6 Candy family storage | CLOSED | family canonical storage, Migration 15, ABSOLUTE_SNAPSHOT/DELTA_EVENT, real-device closure | Never reopen absent regression |
| TECH.2 Observation / Identity / guarded import | IMPLEMENTED / closure audit candidate | Observation v2, candidate resolver, confirmation UI, transaction/apply bridge, Android import, sparse update semantics | Reconcile stale parent issue #37 and close if no acceptance item is genuinely missing |
| DATA.1D / DATA.1D.1 OCR | IMPLEMENTED / closure audit candidate | local OCR runtime, region OCR, thumbnail/overlay, review package, cancellation/progress, consolidated screenshot pipeline | Reconcile stale #55/#63; do not rebuild |
| DATA.1E import review | IMPLEMENTED / closure audit candidate | field diff, identity review, Dry Run, Snapshot, transaction, rollback, audit | Reconcile stale #56 |
| DATA.1F approximate-image duplicate | OPEN | exact hash/fingerprint foundations exist | pHash/dHash/OCR-near-duplicate review is not proven complete (#58) |
| DATA.2A Full75 completeness | PARTIAL | completeness engine, sparse import, user-confirmed-not-visible semantics, Full75 retirement foundations | private 75/75 evidence/readiness closure remains (#144) |
| G4 / DATA.1 Public Master foundation | PARTIAL, broad umbrella | mature recipe, ingredient, Pokémon, berry, evolution, item/event authorities exist | future work is coverage audit + real gaps only; do not rebuild existing masters (#48) |
| **G5.1 Player Recipe State** | **CLOSED** | canonical `recipe_catalog_state`, unlocked vs locked UI, level/current-energy player state, retired personal-recipe UI/runtime | owner Android/PWA PASS on `.16`; #1 closed 2026-10-02 |
| **G5.2 Canonical Recipe State JSON Import** | **CLOSED** | recipe Update Center validation, canonical master lookup, strict player-state allowlist, canonical id/name revalidation, Dry Run/Apply parity, duplicate update_id guard, Snapshot/transaction/rollback/persist/audit | `.18` merged to main; #2 closed |
| **G5.3 Screenshot → Recipe State** | **CLOSED** | UC.IMG-A recipe scenario, Public Master constrained recognition, MATCHED/AMBIGUOUS/UNMATCHED, canonical revalidation, state Update Package | owner Android/PWA recipe screenshot evidence PASS on `.18`; #3 closed 2026-10-05 |
| **G5.4 Public Recipe Authority** | **CLOSED** | current authority, provenance, aliases, formula audit, 78-recipe authority, controlled master sync, player-state preservation/idempotency, single Public Recipe Master product model | owner `.16` canonical recipe surface PASS; #4 closed 2026-10-02 |
| **G6.1 Ingredient Gap Planner** | **CLOSED** | deterministic ingredient-gap engine, recipe strategy projection, safe reserve, pot fit, unlocked/locked classification, shortage sorting, War Room UI, regression | #5 closed; rarity/portfolio optimization belongs to G7 rather than reopening G6.1 |
| **G6.2 Recipe Attempt Feedback** | **ACTIVE IMPLEMENTATION / CI PENDING** | `.19` branch adds Migration 17 local attempt history, local pause/reference-warning state, deterministic recommendation suppression/resume, Android/PWA War Room feedback UI, regression contract | exact-head CI → merge/main CI/Pages → focused owner real-device validation; keep #6 open until closure evidence |
| G6 Epic | PARTIAL | G6.1 CLOSED; G6.2 successor implementation active | remains open until #6 owner closure (#16) |
| G7 Cooking AI / deterministic cooking planner | CLOSED | shared-inventory contention, multi-meal simulation, preserve/unlock/continuous/max-verified-energy objectives, current-energy authority, event multiplier authority, team supply capability, deterministic/AI-proposal re-evaluation | #17 and #246 closed; ingredient/hour production-rate authority intentionally remains separate (#278) |
| G8 Weekly Planner | PARTIAL | weekly context, effective context, recipe recommendation and War Room strategy foundations | full seven-day planner/team/meal substitution schedule remains (#18) |
| G9 Event Manager | PARTIAL | Public Event Master, manifest/schema/store, typed effects, effective weekly integration | full import/lifecycle/UI management acceptance remains (#19) |
| G10 / WAR.1 Team Builder | PARTIAL | controlled selectors, candidate projection/scoring, deterministic 5-member optimizer, Team Card/alternatives | persisted multi-team CRUD, full energy model, comparison/AI draft lifecycle remain under #20/#40 |
| G11 Capture Planner | OPEN / only collection-target foundation | basic collection targets exist | capture target engine and recommendation workflow still required |
| **G12.1 Evolution Planner A–E** | **IMPLEMENTED / ISSUE-CLOSURE READY** | A authority + Migration16, B deterministic status/read API, C explainable recommendation, D UI/provider/War Room binding, E mobile regression; real-device D/E closure | close stale #411 and parent #41 after evidence comment; missing acquisition facts correctly fail closed and are not a reason to rebuild engine |
| G13 AI Assistant Center | PARTIAL but extensive | OCR pipeline, Observation v2, identity review/import, encrypted Project Pool, queue/failover, structured Gemini, review workbench, provider/raw safety | parent remains open for final product consolidation; do not rebuild completed OCR/import pieces (#42) |
| G14.1 Derived Unlock State | IMPLEMENTED / owner closure status must be explicit | CURRENT/FUTURE authority, level-derived ingredients/subskills, roster integration, regression, .13 release | keep #457 open unless owner physical gate is explicitly recorded PASS |
| G14.2 ROI Engine | OPEN | no complete ROI engine | next Training Coach compute layer |
| G14.3 Sleep Scheduling | OPEN | G12 sleep projection exists, but multi-target nightly scheduling is not complete | implement after ROI/evolution inputs |
| G14.4 Coach UI | OPEN | no complete coach dashboard | implement after G14.2/3 |
| G14.5 Coach closure | OPEN | — | regression + Android/PWA closure |
| G15 Scenario Simulator | OPEN | no governed sandbox core | G15.1→G15.5 remain |

## 4. Issue cleanup — high-confidence disposition

### Closed by the 2026-09-30 stale-Issue reconciliation
- #5 — G6.1 Ingredient Gap Planner.
- #17 — G7 Cooking AI / deterministic cooking planner.
- #37 — TECH.2 Observation v2 / Identity / guarded import.
- #41 — G12.1 parent A–E.
- #55 — DATA.1D OCR/classification parent.
- #56 — DATA.1E SQLite compare/import review.
- #63 — DATA.1D.1 OCR Runtime UI / Review Package.
- #64 — G13.2A Project Pool/failover.
- #163 — WAR.1A Goal Profile + Evaluation Snapshot.
- #165 — WAR.1B Strategy Context / Gemini privacy contract.
- #173 — WAR.2A Candidate Feature Projection/scoring foundation.
- #174 — v0.4.3 Recipe/Selector/Team Optimizer parent.
- #178 — Controlled Multi-select.
- #179 — deterministic 5-member Team Optimizer UX.
- #191 — Recipe Discovery Stockpile (implemented, then superseded by canonical promotion).
- #246 — G7 verified-energy cooking objective.
- #411 — G12.1A Readiness Audit.

### Must remain open now
- #6 / #16 G6.2 + G6 Epic.
- #7 full historical ZIP inventory/extraction.
- #48 broad Public Master coverage.
- #58 near-duplicate detection.
- #144 Full75 private completeness closure.
- #278 ingredient probability production authority.
- #295 Startup watchdog native-dialog/manual-block false-positive gap.
- #420 Gemini HTTP 400 compact schema: current provider schema still repeats full catalog enums.
- #462 Advanced OCR task-card anchor: code fix exists on Draft PR #463, live owner retest not yet done.
- #457 G14.1 until owner physical PASS is explicitly recorded.
- #18 G8, #19 G9, #20/#40 G10/WAR.1, #42 G13 parent, #43 G14 parent, #44 G15.
- #47 broad onboarding/camp initialization.
- #164 evolution evidence backfill unless a separate route-coverage audit proves all original UNKNOWN species are resolved.
- #265 Decision UI until its complete persistent decision workflow is verified.

## 5. Correct next execution order

1. **G6.2 Recipe Attempt Feedback (#6)** — current active Gate. Complete exact-head CI, merge/main CI/Pages, then focused Android/PWA owner validation. Personal failure evidence must remain local and advisory-only.
2. After G6.2 closure continue genuinely incomplete work: **G9 → G10/WAR.1 → G8 → G11 → G13 closure → G14.2–5 → G15**.
3. Continue stale-Issue reconciliation only when exact evidence exists; never equate unchecked boxes with missing code.
4. G12.1 must be treated as completed baseline, not a future implementation Gate.
5. G5.1–G5.4 and G6.1 are completed baselines; do not reopen absent a demonstrated regression.

## 6. Anti-drift rule

Before every new implementation Gate:
1. fresh-read `main` exact SHA;
2. fresh-read this roadmap;
3. inspect current runtime modules/regressions and commit history;
4. classify the Gate as CLOSED / implemented / partial / open;
5. only write code for proven gaps;
6. update this document and the corresponding Issue when status changes.

A stale unchecked GitHub checklist is **not evidence that functionality is missing**.
