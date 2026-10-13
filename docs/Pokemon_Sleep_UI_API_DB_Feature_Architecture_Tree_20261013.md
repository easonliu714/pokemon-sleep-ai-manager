# Pokémon Sleep AI Manager — UI／功能 API／SQLite／Public Master 架構樹與驗證矩陣

> **2026-10-13 architecture release baseline**：截至 main `3b1aabd2c26a120cac8037d1277518a2aedec1fe`，G9R `verifyG9RDataOnlyRelease`（#474）與以 mock DB 執行**原始** `refreshPublicEventMaster` 的 runtime regression（#475）已 MERGED；其所列 JS API 均為開發／QA 端，既有 PWA Production module `assets/js/public-event-master-store.js` 未改。**UI=NO_CHANGE、SQLITE_DDL=NO_CHANGE、IndexedDB=NO_CHANGE、Public Master JSON/manifest=NO_CHANGE、APP_VERSION=.22、CI PR exact-head=PASS；OWNER NEW-SHA REAL DEVICE=NOT_VERIFIED**。以此避免將 API 測試誤認為 UI 新功能或資料表新增。


> **2026-10-13 Runtime contract extension（#475 已 MERGED）**：新 `scripts/g9r-public-event-refresh-lastgood-contract.mjs` 直接載入 `assets/js/public-event-master-store.js` 實際 SOURCE（僅在測試時替換 DB import 為隔離的 SQLite API mock），依序核對首次公版 refresh、UNCHANGED no rewrite、SYNTHETIC future changed-SHA、exact 04:00 active projection、bad SHA / offline latest cached、SQL transaction abort/rollback、私人 `pokemon` sentinel 無寫入與 `.22` Version Authority byte-identical。現有 PWA runtime/SQLite DDL/IndexedDB/Public Event JSON+Manifest 一律不變。**不等同真實 Android SQLite/PWA 實機 Gate**。


> **2026-10-13 G9-R module-level delta（#474 已 MERGED）**：`scripts/g9r-official-event-source-refresh.mjs` 匯出 `verifyG9RDataOnlyRelease()`：檢查候選官方 Growth Week Data-Only feed 雙 SHA、append-only immutable old Event rows、source candidate exact parity、04:00、feature-only candy scope；既有 `discoverAndStage(write=false)` 乾跑與 `--write` 的受控候選路徑必須先通過 guard。`scripts/g9r-official-event-feed-contract.mjs` 以**虛構且明確 SYNTHETIC** future event 測試新 SHA / 惡意變更 / 缺少版次 / 錯誤 Manifest，僅測試不發佈。**UI/JS Runtime API/SQLite DDL/IndexedDB Store/Public Event payload+Manifest 均無實體變更；Owner same-.22 actual new-SHA PWA gate 仍 NOT_VERIFIED**。


> **2026-10-13 Living Architecture Reconciliation / canonical feature baseline**
> 本檔已列為 GitHub docs 常設 UI/API/DB 權威，每次有 Gate／PR／Issue 實質更新皆需與 Roadmap/Issue Audit 同步增修。
> GitHub main d25c2515cda3b32d7442d796fe6cca682648c528（v0.4.27.55.3.3.22）；#472 合併僅 G9R source fail-closed parser、synthetic tests、Roadmap，**無 PWA UI/SQLite schema/玩家資料變更**；下方初始 main@5cf26... 是歷史盤點 SHA。
> Issue #420 已以 #421/#424 schema + real-device provider evidence 完成原 HTTP400 Gate；G13 #42 未全部閉合。#359/#360/#429/#430/#431/#434 舊版 PR 已標 SUPERSEDED/CLOSED，不可當 live UI 權威。
> 仍 OPEN #19 新正式下期活動 changed-SHA DATA-ONLY same .22 PWA/offline-last-good Owner E2E；#457 owner derived-unlock、#6/#16 non-waste recipe feedback 等，必須保留原 Gate 邊界。

## Living architecture change-control rule

