# Pokémon Sleep AI Manager — UI／功能 API／SQLite／Public Master 架構樹與驗證矩陣

## 2026-10-24 G479 FIRST-BOOT AUTHORITY READBACK — .28 DRAFT PR, CI/OWNER PENDING

**Source-bound diagnosis (not Android ESM root cause):** `auditAndSyncPublicMasters()` previously returned its six-key `applied` snapshot captured **before** forced fresh-database synchronization. `database.js` passed that stale snapshot in `pokemon-sleep:database-ready`, while `public-catalog-workbench.js` compared it with `expected` and emitted `PUBLIC_CATALOG_HYDRATE_FAILED / DATABASE_AUTHORITY_MISMATCH` despite SQLite seed/sync succeeding. On next boot, the pre-sync snapshot naturally matched, explaining the observed first-boot-fail/second-boot-recover pattern without claiming a reproduced Android incident.

**Scoped correction:** Preserve pre-sync `previous_applied` as audit provenance; re-read all six persisted setting authorities **after** sync into emitted `applied`. Never bypass the independent integrity sentinel or player-data boundaries. Extend the existing `v04275531-startup-idb-sw-reliability-contract.mjs` with real ephemeral in-memory sql.js fresh-bootstrap and drift-repair regression, asserting same-boot exactness, metadata still requiring verification, subsequent parity, zero player records and SQLite integrity. No personal SQLite/IndexedDB input. New production tuple candidate `v0.4.27.55.3.3.28` / `20261024-v0427553328-g479-public-catalog-postsync-readback` (predecessor .27 retained). **First exact-head CI diagnosis:** HEAD `3749e0001b4b389fb7e238f432bd7d2339919cd7` had 10/12 SUCCESS and two **historical successor contract** failures: G14 Safety Regression run `40047668167` job `120732992203` step 5 expected frozen .13 but saw .28; Frontend run `40047668125` job `120732992062` step 29 expected frozen .4 but saw .28. Added exact .28 branches preserving the original .27/.13/.4 lineage and assertions; no generic allowlist or disabled check. New HEAD requires independent 12/12 revalidation; earlier 10/12 does not transfer.\n\n**Second exact-head CI diagnosis:** HEAD `ce888113482bc4d4386ab48c3130299640d34ab2` 11/12 SUCCESS, Frontend Regression run `40047810698` job `120733416523` step 31 `v042755333-candy-master-progressive-render-contract.mjs:171` failed because .28 was not an explicitly governed successor of frozen .3 Candy behavior. Add exact .28 branch preserving .27 predecessor and original .3 lineage; no generic allowlist, no Candy runtime mutation. New exact-head CI mandatory.\n\n**Third exact-head CI diagnosis:** HEAD `13aaae2bdbdf579928fbe7b7e100278633ace8cc` 11/12 SUCCESS, Frontend run `40047909025` job `120733722133` step 32 rejected unlisted .28 tuple in `v04275532-release-version-authority-contract.mjs:43`. Append **one exact .28 version/build/cache tuple** to frozen release lineage (no fuzzy/prefix admission); keep all historical rows and predecessor bridges. Re-run full new-head CI before merge.\n\n**Fourth exact-head CI diagnosis:** HEAD `dac1d8eb78f526038762f826e83c9e9e4fb61fe0` 11/12 SUCCESS, Frontend run `40048009767` job `120734032273` step 33 rejected .28 as unlisted exact successor in `v04275533-page-hydration-authority-contract.mjs:46`. Add exact .28 release tuple and ordered lineage entry only; preserve canonical ESM identity, navigation/data boundary and migration15 assertions. Re-run all exact-head CI.\n\n**Fifth exact-head CI diagnosis:** HEAD `3678694d096174cae1f4e18cc615aac1596d8160` 11/12 SUCCESS, Frontend run `40048121473` job `120734391253` step 33 failed in chained `v042755331-page-prewarm-collapsible-hydration-contract.mjs:149` because .28 was not an exact successor. After four observed chained version-gate failures, reviewed seven existing .27 **exact** successor branches (page-prewarm, AI key, Candy 24/20, visible-count, Candy promotion, gap identity, canonical replay) and added corresponding .28 branches copying **all original .27 frozen assertions**, with exact .28 live tuple and .27 predecessor version/build/cache. No blanket version acceptance, no behavioral assertion removed, no production Candy/data changes. New HEAD must pass full 12/12.\n\n**Sixth exact-head CI diagnosis:** HEAD `3b8b701437fba7f9cc65bb221cb55e4abda7ad18` 11/12 SUCCESS; Frontend run `40048382823` job `120735223373` step 33 `v042755331-page-prewarm-collapsible-hydration-contract.mjs:202` selected obsolete analysisConfirmationStatus assertion for .28. Exact .28 inherits the existing .27 `analysisRoot.dataset.analysisConfirmationReady==='true'` ownership contract; add .28 to **two explicit successor arrays** (new readiness and chained .332 test), no assertion removed. New exact-head CI required.\n\n**Draft PR engineering only until exact-head required CI, protected merge, same-main CI/Pages and separate Owner Android UAT.** #479 remains OPEN: original intermittent Android ESM HTTP/transport/SW cause is still unproven; .27 diagnostic Owner UAT remains NOT_VERIFIED. Other #295/#482/#19 Owner DoD unchanged.


## 2026-10-24 OWNER ACTIVE PRIORITY DECISION — 22-Issue DoD/anti-drift/parallel execution

