# Public Event Master / Player Weekly Context Authority Contract

Status: **Normative**  
Version: `public-event-authority-2026-08-17-a`  
Applies to: Android/PWA startup, browser SQLite, Weekly Context, War Room, recipe strategy, candidate scoring, external Strategy Analysis Pack, offline mode, CI regression gates.

## 1. Authority boundary

Pokémon Sleep global/regional event facts are public game data and must not be owned by a player's Weekly Context.

### Player Weekly Context owns

- the player's currently selected camp;
- the player's actual dish category for the week;
- account/pot capacity and other player-specific capacity values;
- actual favorite berries for weekly-random / EX camps when the public camp master cannot determine them;
- player notes and explicit player-specific overrides.

### Public Event Master owns

- event id and title;
- locale / region;
- event start / end;
- camp scope;
- phase start / end;
- structured event effects;
- mission periods, missions and rewards;
- limited mechanics;
- source, field provenance, verification status and master version.

Player screenshots, Gemini extraction and legacy Weekly JSON may provide observation evidence, but they must not establish or overwrite the global/regional Public Event authority.

## 2. Effective Weekly Context

All deterministic strategy consumers must read:

```text
Effective Weekly Context
= Player Weekly Context
+ Public Camp Projection
+ Active Public Event Projection
```

The event portion of Effective Weekly Context is exclusively projected from the locally verified Public Event Master cache.

Existing player `weekly_context.event_name` / `weekly_context.event_effects` values remain in SQLite for compatibility and audit. They are exposed only as `legacy_player_event_observation` with `deterministic_authority=false` and must not overwrite Public Event Master values.

Required provenance labels:

- `PLAYER_WEEKLY_CONTEXT`
- `PUBLIC_CAMP_MASTER`
- `PUBLIC_EVENT_MASTER`

## 3. Public Event schemas

Manifest schema:

`pokemon-sleep-public-event-manifest/1.0`

Payload schema:

`pokemon-sleep-public-event-master/1.0`

SQLite schema migration:

`14`

SQLite cache tables:

- `public_event_master`
- `public_event_phase`

SQLite settings keys:

- `public_event_master_version`
- `public_event_master_manifest`
- `public_event_master_payload_sha256`
- `public_event_master_refresh_report`

These tables/settings are public cache only. Refresh code must not insert, update or delete player `weekly_context`, Pokémon, inventory, recipe state, candy inventory, goals or other player-owned rows.

## 4. Manifest refresh contract

Required startup ordering:

```text
PWA startup
→ SQLite load / migrations
→ SQLite Ready
→ Public Event manifest check
→ manifest schema validation
→ payload download when version/hash changed
→ SHA-256 validation
→ payload schema + authority validation
→ public-cache transaction
→ SQLite persist
→ PRAGMA integrity_check + row/version checks
→ active event / phase resolve
```

A failed network request, invalid manifest, invalid payload, authority conflict or SHA mismatch must never delete the last successfully verified local Public Event Master.

If a verified local cache exists, refresh failure resolves to `OFFLINE_CACHED` and the application continues using that cache.

## 5. Cache freshness and PWA interception

Manifest and payload checks must bypass stale service-worker cache semantics. The refresh request must be network-fresh (for example cache-busting request identity plus `cache:'no-store'`) while the authoritative offline fallback remains the verified SQLite cache.

This separates two concerns:

- network freshness decides whether a newer public master exists;
- SQLite decides what verified event authority remains available offline.

## 6. Time and phase resolver

Timezone authority: `Asia/Taipei`.

The resolver uses half-open intervals:

```text
start_at <= now < end_at
```

It must re-resolve when any of the following occurs:

- PWA online startup / database-ready refresh;
- public manifest version/hash changes;
- local game-day boundary 04:00 is crossed;
- event start/end is crossed;
- phase start/end is crossed;
- player camp changes when camp-scoped events are possible.

Events may change phase during a week. No implementation may assume that Monday 04:00 is the only event transition.

## 7. Typed effect safety

Public Event effects use the versioned Weekly Event Effect Registry.

- `ACTIVE_VERIFIED`: may reach the specifically named deterministic consumer.
- `FEATURE_ONLY`: may be displayed and exported as structured facts but must not silently become Production numeric authority.
- `REVIEW_REQUIRED`: evidence only; deterministic consumers must ignore it.

When two simultaneously active public events provide different values for the same effect key, the resolver must not choose one value. That effect key is removed from deterministic projection and converted to REVIEW evidence (`PUBLIC_EVENT_EFFECT_CONFLICT`). Once a key is conflicted during a resolve pass, a later overlapping event cannot reintroduce it.

Unknown effects remain under `unknown_effects[]` with the source wording preserved.

## 8. Public source governance

Priority:

1. Pokémon Sleep official announcements / official game information — rule authority.
2. RaenonX or other structured/community references — discovery and cross-check only; they cannot override official text.
3. Manual public-master maintenance — fallback when an official fact is known but has not yet been accepted by a parser/structured source; provenance and review notes are required.

Conflicting source evidence produces `REVIEW_REQUIRED` rather than a guessed value.

## 9. Initial v0.4.27.5 seed

The initial Taiwan cache includes the August 2026 Pokémon Horizons special collaboration identity. At implementation time, the official source available to the project confirms the August collaboration and featured Pokémon, while the exact August 17–24 period is secondary-source cross-checked and the official detailed bonus text has not yet been admitted into the master.

Therefore the seed is deliberately:

- `authority_status=PARTIAL_VERIFIED`;
- `effects={}`;
- no inferred multipliers;
- field-level provenance records the official identity evidence and the still-pending event-effect authority.

A later verified Public Event Master payload may add effects without requiring an app release, provided manifest version/hash validation succeeds.

## 10. Privacy and production-authority invariants

Public Event Master must not contain:

- player screenshots;
- player SQLite bytes;
- Pokémon instances;
- player inventory quantities;
- recipe unlock/level state;
- private notes or identifiers.

v0.4.27.5 does not activate Ingredient Probability or any other previously held Production numeric dimension. Ingredient Probability remains `NOT_YET_VERIFIED`; the Production numeric model remains 4/7 active until its independent Evidence/Activation contracts pass.

## 11. Required regression coverage

CI must block release unless it proves at least:

- manifest SHA-256 matches payload bytes;
- manifest/payload schemas validate;
- migration 14 creates the public cache schema;
- public refresh code has no player-table writes;
- event/phase boundary resolver changes projection at exact boundaries;
- legacy player event fields cannot override Public Event Master;
- overlapping contradictory effects fail closed to REVIEW;
- unknown effects remain REVIEW;
- FEATURE_ONLY multipliers do not enter deterministic effect projection;
- current public seed remains PARTIAL_VERIFIED with no guessed numeric effects;
- offline failure preserves the verified SQLite public cache;
- deterministic consumers import Effective Weekly Context;
- Production numeric authority remains 4/7 HOLD for Ingredient Probability.
