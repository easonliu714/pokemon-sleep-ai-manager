# G12.1A Readiness Audit

Parent: #41  
Audit issue: #411  
Mode: **READ-ONLY**  
Baseline main: `b4fd4757603a7928fe7a4ae5305cb74ddfe6fdad` / `v0.4.27.55.3.3.4`

## Purpose

Freeze the authority boundary required before implementing deterministic evolution-status and training recommendations.

This audit does **not** mutate player data, add a SQLite migration, infer missing evolution rules, or invent acquisition channels.

## Classification

| Dependency | Status | Current authority | Minimal next change |
| --- | --- | --- | --- |
| Public Evolution Master | PARTIAL | from/to species, level, per-instance sleep hours, Candy, item, other condition, source, verified_at, data_version | Add route/branch identity plus `effective_from`, `effective_until`, `confidence` |
| Public evolution-item identity | READY | `PUBLIC_ITEM_MASTER` contains governed evolution-item rows | none for identity |
| Public item acquisition authority | MISSING | no governed shop/acquisition/cost/limit/effective-period authority | Add separate versioned acquisition authority; do not overload item identity master |
| Player Pokémon stable identity | READY | `pokemon_instance_id` + unique index | downstream must fail closed if missing/duplicate |
| Per-instance sleep hours | READY | Migration 7 `pokemon.sleep_hours` | downstream must preserve NULL as unknown and must never substitute account sleep time |
| Canonical family Candy | READY | P0-B6 family-level storage + resource snapshot | legacy per-species double count remains forbidden |
| Item inventory + safe reserve | READY | `item_inventory.quantity/safe_reserve` + computed available | none |
| Dream Shards | MISSING | not exposed by current unified resource snapshot | add explicit local authority with known/unknown semantics |
| Sleep Points | MISSING | not exposed by current unified resource snapshot | add explicit local authority with known/unknown semantics |
| Diamonds | MISSING | not exposed by current unified resource snapshot | add explicit local authority with known/unknown semantics |
| Premium-pass state | MISSING | no explicit local tri-state authority | add explicit known/unknown/active/inactive semantics; never infer from shop availability |
| Shared/Public vs player SQLite isolation | READY | separate masters/player inventory; read-side joins only | preserve |
| Deterministic G12.1 status vocabulary | MISSING | not frozen as an engine contract | freeze enum before recommendation/AI layers |

## Required fail-closed semantics

- Missing public rule/acquisition authority => `data_incomplete`.
- Missing `pokemon_instance_id` or ambiguous identity => `data_incomplete`.
- Missing per-instance `sleep_hours` remains unknown. Account-level sleep time is not a substitute.
- Candy binds only through P0-B6 canonical family storage.
- Unknown premium status, currency balance, acquisition channel, or effective period must remain unknown.
- AI may explain deterministic output later, but it must not fill missing authority.

## Gate decision

**G12.1 deterministic recommendation implementation is not yet READY.**

The minimum safe successor is a schema/authority phase that adds:

1. Evolution route/effective-period/confidence metadata.
2. Versioned evolution-item acquisition authority.
3. Player-local Dream Shards / Sleep Points / Diamonds / Premium state with explicit unknown semantics.
4. Frozen deterministic status vocabulary.

Only after those dependencies are closed should G12.1B begin status calculation against real player data.

## Regression authority

`scripts/g121a-readiness-audit-contract.mjs`

The contract intentionally fails if a currently missing field suddenly appears without an explicit audit update. This prevents silent drift from changing a dependency classification without review.

SQLite Migration remains **15**.