每次對話／進度變更必須逐列檢查 UI control → JavaScript API/event → SQLite DDL / IndexedDB / Public Master → persisted row/real source → CI → PWA Owner Gate；分別標 SPEC_ONLY、CODE_PRESENT、DDL_PRESENT、CI_PASS、OWNER_PASS、NOT_VERIFIED。若本輪純 PR/Issue 清理，仍增補本檔功能歸屬及承接來源，不得虛稱 DB schema change。
配套：Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md；頂層：PROJECT_GATE_ROADMAP.md。



> **分析基準**：2026-10-13；`easonliu714/pokemon-sleep-ai-manager` 正式 `main@5cf26a83533216eda71ba461c1f2e5596b539cf8`，正式 `v0.4.27.55.3.3.22`。  
> **文件類型**：以 SPC_System 的「UI/API/DB 反向盤點」方法檢視 **Pokémon Sleep 自己的已部署入口、實際匯入的 JS、SQLite DDL、IndexedDB store、外部網路邊界與 Issue DoD**。不是一份建議從零重寫的架構書。  
> **讀取界線**：GitHub source/DDL 有原始碼證據；非使用者手機上的 runtime SQL introspection。`SPEC_ONLY` 不得宣稱 SQLite 實際存在；`OWNER_PASS` 僅指指定使用者畫面／情境。

## 0. 專案實際部署架構與狀態語意

```text
Android / Desktop PWA [RUNNING via GitHub Pages；.22 Owner Android PASS]
├── index.html [正式執行入口／13 個主要導覽 view]
├── assets/js/bootstrap.js → app.js / page-hydration-authority-* [CODE/CI]
├── assets/js/version-authority.js [唯一 app_version/build/cache authority]
├── service-worker.js [PWA cache；活動 manifest/payload network-first]
├── 前端 UI 模組／ESM domain API [CODE；不同功能驗收程度不同]
├── SQLite-WASM（sql.js） [LOCAL PLAYER + LOCAL CACHED PUBLIC tables]
│   ├── DDL: schema.js / migrations.js / shared-master-schema.js
│   ├── DDL: public-event-master-schema.js / g121-authority.js 等
│   └── transactions / migration / snapshot readback
├── IndexedDB database `pokemon_sleep_ai_manager` [CODE]
│   ├── `database`: SQLite bytes（primary）
│   ├── `snapshots`: 回復用快照紀錄
│   ├── `metadata`: 設備／DB／snapshot 元資料
│   └── historical `snapshot_metadata`: legacy/migration 相容
├── 獨立加密 AI Key / Project Pool storage [CODE，ai-key-vault.js]
├── 版本化 Public Masters [JS catalogue + assets/data/*.json + checksum]
└── 外部網路邊界
    ├── GitHub Pages GET（HTML／JS／CSS／Public JSON、manifest）
    ├── CDN sql.js（index.html 中明列）
    ├── Owner BYOK 時 AI provider 端點 [非 App 自架後端；需同意/計費/隱私]
    └── 官方 Pokémon Sleep 公告：CI read-only source scan；非私有 API
```

**重要區別**：此 repo 的正式運行方式是**純前端 GitHub Pages PWA**，未見現行 FastAPI／Node backend service 用於個人帳號資料。此文件中的「系統 API」是瀏覽器內的 **JavaScript module export／events／SQLite service boundary**，不是 `GET /api/...` REST route。任何未見 source 的雲端 API、玩家雲端 DB、RaenonX private endpoint 都**不是可用/已驗證的系統能力**。

狀態使用：`CODE`＝當前 source 存在；`CI`＝與實際回歸 Gate 有關的驗證；`OWNER_PASS`＝可稽核裝置情境；`PARTIAL`＝部分功能；`OPEN`＝缺產品能力；`UAT?`＝尚無足夠實機證據；`SPEC_ONLY`＝純文檔規格；`PR_CANDIDATE`＝未 merge。**不得將任何兩種不同證據層互相替代**。

## 1. UI／UX 真實執行入口（`index.html`）

`index.html` Git blob `207e73de58017e32d8259d62440841258a2de645`；目前 nav 有**13 個主要 view**（不是其他專案的多頁式 Dashboard）。以下以 `data-view`、DOM ID 與實際 module 分群：

