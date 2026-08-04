# Pokémon Sleep AI Manager：OCR／AI／人工確認流程設計契約

更新日期：2026-08-04
狀態：正式架構契約（不得由後續功能修改隱性改寫）
適用範圍：圖片與 ZIP 匯入、重複圖片重分析、OCR、AI 分析、Cross Check、人工確認、SQLite 正式寫入

## 1. 核心決策

OCR 不作為 Pokémon Sleep 中文欄位的最終真值來源。

正式資料流程固定為：

```text
圖片／ZIP
→ SHA-256 清點與重複標示
→ 使用者選取圖片
→ 兩階段 OCR 證據擷取
→ AI Vision 結構化判讀
→ OCR／AI Cross Check
→ Confidence Engine
→ 人工確認工作台
→ Snapshot
→ SQLite Transaction
→ 正式資料 Commit
```

任何 OCR 或 AI 分析結果都只能作為 analysis revision／draft，禁止未經人工確認直接寫入正式 Pokémon 資料。

## 2. 重複圖片契約

SHA-256 判定重複，只能影響預設自動流程：

- 預設不自動重新 OCR。
- 預設不自動呼叫 AI。

不得阻擋使用者：

- 預覽原圖。
- 選取圖片。
- 強制重新 OCR。
- 強制忽略 AI Cache 重新分析。
- 使用既有 revision。
- 比較新舊 revision。

重複狀態不是「禁止分析」狀態。

## 3. OCR 兩階段契約

正式手動 OCR 與後續自動 OCR 證據流程必須保留兩階段：

### 第一階段：一般文字

- 對全圖執行 OCR。
- 固定 2× 放大。
- `stage = general`
- `general_scale = 2`

### 第二階段：小字與指定區域

- 依畫面 preset 對各 Region 裁切。
- 固定 4× 放大。
- `stage = small_text`
- `small_text_scale = 4`

### 合併要求

Revision 必須保留：

- `two_stage = true`
- `general_scale = 2`
- `small_text_scale = 4`
- 各 Region 的 stage、scale、文字、confidence、duration。
- 合併後的 OCR evidence。

不得只保留合併文字而遺失階段來源。

## 4. OCR 定位

OCR 的責任：

- Region 定位與畫面類型輔助。
- SP、Lv、數字與英文 token 的候選證據。
- 中文關鍵字 Hint。
- AI Provider 失敗時的降級證據。
- 與 AI 結果進行一致性比對。

OCR 不得單獨自動確認以下中文欄位：

- 寶可夢名稱。
- 主技能。
- 副技能。
- 食材。
- 性格。

## 5. AI 分析契約

AI 分析必須：

- 一次只處理目前單張圖片。
- 使用者完成明確同意後才可上傳。
- API Key 只由本機安全 Project Pool 讀取。
- Queue、DebugTrace、revision、JSON 匯出不得包含 API Key。
- 手動強制分析可設定 `bypass_cache = true`。
- 回傳結構化 Pokémon 欄位與不確定欄位。

中文與關鍵語意欄位預設必須進入 AI 判讀：

- Pokémon 名稱。
- 主技能與等級。
- 副技能與解鎖等級。
- 食材與數量。
- 性格。

## 6. Cross Check 與 Confidence Engine

Cross Check 必須以欄位為單位比較 OCR evidence 與 AI 結果。

建議預設策略：

| 條件 | 決策 |
|---|---|
| OCR confidence ≥ 95%，且為明確數字／英文 token，並與 AI 一致 | 可標示高信心候選 |
| OCR confidence 80–95% | 必須與 AI 比對 |
| OCR confidence < 80% | 必須以 AI 為主要候選並要求人工確認 |
| 中文欄位 | 一律經 AI 判讀與人工確認 |
| OCR 與 AI 不一致 | `requires_review = true` |
| AI 回報 uncertain field | `requires_review = true` |
| Provider 失敗 | 保留 OCR evidence，不得自動 Commit |

Confidence Engine 只決定建議與人工覆核優先級，不得繞過人工確認。

## 7. 人工確認工作台

工作台必須顯示：

- 原始圖片或可追溯來源。
- OCR 兩階段 evidence。
- AI 結構化結果。
- 欄位級一致／衝突狀態。
- 信心值與建議採用來源。
- 可編輯正式欄位草稿。
- 建立新個體或更新既有個體選擇。

使用者按下「確認並寫入正式資料」前，不得修改正式資料表。

## 8. 正式寫入契約

正式寫入順序固定為：

```text
人工確認
→ 建立 Snapshot
→ BEGIN
→ 寫入 pokemon／subskills／ingredients／history
→ COMMIT
→ persist SQLite
```

任何錯誤：

```text
ROLLBACK
→ 保留舊正式資料
→ 保留 analysis revision
→ 顯示可重試錯誤
```

## 9. Revision 與可追溯性

每次 OCR／AI 分析必須建立新 revision，不直接覆寫舊結果。

必須記錄：

- image SHA-256。
- source image reference。
- analysis type。
- revision number。
- forced／bypass cache。
- provider／model／prompt version。
- region preset。
- OCR stage／scale evidence。
- supersedes analysis ID。
- created at。

## 10. 禁止事項

後續版本不得：

- 將 OCR 中文結果直接當正式真值。
- 取消 2× 全圖＋4× 小字的兩階段 OCR。
- 因 SHA-256 重複而禁止手動重新分析。
- 未經同意自動送圖至 AI。
- 將 API Key 寫入任何可匯出資料。
- 未經人工確認直接更新正式 Pokémon 資料。
- 失敗時覆寫或破壞舊 revision／正式資料。

## 11. CI 架構 Gate

CI 必須至少檢查：

- 本文件存在。
- 文件包含 `general_scale = 2` 與 `small_text_scale = 4`。
- 文件包含 OCR → AI → Cross Check → Confidence Engine → 人工確認 → SQLite Commit。
- 程式仍保留兩階段 OCR 常數與 stage evidence。
- 正式寫入仍有 Snapshot、BEGIN、COMMIT、ROLLBACK。
- 分析 revision 保存後才可進入人工確認。
- 正式工作台不得包含 API Key。

此文件為後續架構審查與 PR 驗收的共同基準。