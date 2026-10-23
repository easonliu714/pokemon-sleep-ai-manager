# Pokémon Sleep AI Manager — Canonical Gate Roadmap & Completion Authority

## 2026-10-24 G14.1 / #482 original-backup manifest core-count completeness — scoped test/evidence candidate

- From exact main `776068762259800d70f25795307c5566b3a42ece`, branch `test/g141-backup-core-count-completeness-20261024` tightens the existing **metadata-only** `evaluateG141CrossDeviceRestoreEvidence`: before granting `EXACT_SQLITE_BYTES_PARITY_PASS`, require all **20 exact CORE_TABLES** of `backup-truth-restore.js` in both verified old export manifest and new-phone receipt. Missing/partial/invalid core counts return `HOLD / REQUIRED_BACKUP_CORE_TABLE_COUNTS_INCOMPLETE` even when supplied SHA and size match. Focused synthetic negatives cover old one-table manifest, missing new core count and invalid core count; all existing SHA/stage/paired-self-check checks remain. This module is not imported by production app runtime. **PR CI / merge / main Pages not yet claimed by this candidate.** No version/build/cache change, player data, backup/export/import, SQLite, SW, official public Master, or Owner action.
- **Evidence boundary:** neither original old-phone exported full SHA nor after-reload receipt has been supplied; #482 remains OPEN. #295 `.26` Owner Android UAT, #479 original ESM root cause, and #19 10/26/10/31 Android evidence remain independently OPEN. No device reset or private payload upload. Canonical living docs remain jointly updated; immutable 2026-10-23 inventory unchanged.

## 2026-10-23 G295 current-main watchdog lifecycle — MERGED / Owner UAT pending

- **PR #495 protected Merge Commit PASS**: exact PR head `3746923f1005a6131d279c0ca5e6ddfd8dddd67c` passed unchanged **12/12 required exact-head CI**, including source-bound VM `G295_SOURCE_BOUND_LIFECYCLE_VM=PASS`. Protected merge readback produced exact main `8cca315f44949fcb648b7214845d0d2784f2589f`; same-main **12/12 push CI SUCCESS** including [Deploy GitHub Pages #39966880914](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39966880914) and [Frontend #39966880933](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39966880933). Open PR 0 at this checkpoint. GitHub live SHA supersedes this historical record.
- **Production release** `v0.4.27.55.3.3.26`, build `20261023-v0427553326-g295-watchdog-lifecycle`, cache `pokemon-sleep-ai-v0.4.27.55.3.3.26-v0427553326-g295-watchdog-lifecycle`. Current-main correction: BFCache `pageshow` re-arms a single interval/RAF generation, visible focus resets bounded grace, native `alert/confirm/prompt` preserve return and throw semantics while suppressing dialog timer-gap false positives; hidden/background suppression, 4000ms genuine visible stall detection and stable-frame recovery remain active.
- **Evidence boundary**: deterministic controlled VM executes the actual production watchdog source and proves hidden 20s gap suppression, first resume grace, pageshow/focus, dialog return/exception, grace expiry and recovery. **Real Android PWA .26 Owner UAT = NOT_VERIFIED**, and #295 remains **OPEN** pending focused nondestructive device evidence. Normally reopen existing PWA, confirm exact .26, background/foreground return without false warning, safe ordinary navigation/dialog return and retained content; redacted screenshot/diagnostic trace only, no forced stall, reset, reinstall, reimport, private SQLite/JSON upload or device clock change.
- **Frozen**: provider Raw immutable, Candy visible 24/20 explicit count, UNKNOWN != 0, ABSOLUTE_SNAPSHOT != DELTA_EVENT, P0-B6 Migration15, G12.1 Migration16, public Master/private player boundary. #479 original Android ESM intermittent root cause, #482 original old export SHA/postreload parity, #19 Halloween 10/26/31 Owner proof remain separately **OPEN**; G9 calendar does not block unrelated gates. Immutable full branch/PR/Issue inventory remains unchanged. Windows local checkout identity NOT_VERIFIED.

> **2026-10-23 394-branch / 362-PR / 22-open-Issue full audit:** [immutable inventory](./GOVERNANCE_BRANCH_PR_ISSUE_INVENTORY_20261023.md). It classifies 346 exact merged-PR branches, 12 closed-unmerged-only, 35 unlinked + reserved main; Open PR=0; Issue safe-to-close=0 pending original DoD. Priority #295 source-bound lifecycle, #479 diagnostic, #482 parity, #6 focused Owner quick closure; #19 actual 10/26/31 remains parallel. No branches deleted, no Issue closed. Canonical progress remains this document and the two companion living docs.

## 2026-10-23 G9-R / #19 Halloween 10/26 Owner readiness preflight — branch candidate