```text
PWA 主操作介面 [CODE；.22 現有活動 UI OWNER_PASS，不代表全部 UI 已實機驗證]
├── 01. 儀表板 dashboard [CODE / baseline UAT]
│   ├── dbStatus / pageLoadStatus / appVersion / storageWarning
│   ├── capacityCards / pokemonCount / ingredientCount / itemCount / recipeUnlocked
│   ├── ratingSummary / storageSummary / requestPersistenceBtn
│   └── [UAT?] DB 救援／配額／跨裝置計數總一致性（不要從字卡推全表）
│
├── 02. 寶可夢 pokemon [CODE / DATA.2A部分]
│   ├── pokemonSearch / ratingFilter / specialtyFilter / pokemonTable
│   ├── pokemonDetailBackdrop；detailRating、detailEditBtn/Save/Cancel、detailBody
│   ├── roster filter、CURRENT/FUTURE ingredient/subskill unlock（G14.1）
│   └── [OPEN #144/#457] 私人 75/75 full audit；G14.1 Owner exact gate closure check
│
├── 03. 食材 ingredients [CODE / .21 Owner PASS on identified flow]
│   ├── ingredientTable + ingredient-inventory-integrity-ui.js
│   ├── Public ingredient identity / inventory state / zero-vs-unknown
│   ├── screenshot OCR → manual public-name confirm → Dry Run → Apply
│   └── [OWNER_PASS .21] 指定案例 cards/table；不是全量 SQLite DB dump
│
├── 04. 道具 items [CODE / UAT?]
│   ├── itemTable + item_master / item_inventory
│   └── [UAT?] 既有帳號道具全部 row 對照／未知數量的處理
│
├── 05. 食譜 recipes [CODE / G5.1–5.4 CLOSED]
│   ├── recipeTable / recipe_catalog_state（Public Recipe identity + player state）
│   ├── unlocked / recipe_level / current_energy；配方＋食材來源唯公版
│   ├── recipe-attempt-feedback UI（可選、保留本機、暫停推薦）
│   └── [CLOSED_OWNER .16/.18] 禁止復活個人 recipe-master／手動創配方功能
│
├── 06. 更新中心 updates [CODE / TECH.2 + G13 + DATA.1E]
│   ├── updateCenterTaskNavigationV0427553311、promptScenario、AI prompt
│   ├── jsonFile / validateJsonBtn / approveReviewBtn / dryRunBtn / applyBtn
│   ├── workflowSummary / workflowIssues / changeTable / importSummary
│   ├── UC.IMG-A 手機導覽、Candy 截圖覆核、AI/OCR 覆核、進階 OCR
│   ├── importHistoryDetails、historyTable、exportImportHistoryJsonBtn
│   ├── Raw immutable → Observation → Identity Review → Plan/Apply → audit
│   ├── [CLOSED_GATE] 24/20 visible count、依據欄位更新、快照、錯誤拒絕
│   ├── [OWNER_PASS .21] 食材名稱確認及庫存匯入流程
│   └── [OPEN #42/#58/#144] 跨情境 coverage / 近似去重 / 全 75 收斂
│
├── 07. 備份還原 backup [CODE / system safety]
│   ├── downloadDbBtn / downloadJsonBtn / restoreDbFile / restoreDbBtn
│   ├── resetDbBtn（破壞性，需明確使用者確認）
│   ├── snapshotList / IDB snapshots、backup-truth-restore.js
│   └── [CI] snapshot/rescue contracts；不宣稱本輪執行過真實玩家 restore
│
├── 08. 資料百科 knowledge [CODE / Public Master boundaries]
│   ├── sharedKnowledgePanel / knowledgePokemonSlot / knowledgeCandySlot
│   ├── candyMasterDetailsV042755331、public-catalog-workbench.js
│   └── [PARTIAL #48] Master coverage、species/alias/source completeness
│
├── 09. 本週環境 weekly [CODE / .22 Owner PASS on current event]
│   ├── weeklyContextPanel / 公版 Event Master／玩家本週條件
│   ├── manual activity bonuses + typed official effect registry
│   ├── .22 Growth Week vol.6 VERIFIED、sleep EXP×1.5、首日研究糖果×1.5
│   │   └── [FEATURE_ONLY] 不等於使用糖果 EXP，也不直接寫玩家 XP／數量
│   └── [OPEN #19] 未來不同 SHA DATA-ONLY 同 .22 前景更新／離線實機 Gate
│
├── 10. 本週戰情室 warroom [CODE / G7 CLOSED, WAR.1 PARTIAL]
│   ├── warroomPanel；recipe/cooking planner／goal profile／team optimizer
│   ├── recipe portfolio、缺料供應、確定性 5-member、evolution recommendation
│   ├── UI cards／產能、情境假設、解釋、missing data warning
│   └── [OPEN #18/#20/#40/#265] 七天 planner、完整隊伍儲存、命名 draft、比較
│
├── 11. 收集指南 collection [CODE / 捕獲規劃 PARTIAL]
│   ├── collectionAddForm / collectionTable
│   └── [OPEN] 真正捕獲優先策略與隊伍／島嶼資料完整連動
│
├── 12. 使用說明 guide [CODE / first-run PARTIAL]
│   ├── guideScenarioList / 兩種更新方式／多張圖／安全提醒
│   └── [OPEN #47] 首次啟用引導、營地初始化完整體驗
│
└── 13. 診斷中心 diagnostics [CODE / watchdog lifecycle]
    ├── debugModeBadge / debugSession / debugEventCount / debugErrorCount
    ├── debugExportBtn / debugBundleBtn / debugModeBtn / debugClearBtn
    ├── debugEventTable / debugLastError
    └── [REVIEW #295] native-dialog / background foreground false-positive 對照 DoD
```

