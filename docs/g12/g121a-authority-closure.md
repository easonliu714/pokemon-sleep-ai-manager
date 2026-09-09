# G12.1A Authority Closure

Parent: #41  
Readiness audit: #411  
Baseline audit merge: `a42d6ddaa2f51d16536cfbdf18739d013096fd53`

## Release authority

- app version: `v0.4.27.55.3.3.5`
- build: `20260908-v042755335-g121a-authority-closure`
- cache: `pokemon-sleep-ai-v0.4.27.55.3.3.5-v042755335-g121a-authority-closure`

## Migration boundary

This phase introduces **schema migration 16** for G12.1 authority state.

The P0-B6 Candy family migration remains exactly:

`CANDY_FAMILY_STORAGE_MIGRATION_VERSION = 15`

Migration 16 does not rewrite Candy family chronology, player Candy quantities, ABSOLUTE_SNAPSHOT, or DELTA_EVENT semantics.

## Closed authority work

### Evolution route authority

`pokemon_evolution_master` now exposes:

- `route_id`
- `evolution_branch_id`
- `effective_from`
- `effective_until`
- `confidence`
- `effective_period_status`

Existing verified routes receive deterministic route/branch identities. Effective-period fields remain nullable rather than being guessed. Current source-verified rows use:

`CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW`

This is an explicit authority state, not a fabricated effective date.

### Evolution-item acquisition schema

A separate `item_acquisition_master` is introduced. It is intentionally not merged into item identity.

The schema supports:

- acquisition_type
- shop_type
- sleep_point_cost
- diamond_cost
- exchange_limit
- premium_only
- mission_or_achievement
- event_limited
- bundle_name
- available_from / available_until
- source_url / verified_at / confidence
- authority_status
- data_version

Evolution items without a verified acquisition source receive an explicit `unknown / MISSING_AUTHORITY` row. Unknown acquisition must never become a purchase recommendation.

### Player-local resource authority

`player_resource_state` introduces explicit device-local state for:

- dream_shards
- sleep_points
- diamonds
- premium_pass_state

Every resource starts as `UNKNOWN`. Missing information is never normalized to zero.

Numeric resources allow an explicit `KNOWN=0`, but reject negative or fractional values. Premium Pass supports only explicit `ACTIVE` / `INACTIVE` when `KNOWN`.

### Unified resource snapshot

Resource Context advances to:

`pokemon-sleep-resource-context/2.0`

The snapshot now exposes `player_resources` with explicit `known / knowledge_state` semantics. UNKNOWN values remain null.

### Deterministic status vocabulary

The following enum is frozen before G12.1B implementation:

- ready_now
- missing_sleep_hours
- missing_level
- missing_candy
- missing_item
- missing_dream_shards
- time_window_pending
- multiple_requirements_missing
- data_incomplete
- evolution_not_recommended_yet

AI is not allowed to create additional operational statuses or fill missing authority.

## Current readiness after this phase

| Dependency | Status after closure |
| --- | --- |
| Evolution route schema/identity | READY |
| Evolution effective-period semantics | READY as explicit nullable/current-reference authority |
| Player instance identity | READY |
| Per-instance sleep hours | READY |
| P0-B6 family Candy | READY |
| Item inventory + safe reserve | READY |
| Dream Shards schema/unknown semantics | READY |
| Sleep Points schema/unknown semantics | READY |
| Diamonds schema/unknown semantics | READY |
| Premium state schema/unknown semantics | READY |
| G12.1 deterministic status vocabulary | READY |
| Live item acquisition facts/costs | **PARTIAL** |

## Remaining before acquisition recommendations

The separate acquisition master still requires source-verified live facts. Until then:

- `missing_item` can be calculated deterministically;
- acquisition guidance must remain `data_incomplete` when the matching acquisition row is `MISSING_AUTHORITY`;
- the system must not assume an item is purchasable with Sleep Points or Diamonds.

This does **not** block G12.1B player-state/status calculation, because G12.1B can fail closed for missing acquisition guidance.

## Regression

- `scripts/g121a-readiness-audit-contract.mjs`
- `scripts/g121a-authority-closure-contract.mjs`

Both are wired into Frontend Regression Gate.

