# UC.IMG Ingredient Key Contract Hotfix

## LIVE failure
Android/PWA v0.4.10.2 Internal Gemini generated `ingredient_inventory` operations with AI-invented `key.ingredient_id` values such as `fancy_pumpkin`.

The platform SQLite contract uses `ingredient_inventory.ingredient_name` as the primary key. The generic Update Package Structured Output schema was too permissive (`key.additionalProperties=true`), and `validateWorkflow()` did not require `ingredient_name`, so the payload passed Parse/structure review and only failed in the importer with `key 缺少 ingredient_name`.

The missing key also caused UC.IMG duplicate-target signatures to collapse to `ingredient_inventory:` and emit misleading duplicate warnings.

## Hotfix contract
- `ingredient_inventory` canonical Update Package key remains `ingredient_name`.
- AI must copy the visible ingredient name; it must not invent English stable IDs.
- Structured Output declares scenario-safe key names and rejects unknown key properties such as `ingredient_id`.
- `validateWorkflow()` rejects missing/blank `ingredient_name` before Dry Run / Apply.
- Importer remains fail-closed and is not relaxed to accept invented IDs.
- No schema migration, Public Master mutation, screenshot persistence, or AI-to-SQLite bypass.

## Target release
`v0.4.10.2.1`
