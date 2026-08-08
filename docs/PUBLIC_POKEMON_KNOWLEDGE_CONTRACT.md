# Public Pokémon Knowledge Projection Contract

Status: **Normative**  
Introduced: **v0.3.99.2**  
Authority: `assets/js/public-pokemon-knowledge-master.js`

## Purpose

Pokémon Sleep AI Manager separates **player-observed/private state** from **public game knowledge**.

Public knowledge must not be duplicated into every player Pokémon row merely to make the UI look complete. Instead, the UI and analysis layer project versioned public master data at read time when the corresponding player field is empty.

## Public master authorities

v0.3.99.2 adds these versioned public authorities:

- `nature_master`: nature name, boosted axis, reduced axis, description.
- `main_skill_master`: main-skill name and public description.
- `pokemon_evolution_master`: verified evolution routes and requirements.

v0.4.0 adds:

- `pokemon_evolution_status_master`: source-verified current Pokémon Sleep terminal classification used only to distinguish a verified terminal species from an unresolved evolution gap.

The release version is stored in `settings.public_pokemon_knowledge_version` and compared with `PUBLIC_POKEMON_KNOWLEDGE_VERSION` during database bootstrap / migration audit.

If the installed version already matches, the local SQLite master is used directly. If the version differs, only the public master tables are refreshed.

## Projection precedence

For a Pokémon detail field that has both player and public semantics:

1. A non-empty player-observed / imported value wins.
2. If the player field is empty, a matching public-master value may be displayed as **（公版）**.
3. If neither exists, display `尚未匯入` or `公版資料尚未收錄` according to the field semantics.

Public projection must not write the fallback value back into the player `pokemon` row.

Examples:

- `pokemon.nature = 固執` is player data; `nature_master` supplies the public boosted/reduced axes when the individual `nature_bonus` / `nature_penalty` fields are empty.
- `pokemon.main_skill` and `pokemon.main_skill_level` are player data; `main_skill_master` can supply the description when `pokemon.main_skill_description` is empty.
- Explicit player/imported evolution fields take precedence. Otherwise `pokemon_evolution_master` is shown as a public reference route.
- `pokemon.type` may be projected through the public type→berry master for display, but that relationship must not be written into `pokemon.favorite_berry` by a master sync.

## Evolution coverage semantics

### Historical compatibility

Absence from `pokemon_evolution_master` historically meant **NOT_YET_VERIFIED_NOT_NO_EVOLUTION**. The legacy coverage label `UNKNOWN_OR_TERMINAL_NOT_CLASSIFIED` remains available for regression compatibility, but it is not the primary v0.4.0 interpretation.

### v0.4.0 three-state triage

Every observed species is classified into exactly one public-knowledge state:

1. **VERIFIED_OUTGOING** — at least one source-verified row exists in `pokemon_evolution_master`.
2. **VERIFIED_TERMINAL_CURRENT_SLEEP** — no outgoing row exists, and a source-verified terminal row exists in `pokemon_evolution_status_master` for the current public Pokémon Sleep reference.
3. **UNKNOWN_NOT_YET_VERIFIED** — neither condition is satisfied.

The three-state coverage contract is named:

`VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN`

A terminal row is version-scoped public knowledge, not a permanent claim about the Pokémon franchise. A future Pokémon Sleep update may introduce another evolution path; such a change requires a new public-master version and source evidence.

An unknown row must never be promoted to “cannot evolve”, “terminal”, or any fabricated route without evidence.

## Date semantics

`registered_at`, `obtained_at`, and import timestamps are distinct concepts and must not be presented as interchangeable:

- `registered_at`: date attached to the Pokémon identity / registration evidence supplied by the player import source.
- `obtained_at`: player-observed acquisition date, only when that source explicitly provides it.
- `import_batches.imported_at`: application transaction timestamp; never a Pokémon attribute.

Legacy migration compatibility may copy `obtained_at` into an empty `registered_at`, but UI and new imports must preserve the distinction going forward.

## Private-data non-overwrite rules

A public-master update must not mutate player-owned values in these tables or domains:

- `pokemon` observed ability/profile values
- `pokemon_ingredients`
- `pokemon_subskills`
- inventory quantities / reserves
- recipe unlock / level / current energy
- account capacity
- AI recommendation / personal strategy fields

An empty or missing private field is not permission to guess it from species knowledge.

This prohibition applies to every public-master authority, including type→berry sync. Master bootstrap/migration may create or update public master rows and version settings only; it must not use public facts to populate private Pokémon columns.

## Source and evidence policy

Every public-master row must carry:

- `source_type`
- `source_name`
- `source_ref`
- `verified_at`
- `data_version`

Where the official Pokémon Sleep site explicitly documents a name or effect, it is preferred. Supplemental structured references may be used for gaps, but their verification status must remain distinguishable from official verification.

A `pokemon_evolution_status_master` terminal row additionally requires a public source that supports the current evolution-chain endpoint. Presence in the player's local collection is not evidence of terminal status.

## Update Center relationship

Public knowledge is not a substitute for private JSON observation.

For example, the public evolution requirement `required_sleep_hours = 150` must never be copied into a player's current `sleep_hours`. The current value must originate from the game-visible **「一起睡覺的時間」** field or another explicit player source.

The general JSON Update Center retains these rules:

1. Load / validate JSON.
2. Complete required human review.
3. Dry Run (read-only).
4. Review human-readable Before → After differences.
5. Apply only after confirmation, Snapshot and Transaction safeguards.

Raw database/JSON field detail is an advanced audit view, not the primary user review surface.
