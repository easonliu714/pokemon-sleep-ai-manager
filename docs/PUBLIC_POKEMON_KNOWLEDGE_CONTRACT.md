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

## Missing evolution route semantics

Absence from `pokemon_evolution_master` means **NOT_YET_VERIFIED_NOT_NO_EVOLUTION**.

The application must never infer that a Pokémon cannot evolve only because the current public master has no verified route for that species.

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

## Source and evidence policy

Every public-master row must carry:

- `source_type`
- `source_name`
- `source_ref`
- `verified_at`
- `data_version`

Where the official Pokémon Sleep site explicitly documents a name or effect, it is preferred. Supplemental structured references may be used for gaps, but their verification status must remain distinguishable from official verification.

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