**UI 原則**：有 HTML 容器不保證 JS 已 mount，module 有 export 也不代表 Owner 所有互動已 UAT；`index.html` 與目前真正載入的腳本是 Authority，舊 mirror、未載入或過期 branch 不能當作 live UI。

## 2. 系統功能／API Tree（實際 JavaScript boundary，不是 REST）

```text
A. PWA 啟動／DB／存取 [CODE + CI]
├── bootstrap.js → app.js → page-hydration-authority-*.js
├── database.js：initializeDatabase / rows / scalar / run / begin / commit
│              rollback / persist / snapshot / replaceDatabase / exportBytes
├── storage.js：inspectDatabaseRecord / loadDatabaseBytes / saveDatabaseBytes
│             createSnapshot / listSnapshots / clearAllStorage
├── migrations.js：applyAllMigrations / applyFreshDatabaseBootstrap
└── service-worker.js：同源網路優先活動資料／舊 last-good cache fallback

B. Observation／AI／身分／安全匯入 [CODE + 歷史 CI Gate]
├── data1d*：本機 OCR / 區域編輯 / image overlay / review package
├── ai-observation.js / ai-workflow.js / ai-review-executor-controller.js
├── ai-key-vault.js：saveEncryptedProjectPool / loadEncryptedProjectPool
├── public-master-recognition-provider-schema.js：buildCompactPublicMasterProviderSchema
├── public-master-recognition.js：平台端 canonical resolver／嚴格驗證
├── identity-candidate-engine / identity-review / identity-import-pipeline
├── importer.js / unified-screenshot-update-center.js / change preview
└── [OPEN] #42 provider/coaching consolidation；#58 near-dup；#144 Full75

C. Public Recipe／個人狀態／料理引擎 [CODE；G5/G6.1/G7 closed scopes]
├── public-recipe-master.js / public-recipe-master-sync.js / recipe aliases
├── recipe-catalog view + recipes player table
├── ingredient-gap-engine.js / recipe-unlock-preparation.js
├── recipe-portfolio-contention.js / recipe-strategy-projection.js
├── recipe-attempt-feedback-local.js：
│     listRecipeAttemptFeedbackSummaries / listRecipeAttemptFeedbackHistory
│     recordRecipeAttemptFailure / setRecipeRecommendationPaused
└── [FROZEN] personal-recipe-service.js 僅相容薄層；不得重建 parallel recipe master

D. 本週條件／活動 [CODE；G9 .22 owner display PASS]
├── weekly-context-store.js：currentWeeklyContext / weeklyContextForEpoch
├── weekly-manual-activity-bonuses.js：
│     readWeeklyManualActivityBonus / saveWeeklyManualActivityBonus
│     projectWeeklyManualActivityBonus
├── public-event-master-contract.js：schema／半開時間／scope／effect validation
├── public-event-master-store.js：
│     refreshPublicEventMaster / loadCachedPublicEventPayload
│     resolveCachedPublicEventProjection / schedulePublicEventBoundary
├── weekly-event-effect-registry.js：typed effect family／FEATURE_ONLY/REVIEW
├── effective-weekly-context.js：公版＋本週個人狀態投影
└── [CURRENT #19] 真實公告新 DATA-ONLY SHA、相同 .22 PWA E2E

E. Strategy／War Room／Evolution [CODE + PARTIAL]
├── team-optimizer.js / team-optimizer-local.js / bounded-team-search.js
├── strategy-goal-store.js / team-objective-evaluator.js
├── g121-authority.js：applyG121AuthoritySchemaMigration
├── g121b-evolution-status-read-api.js：readG121BDeterministicEvolutionStatus
├── g121c-explainable-evolution-recommendation.js
├── g121d-evolution-recommendation-ui.js / warroom-recommendation-provider.js
├── training-derived-state-authority.js：ingredientSlotUnlocked /
│     subskillSlotUnlocked / derivePokemonTrainingCapabilityState
└── [OPEN] WAR.1 team CRUD/energy、G8 planner、G14 ROI/coach、G15 scenario

F. 來源更新／發布控制（不是玩家 runtime API）
├── GitHub Actions `data-boundary-regression.yml`（contents:read）
├── scripts/g9r-official-event-source-refresh.mjs（read-only scheduled discovery）
├── scripts/g9r-official-event-feed-contract.mjs（source/SHA/04:00/fail-closed）
├── PR #472：新合成測試＋額外 bonus HOLD，**尚未 merge**
└── [NOT PROVEN] 官方新實際來源 → PR/merge/Pages → 同 .22 實機資料變動
```