- **G479-R2 Owner UAT CLOSED**: Owner supplied 2026-10-23 13:25 Asia/Taipei Android PWA screenshot showing `v0.4.27.55.3.3.25`, `App 已就緒`, `啟動累計 5.3 秒`, Weekly Context two-column grid, `料理類型` and bounded `鍋子容量` input, existing displayed value 63. Owner explicitly reports `.25 Gate 驗證通過`; outcome `G479_R2_WEEKLY_POT_25_OWNER_PASS`. Earlier `.24` War Room and Knowledge horizontal overflow also Owner PASS. PR #492 merged to main `3c929beeca371e0f1311a102d35002fd07abbebf`, **same-main 12/12 CI SUCCESS**, Pages run [39867979605](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39867979605) SUCCESS. No additional player DB mutation verified or claimed from screenshots. Windows local checkout remains NOT_VERIFIED.
- **Next Gate canonical owner #19**: exact official Halloween 2026 public data `public-event-master-tw-2026-10-14-halloween2026-official-a`, SHA256 `9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c` is already published, not modified in this candidate. 2026-10-26 04:00 Asia/Taipei activity opens only in `萌綠之島` and `萌綠之島EX`, 10/26–10/30 first sleep research Candy x2; 10/31 04:00–11/02 03:59:59 (end exclusive 11/02 04:00) x3. This is **FEATURE_ONLY**, not use-of-candy EXP nor personal Candy inventory mutation, and unknown ghost effects remain review/fail-closed.
- **Implementation this test-only PR**: Extend the already existing, chained `scripts/g9r-public-event-refresh-lastgood-contract.mjs` (invoked by the existing Data Boundary `scripts/g9r-official-event-feed-contract.mjs`) with date/scoped-camp assertions against the ACTUAL production `public-event-master-store.js` transformed only for mock SQLite and network; assert offline `OFFLINE_CACHED` preserves verified Halloween public event rows, official manifest SHA, does not persist or touch private sentinel, and projects at each exact 04:00 transition for 9 cases, including outside camp. No new workflow, no new app/ServiceWorker/CSS/DB, no version bump, no fake official effect promotion. Source remains `v0.4.27.55.3.3.25`.
- **Evidence boundary**: tests are synthetic clock, offline and in-memory DB. They DO NOT prove actual Android PWA offline state, phone cached SHA, real 10/26 auto boundary, exact device week context or October 31 phase. Following PR exact-head CI and merge/main CI, on/after **2026-10-26 04:00 Asia/Taipei** ask Owner normally open existing Android PWA on an allowed camp, confirm event date/camp/`FEATURE_ONLY` projection and public master version (without reinstall/reset); separately on/after **2026-10-31 04:00** check x3 phase; optional non-destructive offline check. Do not ask for impossible future screenshot before its date. #19 remains OPEN until real Owner evidence. #479 intermittent Android ESM and #482 old-original backup manifest SHA/postreload remain separately OPEN.
- **Governance**: branch -> Draft PR -> unchanged exact-head CI -> expected-head protected merge -> same-main CI and Pages readback; all three canonical docs together. Current parent main `3c929beeca371e0f1311a102d35002fd07abbebf` before this candidate. This section is only candidate until GH merge proof.


## 2026-10-23 G479-R2 Weekly Context pot capacity mobile width — .25 candidate