**來源權威／版本（本次決策時點，不保證未來最新）：** GitHub main 4787e365b869ec617e504fc9a4e0ffdbeb0cf8b9；PR [#503](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/503) 已合併並發布 `v0.4.27.55.3.3.27`，12/12 same-main CI 和 [Pages run 40045338377](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40045338377) SUCCESS；PR [#504](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/504) 已更新 post-merge closure。原始 Android .27 實機尚未簽收，不能宣稱 Issue #479 COMPLETE。每輪重新核對 main SHA、唯一 open PR、CI/Pages；Windows local checkout NOT_VERIFIED。

**Owner 指定優先度：** P0 是可靠性與玩家資料安全；P1 是已合併功能聚焦實機關單、來源實證和日期 Gate；P2 是有依賴之產品模組/父 Epic；P3 是長尾附件處理。G9 10/26、10/31 為固定 Owner 時間點，但**不得阻塞**可獨立完成的修補、回歸與關單。

**結案治理：** 22 Open Issues 逐一與原始 DoD 比對。沒有足夠 owner/source/CI 證據的不得關閉；「PR merged」≠「Issue completed」。#6 是可最快取得聚焦 Owner 驗收的候選，成功後評估 #16，但不能未驗先 Close。#295、#457 亦不因純程式合併而自動關單。

**Branches 清理：** [10/23 Immutable Full Inventory](./GOVERNANCE_BRANCH_PR_ISSUE_INVENTORY_20261023.md) 記 394 分支/362 PR/22 Open Issues，後續 PR 與 branch 增減不回寫快照。346 merged-PR-exact-HEAD branches 可進一步評估，但刪除前須證明當下 SHA/唯一提交/封存與 CI 依賴；12 closed-unmerged-only、35 no-PR branches 必須保留直到個別分類。不可批次刪除或假稱刪除。

**每小時推進：** 僅允許一個 GitHub Writer；每輪要確定：active Issue、最近真實 CODE/TEST commit、精確 PR HEAD/base、第一個 CI 失敗/修復、受保護 Merge Commit、新 main CI/Pages 或 Owner pending。若無變化記 NO_PROGRESS_WITH_CAUSE，不能將「watch」或空 CI 當成果。所有正式任務同步修改這三份 canonical docs；不得直推 main、強制還原私人資料或鬆動 Candy 24/20、Raw、UNKNOWN、Migration 15/16、Public/Private 等已結案守則。

**UI/API/DB 對應**：#479 `assets/js/debug-trace-manager.js` 和 `service-worker.js` 必須區分本次錯誤/歷史錯誤及 HTTP/transport；#295 `assets/js/v0394-startup-watchdog.js` 的 background/native dialog/foreground；#482 `backup-truth-restore.js` 與 `g141-cross-device-restore-evidence.js` 僅對帳 metadata，不讀/修改私人 SQLite；#19 `public-event-master-store.js` 僅投影官方 SOURCE 的日期/營地/FEATURE_ONLY 倍率，不寫個人 Candy；#6 recipe attempt player-only；#457 CURRENT/FUTURE 等級權威。完整 22 項優先順序和關單 DoD 見 [Roadmap Closure Ledger](./Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md)。


## 2026-10-24 G479 / #479 — PR #503 diagnostic session/history scope protected merged; exact-main CI/Pages PASS

- **Actual PR**: [#503](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/503) MERGED with `expected_head_sha=48785514a528c56aea260f5e64ceed2e8169ba1a` after **12/12 exact-head PR workflows SUCCESS**, including [Frontend Regression #40045160416](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40045160416). The first failing step of each prior head was inspected and repaired in the same PR branch: exact .27 visible-target-count successor, exact .27 local-gap predecessor, and .27 App Ready → Update Center → player-evolution browser lifecycle; no historical assertion relaxation or blind reruns.
- **Protected main readback**: merge commit `a2e0f965adc2b03afb387bfe32a9e2921fe5d30a`; **12/12 same-SHA push workflows SUCCESS**, including [Frontend #40045338269](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40045338269) and [Deploy GitHub Pages #40045338377](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40045338377). Production GitHub version authority is `v0.4.27.55.3.3.27`, build `20261024-v0427553327-g479-debug-session-history-scope`, cache `pokemon-sleep-ai-v0.4.27.55.3.3.27-v0427553327-g479-debug-session-history-scope`; exact .26 predecessor markers retained. External live Pages JS fetch was NOT_VERIFIED (unavailable in runtime), so Pages workflow SUCCESS is not an independent browser-live readback.
- **Scoped engineering result**: production DebugTraceManager distinguishes current-session error/event counts from retained historical error/event counts and shows scope in the diagnostics UI; actual production-class isolated VM and browser regressions PASS. Export retains historical redacted evidence. No player SQLite/JSON, provider Raw, Candy 24/20 explicit-confirmation truth, Migration15/16, Service Worker, Public Master or Halloween effects mutated.
- **DoD boundary**: #479 remains **OPEN**; the original intermittent Android ESM transport/HTTP/SW root cause and fresh-public-catalog hydration reconciliation remain **ROOT_CAUSE_HOLD**. **.27 Owner Android PWA UAT NOT_VERIFIED**; request focused screenshots of diagnostics current vs retained error counts without resetting/reimporting player data. #295 Android .26 Watchdog lifecycle UAT, #482 old-phone original manifest SHA/new-phone postreload parity, #19 Halloween 10/26 and 10/31 actual phase/offline evidence remain OPEN. Do not close Issues based solely on PR merge. Local Windows Git HEAD/dirty NOT_VERIFIED.


## 2026-10-24 G479 / #479 — DebugTrace session/history scope production correction (Draft candidate)

- **Source-proven defect**: production `DebugTraceManager.summary()` counts only `this.sessionId` even while JSON export retains prior-session `module_probe_failed` events. Thus the unqualified UI `錯誤 0` can be misread as a clean entire history. A current-session zero is valid, but MUST NOT imply no retained failures.
- **Scoped fix**: keep `summary.event_count/error_count/last_error` current-session semantics unchanged for existing consumers; add explicit `historical_event_count/historical_error_count/retained_event_count/retained_error_count`, relabel the UI counts `本次`, and show retained-history error scope. New isolated production-class VM regression exercises old failure + current clean session + new current failure + redacted export, no personal data. Candidate release `v0.4.27.55.3.3.27` build `20261024-v0427553327-g479-debug-session-history-scope`, exact predecessor `.26` preserved. **Draft candidate only; CI, merge, Pages, Owner Android UAT NOT YET VERIFIED**.
- No provider Raw, player SQLite, Public Master, Service Worker, Candy24/20, Migration15/16, or G9 event data mutation. **#479 stays OPEN**: intermittent Android ESM transport/SW root cause and fresh-catalog reconciliation remain unproven. #295, #482, #19 physical DoD independently OPEN. Windows local Git NOT_VERIFIED.


## 2026-10-24 G479 / #479 — PR #501 Chromium production-SW fetch matrix protected merged and same-main CI closed

- **PR #501** [merged](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/501) with expected-head guard. Exact PR HEAD `8f716570b1d78e08deba7006976be059479d93ec`, all **6/6 pull_request workflows SUCCESS** including [Frontend Regression #40037326368](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40037326368), with new `Verify G479 Chromium production SW ESM fetch matrix` step **#74 SUCCESS**. Merge-commit/main readback `9808fc56473296eb08098d5917cb7ed665aaedab`, all **7/7 same-SHA push workflows SUCCESS**, including [Frontend #40037500969](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40037500969) and [Deploy GitHub Pages #40037501031](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40037501031). These are historical checkpoints, fresh GitHub remains authority.
- **Real engineering evidence**: Chromium dynamic `import()` exercises the actual current production `service-worker.js` fetch/cache/fallback handler with a strictly reduced inert localhost precache list. HTTP 503 and 404 fail closed; network rejection with cached current script succeeds; HTTP 200 succeeds; uncached rejection fails closed. Separate from earlier SW-blocked HTTP/transport matrix in PR #499. No production JS/SW, version/build/cache, private SQLite, player records, provider Raw or Public Master changes; formal PWA remains `v0.4.27.55.3.3.26` build `20261023-v0427553326-g295-watchdog-lifecycle`. GitHub Pages workflow SUCCESS does not itself prove independent external live-JS fetch (external readback unavailable).
- **DoD boundary**: this synthetic controlled SW+Chromium test does NOT identify the Owner's intermittent Android ESM failure's actual response/transport cause; Issue [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479) stays OPEN / REAL_ANDROID_ROOT_CAUSE_HOLD. [#295](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/295) Owner Android .26 Watchdog UAT, [#482](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/482) original old backup SHA/postreload, [#19](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19) Halloween 10/26 and 10/31 physical phase/offline evidence remain OPEN. Do not infer Issue closure from merge. Local Windows Git HEAD/dirty NOT_VERIFIED.


## 2026-10-24 G479 / #479 — Production SW fetch path in real Chromium (test-only Draft candidate)

- New isolated browser regression `scripts/g479-chromium-production-sw-esm-replay.mjs` exercises the **actual current `service-worker.js` fetch handler** under real Chromium dynamic `import()`. Only the enormous production install precache list and version authority are substituted with inert localhost fixtures; fetch/cache/fallback logic remains production source-bound. Explicit cases: HTTP 503 and 404 reject as HTTP responses; transport rejection recovers only a cached current module; HTTP 200 imports network module; an uncached transport rejection fails closed. Each case uses an isolated browser context and no PWA/player storage.
- Wired as one step inside existing Frontend Regression Gate, not a new workflow. No production SW/PWA/version/build/cache, SQLite, public event master or player data changes. **DRAFT / exact-head CI NOT YET VERIFIED** until GitHub Actions completes; no claim that the Owner's intermittent Android ESM failure is reproduced or root-caused. #479 remains OPEN. #295 Android watchdog UAT, #482 original cross-phone manifest SHA/postreload, #19 real 10/26 and 10/31 event phase/offline remain OPEN. Local Windows checkout NOT_VERIFIED.


## 2026-10-24 G479 / #479 — PR #499 protected merged; synthetic browser diagnosis only

- **PR #499** protected Merge Commit PASS: exact PR head `091ebea78a0755ebf2219d89da1d8c0c85c55adc`, unchanged **6/6 exact-head PR workflows SUCCESS**, including [Frontend Regression #40022974067](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40022974067). Merge readback main `242857c9e3e0054f35f96f4cb9b7554ba85548f7`; **same-main 7/7 push workflows SUCCESS**, including [Deploy GitHub Pages #40023168564](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40023168564) and [Frontend Regression #40023168620](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/40023168620). All SHA checkpoints historical; fresh GitHub remains authority.
- **First CI failure repaired in same branch**: Chromium HTTP 503 module import generated a real HTTP response **and** `requestfailed: net::ERR_ABORTED`; previous test wrongly required no requestfailed for all HTTP responses. Corrected the isolated test to classify by observed response status and require zero failures only for HTTP 200; transport rejection remains the no-HTTP-response plus requestfailed branch. Synthetic Chromium HTTP 200/503/404/network rejection PASS; SW deliberately blocked and existing independent production-SW replay unchanged.
- **Scope**: CI-only script/workflow and governance; no PWA runtime, Service Worker, version/build/cache, SQLite, personal data, Public Master or migration mutation. Production remains `v0.4.27.55.3.3.26`. **#479 OPEN**: original intermittent Android ESM import root cause and nondestructive device trace NOT_VERIFIED; synthetic browser evidence is not an Android incident reproduction. #295 Owner .26 watchdog UAT, #482 original old-phone backup SHA/postreload, #19 Halloween 10/26/10/31 phase/offline Owner evidence independently OPEN. Immutable branch/PR/Issue snapshot unchanged; Windows local checkout NOT_VERIFIED.


## 2026-10-24 G479 / #479 — Chromium ESM transport classification (CI-only candidate)

- Adds real Chromium dynamic `import()` synthetic HTTP 200/503/404 versus network-rejection classification, using response status and requestfailed telemetry. Service Workers are explicitly blocked in this test; the existing separate source-bound production-SW VM replay is unchanged. Disposable browser context, synthetic same-origin module, no player data.
- Adds one step to existing Frontend Regression Gate, no new workflow; no production app/SW/SQLite/Public Master or version/build/cache change. Candidate pending exact-head CI and protected merge. This does **not** establish actual Android ESM failure cause; #479 remains OPEN until nondestructive real-device evidence. #295 Owner .26 UAT, #482 old exported backup SHA/postreload, #19 Halloween phase/offline Owner proof remain independently OPEN. Windows local Git NOT_VERIFIED.


## 2026-10-24 G14.1 / #482 — metadata-only core-count gate now on main

- **PR #497** protected Merge Commit PASS: exact PR head `7ab3a094601fbb0d007fede82e66fed402c73c38` completed **7/7 exact-head PR workflows SUCCESS**, including G14 Safety Regression `backup-truth-restore`; merge produced main `8a4a75b0e150fe248855cfdaf894b493a5eacb80`. Same exact-main **8/8 push workflows SUCCESS**, including [Deploy GitHub Pages #39998535461](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39998535461) and [Frontend #39998535444](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/39998535444). Historical SHA; fresh GitHub remains authority.
- **Implemented:** `evaluateG141CrossDeviceRestoreEvidence` now requires all 20 exact `backup-truth-restore.js` CORE_TABLES with valid nonnegative integer counts in both old exported manifest and new receipt before exact-byte parity credit. Missing/invalid counts fail closed as `HOLD / REQUIRED_BACKUP_CORE_TABLE_COUNTS_INCOMPLETE`; synthetic negative tests cover incomplete old/new evidence. Provider Raw, player-private/public Master split, migration invariants and existing SHA/stage checks unchanged.
- **No release bump:** production app `v0.4.27.55.3.3.26`, build `20261023-v0427553326-g295-watchdog-lifecycle`, cache unchanged. No player SQLite, backup import/export, personal data, service worker, or public Master mutation. **Issue #482 remains OPEN**: old phone original exported backup full SHA256 and postreload persistence parity are NOT_VERIFIED; same visible counts or current self-check digest comparisons are insufficient. #295 Android .26 Owner UAT, #479 original intermittent Android ESM network root cause, #19 future Halloween Android proof remain separately OPEN.
- Immutable `GOVERNANCE_BRANCH_PR_ISSUE_INVENTORY_20261023.md` is unchanged; do not treat this engineering merge as Issue DoD or a reason to delete branches. Windows local checkout identity NOT_VERIFIED.


## 2026-10-24 G14.1 / #482 backup manifest completeness — architecture candidate

- `assets/js/backup-truth-restore.js` defines 20 canonical `CORE_TABLES` for backup metadata. `assets/js/g141-cross-device-restore-evidence.js` is **not imported by production PWA** and only compares redacted metadata; candidate enforces exact 20 core counts in both old exported manifest and new receipt before `EXACT_SQLITE_BYTES_PARITY_PASS`, otherwise `HOLD / REQUIRED_BACKUP_CORE_TABLE_COUNTS_INCOMPLETE`. `scripts/g141-cross-device-restore-evidence-contract.mjs` adds controlled one-table/missing/null negatives. No IndexedDB/SQLite read/write, no private rows, no release tuple change. Source branch `test/g141-backup-core-count-completeness-20261024` from exact main `776068762259800d70f25795307c5566b3a42ece`; CI/merge pending. Actual Owner exported original full SHA and postreload parity NOT_VERIFIED; #482 stays OPEN.

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


## 2026-10-16 G479 Service Worker response-replay architecture authority — PR #489 candidate

> **Branch-bound evidence**: parent main `56077b971b29601db5dea024a60a9a080be55776`; PR [#489](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/489) Draft. Previous PR head `2b72c35ac157fb3d8a84c61f4cf19c737b51335e` 9/9 CI SUCCESS is **historical after any documentation commit**. Production `v0.4.27.55.3.3.22` / `20261012-v0427553322-g9-official-event-auto-refresh` and cache unchanged. No PWA JS/SW/UI mount or data migration in this PR.

### Isolated synthetic fixture vs deployed Android behavior

| Layer | Verified synthetic behavior / scope | Unverified physical fact |
|---|---|---|
| `service-worker.js` `fetch` interception | Synthetic versioned `app.js` rejected fetch can use same-release cached response; synthetic resolved HTTP 503 passes through; HTTP 404 remains failure; later 200 recovers | Android `module_probe_failed` network status/headers/SW cache path not captured |
| `scripts/g479-sw-network-failure-replay.mjs` | Node VM + fake `fetch`/`caches`, no real browser SW registration or owner data; imported by existing `scripts/v04275531-startup-idb-sw-reliability-contract.mjs` | No Android ESM import fix, no first-boot real network fault reproduction |
| Public Catalog / SQLite / IndexedDB | Prior #487 metadata/fingerprint mismatch/recovery and awaited restore persist static contract retained | 121.8-second `正在儲存 SQLite` label not proven to reflect a running transaction |
| Version / event / personal data | .22 version/build/cache, Halloween Public Event Master, Migration15/16, Raw and player tables unchanged | #482 original backup exact SHA and postreload durable parity; #19 10/26/10/31 mobile phase/offline gates remain open |

**Architectural decision**: synthetic HTTP status classification is a diagnostic regression, not an automatic fallback change. Any runtime SW/network retry must first have bounded real trace and demonstrate fail-closed 404/version authority, current-release cache identity, no stale downgrade and no player data mutation. Three living docs in this same PR must be reconciled before Ready/merge; re-run exact-head CI after final commit.


## Current UI / API / DB Architecture Authority — 2026-10-15 (live GitHub recheck)

> **Source state**: main `5f61f972a98e7dba3cfa5ff882b125b061d6c096` before this docs-only PR; installed app version authority `v0.4.27.55.3.3.22` with build `20261012-v0427553322-g9-official-event-auto-refresh` unchanged. PR #487 (HEAD `0348897496492f4bb1da90f8641add071d2e0be7`) **MERGED**; exact PR triggered CI 9/9 SUCCESS and same-main 9/9 CI+Pages [run 38731090483](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38731090483) SUCCESS. `OPEN PR=0` / `OPEN Issues=22`. 本次 #487 只變更 `scripts/v04275531-startup-idb-sw-reliability-contract.mjs` 及三份治理文件；不變更用戶可用的 UI/API、SQLite/IndexedDB、SW、Public Master JSON 或玩家資料。

### 現行 UI → 模組 API → 資料權威（避免重做）

| 執行中入口（13 views） | 應重用現有 API / JS | SQLite / 公版 Authority | 已完成／尚需驗證 |
|---|---|---|---|
| 儀表板 | `app.js`, `database.js`, `storage.js` | player SQLite local bytes / IndexedDB | CODE+基礎 UI；新機實機還原後健康 PASS、重開機後持久化尚未讀回 #482 |
| 寶可夢 | roster/detail、`training-derived-state-authority.js` | pokemon / subskills / ingredients | CODE；81 total/75 active 已實機見；Full75 source #144 與 CURRENT/FUTURE owner #457 未全閉 |
| 食材 | ingredient inventory integrity / OCR review | ingredient_inventory + shared ingredient_master | CODE，.21 特定來源名稱人工確認 OWNER PASS；全 inventory coverage 未聲稱 PASS |
| 道具 | inventory view | item_inventory + item_master | CODE；新機 22 item rows 自檢存在，不等於全使用者道具 UAT |
| 食譜 | public recipe identity / gap / feedback | recipes player / recipe_master public | G5 identity、G6.1、G7 指定 Gate CLOSED；#6/#16 no-waste feedback Owner 尚未閉 |
| 更新中心 | Observation → Review → Dry Run → Apply / audit, AI BYOK | import_batches/import_changes/image_analysis_revision | P0-B6 Candy 24/20、Migration15 CLOSED；#42/#58/#144 整體覆蓋仍 OPEN |
| 備份還原 | `backup-truth-restore.js`, `database.replaceDatabase`, `g141-cross-device-restore-evidence.js` | SQLite export + JSON + Manifest / IDB snapshot | NEW PHONE owner restore modal+integrity PASS/FK0；two-current-DB SHA 不同 REVIEW，original source backup exact SHA / post-reload HOLD #482；後者 pure metadata API 尚未接 UI |
| 資料百科 | `public-catalog-workbench.js` + shared-master provider | versioned Public Masters / canonical terms | CODE；Master coverage #48 OPEN |
| 本週環境 | `public-event-master-store.js`, `weekly-event-effect-registry.js` | public_event_master / phases、weekly_context | 新 10/14 Halloween Manifest VERSION 在同 .22 Android 顯示 Owner PASS；10/26 / 10/31 營地分段、端側 SHA、offline last-good #19 OPEN |
| 本週戰情室 | `team-optimizer*`, `warroom-*`, strategy/evolution providers | goal profiles / eval snapshots / player inventory | G7 closed defined scope；G8 #18 / G10 #20 / WAR #40/#265 等產品閉環仍 OPEN |
| 收集指南 | collection model / capture display | collection_targets / public pokemon master | CODE；coverage/owner use cases OPEN |
| 使用說明 | guide scenarios / privacy reminders | static docs/local preferences | CODE；Onboarding Wizard + camp init #47 OPEN |
| 診斷中心 | debug trace / watcher / export | session log and local report (not user DB export) | CODE；#479 Android ESM transient/fingerprint phase/121.8s stage root cause OPEN；#487 pure synthetic test CI CLOSED；#295 original native-dialog/visibility DoD REVIEW |

### API / 資料表宣告 vs 真實部署的界線

```text
OFFICIAL BROWSER-ONLY PWA   [CODE / GitHub Pages DEPLOYED]
├── index.html → bootstrap.js → app.js / 13 views           [CODE]
├── Version Authority (.22) + Service Worker               [CODE / SHA frozen]
├── D1. Local SQLite WASM (sql.js)
│   ├── schema.js 26 CREATE TABLE declarations              [DDL SOURCE, not a claim all private fields complete]
│   ├── migrations.js, Migration 15 Candy, Migration 16 Evolution
│   ├── Player domains: pokemon, *_inventory, recipes, weekly_context,
│   │                   import audit, images, warroom, candy, evolution
│   ├── shared-master-schema.js: 5 master tables + views    [PUBLIC CACHED]
│   ├── public-event-master-schema.js: Event / Phase        [SOURCE VERIFIED; Owner VERSION PASS]
│   └── g121-authority.js and other bounded migrations     [G12.1 CODE]
├── D2. IndexedDB pokemon_sleep_ai_manager                 [LOCAL ONLY]
│   ├── database (SQLite bytes), snapshots, metadata; legacy snapshot_metadata
│   └── first-install virgin schema creation is EXPECTED
├── D3. Production pure JS API modules
│   ├── identity/import/AI/BYOK (owner-confirmed mutations only)
│   ├── cooking/recipe/ingredient strategy
│   ├── public event -> effective weekly projection FEATURE_ONLY
│   ├── team planner / training derived current-vs-future
│   └── backup-truth-restore / diagnostics safety
├── D4. OFFLINE QA-only APIs (NOT current PWA UI)
│   ├── evaluateG141CrossDeviceRestoreEvidence
│   ├── evaluateG141PairedSelfChecks
│   └── G479 synthetic metadata reconciler assertions in scripts/v04275531-*
└── D5. GitHub Actions & source data (NOT a production backend)
    ├── contents:read official-source watch, controlled data-only PRs
    ├── official Halloween Public Master v2026-10-14 (4 events)
    └── exact-head PR CI -> protected merge -> exact-main CI/Pages
```

**Evidence level discipline**: `CODE` != `CI_PASS` != `PAGES_PASS` != `OWNER_PASS`. `DDL_SOURCE` != user SQLite schema inspection/row-parity proof. Screenshot visible master VERSION does not attest device exact cached SHA, or future phase/offline. 10/12 current-week correctly displays Growth vol.6, Halloween first active at 10/26 04:00 Asia/Taipei, public source only on 萌綠之島/EX and FIRST daily research candy ×2 (10/26–30) / ×3 (10/31–11/1); unknown ghost/bonus effects cannot be silently made global player multipliers. Frontend is browser-side JS modules, **not FastAPI or PostgreSQL**: uploaded `SPC_System` UI/API/DB files are examples of formatting/governance only, and MUST NOT contribute feature facts to this architecture.

**Closure / overlap**: #19 owns real G9 official future-event UAT; #479 owns Android ESM boot/fingerprint status triage (synthetic #487 CI is not Android fix); #482 owns old→new exact backup SHA and new-device durable reload; #295 owns old watchdog lifecycle DoD (check for overlap, don't rewrite); #457 owns current/future unlock; all higher-level #9/#42/#43/#48 stay OPEN. Subsequent proposals first search this Tree, current repo source and Issue DoD. Downstream living closure authority: [ROADMAP_PR_ISSUE_CLOSURE_AUDIT](./Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md).



> **2026-10-15 G479 #487 SYNTHETIC ARCHITECTURE / NOT PWA RUNTIME**：`scripts/v04275531-startup-idb-sw-reliability-contract.mjs` 透過 `evaluatePublicCatalogVersionAuthority`、`decidePublicCatalogStartup`、`persistPublicCatalogFingerprint`、`readPersistedPublicCatalogFingerprint`、`canBypassPublicCatalogHydration` 純本機 metadata fixture，驗證首次不一致時 `HYDRATE_REQUIRED(DATABASE_AUTHORITY_MISMATCH)`、禁止錯誤 fingerprint promotion；reconciled exact + fingerprint 才 `VERSION_MATCH_BYPASS`，integrity sentinel FAIL 不可 bypass。靜態原始碼順序斷言 `restoreDbBtn` → awaited `replaceDatabase()` → awaited `persist()` → `還原完成`，且 `bootstrap.js` ESM failure trace 不丟棄。**此 PR 僅改 TEST 與 canonical docs，無任何 PWA JS runtime/UI mount、SQLite DDL/row、IndexedDB、Service Worker、Public Event Master、version/build/cache 變更**。歷史 HEAD `41a8d5fab4ea55d0464dcd74fa74868b5dcfe9f1` 的 CI 9/9 PASS；正式合併前必須以最新 HEAD 的全套 CI 為準；Android `app.js` 偶發 dynamic import、121.8s stale label 根因仍 UNKNOWN，#479 OPEN。#482 兩機 integrity/FK/visible counts PASS、不同 current SHA REVIEW、原備份 Manifest/重載持久化 HOLD；#19 Halloween phase/offline/exact SHA Owner UAT OPEN。對應 Roadmap 與 PR/Issue Audit 必須同 PR 一致，且不以 synthetic fixture 宣稱 Owner PASS。

> **2026-10-14 G14.1 CURRENT API final merge**：新增並已 MERGED `assets/js/g141-cross-device-restore-evidence.js` 的 `evaluateG141PairedSelfChecks`（input={oldPhone,newPhone,stage}，13 個必要 user-table counts、一致完整 table set、good integrity/FK、full SHA validation、size validation），針對不同日期的兩支手機 SelfCheck receipts 提供 `COUNT_PARITY_ONLY / PAIR_SELF_CHECK_BYTES_MATCH / REVIEW_REQUIRED(COUNT_PARITY_SHA256_DIFFERENT) / HOLD`。這**不是**舊機匯出備份 Manifest/SQLite 檔案比對：資料庫目前 SHA 相符仍保留 `source_backup_manifest_not_verified`。PR #485 MERGED main `3559ca9f7b48240e4d9a619491f4c9495e775a12`、main 8/8 SUCCESS、Pages 38567091151 PASS；原 `evaluateG141CrossDeviceRestoreEvidence` for exported manifest authority 仍保留。Production `backup-truth-restore.js`、`app.js` / `.22` build cache、SQLite schema/IndexedDB/SW/個人資料與 Public Master JSON 均 unchanged。

> **2026-10-14 G14.1 audit API extension candidate**：新增 `evaluateG141PairedSelfChecks({oldPhone,newPhone,stage})`，只接收兩支裝置 `目前資料庫自我檢查` 的**匿名化 metadata**，驗證兩端完整性、FK0、byte size、13 個必要私人表 count 與完整 table key set，再比較 SHA；不同 SHA 僅 REVIEW_REQUIRED（跨時間截圖不推論 data-loss），SHA 缺值 COUNT_PARITY_ONLY，相同也僅 PAIR_SELF_CHECK_BYTES_MATCH、不能升格為原始匯出備份相同。原 `evaluateG141CrossDeviceRestoreEvidence(oldManifest,newReceipt)` 保留作為舊備份 Manifest 核定 gate。**正式 PWA JS import tree、IndexedDB/API 消費者、SQLite schema、玩家 DB、SW、官方活動資料、`.22` tuple 均 NO_CHANGE**；新單元測試由既有 G14 CI 執行。

> **2026-10-14 implementation ledger CLOSED (CI only)**：PR #483 (`f300fbf97858cd11403ab30694cc5fd71f13ab29`) 交付新的 `assets/js/g141-cross-device-restore-evidence.js` **pure no-DB metadata evaluation API**，由 `scripts/g141-cross-device-restore-evidence-contract.mjs` 與既有 G14 `tests/test_g14_backup_truth_restore.py` 執行；7/7 PR + 8/8 main CI、Pages SUCCESS。它沒有 UI 連結/SQL/IndexedDB/Service Worker 建置變更，也沒有 player-table 數據查詢/寫入。舊 `backup-truth-restore.js` 依然由 `replaceDatabase()` await `persist()`，顯示完成後可進行 in-memory checksum/table checks；確切 Owner reload-after-persist／old-new exact parity 仍未完成，Issue #482。

> **2026-10-14 G14.1 recovery authority extension（不變更正式 PWA）**：備份／還原現行資料流 `backup-truth-restore.js` → `database.js.replaceDatabase` → `persist()` → in-memory `inspectBytes(exportBytes())` → SHA/row parity → `還原完成` → reload。Owner 新機自我檢查確定 SQL schema=16 migrations / integrity PASS / FK0 與資料筆數；尚缺舊機 Manifest 與 reload-after-IDB 實機證據，故非 full parity。新增**read-only pure** `assets/js/g141-cross-device-restore-evidence.js`，僅接收經刪減的 Manifest metadata + new selfcheck receipt，嚴格辨別 `DEVICE_INTEGRITY_PASS_ONLY` / `COUNT_PARITY_ONLY` / `EXACT_SQLITE_BYTES_PARITY_PASS` / `HOLD` / `REVIEW_REQUIRED`；不讀取個人 row、不開 IndexedDB、不變更 JSON/SQL Schema/Service Worker、不升版 `.22`。原 progress label 121.8s 不代表單筆 IDB 交易已卡住，未有完整 telemetry 前獨立待驗。

> **2026-10-14 Schema/restore boundary clarification（OWNER CONFIRMED）**：此 `.22` Android 為**全新未有本機 SQLite 的手機**，故 `indexedDB open`、`DATABASE_METADATA_READY exists:false`、`FRESH_DATABASE_BOOTSTRAP`、schema/migration/公共資料 seed、初次 persist 均屬正常 cold-start；不是 `OLD_DB_LOST`，不可誤把新 Schema 等同舊機玩家資料復原。G14.1 既有程式 `assets/js/backup-truth-restore.js` 可建立 sqlite3/json/manifest 驗證備份，SQLite `PRAGMA integrity_check`/`foreign_key_check`、SHA256、migrations、table_counts、quality_summary、候選隔離 inspect、pre-restore snapshot、replacement verification & rollback。舊手機→新手機 restore 尚未執行，G14.1 在真實裝置的資料一致性 **NOT_VERIFIED**。First install Public Catalog `HYDRATE_FAILED`→次輪 `HYDRATE_COMPLETED` 的 status/fingerprint 語意需釐清，另 `app.js` 暫時無法 import 已另開 #479。**本輪純文件事實校正，JS runtime/schema/玩家 DB/public master 均未更動**。

> **2026-10-14 Android `.22` live API/data boundary UAT（PARTIAL PASS）**：實機 `本週環境` `Master: public-event-master-tw-2026-10-14-halloween2026-official-a` 顯示，證明 runtime 能在 App build/cache 不變時取得新 Public Master VERSION；新 master 的 Halloween 10/26 future event 與當前 10/12 Growth week 正確分離。**截圖沒有端側 `payload_sha256`、兩段 phase/島嶼消費結果或 SQLite 私人資料前後 fingerprint**，上述 G9R Owner Gates 仍 HOLD。獨立 Boot incident [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479)：當前 PWA asset `/assets/js/app.js?v=20261012-v0427553322-g9-official-event-auto-refresh` 曾動態 import Failed，重試成功；首次新 SQLite 雖 `PUBLIC_CATALOG_HYDRATE_FAILED` 卻仍 `APP_READY`，隨後重新啟動有 `HYDRATE_COMPLETED`；DEBUG export SUMMARY 僅最後 session 清零但保留舊失敗。禁止把此觀察當無故障 PASS／網路或 SW 已定位根因／玩家資料遺失。Production JS/API/SQLite DDL/SW/JSON 本次 docs-only 回填均 **NO_CHANGE**。

> **2026-10-14 architecture / release readback**：main `66d8f14ee11e1866c36d4f2861982c480b29e22a`，唯一 production data files changed `assets/data/public-event-master.json`（新增一筆 `halloween_double_candy_2026_10` 有營地/phase/typed FEATURE_ONLY candy、幽靈限定源文本 REVIEW_REQUIRED）與對應 byte-exact `assets/data/public-event-master-manifest.json` SHA `9f0fedb0a434184fb4101705660c6ecb57e1f3d2c72c4a387f22a4623561d80c`。原 public-event store `refreshPublicEventMaster()` 仍做網路 Manifest→SHA→schema→SQLite public-cache transaction→last-good 保留；依 `visibilitychange/pageshow` 等前景事件刷新。PWA UI 僅顯示**當下 ACTIVE**，10/14 尚未開始活動不會顯示萬聖節的 active 倍率，先看 Public Event Master master_version/readback；10/26 04:00 自動 resolver 才開始投影。JS runtime/UI/IndexedDB/SQLite DDL/SW version tuple 全部 NO_CHANGE；PR CI 6/6、main 6/6+Pages [38510277899](https://github.com/easonliu714/pokemon-sleep-ai-manager/actions/runs/38510277899) PASS；Android new SHA＝NOT_VERIFIED。自動 source ingestion 仍 Growth-only，廣義動態活動 parser 將另需範本和負向測試，不能誤報自動偵測已完成。


> **2026-10-14 new Halloween Public Master data delta（merged #477; Owner UAT still open）**：`assets/data/public-event-master.json` append one `halloween_double_candy_2026_10` with `camp_scope:['萌綠之島','萌綠之島EX']`, `start_at:2026-10-26T04:00:00+08:00`, `end_at:2026-11-02T04:00:00+08:00`, two nonoverlap phases at 2026-10-31 04:00（FIRST DAILY sleep-research candy ×2 → ×3），`source` official 10/14 Japanese same announcement confirmed by Owner 11:00 zh-TW screen; unknown restricted Ghost +1/×1.25/+3 & Bluk favorite berry/EX policy is **review only**, never globally projected into deterministic/Strategy. `assets/data/public-event-master-manifest.json` rotates DATA-ONLY version + content SHA. `assets/js/public-event-master-store.js` / Registry / SQLite DDL / IndexedDB / UI / JS PWA Version Authority `.22` / SW all **UNCHANGED**. G9R source watcher auto adapter remains strictly Growth Week; manual controlled source review is required for Halloween and other unseen event families. New tests assert real source/phase/camp boundaries & no old events mutation; OWNER device last-good new SHA NOT VERIFIED until live Pages CI.


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
├── PR #472：新合成測試＋額外 bonus HOLD [已 MERGED，後續 #474/#475 CI 加強]
└── [OWNER PARTIAL PASS] 10/14 Halloween 真實 Data-only PR #477 已部署、同 .22 新 Master VERSION 已在 Android 顯示；端側 SHA/分段/offline 還待驗
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

## 2026-10-17 G479-R responsive War Room + Knowledge — controlled .24 candidate

- Owner Android screenshots: `v0.4.27.55.3.3.23` / `20261017-v0427553323-g479-startup-stage-ownership` showed App 已就緒, 啟動累計, SW background update completed, and Dashboard/Weekly/War Room/Knowledge with Pokémon profile still visible. **G479_STARTUP_STAGE_DISPLAY_23_OWNER_UAT=PASS**. Original intermittent Android `app.js` ESM fetch root cause is NOT_VERIFIED; Issue #479 remains OPEN.
- New Owner-reported defects **both** War Room `#warroomPanel` Hard Constraints/goal form and Knowledge `#sharedKnowledgePanel` Public Pokémon Master Coverage/tables escape 360–430px mobile frame. `v0.4.27.55.3.3.24` build `20261017-v0427553324-mobile-warroom-knowledge-containment` cache `pokemon-sleep-ai-v0.4.27.55.3.3.24-v0427553324-mobile-warroom-knowledge-containment` is **BRANCH_CANDIDATE**, not deployed/Owner PASS. Scoped CSS and real Chromium synthetic DOM viewport matrix (360/390/412/430) enforce internal table scrolling, editable fields, no clipping or global overflow-x:hidden. Full CI and Android device UAT remain separate Gates.
- Source-of-truth: CSS `assets/css/app.css`, existing runtime Coverage CSS `assets/js/v03993-public-knowledge-coverage-ui.js`, existing berry scroll `assets/js/camp-berry-knowledge-ui.js`, Playwright `scripts/v0427553324-mobile-warroom-knowledge-browser-gate.mjs`. No SQLite/player/public Master/Raw/Candy24/20/Migration15/16 semantics modified.
- #482 old exported-backup SHA/post-reload HOLD, #19 Halloween 10/26/10/31 phase/offline HOLD, #479 ESM root cause OPEN. LOCAL_WINDOWS_GIT_HEAD/DIRTY=NOT_VERIFIED. No app responsive owner PASS until new screenshots.
