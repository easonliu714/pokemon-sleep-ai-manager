# War Room Strategy Architecture

Status: **Normative design draft**  
Tracking: #40, #162, #163, #165, #166  
First strategy prerequisite: #167 → #168 → #170 → #169

## 1. Design goal

The War Room is a **goal-driven local strategy engine** for Pokémon Sleep. It must remain useful when Gemini/API/network is unavailable and must not treat an LLM response as the numeric source of truth.

The architecture is split into three layers:

1. **Public Master / Rules** — versioned public game facts and formulas.
2. **Local Deterministic Strategy Engine** — computes candidates from player-local state, weekly context, goals and hard constraints.
3. **Gemini Optional Layer** — parses activity/event text, maps natural-language goals to structured goals, and explains deterministic trade-offs.

Gemini must never bypass local validation or directly overwrite canonical Pokémon, inventory, team or strategy results.

## 2. Public facts vs player facts

### Public Master / Rules

Examples:
- Pokémon species facts, specialty, type/berry mapping, skills and evolution routes.
- Recipe definitions and ingredient requirements.
- Item facts and acquisition rules.
- Camp/island rules and relevant energy/research thresholds.
- Event rule definitions after verification.
- Strategy formulas and rule version.

Requirements:
- stable IDs;
- immutable/versioned authority IDs;
- provenance and verification status;
- UNKNOWN / REVIEW_REQUIRED must not be silently guessed;
- public refresh must not overwrite player-owned fields.

### Player-local facts

Examples:
- Pokémon instances, observed abilities and current level;
- unlocked recipe state;
- ingredient/item inventory;
- current teams;
- progression and training targets;
- user-defined safe reserves and goal profiles.

These remain local by default.

## 3. Goal profile

A strategy run begins with a structured `strategy_goal_profile`.

Initial primary/secondary goals:
- `max_snorlax_energy`
- `unlock_recipes`
- `ingredient_stockpile`
- `dream_shard_farming`
- `research_unlock`
- `evolution_progress`
- `training_roi`
- `event_objective`
- `balanced`

Soft goals use weights. Hard constraints are evaluated separately and cannot be compensated by a higher score.

## 4. Hard Constraints v1

### Team membership
- `must_include_pokemon`
- `exclude_pokemon`
- `must_include_role`
- `max_same_species`

### Readiness / training
- `current_unlocks_only`
- `no_untrained_candidates`
- `training_budget`

### Inventory / cooking
- `ingredient_safe_reserve`
- `item_safe_reserve`
- `pot_capacity_limit`
- `recipe_unlock_policy`

### Time / progression
- `sleep_evolution_member_at_night`
- `preserve_current_team_slots`
- `minimum_goal_progress`

### Data confidence
- `require_verified_master`
- `require_complete_profile_fields`

Each candidate must output:

```json
{
  "hard_constraint_status": "PASS|FAIL|REVIEW",
  "failed_constraints": [],
  "missing_inputs": [],
  "score_breakdown": {}
}
```

`FAIL` candidates are excluded before ranking.

## 5. Evaluation model

Do not repeatedly overwrite one global `pokemon.ai_score` as weekly context changes.

A versioned `pokemon_evaluation_snapshot` should separate at least:

- `intrinsic_score` — long-term quality of the individual.
- `current_readiness_score` — currently usable abilities at the current level/unlock state.
- `weekly_fit_score` — camp, favorite berries, dish category and event fit.
- `roster_marginal_value_score` — marginal value relative to the user's current box.
- `training_roi_score` — expected value of additional candy/shard/seed/item investment.

Every snapshot records:
- player snapshot/input fingerprint;
- weekly `context_id`;
- `goal_profile_id`;
- public master version set;
- strategy rule version;
- calculation timestamp;
- score breakdown, reasons and missing inputs.

## 6. Recalculation triggers

Recalculate only when a relevant input fingerprint changes.

Trigger classes:
- confirmed new/removed Pokémon;
- level/evolution/skill/ingredient/subskill/nature update;
- crossing an unlock threshold;
- weekly camp/dish/favorite berry/pot/event change;
- goal profile/hard constraint change;
- relevant inventory threshold crossing;
- recipe unlock/progression change;
- public master/rule/event version change.

Simple view navigation must not trigger recomputation. Valid snapshots should survive PWA restart.

## 7. Strategy Context Package for Gemini

After local prefiltering, an opt-in Gemini request may contain only the minimum necessary structured summary:

```json
{
  "weekly_context": {},
  "goal_profile": {},
  "current_team": [],
  "candidate_pokemon": [],
  "recipe_gap_summary": [],
  "inventory_summary": {},
  "deterministic_candidates": [],
  "public_version_refs": {}
}
```

Rules:
- do not send the whole SQLite database;
- do not send API keys;
- do not send unrelated raw OCR or screenshots;
- prefilter the Pokémon box locally before provider calls;
- use ephemeral candidate references when stable private IDs are unnecessary;
- provider output must pass JSON Schema/allowlist validation;
- provider output is advisory until explicitly confirmed locally.

## 8. Recipe-first implementation order

The strategy engine must not optimize against conflicting recipe authorities.

Therefore the implementation order is:

1. **#167** Read-only recipe authority baseline audit.
2. **#168** Introduce single versioned `PUBLIC_RECIPE_MASTER` and migrate all runtime readers/writers.
3. **#170** Complete recipe provenance/verification review.
4. **#169** Expose deterministic recipe strategy projection (`required / available / shortage / pot-fit / unlock-state`).
5. **#163** Goal Profile + Evaluation Snapshot runtime contract.
6. Team candidate generation and scoring.
7. **#165** Minimal Gemini Strategy Context Package.
8. **#166** Snapshot lifecycle and trigger optimization.

## 9. Privacy and determinism acceptance criteria

- Same master/rule/profile/context/player snapshot produces the same deterministic result.
- API disabled/offline still produces local strategy candidates.
- Weekly-fit changes do not modify intrinsic observations.
- No public-master refresh writes player inventory/unlock state.
- No private raw screenshots/SQLite are committed to the public repository.
- All strategy outputs remain explainable through reasons, score breakdown and missing inputs.