- Owner Android .24 screenshots at 06:29 prove War Room Goal/Hard Constraints and Knowledge Master Coverage no longer escape mobile viewport: G479_R_WARROOM_KNOWLEDGE_24_OWNER_UAT=PASS. New 06:30 screenshot proves Weekly Context pot-size number input overflows its panel, with visible horizontal page shift: separate mobile UI regression, not a reversal of .24 original gate.
- Exact source: assets/js/g3-planning.js uses weeklyContextForm / edit-grid / input[name=pot_size][type=number]. assets/css/editor.css grid columns minmax(0,1fr), but input[type=number] retains an intrinsic minimum width and can escape a half-width column. Account pot semantics via weekly-context-ui-bridge.js remain unchanged.
- Scoped app.css fixes #weeklyContextForm grid/field/control min-width:0, width:100%, max-width:100%; keeps two columns. Never apply global page overflow-x:hidden, do not clip fields, preserve War Room and Knowledge. Add source-bound Chromium synthetic-DOM regression 360/390/412/430 CSS px for page scroll width, input bounds, all 2x2 fields, editable number value 63 and negative mutation.
- Candidate v0.4.27.55.3.3.25 / 20261023-v0427553325-weekly-pot-capacity-containment / pokemon-sleep-ai-v0.4.27.55.3.3.25-v0427553325-weekly-pot-capacity-containment. Exact predecessor .24 remains recorded. Previous .24 main and Pages are 12/12 SUCCESS (#39604992712); .25 is NOT READY until exact-HEAD PR required CI all PASS, guarded merge, same-main CI and Pages all PASS. Owner then checks Weekly Context pot control, surrounding form fields and existing data; no uninstall, reset or reimport.
- Source main parent 5a66a7e909972ffbe39d86624499568b25b85c0b; Windows local checkout identity/dirty NOT_VERIFIED. Keep #479 original ESM incident, #482 original export SHA/post-reload and #19 Halloween future event phase OPEN. Same three canonical governance docs retained.


## 2026-10-17 G479 stage-ownership production hotfix candidate (.23)

> Source GitHub main `84fb9b46badccaa3722ba0b47256dcaa79b8e722` = PR #489 synthetic diagnostic merged, exact-main 9/9 CI SUCCESS including Pages [39001966873](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39001966873). New branch `fix/g479-stage-owner-v0427553323-20261017`. New version `v0.4.27.55.3.3.23` build `20261017-v0427553323-g479-startup-stage-ownership` cache `pokemon-sleep-ai-v0.4.27.55.3.3.23-v0427553323-g479-startup-stage-ownership` **CANDIDATE only until exact-head CI / merge / main Pages**. Windows local checkout HEAD / dirty = NOT_VERIFIED.

- **Source-bound defect:** `assets/js/v0382-release-authority.js` UI ticker elapsed was total page time from `STARTED_AT`, not a SQLite persist duration; label now explicitly `啟動累計`. Background SW update `critical_path:false` events previously replaced critical SQLite/App Ready ticker and terminal success emitted `running`. New foreground stage owner ignores background in visible `current` but preserves every event and debug trace; SW success emits `completed`. Foreground failure remains visible.
- **Regression:** isolated Node VM replay of actual release-authority source asserts `SQLITE_PERSIST_RUNNING` not overwritten, `APP_READY` not overwritten, background warning trace retained, foreground error visible. Synthetic DOM/SW only: no actual Android network/ESM import cause proof.
- **Strict isolation:** no changed SQLite/IndexedDB schema/player rows, no public Halloween event master update or effect authority promotion, no new CI workflow, no Raw/UNKNOWN/Candy24/20/ABSOLUTE vs DELTA/Migration15-16 changes. #479 original Android ESM transient STILL OPEN; #482 old export Manifest SHA/postreload and #19 Halloween future-phase/offline remain HOLD.
- **Go/no-go:** all production and tests in one PR with 3 living docs, exact unchanged HEAD CI, protected expected-head merge, same-main CI/Pages, live `.23` version. Only then owner may normally reload the existing Android PWA, verify correct startup stage with eventual App Ready, and optionally export redacted startup diagnostics; no clear-storage, uninstall or reimport.


## 2026-10-16 G479 synthetic Service Worker HTTP-response replay — candidate, not merged

- Parent main: `56077b971b29601db5dea024a60a9a080be55776` (#488 merged); 6/6 triggered main workflows SUCCESS, including Pages build/deploy. Open PR=0 before test branch; `.22` release unchanged.
- Branch `test/g479-sw-http-response-replay-20261016`: isolated SW fixture reproduces current behavior for synthetic versioned `app.js` requests. Rejected network fetch falls back to cached asset; resolved HTTP 503 passes through without cached fallback; genuine 404 stays failure; later HTTP 200 recovers. **This is synthetic and does not prove the Owner's Android failure received HTTP 503**.
- No runtime SW/app change, version bump, new workflow, player SQLite/IndexedDB mutation, or storage reset. #479 remains OPEN for actual network response and stale 121.8-second stage diagnosis. #482 backup-manifest/postreload and #19 Halloween future-phase/offline remain OPEN. PR exact-head CI and protected merge must precede any accepted Gate claim.


## Current authority index — 2026-10-15 (GitHub parent readback)

**SOURCE OF TRUTH / DO NOT DRIFT**: [ROADMAP_PR_ISSUE_CLOSURE_AUDIT](./Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md) for all Gate/PR/Issue closure and [UI_API_DB_FEATURE_ARCHITECTURE_TREE](./Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md) for production UI/JS API/SQLite/IndexedDB/Public Master ownership. THIS file provides only the completion matrix and links. Treat all older `Current` labels and previous checkpoint SHAs below as historical unless re-proven against live main.

- **Latest verified main before governance-only update**: `5f61f972a98e7dba3cfa5ff882b125b061d6c096`; **PR #487 MERGED** head `0348897496492f4bb1da90f8641add071d2e0be7`. PR exact-head 9/9 triggered CI SUCCESS; main same-SHA 9/9 triggered CI SUCCESS and Pages [38731090483](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38731090483) SUCCESS. 0 OPEN PR, 22 OPEN Issues.
- **Version tuple**: `v0.4.27.55.3.3.22` / `20261012-v0427553322-g9-official-event-auto-refresh`, unchanged; official Halloween 10/14 Event Master `public-event-master-tw-2026-10-14-halloween2026-official-a` SHA `9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c` remains unchanged by #487.
- **SAFE CLOSED**: Foundation / Raw immutable / strict identity / P0-B6 Migration15 + Candy visible 24/20 explicit user count / G12.1 Migration16 / G5 Public Recipe identity / G6.1/G7 defined deterministic scope / completed .21, .22 prior Owner cases. Do not reopen or re-implement.
- **CI CLOSED, OWNER OPEN**: #487 synthetic metadata mismatch→hydrate→exact fingerprint recovery and awaited restore persist order, **not** a demonstrated fix for Android transient `app.js` dynamic import or stale 121.8-sec startup UI #479; keep #479 OPEN. New phone virgin-schema bootstrap expected, owner restore modal+SQL integrity PASS FK0, 81 total/75 active/size 11,513,856 bytes, old/new visible counts match; two differently timed current-DB SHA prefixes diverge, but original exported-backup SHA/postreload durability not proven #482 OPEN. Halloween new Master VERSION in same .22 mobile visible PASS; 10/26/10/31 scope-phase, mobile digest, offline last-good still open #19.
- **Feature-level OPEN**: #457/#43/#44 training/scenario; #48/#278 Public Master coverage; #7/#58/#144/#164 data acquisition & full 75; #42/#47 AI/onboarding; #6/#16 no-waste feedback; #18/#20/#40/#265 weekly team/warroom; #9 overall parent; #295 watchdog DoD overlap requires specific evidence before CLOSE.
- **Issue closure decision**: no remaining OPEN PR to close and no entire OPEN Issue currently demonstrated all original DoD satisfied; full **22-row audit** in the official Roadmap/PR/Issue document. No speculative CLOSE of #479 / #482 / #19 due CI-only work.
- **Next Gate**: first confirm latest GitHub main/PR/CI/Pages/version/local authority; inspect #479 Android startup log/asset/SW and UI status owner, reproduce with isolated fixture before any runtime hotfix. In parallel if Owner volunteers normal reload/selfcheck of NEW phone, mark #482 POSTRELOAD integrity/row count only; never demand another restore or private DB upload. On actual 10/26 schedule, prove Halloween phase/time/camp/offline behavior without changing device clock.
- **Local authority**: Windows/git local checkout and mounted Android data cannot be directly inspected from GitHub, so `LOCAL_GIT_HEAD=NOT_VERIFIED`, `LOCAL_DIRTY=NOT_VERIFIED` until user supplies readback. No direct-main mutation, broad site cleanup, storage reset, AI authority guesses, unverified effects or extra workflow writes.



> 2026-10-15 G479 SYNTHETIC startup authority regression: mismatch does not persist fingerprint; recovered exact authority may bypass only after verified metadata; restore success remains after awaited persist. CI-only; Android incident unproven; .22 unchanged; #479/#482/#19 OPEN.

> **2026-10-14 G14.1 second real-device self-check — PR #485 CI/MERGE CLOSED**：Owner 舊手機（20:34）與新手機（20:22）`integrity=PASS、FK=0、11,513,856 bytes`、可見核心表 counts 相同，兩個當前 DB SHA 前綴 `5ff661c4…` / `391cfd2f…` 不同；不等於當初匯出的備份檔位元組不相同。`evaluateG141PairedSelfChecks` 已透過 [PR #485](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/485) CI 7/7 PASS、正式 Merge `3559ca9f7b48240e4d9a619491f4c9495e775a12`，同 SHA main 8/8 PASS、Pages [38567091151](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38567091151) SUCCESS。`COUNT_PARITY_VISIBLE=PASS / TWO_DIFFERENT_CURRENT_SHA=REVIEW / OLD_EXPORTED_BACKUP_PARITY=HOLD / AFTER_RELOAD_DURABILITY=NOT_TESTED`；Issue [#482](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/482#issuecomment-6168812009) OPEN。實作只限 pure no-DB metadata QA API、synthetic contract、三份 canonical docs，正式 `.22` runtime、SQLite/IndexedDB/玩家資料、官方活動/SW 均無變更。

> **2026-10-14 20:34+08 G14.1 two-phone current-selfcheck new evidence（#485 MERGED CI PASS；Owner 原備份尚待對帳）**：Owner 提供舊手機『目前資料庫備份驗證 PASS』截圖：SHA **前綴** `5ff661c4…`；新手機 20:22 畫面 SHA 前綴 `391cfd2f…`，**兩者不同**；然而兩支手機 `integrity_check=PASS`、`FK=0`、`size=11,513,856 bytes`，畫面可見 `pokemon=81 / active=75 / subskills=398 / ingredients=239 / migrations=16 / import_changes=4028` 等 counts 同一組。因 snapshot 捕捉時點不同、舊機『當前 DB』並非已證明的『匯出備份 bytes』，故 `COUNT_PARITY=PASS_FOR_VISIBLE_FIELDS / CURRENT_SHA_DIFFERENT=REVIEW / SOURCE_BACKUP_BYTE_PARITY=HOLD`；**不得定義資料遺失或重做還原**。Issue #482 同步新增 `evaluateG141PairedSelfChecks()` 純 metadata 判定，必要個人表 counts 完整且 SHA 不同時 `REVIEW_REQUIRED(COUNT_PARITY_SHA256_DIFFERENT)`；相同 SHA 仍僅 `PAIR_SELF_CHECK_BYTES_MATCH`，不偷換成同一份匯出備份的證據；截圖不完整 SHA 則 `COUNT_PARITY_ONLY`。原實際完整 SHA 不存入 GitHub。此輪僅測試模組與原 G14 Safety 回歸，正式 `.22` 不變。

> **2026-10-14 G14.1 Verified Cross-Device Restore Evidence CI / MERGE checkpoint**：受控 [PR #483](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/483) exact-head 7/7 SUCCESS，MERGED main `f300fbf97858cd11403ab30694cc5fd71f13ab29`；同一 SHA main 8/8 SUCCESS，Pages [38564696686](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38564696686) SUCCESS。現存 G14 Safety `backup-truth-restore` job PASS，無新增 workflow 或修改 `.22` runtime/Schema/玩家 DB。純 metadata proof contract + synthetic negatives 已 CLOSED（CI），**Owner 新手機完整性 PASS** 仍不等於 **old-backup/new-receipt SHA exact parity**；舊機 Manifest／新機完整 SHA 尚缺，Issue [#482](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/482#issuecomment-6168447317) 持續 OPEN；完成並重啟後自我檢查仍待 Owner evidence。

> **2026-10-14 G14.1 cross-device owner restore + NEXT CI Gate（PR #483 已合併、Owner 對帳未完成）**：Owner 新手機 `.22` 已出現「還原完成」及還原後自我檢查 `integrity_check=PASS / foreign_key_errors=0 / 11,513,856 bytes / pokemon=81 / active=75 / pokemon_subskills=398 / pokemon_ingredients=239 / import_changes=4028 / schema_migrations=16`。**新機 RESTORE UI & SQLITE_INTEGRITY=OWNER_PASS**；尚無舊機 verified backup Manifest 完整 SHA-256、逐表 counts，截圖 SHA 僅前段，因此 `OLD_TO_NEW_EXACT_SHA_AND_ROWS=NOT_VERIFIED`，不得偷換為已全量 parity。另還原完成 alert 背後進度列 `正在儲存 SQLite 121.8秒` 尚未關聯完整 stage/持久化證據，不能單靠文字推論仍有未完成 transaction。[Issue #482](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/482) 新增純公用 metadata proof Gate `assets/js/g141-cross-device-restore-evidence.js` 與合成式 positive/negative CI 套件，透過現有 G14 安全測試執行，缺 SHA/Manifest/筆數即 HOLD、重開機後不同 bytes 僅 REVIEW，禁止判丟資料；**不修改 `.22` Runtime、SQLite Schema、SW、個人資料與官方活動 JSON**。

> **2026-10-14 OWNER NEW-PHONE / VIRGIN SQLITE CLARIFICATION — SUPERSEDES DATA-LOSS SUSPICION**：Owner 明確確認此為**全新手機、首次開啟 PWA 前無任何本機資料庫**，因此 `exists:false / FRESH_DATABASE_BOOTSTRAP / 初次建 Schema / Public Master seed / persist` 均為**預期正常初始化**，不是舊玩家資料遭清除。下一階段才由**舊手機**產生驗證備份，於**新手機**執行備份還原；目前 `OLD_PHONE_PLAYER_PARITY=NOT_TESTED`、非 FAIL。首次 `PUBLIC_CATALOG_HYDRATE_FAILED` 與次次恢復仍需判斷是否僅初次 fingerprint reconciliation 暫態，不能預設真正完整性缺陷；偶發 `app.js` ESM import fail 仍獨立 Issue [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479#issuecomment-6161137926) 觀察。G14.1 既有 `assets/js/backup-truth-restore.js` 支援 `.sqlite3` + `.json` + Manifest、SHA/SQLite integrity/foreign-key/逐表 counts preflight、替換前快照、rollback。下一個實機 Gate：舊機成功匯出並保存原始檔→新機隔離 Preflight→明示確認→還原後 SHA/逐表/原玩家紀錄 parity，未驗不得宣告 PASS。

> **2026-10-14 12:31 +08 Owner Android NEW-MANIFEST evidence = PARTIAL PASS**：使用者第二次以原安裝 `.22` PWA 開啟後，手機「本週環境」畫面顯示 `Master: public-event-master-tw-2026-10-14-halloween2026-official-a`、`App 已就緒`；10/12 週仍顯示快快長大週 vol.6 **符合活動時段**，並非資料同步未生效。GitHub payload SHA `9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c`，但 Owner 手機僅見 Master VERSION，不得宣稱 cached exact SHA / 10/26×2、10/31×3 phase / offline last-good / 玩家資料 parity 已 PASS；Issue #19 OPEN、[Owner 訊息](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19#issuecomment-6160977862)。第一次 PWA 重載 ESM `app.js` dynamic import Failed、下次恢復；debug rolling-history 660 records / last-session summary 162/0 errors 差異、初次 fresh SQLite 的 `PUBLIC_CATALOG_HYDRATE_FAILED` 後 `APP_READY`，兩種獨立 startup defect 已另開 [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479) TRIAGE。不得清除站點資料、卸載 PWA 或覆寫玩家 DB。

> **2026-10-14 LIVE G9R SOURCE/MERGE CHECKPOINT**：受控 PR [#477](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/477) 已正式 MERGED `66d8f14ee11e1866c36d4f2861982c480b29e22a`，PR exact HEAD 6/6 SUCCESS；同 SHA main CI 6/6 + Pages [38510277899](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38510277899) SUCCESS。官方 10/14 [萬聖節2026](https://www.pokemonsleep.net/news/343433383634343334313633353830393330/) 由 Owner zh-TW 11:00 通知＋官方頁面對照，Public Event Master 由 3 筆增至 4 筆，manifest `9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c`，version `public-event-master-tw-2026-10-14-halloween2026-official-a`。十月26～十一月2日僅萌綠之島/EX，首次睡眠研究 ×2（10/26–30）與 ×3（10/31/11/1）；幽靈屬性限定 bonus 仍 REVIEW_REQUIRED，不作全隊 numeric authority。**舊的每小時自動文章解析器仍僅 Growth Week：本次成功是有官方來源確認的 DATA-ONLY 受控入庫，非廣義自動文章同步。**相同 PWA `.22` 更新公版 Manifest / SQLite 快取，Owner 未回傳手機 new-SHA 證據前標 `PAGES_PASS / OWNER_UAT_PENDING`；勿提前關 Issue #19。


> **2026-10-14 G9R-HALLOWEEN SOURCE-REVIEWED DATA-ONLY MERGED — Owner new-SHA still PENDING**：Owner 11:00 的繁中遊戲內通知「萬聖節2026：糖果倍增研究」，已與官方日文 [公告](https://www.pokemonsleep.net/news/343433383634343334313633353830393330/) 交叉確認：10/26 04:00–11/02 03:59（exclusive end=11/02 04:00），**僅**萌綠之島及萌綠之島EX；每日第一次睡眠研究糖果 10/26–30 ×2，10/31與11/1 ×3。受控 DATA-ONLY 候選新增一筆 PARTIAL_VERIFIED public event / 2 個 VERIFIED candy phases；幽靈屬性限定食材+1、主技能1.25與等級+3、墨莓果 EX 差異均以 REVIEW_REQUIRED 原文保留，**不套用全隊/玩家 DB/Strategy**；已知任務逐項獎勵尚未公告，不填假資料。原 G9R 自動發現器僅支援 Growth Week，這次為有官方來源的受控人工審核入庫，**不得宣稱通用活動自動解析完成**。release `.22` tuple 不變；待 PR 精確 HEAD CI、merge/main CI/Pages 及 Owner Android 驗收後才可關閉 Gate。


> **2026-10-13 post-merge G9R checkpoint**：#474 source SHA/append-only official-candidate guard、#475 actual .22 store import + isolated SQLite API mock refresh/rollback contracts 均 PR exact-head CI 6/6 PASS、MERGED；截至 main `3b1aabd2c26a120cac8037d1277518a2aedec1fe` Pages 38385085408 SUCCESS。**G9R_REAL_OFFICIAL_FUTURE_EVENT→NEW_SHA→SAME_.22_PWA_OWNER** 未驗收，不得把 synthetic/mock CI 當 Android PASS；Issue #19 OPEN。


> **G9R_DATA_ONLY_RUNTIME_LASTGOOD_REPLAY（2026-10-13 CI/MERGE Gate CLOSED，Owner E2E 仍 OPEN）**：使用既有實際 public-event store 函式與 mock SQLite API，測不同 SHA、offline / invalid hash last-good、SQL failure rollback、player sentinel and unchanged .22 app tuple；仿真/CI 與 Owner Android 驗證嚴格分開，真實新官方未來活動未公告前 #19 不結案。


> **G9-R active sub-Gate（2026-10-13 來源發布候選驗證已 MERGED，未來實機仍 HOLD）**：Data-Only proposal admission gate 以官方 exact article source、old/new SHA256、old events append-only immutable、合成 future fixture 驗證，沒有新官方未來公告前不更換 Event Master / `.22` tuple。同步治理權威：Roadmap/PR/Issue Audit 與 UI/API/DB tree；Issue #19 new-live-data Owner UAT 維持 OPEN。CI 結果以最新 PR exact HEAD readback 為準。


> **永久同步基準**：本 Roadmap 為 Gate 權威；[Roadmap／PR／Issue 稽核](Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md) 與 [UI／功能 API／DB 功能樹](Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md) 為同期受控進度證據。每次 GitHub 版本／PR／Issue／Gate 實質更新必須一起核對並同步兩檔；先 fresh-read main 與 CI/Pages，不沿用歷史 checkpoint。未驗證 Owner Gate 不可憑 CI PASS 宣稱 CLOSED。


Updated: 2026-10-13  
Last verified predecessor main at G9R synthetic branch start: `main@5cf26a83533216eda71ba461c1f2e5596b539cf8` / `v0.4.27.55.3.3.22` — PR #471 MERGED, exact-main CI and Pages SUCCESS, owner Android/PWA `.22` display PASS recorded in Issue #19 comment 6139254152. Recheck current main before any later write.  
Active G9-R successor: `G9R_AUTOMATIC_FUTURE_DATA_ONLY_REFRESH` — new real official weekly event publication and updated JSON+SHA manifest on installed `.22` PWA remain OPEN. Existing read-only source cron DOES NOT publish PR/commit or write main; synthetic future fixtures are NOT live E2E evidence.

This document is the canonical roadmap/status authority for future implementation conversations. Before implementing a "next Gate", re-read current `main`, this document, the parent issue, and exact runtime/regression evidence. **Do not rebuild a Gate only because an old issue checklist is stale.**

## 1. Frozen product / data authority decisions

### Recipe authority
- **Public Recipe Master is the only recipe identity authority.**
- Recipe name, category, fixed formula and ingredient quantities are Public/Shared data.
- Player SQLite stores player state only: `unlocked`, `recipe_level`, `current_energy`, optional notes/evidence metadata.
- The old `player_manual` / 「我的食譜」 / 「新增個人食譜」 parallel recipe-master concept is retired and must be removed from runtime/UI.
- UNKNOWN / AMBIGUOUS recipe evidence must fail closed to REVIEW_REQUIRED; it must never create a new recipe identity.

### General frozen boundaries
- Provider/Raw evidence is immutable.
- UNKNOWN is not zero/null authority.
- Shared/Public data and player-private data remain isolated.
- Public Master updates must not overwrite player state.
- AI may observe/propose/explain; deterministic platform authority owns canonical identity, calculation and writes.
- Migration 15 (Candy family storage) and Migration 16 (G12.1 authority) are frozen.
- Candy screenshot 24/20 explicit visible-target confirmation and ABSOLUTE_SNAPSHOT vs DELTA_EVENT semantics remain frozen.
- G14.1 CURRENT/FUTURE unlock state is derived from current level, not legacy `is_unlocked`.

## 2. Status vocabulary

- **CLOSED** — implementation + governed release/required validation are complete. Do not rebuild.
- **IMPLEMENTED / ISSUE-CLOSURE READY** — runtime/contracts already satisfy the Gate; issue metadata is stale and may be closed after recording evidence.
- **IMPLEMENTED / OWNER OR TARGETED CLOSURE PENDING** — implementation exists; only a focused validation/cleanup remains.
- **PARTIAL** — meaningful implementation exists, but stated product outcome is not complete.
- **OPEN** — substantial implementation is still required.
- **RETIRED / SUPERSEDED** — historical design is no longer a valid product direction.

## 3. Current Gate completion matrix

| Gate | Current status | What already exists | Remaining work / disposition |
| --- | --- | --- | --- |
| P0-B6 Candy family storage | CLOSED | family canonical storage, Migration 15, ABSOLUTE_SNAPSHOT/DELTA_EVENT, real-device closure | Never reopen absent regression |
| TECH.2 Observation / Identity / guarded import | IMPLEMENTED / closure audit candidate | Observation v2, candidate resolver, confirmation UI, transaction/apply bridge, Android import, sparse update semantics | Reconcile stale parent issue #37 and close if no acceptance item is genuinely missing |
| DATA.1D / DATA.1D.1 OCR | IMPLEMENTED / closure audit candidate | local OCR runtime, region OCR, thumbnail/overlay, review package, cancellation/progress, consolidated screenshot pipeline | Reconcile stale #55/#63; do not rebuild |
| DATA.1E import review | IMPLEMENTED / closure audit candidate | field diff, identity review, Dry Run, Snapshot, transaction, rollback, audit | Reconcile stale #56 |
| DATA.1F approximate-image duplicate | OPEN | exact hash/fingerprint foundations exist | pHash/dHash/OCR-near-duplicate review is not proven complete (#58) |
| DATA.2A Full75 completeness | PARTIAL | completeness engine, sparse import, user-confirmed-not-visible semantics, Full75 retirement foundations | private 75/75 evidence/readiness closure remains (#144) |
| G4 / DATA.1 Public Master foundation | PARTIAL, broad umbrella | mature recipe, ingredient, Pokémon, berry, evolution, item/event authorities exist | future work is coverage audit + real gaps only; do not rebuild existing masters (#48) |
| **G5.1 Player Recipe State** | **CLOSED** | canonical `recipe_catalog_state`, unlocked vs locked UI, level/current-energy player state, retired personal-recipe UI/runtime | owner Android/PWA PASS on `.16`; #1 closed 2026-10-02 |
| **G5.2 Canonical Recipe State JSON Import** | **CLOSED** | recipe Update Center validation, canonical master lookup, strict player-state allowlist, canonical id/name revalidation, Dry Run/Apply parity, duplicate update_id guard, Snapshot/transaction/rollback/persist/audit | `.18` merged to main; #2 closed |
| **G5.3 Screenshot → Recipe State** | **CLOSED** | UC.IMG-A recipe scenario, Public Master constrained recognition, MATCHED/AMBIGUOUS/UNMATCHED, canonical revalidation, state Update Package | owner Android/PWA recipe screenshot evidence PASS on `.18`; #3 closed 2026-10-05 |
| **G5.4 Public Recipe Authority** | **CLOSED** | current authority, provenance, aliases, formula audit, 78-recipe authority, controlled master sync, player-state preservation/idempotency, single Public Recipe Master product model | owner `.16` canonical recipe surface PASS; #4 closed 2026-10-02 |
| **G6.1 Ingredient Gap Planner** | **CLOSED** | deterministic ingredient-gap engine, recipe strategy projection, safe reserve, pot fit, unlocked/locked classification, shortage sorting, War Room UI, regression | #5 closed; rarity/portfolio optimization belongs to G7 rather than reopening G6.1 |
| **G6.2 Recipe Attempt Feedback** | **MERGED .19 / OWNER PRODUCT-GATE HOLD** | player-private failure log and pause are implemented, but device owner rejected forced failure-test UX; must remain OPTIONAL advisory evidence, never required to waste a meal | #6/#16 stay OPEN pending respecified unlock-first acceptance; C/D naturally N/A without real history |
| G6 Epic | **RESCOPED ACTIVE / OWNER ACCEPTANCE HOLD** | G6.1 remains CLOSED; `.20` successor aligns unlock-first planner and ingredient parity, preserving optional G6.2 diagnostics | exact branch→PR→CI→main/Pages→no-waste real-device gate before closing #6/#16 |
| **G6-R Recipe-first Unlock Preparation + Inventory Summary/Detail Parity** | **.20 MERGED / OWNER PHYSICAL GATE PARTIAL PASS** | exact Public Master + confirmed player unlock state + actual stock and Safe Reserve + pot fit + target-first shortage/team capability + no-spend '?' preview; fix screenshot apply event dirty-entity so cards and ingredient table use same current SQLite projection | no UNKNOWN→0, no fabricated failure, no arbitrary target fallback to already unlocked; verify 19/254/17/2 and per-row parity after screenshot apply/reload, targeted unlock-only menu; deliver .20 exact-main CI/Pages then owner PWA |
| **G6-R.1 Ingredient Recognition Integrity + Manual Weekly Activity Bonuses** | **.21 MERGED / OWNER MOBILE GATE PASS** | owner physical evidence: .20 Food screenshot Public Master AMBIGUOUS `沉甸甸南瓜` confirmed but independent inventory absence guard reads stale UI textarea; resolve session/textarea/input state atomically without bypass; add per-week manually entered pot bonus, sleep EXP and candy-use EXP (distinct from research candy amount); preserve Public Event Master source, pot fractional rounding fail-closed | retest one exact known pumpkin confirmation → absence review → Dry Run → Apply → SQLite/cards/details parity and reload; current-week bonus persist/reload/week rollover, without fabricated game costs |\n| G7 Cooking AI / deterministic cooking planner | CLOSED | shared-inventory contention, multi-meal simulation, preserve/unlock/continuous/max-verified-energy objectives, current-energy authority, event multiplier authority, team supply capability, deterministic/AI-proposal re-evaluation | #17 and #246 closed; ingredient/hour production-rate authority intentionally remains separate (#278) |
| G8 Weekly Planner | PARTIAL | weekly context, effective context, recipe recommendation and War Room strategy foundations | full seven-day planner/team/meal substitution schedule remains (#18) |
| **G9-R Official Weekly Event Auto-Refresh** | **.22 OWNER MOBILE PASS / FUTURE DATA-ONLY E2E OPEN** | PR #471 merged; network-first Public Event Master SHA manifest, Oct 2026 source-proven events, exact 04:00 boundaries, Android owner PASS; scheduled source discovery remains read-only. Controlled synthetic replay covers future changed-SHA preview and unknown-bonus REVIEW/HOLD without a release tuple change. | Only new actually published official event with fully supported typed semantics → governed data-only JSON+manifest PR → exact-head CI/merge → main/Pages same SHA → same installed `.22` Android PWA new SHA/last-good offline/zero private changes → owner acceptance; no fabricated future event or automatic publication claim (#19). |
| G9 Event Manager | PARTIAL | Public Event Master, manifest/schema/store, typed effects, effective weekly integration | G9-R automatic-data feed closure plus broader G9 UI/lifecycle; G9 parent #19 remains OPEN |
| G10 / WAR.1 Team Builder | PARTIAL | controlled selectors, candidate projection/scoring, deterministic 5-member optimizer, Team Card/alternatives | persisted multi-team CRUD, full energy model, comparison/AI draft lifecycle remain under #20/#40 |
| G11 Capture Planner | OPEN / only collection-target foundation | basic collection targets exist | capture target engine and recommendation workflow still required |
| **G12.1 Evolution Planner A–E** | **IMPLEMENTED / ISSUE-CLOSURE READY** | A authority + Migration16, B deterministic status/read API, C explainable recommendation, D UI/provider/War Room binding, E mobile regression; real-device D/E closure | close stale #411 and parent #41 after evidence comment; missing acquisition facts correctly fail closed and are not a reason to rebuild engine |
| G13 AI Assistant Center | PARTIAL but extensive | OCR pipeline, Observation v2, identity review/import, encrypted Project Pool, queue/failover, structured Gemini, review workbench, provider/raw safety | parent remains open for final product consolidation; do not rebuild completed OCR/import pieces (#42) |
| G14.1 Derived Unlock State | IMPLEMENTED / owner closure status must be explicit | CURRENT/FUTURE authority, level-derived ingredients/subskills, roster integration, regression, .13 release | keep #457 open unless owner physical gate is explicitly recorded PASS |
| G14.2 ROI Engine | OPEN | no complete ROI engine | next Training Coach compute layer |
| G14.3 Sleep Scheduling | OPEN | G12 sleep projection exists, but multi-target nightly scheduling is not complete | implement after ROI/evolution inputs |
| G14.4 Coach UI | OPEN | no complete coach dashboard | implement after G14.2/3 |
| G14.5 Coach closure | OPEN | — | regression + Android/PWA closure |
| G15 Scenario Simulator | OPEN | no governed sandbox core | G15.1→G15.5 remain |

### 2026-10-12 owner mobile authority / G9-R boundary
- Owner explicitly accepted **.21** Android/PWA ingredient Review → Dry Run/Apply and per-week manual bonus fallback. Keep frozen .21 player data and three-berry dynamic slot fail-closed. In exported diagnostics the berry OCR text was incorrect but resolvable by user; pre-review HOLD does not contradict final owner acceptance.
- For 2026-10-12 Growth Week, helper sleep EXP **1.5×** and first daily sleep-research candy gained **1.5×** are two distinct **feature-only Public Event Master effects**; neither means candy-use EXP. Until an exact deterministic consumer is governed, no player state or candy stock auto-write.
- Existing .21 Service Worker JSON cache-first path could silently retain August Master even with query-busting. **.22 is a one-time necessary network-first/offline-fallback code release**. The G9-R goal is NO ADDITIONAL PWA version bump for future recurring **data-only** event updates.
- P8 governance forbids new unreviewed workflow count and workflow contents:write. G9-R source watch is integrated into the existing Data Boundary workflow as read-only; promotion must follow a controlled branch→PR→exact-head CI→merge. Unknown/new effects or conflicting official facts remain REVIEW_REQUIRED. RaenonX corroboration is not a verified machine-readable feed license.

## 4. Issue cleanup — high-confidence disposition

### Closed by the 2026-09-30 stale-Issue reconciliation
- #5 — G6.1 Ingredient Gap Planner.
- #17 — G7 Cooking AI / deterministic cooking planner.
- #37 — TECH.2 Observation v2 / Identity / guarded import.
- #41 — G12.1 parent A–E.
- #55 — DATA.1D OCR/classification parent.
- #56 — DATA.1E SQLite compare/import review.
- #63 — DATA.1D.1 OCR Runtime UI / Review Package.
- #64 — G13.2A Project Pool/failover.
- #163 — WAR.1A Goal Profile + Evaluation Snapshot.
- #165 — WAR.1B Strategy Context / Gemini privacy contract.
- #173 — WAR.2A Candidate Feature Projection/scoring foundation.
- #174 — v0.4.3 Recipe/Selector/Team Optimizer parent.
- #178 — Controlled Multi-select.
- #179 — deterministic 5-member Team Optimizer UX.
- #191 — Recipe Discovery Stockpile (implemented, then superseded by canonical promotion).
- #246 — G7 verified-energy cooking objective.
- #411 — G12.1A Readiness Audit.

### Must remain open now
- #6 / #16 G6.2 + G6 Epic.
- #7 full historical ZIP inventory/extraction.
- #48 broad Public Master coverage.
- #58 near-duplicate detection.
- #144 Full75 private completeness closure.
- #278 ingredient probability production authority.
- #295 Startup watchdog native-dialog/manual-block false-positive gap.
- #420 Gemini HTTP 400 compact schema: current provider schema still repeats full catalog enums.
- #462 Advanced OCR task-card anchor: code fix exists on Draft PR #463, live owner retest not yet done.
- #457 G14.1 until owner physical PASS is explicitly recorded.
- #18 G8, #19 G9, #20/#40 G10/WAR.1, #42 G13 parent, #43 G14 parent, #44 G15.
- #47 broad onboarding/camp initialization.
- #164 evolution evidence backfill unless a separate route-coverage audit proves all original UNKNOWN species are resolved.
- #265 Decision UI until its complete persistent decision workflow is verified.

## 5. Correct next execution order

1. **G6-R.1 `.21` confirmed owner bugfix** — current active Gate. `.20` was deployed, owner observed unlock planner partial PASS but screenshot ingredient recognition stale UI integrity FAIL. Fix Working JSON event sync plus local explicit weekly activity bonuses; no recipe cooking, no Public Master write. Previously: G6-R `.20` is already merged and must not be reimplemented. Branch→PR exact-head CI→merge/main CI/Pages→focused non-destructive Android/PWA validation: inventory cards/table/SQLite same 19/254/17/2; undiscovered only in unlock objective; target specific quantity deficits and five-member ingredient-source coverage; '？' preview is observational only and must not be equated to exact recipe. No deliberately failed meal. Keep #6/#16 open until proper owner acceptance.
2. After G6.2 closure continue genuinely incomplete work: **G9 → G10/WAR.1 → G8 → G11 → G13 closure → G14.2–5 → G15**.
3. Continue stale-Issue reconciliation only when exact evidence exists; never equate unchecked boxes with missing code.
4. G12.1 must be treated as completed baseline, not a future implementation Gate.
5. G5.1–G5.4 and G6.1 are completed baselines; do not reopen absent a demonstrated regression.

## 6. Anti-drift rule

Before every new implementation Gate:
1. fresh-read `main` exact SHA;
2. fresh-read this roadmap;
3. inspect current runtime modules/regressions and commit history;
4. classify the Gate as CLOSED / implemented / partial / open;
5. only write code for proven gaps;
6. update this document and the corresponding Issue when status changes.

A stale unchecked GitHub checklist is **not evidence that functionality is missing**.


## 2026-10-17 G479-R responsive War Room + Knowledge — controlled .24 candidate

- Owner Android screenshots: `v0.4.27.55.3.3.23` / `20261017-v0427553323-g479-startup-stage-ownership` showed App 已就緒, 啟動累計, SW background update completed, and Dashboard/Weekly/War Room/Knowledge with Pokémon profile still visible. **G479_STARTUP_STAGE_DISPLAY_23_OWNER_UAT=PASS**. Original intermittent Android `app.js` ESM fetch root cause is NOT_VERIFIED; Issue #479 remains OPEN.
- New Owner-reported defects **both** War Room `#warroomPanel` Hard Constraints/goal form and Knowledge `#sharedKnowledgePanel` Public Pokémon Master Coverage/tables escape 360–430px mobile frame. `v0.4.27.55.3.3.24` build `20261017-v0427553324-mobile-warroom-knowledge-containment` cache `pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment` is **BRANCH_CANDIDATE**, not deployed/Owner PASS. Scoped CSS and real Chromium synthetic DOM viewport matrix (360/390/412/430) enforce internal table scrolling, editable fields, no clipping or global overflow-x:hidden. Full CI and Android device UAT remain separate Gates.
- Source-of-truth: CSS `assets/css/app.css`, existing runtime Coverage CSS `assets/js/v03993-public-knowledge-coverage-ui.js`, existing berry scroll `assets/js/camp-berry-knowledge-ui.js`, Playwright `scripts/v0427553324-mobile-warroom-knowledge-browser-gate.mjs`. No SQLite/player/public Master/Raw/Candy24/20/Migration15/16 semantics modified.
- #482 old exported-backup SHA/post-reload HOLD, #19 Halloween 10/26/10/31 phase/offline HOLD, #479 ESM root cause OPEN. LOCAL_WINDOWS_GIT_HEAD/DIRTY=NOT_VERIFIED. No app responsive owner PASS until new screenshots.
