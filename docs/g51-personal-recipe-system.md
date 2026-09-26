# G5.1 Personal Recipe System — Implementation Authority

## Base authority

- Base main SHA: `437a95bae523c2ee055ab254779a4ff2d4a636a1`
- Parent issue: #1
- Branch: `feat/g51-personal-recipe-system`

## Current-main audit

Already present and must be preserved:

- `recipe_master` is public/shared authority.
- `recipes` is local player-owned state.
- `recipe_catalog_state` projects public recipes with player state and preserves player-only rows.
- Existing unified workbench can edit unlock state, recipe level, and current energy.
- Existing manual writes already use snapshot -> transaction -> import audit -> persist.
- Public recipe synchronization does not modify player rows.

## G5.1 remaining scope

1. Player-only recipe create flow.
2. Edit player-owned category, recipe name, unlock state, level, current energy, and notes.
3. Edit player-owned ingredient rows and quantities.
4. Recompute `total_ingredients` deterministically from ingredient quantities.
5. Explicit player-only delete with snapshot, transaction, audit, and persist.
6. Mobile-first editor UX.
7. Regression coverage proving shared/public refresh cannot overwrite player recipes.
8. Backup/export persistence verification for full personal recipe fields.

## Safety invariants

- Public/shared recipe master is read-only from player workflows.
- Player recipe writes remain local SQLite only.
- No public-master refresh may mutate or delete player recipe rows.
- Every create/update/delete operation must create a snapshot before DB mutation.
- Multi-table writes must be transactional with rollback on failure.
- Every successful mutation must be auditable in import history.
- AI output alone is never formal player recipe authority.
- Existing `.55.3.3.12` closed semantics remain frozen.
- P0-B6 Migration 15 and G12.1 Migration 16 remain frozen.

## Delivery sequence

1. Add deterministic CRUD service + focused contract tests.
2. Add player recipe editor UI.
3. Add ingredient row editor and total recomputation.
4. Add delete confirmation and audit evidence.
5. Add backup/export persistence regression.
6. Run unchanged exact-head required CI.
7. Ready -> expected-head merge -> main exact-SHA CI -> Pages same-SHA.
8. Owner Android/PWA real-device validation.
