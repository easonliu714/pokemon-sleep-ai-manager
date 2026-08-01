# AI Prompt Specification

## Principles

- 每個頁面類型使用獨立 prompt、schema 與 validator。
- OCR／規則優先；Gemini 僅補低信心欄位。
- 模型只回傳 JSON，未知值必須為 `null`，不得猜測。
- AI 只能產生 Observation、Explanation 或 Draft Suggestion，不得直接寫入 DB。
- 所有輸出保存 `prompt_version`、`schema_version`、`model_id` 與 `input_signature`。

## Prompt families

- `observation.pokemon_detail`
- `observation.pokemon_box`
- `observation.team`
- `observation.camp_research`
- `observation.research_notes.recipe`
- `observation.research_notes.ingredient`
- `observation.research_notes.berry`
- `observation.inventory`
- `rating.pokemon`
- `strategy.goal_mode`
- `team.proposal`
- `evolution.recommendation`

## Required response envelope

```json
{
  "prompt_version": "1.0",
  "schema_version": 1,
  "page_type": "pokemon_detail",
  "observations": [],
  "missing_fields": [],
  "warnings": [],
  "confidence": 0.0
}
```

## Forbidden behavior

- 不得推測畫面未顯示的 SP、技能、食材、日期、共眠或個體 ID。
- 不得將 `???` 解釋成已解鎖。
- 不得自造寶可夢、食材、樹果、食譜或進化關聯。
- 不得輸出最終能量作為 source of truth。
- 不得跳過人工確認或平台 allowlist。

## Regression

每次 Prompt 或 Schema 更新必須執行固定圖片 Replay、Golden JSON 差異、欄位信心度、幻覺欄位、跨角色錯配與成本／請求數檢查。