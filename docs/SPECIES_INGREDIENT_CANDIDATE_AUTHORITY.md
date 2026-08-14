# Public Species ↔ Ingredient Candidate Authority

Status: SOURCE AUDIT / NOT YET RUNTIME ACTIVE

## Purpose

Provide a public, structural consistency boundary for Pokémon screenshot review:

`species/form + ingredient slot level -> finite allowed ingredient identities`

This authority is not player data and is not a production-rate model.

## Evidence semantics

Pinned primary source commit:

`nerolis-lab/nerolis-lab@fc36317b195125c63bf56d3777fa3ed1a9548831`

The pinned constructor expands a standard `{a,b,c}` ingredient definition into:

- Lv.1 / ingredient0: `[a]`
- Lv.30 / ingredient30: `[a,b]`
- Lv.60 / ingredient60: `[a,b,c]` when `c` exists

Special `IngredientSetDefinition` rows are read from explicit `ingredient0`, `ingredient30`, and `ingredient60` arrays. `LOCKED_INGREDIENT` is a source sentinel and is never a current canonical ingredient identity.

## Hard boundaries

This authority MUST NOT:

- infer the player's actual slot identity from species/form;
- fill a missing `INGREDIENT_VISUAL` observation;
- infer Type, Berry, Main Skill, or Subskill;
- carry or activate `ingredientPercentage`;
- act as `ingredient_probability_per_help` authority;
- act as production-time `ingredient_slot_distribution` authority;
- convert ingredient quantities into selection probabilities;
- infer from specialty;
- use private Pokémon rows or screenshots as public evidence;
- silently rewrite a conflicting player observation.

It MAY only answer whether an independently observed ingredient identity is a member of the finite public candidate set for the independently resolved species/form and slot level.

## Fail-closed states

- missing/ambiguous species or form identity: `REVIEW_REQUIRED`
- missing public source row: `REVIEW_REQUIRED`
- missing slot level: `REVIEW_REQUIRED`
- observed ingredient outside candidate set: `CONFLICT`
- observed ingredient inside candidate set: `MATCH`

## Activation gate

Runtime activation requires all of the following:

1. exactly 242 governed roster rows;
2. exact pinned Git blob SHA match for every upstream source file;
3. 242/242 structural candidate extraction;
4. zero unknown ingredient constants;
5. zero duplicate/unexpected source keys;
6. a deterministic public species/form identity resolver from player-facing zh-TW species/form text to the governed source key;
7. regression proving Public Master never generates a player ingredient value.

Until all gates pass, screenshot Ingredient consistency remains fail-closed.
