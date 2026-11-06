# Pokémon Sleep AI Manager — 15 階評等與產品化階段交接 Snapshot

> **文件性質：交接輔助（NON-AUTHORITATIVE）**。此檔不得成為第三套正式 Roadmap。每次施工須重新讀取 GitHub `main`、兩份正式治理文件與 `docs/PROJECT_GATE_ROADMAP.md`，並以 Commit、PR、Exact-head CI、Pages、Owner 證據更新狀態。以下 SHA 是 2026-11-06 20:30（Asia/Taipei）歷史查核快照，不能取代新一輪 readback。
>
> 正式治理：[Roadmap/Closure Audit](../Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md) ｜ [UI/API/DB Architecture Tree](../Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md) ｜ [Gate index](../PROJECT_GATE_ROADMAP.md)。

## 1. Owner 決策／唯一產品優先順序

**P0 第一優先：G14.RATE #796 統一寶可夢盒與截圖 AI/OCR 評等，達成完整 CLOSED 前不得因一個 Source/Test PR 通過而轉入下一個產品化階段。**

- 共用 `S+, S, S-, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-` 15 個評級（使用者提出英文等級可在後續獨立治理）；同一版本規則評估**已有寶可夢盒**與**圖片辨識待確認**個體。
- AI/OCR 負責解析可追溯的觀測欄位、信心、衝突與建議解釋；確定性級別由本平台同一套有版本、可測試、具明確權重的規則運算。
- 既有寶可夢過去由不同 AI 規則建立的 `rating`，Owner 已授權**在完整安全驗證後重新評級並覆蓋**，但原評級需保留歷史證據。禁止背景靜默寫入或因 Owner 同意便跳過 Snapshot / Diff / explicit review / SQLite durability / rollback。
- 等級、已解鎖槽位、未來潛力需分開呈現。未知/衝突不可猜成 0 或強行評 D 級。評分為**平台啟發式建議**，不能冒充官方遊戲勝率、產能或 `intrinsic_score` 科學驗證。

**評等系統 CLOSED 後，依序：**