**網路／資安責任劃分**：Gemini Provider BYOK 與其傳輸不是 GitHub 的受控 Public Master 寫入路徑；即使 AI 回傳 200，也只可能產 candidate。官方資料來源 cron 本身 read-only，並不會自動建 PR／寫入 GitHub。`index.html` 實際載入 sql.js CDN，不代表該 CDN 經營玩家雲端資料庫。

## 3. 本機資料庫層：SQLite SQL DDL vs 規劃規格

### 3.1 `schema.js`（主 SQLite DDL，26 個 CREATE TABLE 宣告）

```text
Player-owned / Local SQLite（schema.js） [DDL_PRESENT；本輪未直接 SELECT 手機 DB]
├── 系統／版本
│   ├── schema_migrations
│   ├── settings
│   └── account_capacity
├── 寶可夢個體／身份／歷程
│   ├── pokemon（pokemon_id / pokemon_instance_id、species、level、...）
│   ├── pokemon_subskills
│   ├── pokemon_ingredients
│   ├── pokemon_history
│   ├── pokemon_evolution_history
│   ├── pokemon_identity_evidence
│   └── discarded_pokemon
├── 玩家資源／食譜狀態
│   ├── ingredient_inventory
│   ├── item_inventory
│   ├── candy_inventory [Migration15 family policy 另治理]
│   ├── recipes（canonical recipe_id 的玩家 unlocked/level/energy）
│   └── recipe_ingredients（歷史相容；不得成為平行配方 authority）
├── 本週與策略
│   ├── weekly_plan [僅 TABLE 存在；完整 G8 七日 planner 未完成]
│   ├── weekly_context
│   ├── weekly_strategy
│   ├── strategy_goal_profile
│   └── pokemon_evaluation_snapshot [存在≠ G14 ROI 已實現]
├── 目標與觀察
│   ├── collection_targets
│   └── ingredient_probability_observations [數據觀察≠正式機率 authority]
├── G6.2 私人回饋
│   ├── recipe_attempt_feedback
│   └── recipe_feedback_state
└── 匯入／稽核
    ├── import_batches
    └── import_changes
```

