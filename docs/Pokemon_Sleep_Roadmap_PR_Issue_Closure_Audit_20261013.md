# Pokémon Sleep AI Manager — Roadmap／PR／Issue 全量盤點與結案審核

> **2026-10-13 G9-R subsequent Gate（本分支、尚未 Merge）**：`G9R_DATA_ONLY_APPEND_ONLY_SOURCE_PR_ADMISSION` 新增官方記事擴充候選的 **old/new payload SHA256 雙端校驗、舊活動逐筆 immutable、只增不減、公告 exact candidate compare、營地/倍率/04:00/首次研究糖果 FEATURE_ONLY、阻止 SHA / 版次異常**。僅 `scripts/g9r-official-event-source-refresh.mjs` 與其 contract 測試改動；不增 Public Master data、不動玩家資料表、不輪轉 `.22` App tuple。**SYNTHETIC 測試≠真實新公告≠Owner E2E。**Issue #19 持續 OPEN。CI/Main/Pages 實際結果應以該 PR 即時狀態為準。


> **2026-10-13 Living Status Reconciliation / canonical progress baseline**
> 本檔已列為 GitHub docs 正式進度權威；本次 MAIN d25c2515cda3b32d7442d796fe6cca682648c528、v0.4.27.55.3.3.22。
> GitHub 初始稽核 OPEN Issues=21、OPEN PR=7 是以下歷史快照；**本次操作後 OPEN Issues=20、OPEN PR=0（建立本文件 PR 前）**。後續須 fresh-read，不能永久採用本行。
> #472 MERGED：G9-R synthetic future data-only regression + unknown bonus HOLD；正式下期真實活動 data-only Owner Gate 仍 OPEN #19。
> #429 #430 #431 SUPERSEDED/CLOSED（successor MERGED #432）；#434 SUPERSEDED/CLOSED（MERGED #435）；#359 #360 SUPERSEDED/CLOSED（MERGED #361/#362）。舊分支均未合併。
> #420 已依 PR #421 compact schema + PR #424 Candy screenshot real-device provider response evidence CLOSED/completed；G13 broader #42 仍 OPEN。

## Long-lived progress baseline governance (mandatory)

1. 每次對話／每小時任務發生實質進度更新，先確認 GitHub current main、branch、PR exact head、CI/Pages、Issue 原 DoD，**同步更新本檔及配套 UI/API/DB architecture tree**，走 branch/PR/CI/受控 merge；不得只改對話摘要。
2. 更新記錄至少保留 MAIN_SHA、SOURCE_REF、PR/ISSUE、Gate/功能 Owner、CODE、exact-head CI、Pages、Owner Android、PUBLIC_DATA_SHA、PLAYER_DB_WRITE、EVIDENCE、NEXT_GATE；未知即 NOT_VERIFIED。
3. docs/PROJECT_GATE_ROADMAP.md 是頂層 Gate authority；本檔詳列 Issue/PR 與進度，同步另一檔 UI/API/DB；不得相互矛盾。僅 Doc/CI PASS 不可替代 owner physical gate。
4. 已 CLOSED 的 Gate 不重做；真實官方活動未驗證不偽造資料；私有 SQLite、Raw、Public Master、UNKNOWN 不可被隱含寫入。



