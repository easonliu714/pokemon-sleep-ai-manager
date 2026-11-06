# War Room Scoring Rules v1

Status: Normative for activated strategy scores  
Initial rule date: 2026-08-09

## Rule governance

A Pokémon strategy score is not a game-displayed stat. It is a project-defined, deterministic decision aid.

Every activated score must therefore have:

- a stable rule version;
- an explicit semantic meaning;
- exact inputs and formula;
- a deterministic fixture;
- a clear statement of what the score does **not** mean;
- `missing_inputs` behavior when the rule cannot be evaluated.

Hard Constraints are evaluated before scores. A `FAIL` candidate cannot be restored to the ranked set merely because it has a high score.

## CURRENT_UNLOCK_READINESS_V1

Dimension: `current_readiness_score`  
Rule status: `ACTIVE_VERIFIED`  
Rule version: `current-unlock-readiness-2026-08-09-a`

### Meaning

This score measures **unlock maturity of the ability slots already recorded for this individual Pokémon**.

It does **not** estimate:

- Snorlax energy;
- berry production rate;
- ingredient production rate;
- skill trigger rate;
- total Pokémon quality;
- long-term intrinsic value.

### Inputs

For the individual Pokémon, use only locally confirmed slot rows:

- known ingredient slots (`pokemon_ingredients`);
- known subskill slots (`pokemon_subskills`);
- current Pokémon level;
- explicit `is_unlocked` subskill state when present.

A slot is currently unlocked when:

- its unlock level is less than or equal to the current Pokémon level; or
- for a subskill, the stored `is_unlocked` state explicitly confirms it.

### Formula

```text
known_unlock_slots
  = known_ingredient_slots + known_subskill_slots

unlocked_known_slots
  = current_unlocked_ingredient_slots + current_unlocked_subskill_slots

current_readiness_score
  = 100 × unlocked_known_slots / known_unlock_slots
```

Round only the displayed/result value to 2 decimal places. If `known_unlock_slots = 0`, the score is `null` and `missing_inputs` includes `known_unlock_slots`.

### Why this is safe to activate

The rule does not infer hidden game coefficients. It evaluates only the player's locally stored, level-gated unlock rows. The output is therefore a deterministic progress/readiness ratio rather than a claim about game production performance.

### Example

If an individual has:

- 3 known ingredient slots, 1 currently unlocked;
- 5 known subskill slots, 2 currently unlocked;

then:

```text
known_unlock_slots = 8
unlocked_known_slots = 3
current_readiness_score = 37.50
```

### Snapshot behavior

Changing the Pokémon level or the stored slot rows changes the evaluation fingerprint and invalidates the prior current-readiness result. Weekly camp/berry/dish changes may change the overall evaluation fingerprint but do not change this dimension's formula inputs.

## Other dimensions

Until a later rule is separately approved:

- `intrinsic_score` = `null` (`FEATURE_ONLY`)
- `weekly_fit_score` = `null` (`FEATURE_ONLY`)
- `roster_marginal_value_score` = `null` (`DISABLED_NO_EVIDENCE`)
- `training_roi_score` = `null` (`DISABLED_NO_EVIDENCE`)

Feature availability alone is not permission to invent numeric weights.

## PROVISIONAL_ROLE_FIT_15_BAND_V1 — non-official preview, not an activated intrinsic score

- Rule version: `pokemon-role-fit-15-band-2026-11-06-a`; status `PRODUCT_HEURISTIC_PREVIEW_ONLY`. Owner requested a common S/A/B/C/D with +/neutral/- rating for reviewed screenshots and the existing Pokémon box.
- Output grades in descending order: `S+, S, S-, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-`. Heuristic numeric lower bounds: `93,86,79,72,65,58,51,44,37,30,23,16,9,3,0`. These thresholds and points are **product choices**, NOT Pokémon Sleep's official probabilities, performance thresholds or scientific quality estimates.
- Every complete record starts with 40 heuristic points. Berry specialist subskill points: 樹果數量S 30, 幫手獎勵 14, 幫忙速度M 12, 幫忙速度S 7; nature 幫忙速度 +10 or -10. Ingredient specialist: 食材機率提升M 22, 食材機率提升S 12, 幫手獎勵 13, 幫忙速度M 11, 幫忙速度S 6; nature 食材機率 +12/-12, 幫忙速度 +6/-6. Skill specialist: 技能機率提升M 22, 技能機率提升S 12, 幫手獎勵 13, 幫忙速度M 11, 幫忙速度S 6, 技能等級提升M 8, 技能等級提升S 4; nature 主技能發動機率 +12/-12, 幫忙速度 +6/-6. Clamp sum to [0,100], then map to the 15 bands.
- The known nature map and subskill names are read from existing version-controlled `pokemon-master-options.js`. Five real known subskill rows (Lv10/25/50/70/80), verified species, specialty, nature and level are required. Ingredient specialty also needs an observed Lv1 ingredient; skill specialty needs observed main skill. Contradictory nature effects, identity review, image evidence conflicts, duplicate/missing/unknown slots yield `REVIEW_REQUIRED`, no numeric grade. UNKNOWN must not be scored as zero.
- Future known subskills can contribute to **long-term heuristic potential**, never to CURRENT capability. The preview separately reports `current_contribution` and `future_contribution` based on the observed level, not the stale `is_unlocked` flag. This first preview makes no estimate of per-help production, skill activation rates, weekly fit or resource ROI.
- Existing `intrinsic_score` remains `FEATURE_ONLY`, existing `current_readiness_score` remains the sole `ACTIVE_VERIFIED` numeric dimension. No player `pokemon.rating` or `ai_score` writes occur. `planPokemonRosterProvisionalRegrade` is a review proposal only. Before any actual legacy-rating replacement, require per-record old/new diff, a protective snapshot, explicit confirmation, admitted durable Writer, atomic readback/rollback, existing observation preservation and Android UAT.
