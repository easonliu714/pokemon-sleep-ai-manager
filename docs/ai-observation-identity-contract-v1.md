# AI Observation Identity Contract v1

## 目的

所有 AI 模型只負責從圖片輸出可觀察資料，不得自行建立或猜測永久 Pokémon 個體身分。平台收到 JSON 後，依本機 SQLite 執行候選比對、使用者確認、永久 ID 配置與更新類型判定。

## 核心原則

1. AI 每次可建立 `incoming_ref`，僅供同一更新包內關聯。
2. AI 不得自行產生 `pokemon_instance_id`、`instance_discriminator` 或 `identity_match.target_pokemon_id`。
3. 只有平台提供既有個體上下文時，AI 才能原樣回傳 `target_pokemon_instance_id`。
4. 一般圖片辨識的 `requested_action` 固定為 `resolve_on_import`，不得預設 `insert`。
5. 看不清楚填 `null`；不得從物種名稱、等級或暱稱推測個體身分。
6. 平台只在唯一高可信候選時自動更新；其餘情況必須由使用者確認。

## AI 回傳格式

```json
{
  "schema_version": "2.0-observation",
  "update_id": "UPD-YYYYMMDD-HHMMSS-XXXX",
  "generated_at": "ISO-8601",
  "source": "ai_screenshot_observation",
  "observations": [
    {
      "incoming_ref": "pokemon-image-001",
      "requested_action": "resolve_on_import",
      "identity": {
        "target_pokemon_instance_id": null,
        "capture_species_id": null,
        "current_species_id": null,
        "registered_date": null,
        "instance_discriminator": null
      },
      "profile": {
        "species": null,
        "nickname": null,
        "level": null,
        "sp": null,
        "specialty": null,
        "type": null,
        "nature": null,
        "nature_bonus": null,
        "nature_penalty": null,
        "main_skill": null,
        "main_skill_level": null,
        "helper_seconds": null,
        "carry_limit": null,
        "favorite_berry": null
      },
      "ingredients": [
        {"unlock_level": 1, "ingredient_name": null, "quantity": null},
        {"unlock_level": 30, "ingredient_name": null, "quantity": null},
        {"unlock_level": 60, "ingredient_name": null, "quantity": null}
      ],
      "subskills": [
        {"unlock_level": 10, "subskill_name": null},
        {"unlock_level": 25, "subskill_name": null},
        {"unlock_level": 50, "subskill_name": null},
        {"unlock_level": 70, "subskill_name": null},
        {"unlock_level": 80, "subskill_name": null}
      ],
      "evidence": {
        "source_image_refs": ["image-001"],
        "field_confidence": {},
        "unreadable_fields": [],
        "notes": null
      }
    }
  ]
}
```

## 平台解析狀態

- `exact_existing`: JSON 由平台提示詞帶入既有永久 ID，直接更新。
- `unique_high_confidence`: 唯一高可信候選，可預選更新並允許撤銷。
- `possible_existing`: 有候選但證據不足，要求使用者選擇。
- `ambiguous_existing`: 多個候選，要求使用者選擇具體個體。
- `no_candidate`: 無候選，建議新增但仍須確認。

## 使用者決策

- 同一隻：沿用既有 `pokemon_instance_id`，平台判定升級、更名、進化或資料補充。
- 新成員：平台建立永久 UUID，並配置自然鍵與 `instance_discriminator`。
- 稍後處理：存入待覆核區，不寫入 active Pokémon。

## 進化契約

- `pokemon_instance_id`、`capture_species_id`、`registered_date`、`instance_discriminator` 不變。
- 只更新 `current_species_id` 與顯示物種。
- 平台寫入 `pokemon_evolution_history`。
- 直接捕捉進化型時，`capture_species_id = current_species_id`，不得推測進化前歷史。

## 相容層

Update Package v1.1 暫時保留給庫存、道具、食譜與每週規劃。Pokémon 圖片辨識改走 Observation v2，再由平台轉換成內部 Update Package 操作。AI 不直接產生 DB write operations。
