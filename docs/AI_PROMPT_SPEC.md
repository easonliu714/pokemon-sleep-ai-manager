# AI Prompt Specification

## Authority model

Prompt 是**第一層防呆**，不是資料 authority。任何模型輸出都必須依序通過：

`Image bytes → Direct Observation → Schema / Prompt Policy Validation → Public Master Consistency → MATCH / CONFLICT / REVIEW_REQUIRED → Import Dry Run → SQLite`

模型不能因 prompt 文字宣告、confidence 高、或輸出看起來合理，就跳過 validator / preflight。

Current screenshot safety contract：`screenshot-prompt-safety-2026-08-15-a`  
Current Pokémon visual prompt policy：`pokemon-visual-prompt-policy-2026-08-15-a`  
Current Pokémon visual evidence contract：`pokemon-visual-evidence-2026-08-15-c-direct-image-basis`

## Principles

- 每個頁面類型使用獨立 prompt、schema 與 validator，但所有 screenshot prompt 必須套用共用 Screenshot Safety Contract。
- OCR／規則可提供第二條觀測來源；Gemini 不得用 Public Master 或另一欄位補成「直接 Evidence」。
- 模型只回傳 JSON；未知、未顯示、模糊或只能推論的值必須為 `null`／省略／UNMATCHED。
- AI 只能產生 Observation、Recognition Draft、Explanation 或 Draft Suggestion，不得直接寫 DB。
- Public Master 只能在 Observation **之後**做 consistency check，不得替玩家生成觀測值。
- confidence 不是 authority；推論不得因 confidence 高而升格成 Evidence。
- 檔名、舊 JSON、先前對話、模型記憶不是玩家觀測 Evidence。
- internal Gemini 與 external prompt 必須共用相同 policy version；transport boundary 需 idempotent 補上共通 safety instruction。

## Pokémon direct visual evidence

每筆 `TYPE_VISUAL / BERRY_VISUAL / INGREDIENT_VISUAL / MAIN_SKILL_TEXT / SUBSKILL_TEXT` 必須至少包含：

```json
{
  "kind": "INGREDIENT_VISUAL",
  "value": "特選蘋果",
  "source_image_ref": "image-001",
  "confidence": 0.98,
  "observation_basis": "DIRECT_IMAGE",
  "inference_used": false,
  "unlock_level": 30
}
```

`observation_basis != DIRECT_IMAGE` 或 `inference_used != false` 一律不能通過 direct-evidence Gate。

有限詞彙表只作 **spelling allowlist after direct recognition**。模型 context 刻意不提供：

- Type ↔ Berry relation map
- Species ↔ Ingredient candidate map
- species source_key catalog
- player SQLite rows / private Pokémon rows
- hidden ingredient probability tables

這些只屬平台 deterministic layer。

## Species / editable header boundary

寶可夢詳細頁的可編輯頁首名稱不是 canonical species Evidence。

- 可編輯名稱原文保存於 `profile.header_name_text`。
- 只看見可編輯頁首時：`profile.species=null`。
- 只有明確、非可編輯 species label 才能使用 `species_observation_basis=DIRECT_NON_EDITABLE_SPECIES_LABEL`。
- 平台已解析 identity context 可使用 `PLATFORM_PROVIDED_CONTEXT`；模型不得自行宣稱此 basis。
- screenshot grouping header 不得 fallback 成 canonical species。

## Known adversarial fixtures

以下案例必須成為 regression fixture：

- Type/Berry contradiction：保留兩條直接觀測，不自行「修正」其中一個。
- `特選蘋果` vs `好眠番茄`：不能以紅色相似度判斷；看不清楚就 null。
- `技能機率提升M` vs `技能等級提升M`：逐字辨識。
- editable header / nickname vs canonical species：不得等同。
- Public Master 中某食材是合法候選，但圖片不是該 icon：合法候選不得生成 Observation。
- legacy `特選酪梨` vs current `嫩亮酪梨`：不得 silent rewrite direct observation。

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

## Required Pokémon observation envelope

```json
{
  "schema_version": "2.0-observation",
  "prompt_policy_version": "pokemon-visual-prompt-policy-2026-08-15-a",
  "source": "ai_screenshot_observation",
  "observations": []
}
```

Stable player identity、insert/update/upsert 與 SQLite writes 均不屬模型 envelope。

## Forbidden behavior

- 不得推測畫面未顯示的 SP、技能、食材、日期、共眠、物種或個體 ID。
- 不得將 `???` 解釋成已解鎖。
- 不得自造寶可夢、食材、樹果、食譜或進化關聯。
- 不得用 Type 推 Berry，或 Berry 推 Type。
- 不得用 Species / specialty / public candidates 推 Ingredient icon。
- 不得把 editable header / nickname 當 canonical species。
- 不得用 profile / operation value 反填 visual evidence。
- 不得輸出最終能量作為 source of truth。
- 不得跳過人工確認、平台 allowlist、consistency check 或 importer preflight。

## Regression

每次 Prompt / Schema / Public vocabulary 更新必須至少驗證：

1. internal 與 external prompt policy version parity；
2. current finite vocab parity（例如 `嫩亮酪梨` 存在、legacy `特選酪梨` 不可作 current allowlist）；
3. direct evidence basis / inference flag；
4. adversarial fixtures；
5. editable header 不成為 species；
6. manifest ↔ executable operation binding；
7. private data / hidden-rate table 不進 prompt resource pack；
8. fixed image replay / Golden JSON / hallucinated-field count；
9. browser / PWA offline dependency；
10. Production numeric authority不得因 Prompt 更新而升級。