1. **Phase 1：現有功能可靠性與正式驗收** — G6.2 [#6](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/6)、G9R [#19](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19)、G479 [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479)、G295 [#295](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/295)。Source/CI_PASS ≠ Android Owner PASS。
2. **Phase 2：跨模組完整閉環** — 寶可夢 → 食材 → 料理 → 本週活動 → 戰情室 → 七日規劃。G8 [#18](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/18)、G10 [#20](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/20)、WAR.1 [#40](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/40)。
3. **Phase 3：進階 AI／培養決策／資料完整度** — G14 Training Coach [#43](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/43)、G15 Simulator [#44](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/44)、G13 多模型 [#42](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/42)，及 [#48](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/48)、[#144](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/144)、[#278](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/278)、[#164](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/164)。

不可因優先序延後獨立 P0 玩家資料安全修復或實際到期的活動實機 Gate。

## 2. GitHub Authority／工程進度（查核時點）

- Repository: `easonliu714/pokemon-sleep-ai-manager`（Protected `main`）。
- 已核實 `main` 基線：`d930a3a317103f6a8bae075763e4c0dce3bdc2ed`，後續必須重查。
- 唯一工作 PR：[Draft #795](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/795)，branch `feat/g14-pokemon-roster-provisional-rating-v1-20261106`，Base `d930a3a317103f6a8bae075763e4c0dce3bdc2ed`。此 Snapshot 更新前的 CI HEAD `2ce62019001b5ab9f67845c0fff77a08b1355d9c` 之 11 個記錄皆 SUCCESS；**本 Snapshot 和治理更新提交造成新 HEAD，舊 CI 失效，不能當新 HEAD 成功證據**。
- PR #795 已新增 `assets/js/pokemon-provisional-rating.js`（`scorePokemonProvisionalRating` 與 `planPokemonRosterProvisionalRegrade` 純計算）；`scripts/v042-pokemon-provisional-rating-contract.mjs`；把回歸掛至既有 War Room CI；已在同 PR 更新兩份正式治理文件、Gate Index 及 `docs/WAR_ROOM_SCORING_RULES_V1.md`。
- **現況標示**：RATE.1 部分 Source/Test `CANDIDATE`，前一 HEAD CI_PASS 但 final HEAD 未核；RATE.2 截圖覆核 UI `NOT_VERIFIED`；RATE.3 寶可夢盒重評預覽 UI `NOT_VERIFIED`（僅唯讀規劃器 Source）；RATE.4 實際安全覆蓋 SQLite `HOLD`；RATE.5 Stale/重算 `NOT_VERIFIED`；RATE.6 Android Owner UAT `NOT_VERIFIED`。
- 唯一產品追蹤 Issue：[**#796 G14.RATE P0**](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/796)，截至本次為 **OPEN**。既有 [#173 WAR.2A scoring rules](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/173) **CLOSED**，保持已結案，勿重做。

## 3. Gate #796 DoD 與下一步

| 子 Gate | 需要完成 | 此 Snapshot 狀態 |
|---|---|---|
| RATE.1 統一評級 | Versioned 15 labels、specialty-aware nature/subskills/ingredients、透明權重與負向 fixtures | Source/Test CANDIDATE |
| RATE.2 截圖初評 | OCR/AI Observation v2／Review 顯示暫定評級、依據、缺項和身份驗證 | NOT_VERIFIED |
| RATE.3 全盒對照 | 舊/新評級、逐筆差異、缺證據 HOLD、同物種不同個體 | Source-only，UI NOT_VERIFIED |
| RATE.4 正式覆蓋 | Snapshot → 明確確認 → durable Writer → 原子保存/ACK/readback → 失敗 rollback → 舊值 audit | HOLD／不得寫私人 DB |
| RATE.5 一致性 | OCR 回填、等級/性格/副技能改動、版本升級/還原後重新計算；CURRENT/FUTURE 分離 | NOT_VERIFIED |
| RATE.6 上線驗收 | Exact-head CI、Ruleset、protected merge、same-main CI/Pages、Android Owner PASS | NOT_VERIFIED |

下一個**唯一工程任務**：重查 PR #795 最新 exact HEAD，確認 War Room/Frontend 等 Required CI 全綠，依 Ruleset 完成 Ready/merge，重新查新 main CI/Pages；之後在同一工程治理流程接續 RATE.2 截圖覆核與 RATE.3 全盒差異 UI，不要跳至 Phase 1 或新增競爭 Writer。任何 code/TEST 新 HEAD 皆作廢舊 CI。

## 4. 資料與治理安全不可違反

- Raw Observation 不覆寫，Identity、Public Master、Player、AI Candidate 各守權威；`UNKNOWN` != `0`，Missing 不作假分數，未來解鎖不算目前產能。
- 全盒 `pokemon.rating` 重評**保留舊值可追溯證據**；在正式安全 Writer 準入、SQLite durable readback、回滾與 Owner 驗證前不可採取破壞性覆蓋。隔離式 G265 Opt-in CAS/ACK loss 測試不能冒充正式 Writer production admission。
- Migration 15/16、Candy family/quantity、ABSOLUTE_SNAPSHOT/DELTA_EVENT、離線救援、跨分頁負向 fixture 不得破壞。
- #482 `HOLD_OWNER_DEVICE_UNAVAILABLE`／`OWNER_ACTION=NONE_NOW`；不要求用戶新舊機還原、DB/Manifest 上傳、清除資料。
- G9R 11 月來源與跨公告料理發布時間衝突仍獨立 HOLD；#19 OPEN。所有既有 Owner_PASS 保留、不重驗。
- Writer 只有既有每小時任務 `6abe5983f79c8191bd8702773e1cbd4c`，於 Asia/Taipei 每小時 :55；單一 branch/PR、不得 direct-main、force push、平行 Roadmap。

## 5. Issue 結案策略與 Owner 最小操作

- **新增 Issue**：#796（產品評等唯一 Outcome Gate）。
- **已完成但不重開**：#173 CLOSED；歷史 G5.1–5.4／G6.1／G7／G12.1 等已 CLOSED 的子 Gate 依現有正式文件與 CI 保留。
- **不得提前關閉**：#796、#43、#42、#144、#6、#19、#479、#295、#18、#20、#40、#44、#48 等各自未滿完整 DoD 的 Issue。
- **當輪新增結案**：無 — 只有確定 CI+protected merge+new-main Pages 及必要 Android Owner PASS 後才能依 Issue 本身 DoD 關閉。
- **Owner 目前立即待辦**：NONE；未取得 READY_FOR_OWNER_UAT 者不請求操作或重匯。正式評級覆蓋的逐筆確認和 Android 驗收於安全准入後另行通知。

---
Snapshot created for handoff; **not** a replacement authority. Every new chat must re-read latest protected main SHA, exact PR HEAD/CI, live Issue state and both governance documents before action.
