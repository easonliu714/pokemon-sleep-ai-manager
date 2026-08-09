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
