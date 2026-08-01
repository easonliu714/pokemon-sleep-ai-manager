# Product Vision

Pokémon Sleep AI Manager 的最終定位是手機優先、資料留在本機的 AI 戰略助手，而不只是清單或庫存管理工具。

## Product pillars

1. **Trusted local data**：玩家資料、圖片與 API Key 優先保存在本機。
2. **Versioned knowledge**：公共 Master 具 stable ID、版本、來源與更新治理。
3. **Safe AI assistance**：OCR／規則優先，Gemini 僅做低信心辨識與說明；AI 不直接寫正式資料。
4. **Explainable decisions**：評分、缺口、捕獲、培養、進化、組隊與能量預估皆能顯示證據與權重。
5. **Goal-oriented strategy**：建議依玩家目標調整，不提供單一固定答案。

## Goal modes

- 料理圖鑑優先
- 食材解鎖優先
- 樹果覆蓋優先
- 營地攻略優先
- 本週高分衝榜
- 圖鑑完成優先
- 長期培養與進化
- 自訂權重

## Decision model

Master Database + Player Profile + Weekly Context → deterministic scoring／gap／energy engines → Goal Mode weights → ranked candidates → Gemini explanation → user-confirmed action。

## Product promise

系統不隱藏缺值、不以模型臆測填補事實、不因版本更新破壞玩家資料，並讓使用者能理解每一項建議為何成立、依賴哪些資料以及仍有哪些不確定性。