# Master Database Specification

## Scope

公共 Master 是所有 deterministic engines 的共同 source of truth；玩家個體與解鎖／庫存不屬於 Master。

## Core entities

- `pokemon_species_master`
- `pokemon_type_master`
- `pokemon_berry_master`
- `pokemon_ingredient_slot_master`
- `ingredient_master`
- `berry_master`
- `recipe_master`
- `recipe_ingredient_master`
- `island_master`
- `island_favorite_berry_master`
- `evolution_master`
- `item_master`
- `main_skill_master`
- `sub_skill_master`
- `nature_master`

## Stable ID rules

- 不使用繁體中文名稱作主鍵。
- 名稱、別名與譯名修正不得改變 stable ID。
- 關聯必須使用 stable ID，顯示層再解析語系名稱。
- 版本規則改變時使用 effective_from／effective_to，不覆蓋歷史。

## Version manifest

```json
{
  "master_schema_version": 1,
  "master_data_version": "YYYY.MM.patch",
  "game_version": "observed-version",
  "released_at": "ISO-8601",
  "source_manifest": [],
  "checksums": {},
  "migration_from": []
}
```

## Required queries

1. 食材 → 可供應物種、解鎖等級、slot 與數量。
2. 樹果 → 屬性、物種與營地覆蓋。
3. 食譜 → 材料、鍋子需求與玩家缺口。
4. 個體 → 已解鎖食材／副技能及下一門檻。
5. 進化 → 等級、共眠、糖果、道具與其他條件。
6. 未解鎖食材／樹果 → 捕獲與培養候選排序。

## Player Profile separation

Profile tables 至少包括：
- `profile_ingredient_unlocks`
- `profile_berry_unlocks`
- `profile_recipe_unlocks`
- `profile_inventory`
- `profile_island_progress`

研究筆記只更新上述 Profile unlock tables。

## Update contract

Patch → schema/checksum/provenance validation → Dry Run → diff preview → Snapshot → Transaction Apply → integrity check → version switch。失敗時 rollback；Gemini 回傳不得直接升格為 Master。

## DATA.1A Coverage Report

必須盤點現有 seed、Shared Master、schema 與 UI option：row count、欄位覆蓋率、缺值、衝突、來源、別名、stable ID，以及所有物種的屬性／樹果／Lv1/30/60 食材候選完整度。