### 3.2 `shared-master-schema.js`（5 tables + views，公版在本機 read-side materialization）

```text
Public/Shared local catalogue [DDL_PRESENT／不得以 AI 靜默改寫]
├── berry_master
├── ingredient_master
├── item_master
├── recipe_master
├── recipe_master_ingredients
└── SQL Views:
    ├── ingredient_catalog_state（公版食材＋玩家庫存）
    ├── item_catalog_state（公版道具＋玩家狀態）
    └── recipe_catalog_state（公版配方＋玩家解鎖/等級/能量）
```

上述 `ingredient_catalog_state`／`item_catalog_state` 的 public row 與 player zero-state 展示，不等同使用者確實觀察／確認了零數量。從 Master 缺少玩家 row 時，不能對所有匯入欄位推定「玩家已知 0」。

### 3.3 其他重要 migration／分離權威

```text
public-event-master-schema.js [DDL_PRESENT]
├── public_event_master（event_id, start/end, effects_json, source_json, data_version）
└── public_event_phase（event_id + phase_id + 時間/效果/來源）

g121-authority.js / Migration 16 [DDL_PRESENT]
├── item_acquisition_master（取得渠道來源／費用／可靠性）
└── player_resource_state（玩家資源知識狀態；UNKNOWN 不轉 0）

migrations.js 增量相容 [DDL_PRESENT]
└── pokemon_analysis_observation（Observation 不是 verified player entity）

assets/data/ public master source（非使用者持久資料表）
├── public-event-master.json
├── public-event-master-manifest.json（master_version / byte-exact SHA256）
├── Public Recipe/Pokémon/Berry/Ingredient/Item JS canonical catalogues
└── SW/IndexedDB public last-good copy；不能用玩家資料寫入替代公版更新
```

**重要架構差異／SPEC_ONLY**：`docs/MASTER_DATABASE_SPEC.md` 提及 `pokemon_species_master`、`pokemon_type_master`、`island_master`、`evolution_master`、`nature_master`、`profile_*` 等**概念性目標實體名稱**，但在本輪讀取 `schema.js`、`shared-master-schema.js` 中**沒有同名完整 CREATE TABLE**。它們可能由 JS Master、其他 source 或專用現有資料表/投影承擔；不可將該規格中的表名自動當作「現有正式 SQLite table」，也不要因此在另一分支未評估重複建立。

**同樣重要**：`weekly_plan`、`pokemon_evaluation_snapshot`、`recipe_feedback_state` 已有 DDL，卻不能反推完整 G8 schedule UI、G14 ROI engine 或 G6.2 Owner no-waste Gate 完成；Issue #40 所需的 `teams/team_members` 正式命名多隊伍 schema 在本輪已讀主 DDL 中**未見對應 CREATE TABLE**，應先做全 migration graph 檢查再施工。

### 3.4 IndexedDB / snapshots

- `assets/js/storage.js` 明示 IndexedDB `pokemon_sleep_ai_manager`，主 store `database`、`snapshots`、`metadata`，並有 legacy `snapshot_metadata` 的相容處理。
- SQLite schema migrations 與 IndexedDB 版本升級**不同層次**；browser IDB stores 不是 SQL tables。
- `ai-key-vault.js` 另行封裝加密的 Provider project settings；敏感 Key 不應進 Public Master、GitHub、一般 logs 或公開診斷包。
- GitHub source 可以證明 DDL/程式存在；**本次不能證明某支手機此刻每張 table 的列數/實際 migration state/資料一致性**。

## 4. UI — JS API — DB — Issue Crosswalk（新功能前強制查核）