> **稽核日期**：2026-10-13（Asia/Taipei，對話稽核基準）  
> **專案**：[`easonliu714/pokemon-sleep-ai-manager`](https://github.com/easonliu714/pokemon-sleep-ai-manager)，正式分支 `main`。  
> **文件性質**：依使用者提供的 SPC_System 稽核範本編排，**實際內容完全以 Pokémon Sleep 現行 GitHub、可見的 Owner 證據和原始碼為準**。此為只讀現況報告／受控 Roadmap 更新候選，**本報告本身不是 merge、Issue close、手機操作或 DB live readback 的證據**。  
> **防漂移**：本報告的 SHA 僅代表此次 readback；後續施工前必須重新讀 GitHub current authority。本地 Windows checkout 未連線，`LOCAL_HOST_AUTHORITY=NOT_VERIFIED`。

## 0. 稽核結論與 Evidence Gate

| 項目 | 本輪實際查核 | 解讀 |
|---|---|---|
| GitHub `main` | `5cf26a83533216eda71ba461c1f2e5596b539cf8` | 本次遠端 readback，不得永久 pin |
| 產品 Release | `v0.4.27.55.3.3.22` | `assets/js/version-authority.js` |
| Build | `20261012-v0427553322-g9-official-event-auto-refresh` | 未進 `.23` |
| Cache | `pokemon-sleep-ai-v0.4.27.55.3.3.22-v0427553322-g9-official-event-auto-refresh` | 與正式 build 一致 |
| GitHub Issues | **OPEN 21；CLOSED 108** | GitHub issues API；PR 不混入 Issue 數 |
| Pull Requests | **OPEN 7**（#472 + 6 歷史）；#471 已 MERGED | 6 歷史 PR 均未合併，與 main 已 `diverged` |
| 最近 G9-R | #472 `4f75a8d3c9297a59e8856fe925e5283ed54de231`，Ready／OPEN | synthetic 測試，不是未來真實活動發布 |
| #472 exact-head CI | 首輪已觸發 6/6 `SUCCESS`，包含 Data Boundary | 不能替代 merge 後 main／Pages |
| main GitHub Actions | 12 個 post-merge push-run `SUCCESS`；另 2 個 schedule success | Pages 同 `main` SHA [run 38279224592](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38279224592) |
| Actions 拓樸 | `13` 個 `.github/workflows/*.yml` | 禁止新增同質 workflow／`contents:write` |
| G9 `.22` Owner Android | **PASS** | [#19 comment 6139254152](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19#issuecomment-6139254152) |
| G9 新未來資料 only 更新 | **OPEN／REAL E2E 未驗收** | 新正式來源＋不同 SHA＋同 `.22` PWA 畫面／last-good proof 尚未完整 |
| 現有 Roadmap | `docs/PROJECT_GATE_ROADMAP.md` blob `9c47103c6db0a78696e77c49c74414dfe25827f1` | main 仍錯載 `.22 PR #471 active／Owner pending`；#472 分支已提出更正，**尚未進 main** |
| 個人 SQLite／裝置當下 | **NOT_VERIFIED** | 不宣稱遠端能看到使用者私有 DB、手機即時資料或完整 parity |

### 採用的狀態字典

- `CLOSED_OWNER`：正式實作、CI/Pages、指定 Owner Android 驗收有可追溯的完成紀錄。
- `CLOSED_GATE`：限特定子 Gate／歷史證據 PASS；不推論父 Epic 全部完成。
- `IMPLEMENTED_CI`：正式主線程式和回歸存在，尚需獨立 Owner／資料／整體端到端條件。
- `PARTIAL`：可重用骨架已存在，尚無完整產品成果。
- `REVIEW_CLOSE`：疑似 Issue／PR 遺漏核銷，必須依原 DoD 與後續證據做逐項 readback，不自動關閉。
- `OPEN`／`BLOCKED`：真正剩餘功能或無可用權威，不能憑現有按鈕／函數推論 PASS。
- `SPEC_ONLY`：Roadmap／設計文件想達成，但未發現相應完整實體。

## 1. 校正後多階層 Roadmap Tree

```text
Pokémon Sleep AI Manager — canonical outcome roadmap（稽核建議，不等同已 merge）
├── R0. Foundation / data isolation
│   ├── [CLOSED_GATE] GitHub Pages PWA／SW／SQLite WASM + IndexedDB；救援唯讀
│   ├── [CLOSED_GATE] Raw immutable → Review → Dry Run → Snapshot → Transaction/Readback
│   ├── [CLOSED_GATE] Migration 15 Candy family + 24/20 explicit visible target
│   └── [CLOSED_GATE] Migration 16 Evolution；UNKNOWN ≠ 0；ABSOLUTE vs DELTA
│
├── R1. Public Masters + canonical personal state
│   ├── [CLOSED_OWNER] G5.1–5.4 Public Recipe identity + 玩家食譜狀態（#1–#4 CLOSED）
│   ├── [CLOSED_GATE] G6.1 deterministic Ingredient Gap（#5 CLOSED）
│   ├── [CLOSED_GATE] G7 multi-meal deterministic cooking／能量規劃（#17/#246 CLOSED）
│   ├── [PARTIAL #48] 寶可夢、樹果、食材、營地、技能、進化、來源版次與 coverage
│   └── [OPEN #278] 物種食材機率，不能從 specialty 猜數值；Production coverage 未滿
│
├── R2. 私人資料輸入與 OCR
│   ├── [CLOSED_GATE] Observation/Identity/Guarded Import（#37 CLOSED）
│   ├── [CLOSED_GATE] DATA.1D OCR／1D.1 OCR UI／DATA.1E Review（#55/#63/#56 CLOSED）
│   ├── [CLOSED_OWNER] .21 食材公版名稱人工確認→庫存 Apply 與字卡明細一致
│   ├── [IMPLEMENTED_CI / REVIEW_CLOSE #420] Gemini compact provider schema；原樣 Candy 重試證據核對
│   ├── [PARTIAL #7] 來源 ZIP 清冊、原始截圖分類與剩餘個體處理
│   ├── [OPEN #58] pHash/dHash/OCR 近重複（不是現有 exact SHA 去重）
│   ├── [OPEN #164] Evolution 圖片 UNKNOWN backfill／來源對應
│   └── [OPEN #144] Full75 私有資料 75/75 completeness＋Owner 確認
│
├── R3. Cooking / weekly / event
│   ├── [CLOSED_OWNER] .20→.21 食譜優先缺料規劃／食材庫存人工確認
│   ├── [IMPLEMENTED_CI / PRODUCT HOLD #6 #16] G6.2 optional 失敗回饋／暫停推薦
│   │   └── 禁止要求玩家為驗收故意浪費料理；未完成 owner no-waste closure
│   ├── [CLOSED_OWNER] G9-R .22 既有正式活動 Event Master/UI/SW 前景刷新
│   ├── [CURRENT OPEN #19] 未來**真實**公告→only JSON+SHA PR→同 .22 PWA 新 SHA 實機
│   │   ├── [PASS on PR #472] SYNTHETIC 新週 replay、未知 bonus REVIEW/HOLD
│   │   └── [NOT PROVEN] 新真實官方活動 data-only 發布＋Owner Android offline/rollback
│   ├── [PARTIAL #18] G8 七日每時段 Team／料理／替補／草稿
│   └── [OPEN/PARTIAL #20 #40 #265] Team Builder、命名隊伍存檔、決策卡 UX
│
├── R4. Evolution / Training / Collection
│   ├── [CLOSED_GATE] G12.1 A–E deterministic Evolution（#411/#41 CLOSED）
│   ├── [IMPLEMENTED_CI; OWNER CHECK #457] G14.1 由 level 推算 CURRENT/FUTURE
│   ├── [OPEN #43] G14.2 ROI／14.3 共眠排程／14.4 Coach UI／14.5 closure
│   ├── [OPEN #44] G15 Sandbox scenario / clone / restore / no-write proof
│   └── [PARTIAL] G11 capture/collection target→完整捕獲規劃（部分納入 #9）
│
├── R5. AI + UX lifecycle
│   ├── [PARTIAL #42] G13 多圖 OCR、Gemini BYOK、Review、fallback、成本治理完整統一
│   ├── [OPEN #47] 首次導覽、營地預設、資料初始化完整導引
│   ├── [REVIEW_CLOSE #295] Watchdog foreground/hidden 修復已有正式版；native dialog 等 DoD 待核對
│   └── [OPEN #265] concise recommendation cards + named team draft 持久化
│
└── R6. Governance & product closure
    ├── [CURRENT] PR #472 exact-head→merge/main/Pages proof（主施工 single writer）
    ├── [NEXT] #19 新**真實**活動 DATA-ONLY E2E，不可用 synthetic 取代
    ├── [REVIEW] 歷史 6 OPEN PR vs newer merged successors（不可 merge 過期分支）
    ├── [REVIEW] #420、#295、#457 精準 Issue closure audit
    ├── [UPDATE] Canonical Roadmap stale 類目、Issue #9 checklist crosswalk
    └── [AFTER G9] 再選 G8／WAR.1／G14，不同 Owner 不建立同功能平行系統
```

## 2. PR 全量盤點（Open 7）

| PR | Branch／範圍 | Current | 建議／不可誤判 |
|---|---|---|---|
| [#472](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/472) | G9-R synthetic source replay，HEAD `4f75a8d3…` | **READY／OPEN**；首輪 6/6 CI PASS | **KEEP ACTIVE**。交既有主施工流程重新核對 required CI→expected-head merge→main/Pages；僅關閉 synthetic 子 Gate；**不關 #19** |
| [#434](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/434) | `.55.3.3` page hydration，舊 head `def3ce0…` | **OPEN**；新主線已有 [#435](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/435) MERGED | **REVIEW_CLOSE：疑似同目標被 #435 取代**。先核對具體 diff 與 callback/UX regressions；不用 merge 過期 head |
| [#431](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/431) | `.55.3.2` version-authority，`b8363fa…` | **OPEN**；[#432](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/432) MERGED | **REVIEW_CLOSE**。以現在唯一 `version-authority.js` tuple、後繼 regression 證據核銷 |
| [#430](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/430) | `.55.3.2` version promote，`289cce1…` | **OPEN**；[#432](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/432) MERGED | **REVIEW_CLOSE**；與 #429/#431 屬同一 release identity 問題，勿重複合併 |
| [#429](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/429) | `.55.3.2` version publish，`317af2a…` | **OPEN**；[#432](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/432) MERGED | **REVIEW_CLOSE**；確認已完成 successor 後用 superseded comment 關閉 |
| [#360](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/360) | 舊 `.27.12` confirm lifecycle/fallback，`ef7360e…` | **DRAFT／OPEN** | **REVIEW_CLOSE**：新版 OCR confirmation 模組已大量迭代；逐條對比 Owner 缺陷（model、name、registered_at）不能直接 assume 已全修 |
| [#359](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/359) | 舊 `.27.12` mobile confirmation，`eaed5c1…` | **DRAFT／OPEN** | **REVIEW_CLOSE**：先核對後繼版本，禁止把此舊 source branch 合回 .22 |

**額外 GitHub compare**：六個歷史 PR head 對 `main@5cf26a8…` 均為 `diverged`（非 ancestor-only），所以「主線比較新」並不自動證明 PR 的**每個驗收條件**都完成。可關閉的是**被證明已取代的 PR 協作分支**；未實現的實際需求要留在唯一 canonical Issue，不可一起抹除。

### 已合併的高價值前驅證據（勿重工）

[#421 HTTP400 compact schema](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/421)、[#424 visible 24/20](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/424)、[#439 watchdog](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/439)、[#458 G14.1](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/458)、[#459 G5.1](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/459)、[#468 G6.2](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/468)、[#469 `.20`](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/469)、[#470 `.21`](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/470)、[#471 `.22`](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/471) 均已 MERGED；其後的新缺口應 **extend／verify**，而非另起一套相同功能。

## 3. 21 筆 Open Issues — 完整處置矩陣

| Issue | 功能域與既有能力 | 處置 | 結案還差的最小證據 |
|---|---|---|---|
| [#6](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/6) | G6.2 optional feedback；[#468](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/468) 已合併 | **KEEP / OWNER HOLD** | no-waste rescope、只接受自然發生回饋的 UI／本機儲存、完整 Owner acceptance；不可強迫失敗 |
| [#7](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/7) | DATA.1 ZIP inventory／分類／匯入 | **KEEP** | 實際剩餘私人截圖索引與處理狀態、manifest、缺漏項及 Owner readback |
| [#9](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/9) | Global Roadmap Epic | **PARENT KEEP / UPDATE** | 子 Gate crosswalk 更新；不要因局部 PASS 關閉父看板 |
| [#16](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/16) | G6 Epic / G6.1 closed / G6.2 partial | **PARENT KEEP** | #6 依 rescope 完成，外加 G6 整體 Owner 驗收 |
| [#18](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/18) | G8 seven-day planner | **KEEP** | 七日每日時段、儲存比較草稿、替補及資源收支可再現／手機 UAT |
| [#19](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19) | G9 Event / .22 display PASS | **PARENT KEEP / CURRENT** | 新真實公告 DATA-ONLY PR＋sha＋同 .22 PWA live/last-good/DB isolation Owner PASS |
| [#20](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/20) | G10 deterministic 5-member optimizer | **KEEP** | 全部規劃條件、命名團隊持久化與 Android 產品驗收 |
| [#40](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/40) | WAR.1 team UI/profile/energy | **PARENT KEEP** | `teams/team_members` schema + CRUD + energy interval + draft/compare／實機 |
| [#42](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/42) | G13 OCR / Gemini BYOK / review | **PARENT KEEP** | 多輸入情境、完整 provider/成本/隱私/離線與手機流程最後驗收；既有 OCR 不重寫 |
| [#43](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/43) | G14 Training Coach | **PARENT KEEP** | G14.2 ROI → 14.3 sleep → 14.4 UI → 14.5 closure |
| [#44](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/44) | G15 Simulation | **KEEP** | snapshot-only 隔離 sandbox、操作 allowlist、rollback、保存與結果對比 |
| [#47](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/47) | G13.8 first-run guide／camp | **KEEP** | setup flow, master/bootstrap isolation, empty-profile UAT |
| [#48](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/48) | broad Public Master DB coverage | **PARENT KEEP** | 全覆蓋率與 sources+version+manifest，避免將 spec 中未建實體當成 live table |
| [#58](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/58) | DATA.1F near duplicate image | **KEEP** | pHash/dHash/OCR-near-dup corpus、分數、人工覆核；現有 exact SHA ≠ 完成 |
| [#144](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/144) | DATA.2A Full75 | **KEEP** | 75/75 私有完整性報表、缺項確認、完整更新/退役與裝置 evidence |
| [#164](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/164) | Evolution UNKNOWN backfill | **KEEP / EVIDENCE DEPENDENT** | 每張圖片來源、分歧、route/terminal/UNKNOWN coverage 的私人資料 proof |
| [#265](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/265) | War Room concise cards／named drafts | **KEEP** | local named team drafts 存取與 mobile UX、不做遊戲側「套用」假象 |
| [#278](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/278) | G7.5E3 species ingredient rate | **KEEP / BLOCKED** | 物種/形態來源數值、跨來源核對、統計充分性、無衝突；不能猜 0 |
| [#295](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/295) | watchdog lifecycle / false positive | **REVIEW_CLOSE (PARTIAL)** | #439 已上 main、hidden/foreground case 需比對；issue 特別要求 native dialog／manual-block 防誤報，沒有該精確證據不可關 |
| [#420](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/420) | Gemini HTTP400 large catalog schema | **REVIEW_CLOSE (HIGH PRIORITY)** | main 已有 `public-master-recognition-provider-schema.js` compact string keys，且 #421 merged；仍需核對 Issue 要的同一張 Candy screenshot 裝置重試、平台端 strict validation 才可 CLOSE |
| [#457](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/457) | G14.1 CURRENT/FUTURE | **REVIEW_CLOSE (OWNER PROOF)** | main `training-derived-state-authority.js` + #458 merged/regression；Issue 0 comment，缺 exact Owner acceptance record，不可把 CI 等於手機 PASS |

**可立即不經額外實機就批次 Close 的 Issue 數：0（依本輪可見 DoD）。** 可優先「核銷審核」的是 #420、#295、#457；是否 CLOSE 取決於上述最小證據，不得把「已 merge」等同「所有 Issue 條件完成」。

## 4. 功能／Issue 去重 Crosswalk — 單一 Owner

| 唯一能力／模組 | Canonical owner | 相交 Issue，不可平行再寫 | 施工規則 |
|---|---|---|---|
| Public Recipe 公式與身份 | `public-recipe-master.js` / #48 | G5 #1–#4、G6 #5/#6、G7 | 玩家僅維護 recipe state；不新建個人 recipe master |
| 食材庫存與圖片匯入 | `ingredient-inventory-integrity-*`, UC.IMG / #42 | #7、#144、#6、#18 | 使用既有 Review→Dry Run→Apply→readback、不可未知=0 |
| Pokémon identity／Candy | `identity-*`, `candy-family-storage-authority.js` | #7、#144、#457、#43 | 24/20、Migration15、ABSOLUTE/DELTA 固定不可重建 |
| Growth/official events | `public-event-master-*`, `weekly-event-effect-registry.js` / #19 | #18、#20、#40 | 同一 Public Master + manifest／精確 typed registry；源掃描 read-only；不新增私有 RaenonX API |
| G6.2 feedback | `recipe-attempt-feedback*.js` / #6 | #16、#9 | 可選保留本機、暫停推薦，**不要求故意失敗** |
| War Room / 5-person optimize | `team-optimizer*`, `war-room-*` / #40 | #20、#265、#18 | 重用 optimizer，新增儲存命名團隊不可創造第二套排名引擎 |
| Evolution/training | `g121*`, `training-derived-state-authority.js` / #43 | #457、#164、#48 | G12.1 已實作，G14 ROI 為獨立未完成上層 |
| OCR/AI | `data1d*`, `ai-*`, `public-master-recognition-*` / #42 | #7、#58、#420、#144 | provider JSON 僅候選；平台端 strict resolver 與人工確認必經 |
| PWA lifecycle/watchdog | `bootstrap.js`, SW, `v0394-startup-watchdog.js` / #295 | #47、#420、歷史 PR #359/#360 | 逐項核對已 merge successor，不直接復活舊分支 |
| Public version/data architecture | `docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md` / #48 | #19、#9 | 公版版本和 App build 分開；未觀測效果保留 REVIEW |

## 5. 缺漏／風險／排序

### P0 — 防止現行主線成果誤判

1. **[NOW] #472 PR closure**：以最新 exact HEAD recheck complete required PR checks；不得跳過數量不等的檢查；合併後讀 exact-main CI+Pages，並只宣告 SYNTHETIC 子 Gate PASS。
2. **[NOW] #19真實 data-only E2E**：不同官方來源有效版次與 SHA、原 `.22` 裝置前景更新、offline last-good、玩家私有欄位保留；source/payload 衝突 fail closed。無新公告則保持 OPEN。
3. **[NOW] 舊六 PR 審核**：#434/#429–431/#359–360；不 auto merge；若明確 superseded 則留言指向新 successor／關閉分支 PR。
4. **[NOW] Roadmap 本體更新**：從已 merge main 衍生合法 branch 修補，禁止用 branch 上的文件提前宣稱 main 已更新。

### P1 — 後續功能實質缺口

- G8 #18 七日 planner 與本機存檔；WAR.1 #20/#40/#265 命名團隊持久化、對照與能量模型。
- G14 #43 ROI/sleep/coach；G15 #44 真正隔離的 scenario simulator。
- G13 #42 完整 OCR/provider/cost/empty-state 與近似去重 #58；DATA.2A #144 實際私人 75/75 closure。
- Public Master #48 未核完的資料涵蓋，#278 物種機率，#164 Evolution UNKNOWN evidence。

### P2 — Issue hygiene，不重跑已關 Gate

- #420→#295→#457 高價值證據比對；#6 僅限 no-waste 的新驗收決策。
- Issue #9/各 parent checklist 與 Canonical Roadmap 清楚劃分「功能已編碼」「CI PASS」「Owner PASS」「後續獨立缺口」，避免 checklist stale 觸發重工。
- 對 Issue 每輪固定記錄：`OWNER / CODE_REF / DATA_AUTHORITY / HEAD / CI_RUN / OWNER_UAT / BLOCKER / NEXT_PROOF / CLOSE_DECISION / LAST_VERIFIED_AT`。

## 6. 強制治理／更新流程

1. Fresh-read `main`、`version-authority.js`、Open PR exact HEAD、必要 CI+Pages、Issue 最後 comment、13 個 workflows；若本地無權存取，明示 `LOCAL_HOST_AUTHORITY=NOT_VERIFIED`。
2. 每筆新需求先找「既有 UI／函數／表格／Issue canonical owner」，找不到才能另開新 Issue／新表。
3. 對每個 Gate 分層存 `CODE_PRESENT`、`CI_VERIFIED`、`DEPLOYED`、`OWNER_VERIFIED`、`REAL_DATA_E2E`，不得跨層推論。
4. 凍結已 CLOSE 的 G5.1–5.4、G6.1、G7、G12.1、Candy Migration15/16、`.21/.22` owner 行為；只容許針對可再現回歸做最小修復。
5. 受控 **fresh main → branch → PR exact-head required checks → Ready/readback → expected-head merge → exact-main CI/Pages**。若本輪另有主施工 task 持有 branch 寫入權，本文件只能提交為交接候選，不做競態 repo 變更。
6. 嚴禁 GitHub Actions direct `contents:write`／push／commit；保持現有 13 workflow topology。官方新效果若超出 registry → REVIEW/HOLD；`pokemon_candy_multiplier` 是首次睡眠研究獲糖果，不是使用糖果培育 EXP。
7. 不得把 synthetic 測試、頁面截圖表象、資料表 DDL 或 stale Roadmap 當作真實玩家 SQLite row readback。

## 7. 來源與差異判定

- [正式 Roadmap（本輪查得 stale）](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/main/docs/PROJECT_GATE_ROADMAP.md)
- [已驗收的 Owner `.22` 及 G9-E2E 待辦：Issue #19](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19)
- [最新 synthetic G9-R 候選：PR #472](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/472)
- [唯一 Release Authority](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/main/assets/js/version-authority.js)
- [目前 workflows](https://github.com/easonliu714/pokemon-sleep-ai-manager/tree/main/.github/workflows)
- [主要本機 SQLite DDL](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/main/assets/js/schema.js)
- [架構樹配套文件](./Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md)

**稽核限制**：無直接 Android 操作、無個人 SQLite、無本地 checkout/dirty readback，也沒有在此次稽核中實際 Close Issue/PR；所有 CLOSE 僅提供適用的判準及推薦動作。