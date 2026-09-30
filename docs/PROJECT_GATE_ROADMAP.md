# Pokémon Sleep AI Manager — Canonical Gate Roadmap & Completion Authority

Updated: 2026-09-30  
Current production baseline at audit: `main@897bbeae6819acfba7a5a40c20276a72caf1ce3f` / `v0.4.27.55.3.3.14`

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
| **G5.1 Player Recipe State** | **IMPLEMENTED core / CLEANUP PENDING** | canonical `recipe_catalog_state`, unlocked vs locked UI, level/current-energy player state | retire old personal-recipe model; remove PLAYER_ONLY product projection; harden regressions (#1) |
| **G5.2 Canonical Recipe State JSON Import** | **IMPLEMENTED core / HARDENING PENDING** | recipe Update Center validation, canonical master lookup, Dry Run, duplicate update_id guard, Snapshot/transaction/rollback/persist/audit | enforce strict recipe-state field allowlist so import cannot write recipe identity/category/formula fields (#2) |
| **G5.3 Screenshot → Recipe State** | **IMPLEMENTED / OWNER CLOSURE PENDING** | UC.IMG-A recipe scenario, Public Master constrained recognition, MATCHED/AMBIGUOUS/UNMATCHED, canonical revalidation, state Update Package | focused Android/PWA recipe-screenshot Review→Dry Run→Apply evidence before closing #3 |
| **G5.4 Public Recipe Authority** | **IMPLEMENTED / ISSUE-CLOSURE READY** | current authority, provenance, aliases, formula audit, 78-recipe authority, controlled master sync, player-state preservation/idempotency | close #4 with evidence |
| **G6.1 Ingredient Gap Planner** | **IMPLEMENTED / ISSUE-CLOSURE READY** | deterministic ingredient-gap engine, recipe strategy projection, safe reserve, pot fit, unlocked/locked classification, shortage sorting, War Room UI, regression | close #5; rarity/portfolio optimization belongs to later G7 rather than reopening G6.1 |
| G6.2 Recipe Attempt Feedback | OPEN | no complete player-feedback lifecycle proven | implement under #6 |
| G6 Epic | PARTIAL | G6.1 complete | remains open for G6.2 (#16) |
| G7 Cooking AI / deterministic cooking planner | IMPLEMENTED FAR BEYOND OLD CHECKLIST / closure reconciliation needed | shared-inventory contention, multi-meal simulation, preserve/unlock/continuous/max-verified-energy objectives, current-energy authority, event multiplier authority, team supply capability, AI proposal re-evaluation | production-rate authority is intentionally NOT_YET_VERIFIED; reconcile #17/#246 against intended scope rather than rebuild |
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

### Closure-ready now
- #4 — G5.4 Public Recipe Authority.
- #5 — G6.1 Ingredient Gap Planner, with scope clarified to deterministic gap/readiness; later optimization stays in G7.
- #411 — G12.1A Readiness Audit; superseded by completed A authority closure and downstream B–E.
- #41 — G12.1 parent; A–E implementation and real-device closure exist.
- #174 — v0.4.3 Recipe/Selector/Team Optimizer parent; implementation + targeted Android/PWA closure were recorded.
- #178 — Controlled Multi-select; shipped and Android selector hotfix validation recorded.
- #179 — deterministic 5-member Team Optimizer UX; shipped and real-device team behavior recorded.
- #191 — Recipe Discovery Stockpile; implemented in v0.4.6 and its historical discovery recipes were subsequently promoted to canonical authority.
- #246 — G7 verified-energy cooking objective; current planner and regression implement it.

### Likely closure-ready, but perform one focused evidence reconciliation before changing issue state
- #37 TECH.2 Observation v2.
- #55 DATA.1D parent.
- #56 DATA.1E import review.
- #63 DATA.1D.1 OCR Runtime UI.
- #64 G13.2A Project Pool / failover.
- #163 Goal Profile + Evaluation Snapshot.
- #165 Strategy Context Package + Gemini privacy contract.
- #173 Candidate Feature Projection + scoring foundation.

### Must remain open now
- #1 G5.1 cleanup.
- #2 G5.2 strict canonical player-state hardening.
- #3 G5.3 focused owner recipe screenshot closure.
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

1. **G5.1R cleanup + #462** — remove the obsolete personal-recipe product surface; keep/finalize the Advanced OCR anchor fix.
2. **G5.2 hardening** — recipe Update Center may mutate only canonical player-state fields.
3. **G5.3 focused owner closure** — use the already-built screenshot path; do not rebuild it.
4. Close/document **G5.4 + G6.1** as already implemented.
5. Reconcile/close stale historical issues that have existing implementation evidence.
6. Continue genuinely incomplete work: **G6.2 → remaining G7 closure → G9 → G10/WAR.1 → G8 → G11 → G13 closure → G14.2–5 → G15**.
7. G12.1 must be treated as completed baseline, not a future implementation Gate.

## 6. Anti-drift rule

Before every new implementation Gate:
1. fresh-read `main` exact SHA;
2. fresh-read this roadmap;
3. inspect current runtime modules/regressions and commit history;
4. classify the Gate as CLOSED / implemented / partial / open;
5. only write code for proven gaps;
6. update this document and the corresponding Issue when status changes.

A stale unchecked GitHub checklist is **not evidence that functionality is missing**.
