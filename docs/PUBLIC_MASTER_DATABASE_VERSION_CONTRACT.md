# Public Master Database Version Audit / Update Contract

Status: **Normative**  
Applies to: browser SQLite runtime, rescue mode, fresh database bootstrap, existing database startup, import/update workflows, CI gates.

## 1. Data ownership boundary

### Public master data
Public master data describes game-wide entities and may be distributed in the public repository. It includes at least:

- Pokémon species/options and canonical terminology
- types and berries
- ingredients
- items and Traditional Chinese effect descriptions
- recipes and recipe ingredients
- main skills, subskills, natures, camps/fields and other shared selectable game terms when implemented

### Player-owned data
Player-owned data must remain local and must never be seeded from the public repository:

- owned Pokémon instances and their personal fields
- ingredient quantities
- item quantities, safe reserve and player notes/recommendations
- recipe unlock state, recipe level and current energy
- account capacity, weekly plans, collection targets and AI observations

## 2. Fresh database contract

When no local SQLite database exists, startup must:

1. create schema;
2. load every available public master authority into local master tables;
3. expose player projections with neutral defaults:
   - quantity = `0`;
   - safe reserve = `0`;
   - recipe unlocked = `false` / `0`;
   - player record exists = `false` / `0`;
4. persist the completed database once;
5. record every applied public master version in `settings`.

Fresh bootstrap must not create fake player inventory rows merely to display zero. Neutral values are produced by master-to-player LEFT JOIN views.

## 3. Existing database startup contract

Existing databases are local-first.

For each public master authority:

1. read the expected version exported by the authority module;
2. read the applied version from `settings`;
3. if versions are equal, do not rerun the authority UPSERT and do not persist solely for public data;
4. if versions differ or the applied version is missing, run an idempotent master-only synchronization;
5. update the matching `settings` version key;
6. persist once after all required public-master updates finish.

## 4. Master update safety contract

A public master update may insert or update master tables only. It must not overwrite player-owned fields.

Required preservation rules:

- `ingredient_inventory.quantity` is unchanged;
- `item_inventory.quantity`, `safe_reserve`, `recommendation` are unchanged;
- `recipes.unlocked`, `recipe_level`, `current_energy`, `notes` are unchanged;
- `pokemon` instance rows are unchanged, except deterministic derived references explicitly governed by a separate migration;
- account, plan, target, evidence and history tables are unchanged.

Removal or renaming of a public entity requires an explicit deprecation, alias, or retirement rule. A master updater must not infer deletion solely because a row is absent from a newer authority. When a legacy public-master row is replaced during a canonical migration, the old row may be retired only when it is explicitly identified by a versioned alias/deprecation contract and player-owned rows remain preserved.

## 5. Single-authority contract

Rescue mode and standard mode must consume the same exported public authority.

Forbidden architecture:

```text
rescue static list A
standard-mode seed list B
```

Required architecture:

```text
PUBLIC_*_MASTER authority
├─ rescue renderer (read-only)
└─ SQLite master synchronization (standard mode)
```

No public description, name, category, recipe or selectable term may be independently duplicated in a rescue-only renderer or historical compatibility controller.

For recipes specifically:

```text
PUBLIC_RECIPE_MASTER
├─ rescue recipe renderer
├─ recipe_master / recipe_master_ingredients
├─ recipe_master_alias
├─ canonical recipe terminology projection
└─ deterministic Ingredient Gap / Strategy projection
```

Historical recipe registries may remain only as compatibility/audit evidence; they must not contain an executable second recipe fact list or self-starting recipe writer.

## 6. Required version keys

Current required keys:

| Authority | Exported version | SQLite settings key | Master tables |
|---|---|---|---|
| shared type/berry/ingredient authority | `MASTER_DATA_VERSION` | `shared_master_version` | `berry_master`, `ingredient_master` |
| recipe authority | `PUBLIC_RECIPE_MASTER_VERSION` | `public_recipe_master_version` | `recipe_master`, `recipe_master_ingredients`, `recipe_master_alias` |
| item authority | `PUBLIC_ITEM_MASTER_VERSION` | `public_item_master_version` | `item_master` |
| canonical terminology registry | `CANONICAL_REGISTRY_VERSION` | `canonical_registry_version` | canonical registry tables |
| Pokémon knowledge authority | `PUBLIC_POKEMON_KNOWLEDGE_VERSION` | `public_pokemon_knowledge_version` | public Pokémon knowledge tables |

Any new public authority must add a row to this table, an exported immutable version, a `settings` key, an idempotent updater and CI coverage.

## 7. Startup ordering

Required order:

```text
DDL / schema compatibility
→ historical migrations
→ public-master version audit
→ required master-only synchronization
→ canonical registry refresh when dependent masters changed
→ one persist if schema or public master changed
→ database-ready event
→ UI lazy rendering
```

Public-master code must not execute before the database-ready boundary through legacy self-starting migration controllers.

## 8. UI projection contract

- Rescue mode reads public authorities directly and displays player values as `尚未載入` / neutral read-only values.
- Standard mode reads local SQLite master tables and LEFT JOIN player tables.
- A missing player row appears as zero/locked but remains distinguishable using `player_record_exists = 0`.
- Standard mode must never depend on rescue-only constants.
- Recipe display name/ingredient requirements in rescue and standard mode must derive from `PUBLIC_RECIPE_MASTER`.
- Legacy player recipe IDs/names may be resolved through `recipe_master_alias`; merely viewing or refreshing public master data must not rewrite player recipe identity.

## 9. CI enforcement

The repository must contain blocking gates that verify:

- this document exists;
- every declared authority has an exported version and a SQLite settings key;
- rescue and standard rendering consume the same item and recipe authorities;
- public master updaters do not write player tables;
- existing database startup invokes version audit;
- unchanged versions skip synchronization/persist;
- changed versions update master tables while preserving player rows;
- public views use neutral LEFT JOIN defaults;
- no rescue-only duplicated item effect list exists;
- no `shared-master-data.js` or historical compatibility module owns a second executable recipe fact list;
- recipe IDs/names are unique and all recipe ingredient references resolve to `ingredient_master` authority terms;
- canonical recipe aliases are explicit and versioned.

A PR that changes public master data, master tables, rescue renderers or startup migrations must update the authority version and pass these gates.

## 10. Release closure checklist

- [ ] fresh empty database contains all public master rows;
- [ ] player quantities are zero and recipe unlocks are false;
- [ ] second startup with unchanged versions performs no public synchronization;
- [ ] changed item version updates descriptions without changing inventory;
- [ ] changed recipe version updates master recipes without changing player unlock/level/energy/notes or silently changing player recipe identity;
- [ ] explicit legacy recipe aliases resolve without duplicate player rows;
- [ ] rescue and standard displays resolve from the same authority;
- [ ] browser regression and Android first-entry rendering pass;
- [ ] GitHub Pages deploys the new central app version.
