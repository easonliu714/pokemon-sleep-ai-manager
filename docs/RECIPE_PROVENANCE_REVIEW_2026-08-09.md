# Recipe Provenance Review — 2026-08-09

Status: v0.4.2 / #170  
Authority: `PUBLIC_RECIPE_MASTER_VERSION=public-recipe-master-2026-08-09-a`  
Evidence registry: `PUBLIC_RECIPE_PROVENANCE_VERSION=public-recipe-provenance-2026-08-09-a`

## 1. Purpose

This review separates three questions that must not be collapsed into one generic `VERIFIED` flag:

1. Where does the **Traditional Chinese display name** come from?
2. Where does the **ingredient formula** come from?
3. Is the recipe **active in the game today**, merely upcoming, or retired?

Player recipe unlock state, level, energy and notes are not evidence for public truth.

## 2. Current ACTIVE authority

The v0.4.2 active recipe authority contains **76** recipes:

- 咖哩／濃湯: 23
- 沙拉: 26
- 甜點／飲料: 27

For the 76 active rows:

- name evidence = `SANITIZED_USER_REFERENCE`
- formula evidence = `REFERENCE_VERIFIED`
- lifecycle = `ACTIVE`

The zh-TW names were retained from the sanitized pre-v0.4.2 catalog evidence. This review does **not** upgrade them to `OFFICIAL_ZH_TW_VERIFIED` because the current official public pages retrieved for this review do not provide a complete zh-TW recipe table.

Ingredient formulas were cross-checked on 2026-08-09 against the current Serebii Pokémon Sleep Dishes reference:

- https://www.serebii.net/pokemonsleep/dishes.shtml

The earlier shared-master conflicts were resolved in favor of the current reference/historical 76-recipe formulas, including:

- 忍者咖哩
- 電光香料可樂
- 鬼面鬆餅
- 採蜜巧克力鬆餅

## 3. Upcoming reference-discovered recipes

On 2026-08-09 the current Serebii page already lists two additional curry recipes beyond the 76-row active zh-TW authority:

### Greengrass Curry Bun

Reference formula:

- 暖暖薑 ×20
- 火辣香草 ×20
- 萌綠大豆 ×8
- 純粹油 ×15

### Bounce Curry Udon

Reference formula:

- 暖暖薑 ×39
- 品鮮蘑菇 ×31
- 火辣香草 ×22
- 豆製肉 ×20

These rows are stored only in `PUBLIC_RECIPE_UPCOMING_EVIDENCE` with:

- `canonical_name_zh_tw = null`
- `lifecycle = UPCOMING_REFERENCE_DISCOVERED`
- `effective_from = null`
- activation blocked pending verified zh-TW name and live/effective evidence

They are intentionally excluded from `PUBLIC_RECIPE_MASTER`, SQLite `recipe_master`, Ingredient Gap and War Room candidates on 2026-08-09.

## 4. Date boundary

Pokémon Sleep's official Traditional Chinese announcement states that `天青沙灘EX` starts on **2026-08-10**:

- https://www.pokemonsleep.net/zh/news/343231343532353138373131363233363832/

The retrieved official announcement does not provide the two new recipe names/formulas and does not establish that the two reference-discovered dishes have the same effective timestamp.

Therefore the system must not infer either:

- an official zh-TW name; or
- an `effective_from=2026-08-10`

from the EX-field announcement alone.

Activation is tracked separately in #172 and requires live/official zh-TW verification on or after 2026-08-10.

## 5. Evidence contract

### Name evidence

- `OFFICIAL_ZH_TW_VERIFIED`
- `GAME_OBSERVED_ZH_TW`
- `SANITIZED_USER_REFERENCE`
- `REFERENCE_TRANSLATION_ONLY`
- `REVIEW_REQUIRED`

### Formula evidence

- `OFFICIAL_VERIFIED`
- `GAME_SCREENSHOT_VERIFIED`
- `REFERENCE_VERIFIED`
- `REFERENCE_VERIFIED_PRE_RELEASE`
- `REVIEW_REQUIRED`

### Lifecycle

- `ACTIVE`
- `UPCOMING_REFERENCE_DISCOVERED`
- `RETIRED`
- `UNKNOWN_EFFECTIVE_DATE`

Compatibility aliases remain a separate identity-migration concern and are never promoted to canonical truth merely because a player row uses them.

## 6. Safety rules

- Public provenance never reads player unlock state to decide canonical truth.
- Raw private screenshots are not committed to the public repository.
- An upcoming row cannot enter strategy calculations merely because a third-party reference lists it.
- A new Public Recipe Master version requires a new provenance review; provenance is pinned to the reviewed master version.
- Unknown or future rows must remain explicit instead of being silently guessed.