| 功能域／Owner | 現有 UI | 現有 JS API / source | 實際 DB/公版權威 | 功能／驗證狀態 |
|---|---|---|---|---|
| Dashboard / startup | `dashboard`, status cards | `app.js`, `database.js` | `settings`, SQLite bytes / IDB | CODE+CI；裝置全表 parity UAT? |
| Pokémon／能力 | `pokemonTable`, detail modal | `pokemon-detail.js`, `training-derived-state-authority.js` | `pokemon`、slots、歷史 | CODE，G14.1 implemented；#457 Owner closure review |
| 食材／庫存 | `ingredientTable` | `ingredient-inventory-integrity-*` | `ingredient_master` + `ingredient_inventory` | `.21` 指定案例 OWNER_PASS；#144 全帳號 UAT? |
| 道具 | `itemTable` | shared master / `app.js` | `item_master` + `item_inventory` | CODE；全量 UAT? |
| Public Recipe／玩家狀態 | `recipeTable` | `public-recipe-master*` | `recipe_master*` + `recipes` | G5.1–5.4 CLOSED；不重建 identity |
| 料理缺料／多餐 | `warroomPanel` | `ingredient-gap-engine`, `recipe-portfolio-contention` | public recipe + player inventory | G6.1/G7 CLOSED；週 planner 不含在此 closure |
| Recipe feedback | recipe feedback UI | `recipe-attempt-feedback-local.js` | `recipe_attempt_feedback`, `recipe_feedback_state` | CODE／#468 MERGED；#6/#16 no-waste Owner HOLD |
| 多圖 OCR／匯入 | `updates`, review/diff/import | `data1d*`, `identity-*`, `importer` | `import_batches`, `import_changes`, observations | 技術 Gate CLOSED；#42/#58/#144 coverage OPEN |
| Public Candy／24/20 | Candy screenshot review / master UI | `candy-visible-target-count-authority`, `candy-family-storage-authority` | `candy_inventory` + governed public candy | 已知 24/20 CLOSED；不能重開 Migration15 |
| 本週事件 | `weeklyContextPanel` | `public-event-master-store`, `effective-weekly-context` | public_event_master/phase、manifest、週 Context | `.22` Owner display PASS；#19 future real DATA-ONLY E2E OPEN |
| 個人週倍率 | weekly manual bonus UI | `weekly-manual-activity-bonuses.js` | weekly state / settings | `.21` Owner PASS；不能混淆首次研究糖果與使用糖果 EXP |
| 進化狀態／建議 | detail/War Room evolution UI | `g121b/c/d`, `g121-authority.js` | player resources + canonical evolution facts | G12.1 A–E CLOSED；缺事實 fail-closed |
| 評分／組隊 | War Room team optimizer | `team-optimizer*`, `team-objective-evaluator` | `strategy_goal_profile`, `pokemon_evaluation_snapshot` | PARTIAL #20/#40/#265；命名 team CRUD 未驗證 |
| 一週作戰計畫 | Weekly/War Room | `weekly-context-store`, `g3-planning` | `weekly_plan`, `weekly_strategy` | PARTIAL #18；七天時段 schedule＋替補缺 |
| 教練 ROI／夜間 | Pokémon/War Room skeleton | `training-derived-state-authority` | evaluation snapshot | G14.1 implemented；G14.2–5 OPEN |
| 情境沙盒 | 尚無正式 Simulator view | 部分 strategy contract 可重用 | 不可拿 production DB 當 sandbox | G15 #44 OPEN；禁止模擬直接 Apply |
| 收集目標 | `collectionTable` | collection UI / rules | `collection_targets` | CODE/部分；完整捕獲策略 OPEN |
| 備份／還原 | backup | `storage.js`, `backup-truth-restore.js` | IDB SQLite bytes／snapshots | CODE+CI；個人設備本輪未執行 |
| Debug lifecycle | diagnostics | `v0394-startup-watchdog.js` | local trace / status metadata | CODE；#295 native-dialog case audit |

## 5. 「看似完成、其實缺驗證或產品閉環」清單

