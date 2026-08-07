# v0.3.98 General Update Center Multiscenario Contract

## Authority

The general Update Center is the only supported write path for private JSON updates. No Pokémon, ingredient inventory, item inventory, or recipe-status scenario may introduce a dedicated Apply path.

## Supported private update scenarios

| Scenario | Allowed primary entity | Player values |
| --- | --- | --- |
| `pokemon_profile_update` / general Pokémon package | Pokémon-related entities | observed profile, ingredients, subskills, evidence |
| `ingredient_inventory_update` | `ingredient_inventory` | `quantity` |
| `item_inventory_update` | `item_inventory` | `quantity`, optional `safe_reserve`, `recommendation` |
| `recipe_status_update` | `recipes` | `unlocked`, `recipe_level`, `current_energy` |

## Field semantics

1. `null`, empty string, and omitted fields mean **no change**.
2. Only `operation.clear_fields` may explicitly clear an existing value.
3. Numeric `0` is a valid value and must be written.
4. Boolean `false` is a valid value and must be written.
5. Ingredient/item names and recipe identity must resolve against the public master registry before a new player projection row is inserted.
6. Recipe status may identify the public recipe by `recipe_id` or exact public `recipe_name`; the platform resolves the canonical `recipe_id`.
7. Public master columns may be used to create the local player projection row, but public data must never fabricate private quantities, unlock states, recipe levels, energy, or Pokémon capability slots.

## User confirmation state

`profile_audit_confirmations` with `status=user_confirmed_not_visible` must be explicitly accepted by the user. Checkbox changes must update the same canonical JSON payload used by structure validation and Dry Run; a separate UI-only cache is not authoritative.

## Transaction contract

Every supported scenario follows:

`JSON validation -> user review/confirmation -> Dry Run -> field audit -> Snapshot -> Transaction Apply -> Persist -> import history / Rollback`

## Regression requirements

CI must block regressions that:

- treat `0` or `false` as empty;
- overwrite a non-empty local value with blank input;
- bypass the general Update Center with a scenario-specific Apply function;
- allow unknown ingredient/item/recipe identities to create player rows without a public-master match;
- leave profile confirmation UI state disconnected from the canonical payload.