```text
P0 — 絕不可被 stale checklist 遮蓋
├── #19：已安裝 .22 Event UI ≠ 未來正式事件 **new payload SHA** 自動接收
├── #420：compact provider schema 已在 main ≠ 同一張 Candy 24/20 裝置 retry 已有證據
├── #457：CURRENT/FUTURE 代碼 + CI ≠ 該 Issue 所列 Owner physical Gate 有紀錄
└── #295：hidden-background false positive 修復 ≠ native alert/dialog 所有場景已驗收

P1 — 已有 code，但完整產品不等於存在
├── #18 `weekly_plan` DDL ≠ 七日逐時段規劃、替換條件、存檔/比較
├── #20/#40/#265 5-person optimizer ≠ teams/team_members 命名 CRUD/energy/draft
├── #43 evaluation snapshot ≠ G14.2 完整 ROI 成本收益模型／睡眠排程
├── #44 existing strategies ≠ 隔離 no-write 的 Sandbox
├── #6 recipe feedback table ≠ 要求玩家刻意失敗的測試得到授權
└── #48 資料庫 spec 表名 ≠ 全都已建 schema／有來源完整權威

P2 — 真正的資料覆蓋不足
├── #7 原始圖片／ZIP 抽取狀態及私人資料缺項
├── #58 near-duplicate vs exact duplicate（不得誤用 SHA 判定相似）
├── #144 Full75 真實玩家資料 complete 75/75
├── #164 UNKNOWN evolution evidence 回填
├── #278 物種食材機率 Production source sufficiency
└── #47 first-use setup 初始 UX 完整驗收
```

## 6. 防重工與目標變更 SOP

1. 每一新需求先記錄 **使用者畫面/ID → 執行 JS 主模組/export → SQLite/IDB/Public Master 權威 → Issue canonical owner → Gate/CI/Owner evidence**。五者未對齊前禁止同功能新建平行 UI/API/DB。
2. 以實際 `index.html` 跟隨 `<script src>` 與 page hydration ownership；檔案存在不代表瀏覽器真的已載入/掛載。
3. 讀 `schema.js`、`shared-master-schema.js`、`migrations.js`、專用 schema 才能判斷 DDL；Spec 名稱不可代替 physical table；資料行是否已存在需另有真實 SQLite readback。
4. 一律拆開 `DDL_PRESENT / MIGRATION_CODE / USER_DB_ROW_READBACK / PROVENANCE_VERIFIED / OWNER_UAT`。只要缺最後一段，標示缺口，不擅自結案。
5. Public event Master 所有來源與效果需官方且 typed；未知不補零、不強制把 FEATURE_ONLY 消費進 deterministic，也不得將首次研究糖果收益認作使用糖果 XP。
6. 公版 Master 只存 source/governed facts，玩家只存個人資料與確認；Snapshot/Import/rollback 不能讓 AI 寫 canonical master。
7. 沒有新正式活動，synthetic fixture 僅作測試，**不能宣稱 future DATA-ONLY E2E 已驗證**；絕不為每週資料改 `.22` app/build/cache。
8. GitHub 受控變更保持 13-workflow；sole writer branch→PR→exact-head CI→merge→main CI+Pages；避免與每小時主施工撞分支。
9. Issue closure 前固定回填 `UI/JS/DB/EFFECT_SOURCE/CI/OWNER_UAT/PROVENANCE/NEXT_PROOF`，使新版 Roadmap 能以 GitHub 上的證據取代人工記憶。

## 7. 實際原始碼／資料來源（readback 可重現）

- [正式 PWA 主頁 `index.html`](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/index.html)
- [SQLite 主 DDL `schema.js`](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/schema.js)
- [Shared Master DDL 與 Views](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/shared-master-schema.js)
- [DB migration wiring](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/migrations.js)
- [DB persistence／IDB stores](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/storage.js)
- [Public Event Master schema](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/public-event-master-schema.js)
- [Public Event manifest+cache store](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/public-event-master-store.js)
- [G12.1 schema](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/5cf26a83533216eda71ba461c1f2e5596b539cf8/assets/js/g121-authority.js)
- [概念性 Master DB 規格（非實際 SQL catalog）](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/main/docs/MASTER_DATABASE_SPEC.md)
- [正式 Architecture 摘要](https://github.com/easonliu714/pokemon-sleep-ai-manager/blob/main/docs/ARCHITECTURE.md)
- [配套 Roadmap／PR／Issue 結案稽核](./Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md)

**未執行範圍**：本輪未透過使用者手機開啟 DevTools、未取得私人資料庫 SQL schema/row count、新網路公告未作真實 DATA-ONLY App 驗收，未動任何 App DB/IndexedDB、未執行資料破壞或合併分支。