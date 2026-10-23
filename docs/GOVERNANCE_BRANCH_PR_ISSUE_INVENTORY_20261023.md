# Pokémon Sleep AI Manager — Full GitHub Branch / PR / Open Issue Inventory

**Immutable audit capture:** 2026-10-23 Asia/Taipei; repository [`easonliu714/pokemon-sleep-ai-manager`](https://github.com/easonliu714/pokemon-sleep-ai-manager); main `6b5e2b56216f8cc02c4f720627d43fedb8e6e0c6`; version `v0.4.27.55.3.3.25`.

> This is a read-only governance inventory snapshot. Current authority and progress decisions MUST be updated only in the three canonical living docs (linked below); this inventory MUST NOT be interpreted as a destructive branch-cleanup approval or evidence that an Issue's DoD is satisfied. Linked PR state may change after capture.

## Summary / closure verdict

- **394 branches**, 0 Open PR, **362 historical PRs = 346 MERGED + 16 CLOSED_NOT_MERGED**, **22 Open Issues**.
- PR and branch counts are distinct: **merged PR ≠ branch deletion**. Preserve `main` and any branch that retains unique unmerged commits or documented archival purpose.
- **Safe Issue closure by verified DoD: 0**. Do NOT silently close an Owner-UAT-gated feature because a source PR merged. The strongest quick-closure candidate is #6, which requires focused Android/PWA Owner evidence.
- **Action plan:** (A) mark 346 exact merged-PR HEAD branches for non-destructive prune eligibility review; (B) separately audit 12 closed-unmerged-only branch refs and 36 no-PR refs, including reserved `main`; (C) preserve known archive branches pending actual provenance confirmation; (D) prioritize #295, #479, #482 independently of timed #19.
- **No branch deletion / Issue state mutation in this audit PR.** The only newly created workspace branch before the inventory, `test/g295-current-watchdog-lifecycle-replay-20261023`, points exactly to main without commits and has no PR; it is an explicit cleanup candidate, not a completed #295 implementation.

## Priorities and strict Issue DoD decisions

| Priority | Issue | Title | Current verified gap | Decision |
|---|---|---|---|---|
| P0 | [#295](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/295) | Startup Watchdog Lifecycle False-Positive Hardening on Current Main | 現行 watchdog 未驗證原生對話框、pageshow/focus 與 grace 過期真阻塞；舊 PR #247 未合併 | **保留；優先隔離 source+Chromium fixture** |
| P0 | [#479](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/479) | Android .22 transient ESM import + virgin-install Public Master hydration status triage | 實機 ESM import 短暫失敗根因未取得網路/SW 原始狀態；合成回歸不能結案 | **保留；精確診斷** |
| P0 | [#482](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/482) | G14.1 cross-device SQLite restore parity: manifest vs new-phone receipt Gate | 新機還原 integrity/FK/counts 局部 PASS，原匯出 Manifest full SHA + 新機 post-reload 尚缺 | **保留；metadata-only fail closed** |
| P1 | [#6](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/6) | G6.2 Recipe Attempt Feedback：記錄第三方配方未成功開啟與降低推薦 | PR #468 已合併且功能完整，但 Issue 原文與 PR 明列 Owner Android/PWA 驗收；無可信 PASS 收據 | **保留，排聚焦 Owner UAT 後可關** |
| P1 | [#19](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/19) | G9 Event Manager：官方活動資料、效果與推薦策略管理 | 10/26 與 10/31 活動真實階段及離線手機驗收未到期 | **並行，日期到期即 Owner 驗證** |
| P1 | [#144](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/144) | DATA.2A Full75 Profile Completeness：75 隻個體完整欄位、衍生狀態與分析基線 | 全 75 逐筆最終完整度與缺值 Owner 證據未全閉 | **保留，依正式證據精簡缺口** |
| P1 | [#278](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/278) | v0.4.26 G7.5E3 Species Base Ingredient Probability Authority | E3C 多 Gate 已合併，但 ingredient_probability_per_help 仍 HOLD、production 4/7 | **保留，不得提高數值權威** |
| P1 | [#457](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/457) | G14.1 Derived Unlock State Authority：目前能力與未來潛力分離 | PR #458 pure CURRENT/FUTURE 已合併，缺對應完整 Owner 實機閉環 | **保留，專項 Owner DoD 審核** |
| P2 | [#16](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/16) | G6 Epic：Ingredient Gap Planner 與 Recipe Attempt Feedback | #5 CLOSED，但 #6 Owner UAT 及父 Gate 整體驗收未閉 | **保留；#6 完成後重核** |
| P2 | [#18](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/18) | G8 Weekly Planner：整合島嶼、料理、樹果與活動條件的一週規劃 | 七日安排、鎖定、草稿持久化、離線驗收未全閉 | **保留** |
| P2 | [#20](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/20) | G10 Auto Team Builder：依島嶼、料理目標與角色需求自動組隊 | 四種策略與硬限制／持久化完整 DoD 未全閉 | **保留** |
| P2 | [#40](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/40) | WAR.1 戰情室多隊伍編組、AI 組隊建議與本週能量預估 | 多隊伍持久化、能量分解及手機實測未全閉 | **保留** |
| P2 | [#42](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/42) | G13 AI Assistant Center：OCR、截圖待審、BYOK 多模型與成本治理 | OCR/BYOK/成本完整體系需 DoD 逐項核對 | **保留** |
| P2 | [#43](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/43) | G14 Training Coach：培養優先度、資源 ROI、共眠排程與每日建議 | G14.1 子功能已實作，ROI/共眠排程/日建議未閉 | **保留** |
| P2 | [#44](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/44) | G15 Scenario Simulator：等級、進化、技能與隊伍能量沙盒 | 模擬讀寫隔離、資源 ROI、手機驗收未全閉 | **保留** |
| P2 | [#47](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/47) | G13.8 首次使用導引與營地基礎資料初始化 | 分批上傳、營地初始化、多類 ZIP/手機 UAT 未閉 | **保留** |
| P2 | [#48](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/48) | DATA.1 Versioned Master Database：寶可夢、食材、樹果、食譜、營地與進化關聯 | Master 版本關聯、原始來源與跨領域覆蓋仍缺 | **保留** |
| P2 | [#164](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/164) | DATA.1D Evolution Screenshot Evidence Backfill for Remaining UNKNOWN Species | 私人截圖整理與 public terminal/unknown 來源處理仍需驗收 | **保留** |
| P2 | [#265](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/265) | War Room Decision UI: concise recommendations + named planner team drafts | 命名草稿、apply/local-only、精簡卡片與保存 DoD 未全閉 | **保留，與 #40 串接** |
| P3 | [#7](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/7) | DATA.1 Complete ZIP Extraction：完成剩餘寶可夢與帳號截圖資料整理 | 179 張附件原始索引／處理狀態未完整 Owner 驗收 | **保留，不能猜測完成** |
| P3 | [#9](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/9) | ROADMAP Epic：Shared Knowledge、Cooking AI、Weekly Planner 與 Team Builder | 多個子 Gate 仍 OPEN，不能整體 close | **保留，僅治理聚合** |
| P3 | [#58](https://github.com/easonliu714/pokemon-sleep-ai-manager/issues/58) | DATA.1F 近似圖片重複偵測（pHash／dHash／OCR 指紋） | pHash/dHash 近似圖片覆核與語意來源驗證未完成 | **保留，低優先** |

## Priority execution after the inventory

1. **#295 Startup watchdog lifecycle**: CI-only test first for native `alert/confirm/prompt`, hidden/background, resume `visibilitychange/pageshow/focus` bounded grace, and real foreground block still detected. Production fix only if reproduced, with guarded PR; historical PR #247 must never be merged.
2. **#479 Android ESM root cause**: preserve real HTTP/SW/ESM provenance and retry boundary, no speculative 503-cause claim or player DB mutation.
3. **#482** metadata-only original backup full SHA / receipt and postreload parity, never claim bytes-match from two different timestamps or partial SHA.
4. **#6** quick focused Owner Recipe Attempt Feedback UAT may be requested separately; after verified DoD, close #6 then reassess parent #16.
5. **#19** 10/26 04:00 and 10/31 04:00 Owner phase checks remain parallel independent date hinges. No new app release merely to wait.

## Branch inventory — all 394 refs

**Status definitions:** `MERGED_PR_EXACT_HEAD` means current branch SHA matches at least one **merged PR's stored HEAD**, not a directive to delete; `CLOSED_UNMERGED_PR_ONLY` means linked PRs are all closed without merge (needs provenance assessment); `NO_PR_ASSOCIATION` is not assumed orphan or safe delete; `MAIN` always reserved.

| Branch ref | Current SHA | PR link(s) | Classification |
|---|---|---|---|
| `agent/ci1-g13-ocr-ai-consolidation` | `cbf1382b6909` | [#223](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/223) M | MERGED_PR_EXACT_HEAD |
| `agent/ci1-historical-release-consolidation` | `eb22b1586783` | [#222](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/222) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c6c-multislot-unique-event-reconstruction` | `2636645e36c7` | [#350](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/350) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c6d-multislot-mobile-ui` | `c79203af142e` | [#351](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/351) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c6e-first-party-observation-pwa-offline` | `9aaf1306b73e` | [#352](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/352) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7-ingredient-probability-statistical-readiness` | `258a1a72dba8` | [#339](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/339) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7b-local-readiness-ui` | `df71494ee57d` | [#340](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/340) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c1-sufficiency-evidence-pack` | `3c3ef4cd2f0c` | [#341](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/341) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c2-independent-source-lineage-reconciliation` | `9b8cdc324661` | [#342](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/342) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c3-independent-candidate-discovery-audit` | `226b4598d40a` | [#343](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/343) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c4-independent-candidate-discovery-register` | `c472ddab2910` | [#344](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/344) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c5-independent-candidate-intake-gate` | `2139e298355c` | [#345](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/345) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c6-recorded-dataset-resolution-pack` | `c758d94f9ac9` | [#346](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/346) M | MERGED_PR_EXACT_HEAD |
| `agent/e3c7c7-recorded-dataset-scope-resolution` | `202845fb9733` | [#349](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/349) M | MERGED_PR_EXACT_HEAD |
| `agent/pinned-evidence-fetch-429-hotfix` | `f5e13e6b9554` | [#347](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/347) M | MERGED_PR_EXACT_HEAD |
| `agent/pinned-evidence-github-api-fallback-hotfix` | `6bb493a40ea5` | [#348](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/348) M | MERGED_PR_EXACT_HEAD |
| `agent/pokemon-roster-unlocked-filters` | `cd7dd4ae52ea` | [#294](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/294) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-1a-browser-runtime-gate` | `dd8a0526e3e4` | [#32](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/32) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-1b-duplicate-skeleton-guard` | `d14fe463e84a` | [#34](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/34) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-1c-profile-completeness-guard` | `d5d52ebf02f2` | [#36](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/36) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-2a-ai-observation-contract` | `e7f3aa03027d` | [#38](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/38) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-2b-identity-candidate-engine` | `504f9e41d337` | [#39](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/39) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-2c-confirmation-ui` | `c95f26333c31` | [#45](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/45) M | MERGED_PR_EXACT_HEAD |
| `agent/tech-2c-confirmation-ui-clean` | `cf53be292d9f` | — | NO_PR_ASSOCIATION |
| `agent/tech-2d-import-wizard` | `2bab27678e2b` | [#46](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/46) M | MERGED_PR_EXACT_HEAD |
| `agent/v04101-root-contract-alignment` | `6682159c8566` | [#219](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/219) M | MERGED_PR_EXACT_HEAD |
| `agent/v04102-internal-gemini-dual-mode` | `185de4aa6582` | [#221](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/221) M | MERGED_PR_EXACT_HEAD |
| `agent/v04275-g72-effective-event-effects-hotfix` | `e9a85a768f9b` | [#338](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/338) M | MERGED_PR_EXACT_HEAD |
| `agent/v04275-pe4-war-room-effective-context-banner` | `e63999542a39` | [#337](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/337) M | MERGED_PR_EXACT_HEAD |
| `agent/v04275-pe6-strategy-event-provenance` | `7904eac77749` | [#336](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/336) M | MERGED_PR_EXACT_HEAD |
| `agent/v04275-pe7-legacy-event-ui-hotfix` | `617e0294e922` | [#335](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/335) M | MERGED_PR_EXACT_HEAD |
| `agent/v04275-public-event-master` | `352761b147e3` | [#334](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/334) M | MERGED_PR_EXACT_HEAD |
| `agent/v04276-internal-observation-parity-progress-ux` | `05a6f75c2513` | [#353](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/353) M | MERGED_PR_EXACT_HEAD |
| `agent/v04277-structured-gemini-current-file-ux` | `6a247f205834` | [#354](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/354) M | MERGED_PR_EXACT_HEAD |
| `agent/v04278-ai-pool-self-heal-wrap-projection` | `8518144cc98f` | — | NO_PR_ASSOCIATION |
| `agent/v04278-evolution-master-ai-resilience-confirmation` | `01c1ad789b33` | [#355](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/355) M | MERGED_PR_EXACT_HEAD |
| `agent/v04279-confirmation-multicapture-authority-hotfix` | `acfc11545d96` | [#356](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/356) M | MERGED_PR_EXACT_HEAD |
| `agent/v042710-ai-startup-timeout-public-hydration` | `7e1054545f54` | [#357](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/357) M | MERGED_PR_EXACT_HEAD |
| `agent/v042711-model-health-fallback-persistence` | `b629324fed1e` | [#358](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/358) M | MERGED_PR_EXACT_HEAD |
| `agent/v042712-confirmation-lifecycle-model-status-ux` | `ef7360ea7853` | [#360](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/360) C | CLOSED_UNMERGED_PR_ONLY |
| `agent/v042712-live-validation-ux-hotfix` | `eaed5c175aef` | [#359](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/359) C | CLOSED_UNMERGED_PR_ONLY |
| `agent/war3a-candy-inventory-resource-context` | `a7be11740cd4` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-baseline-v0491-cleanup-marker` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-baseline-v0491-cleanup-marker2` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-baseline-v0491-final` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-baseline-v0491-last` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-baseline-v0491` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-main-baseline-20260811` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/uc-img-a-pre-implementation` | `bce36eaa0c6d` | — | NO_PR_ASSOCIATION |
| `archive/war3c-pre-v0485-fbba1b1` | `fbba1b18a5fc` | — | NO_PR_ASSOCIATION |
| `ci/p1-production-evidence-regression` | `a1e4bf15f9a2` | [#306](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/306) M | MERGED_PR_EXACT_HEAD |
| `ci/p2-legacy-runtime-regression` | `f846d1fc5457` | [#307](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/307) M | MERGED_PR_EXACT_HEAD |
| `ci/p3-data-g13-war-consolidation` | `ffd6d389b48d` | [#308](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/308) M | MERGED_PR_EXACT_HEAD |
| `ci/p4-topology-governance` | `5a6d2cd14e14` | [#309](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/309) M | MERGED_PR_EXACT_HEAD |
| `ci/p5-core-update-public-parity` | `00d1a3920e79` | [#316](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/316) M | MERGED_PR_EXACT_HEAD |
| `ci/p5-retire-core-update-public-wrappers` | `1e65cada1a4e` | [#317](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/317) M | MERGED_PR_EXACT_HEAD |
| `ci/p6a1-ucimg-wrapper-parity` | `1876a56f9214` | [#322](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/322) M | MERGED_PR_EXACT_HEAD |
| `ci/p6a2-retire-v0413-wrappers` | `2e2f0da0b153` | [#323](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/323) M | MERGED_PR_EXACT_HEAD |
| `ci/p6b1-screenshot-pipeline-parity` | `807191569ad2` | [#324](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/324) M | MERGED_PR_EXACT_HEAD |
| `ci/p6b2-retire-screenshot-domain-runners` | `2360767a03c9` | [#325](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/325) M | MERGED_PR_EXACT_HEAD |
| `ci/p7a-recipe-regression-parity` | `e872fe42692f` | [#326](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/326) M | MERGED_PR_EXACT_HEAD |
| `ci/p7b-retire-recipe-wrappers` | `61ec5eaa397b` | [#327](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/327) M | MERGED_PR_EXACT_HEAD |
| `ci/p8a-safety-boundary-parity` | `9e000d2a989e` | [#328](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/328) M | MERGED_PR_EXACT_HEAD |
| `ci/p8b-retire-safety-boundaries` | `d35f13066809` | [#329](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/329) M | MERGED_PR_EXACT_HEAD |
| `codex/v042755-p0b6-candy-family-storage-reconciliation` | `5b193c95dc0e` | [#408](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/408) M | MERGED_PR_EXACT_HEAD |
| `codex/v042755-p0b6-candy-timezone-order-hotfix` | `e7784169ab58` | [#410](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/410) M | MERGED_PR_EXACT_HEAD |
| `codex/v042755-p0b6-real-device-candy-authority-hotfix` | `ae9ce8e78972` | [#409](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/409) M | MERGED_PR_EXACT_HEAD |
| `data/g9r-halloween2026-official-scoped-phase-candy` | `6ac569d4f59a` | [#477](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/477) M | MERGED_PR_EXACT_HEAD |
| `docs/g9r-20261013-post-merge-runtime-baseline` | `cbca104171ab` | [#476](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/476) M | MERGED_PR_EXACT_HEAD |
| `docs/g9r-20261014-halloween-live-data-checkpoint` | `04877dda8b83` | [#478](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/478) M | MERGED_PR_EXACT_HEAD |
| `docs/g9r-20261014-new-phone-virgin-schema-clarification` | `0a4714bf896f` | [#481](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/481) M | MERGED_PR_EXACT_HEAD |
| `docs/g9r-20261014-owner-partial-pass-startup-triage` | `f6de207dca5f` | [#480](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/480) M | MERGED_PR_EXACT_HEAD |
| `docs/g141-20261014-postmerge-owner-restore-checkpoint` | `84d9c27e2ad6` | [#484](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/484) M | MERGED_PR_EXACT_HEAD |
| `docs/g141-20261014-sha-divergence-postmerge-ledger` | `d73f22a5e09d` | [#486](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/486) M | MERGED_PR_EXACT_HEAD |
| `docs/issue479-virgin-hydration-pre-sync-triage-20261014` | `082c485b8ca8` | — | NO_PR_ASSOCIATION |
| `docs/product-roadmap-and-architecture` | `b43e68c3ef31` | [#49](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/49) M | MERGED_PR_EXACT_HEAD |
| `docs/20261013-canonical-roadmap-and-architecture-baseline` | `4cb7ec9bf04c` | [#473](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/473) M | MERGED_PR_EXACT_HEAD |
| `docs/20261015-canonical-audit-handoff-post487` | `5c58eca2cf41` | [#488](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/488) M | MERGED_PR_EXACT_HEAD |
| `feat/core-debug-2-import-ux` | `5b182d291800` | [#51](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/51) M | MERGED_PR_EXACT_HEAD |
| `feat/data1a-zip-inventory-manifest` | `6f10a0f13a7c` | [#52](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/52) M | MERGED_PR_EXACT_HEAD |
| `feat/data1b-inventory-review-workbench` | `91a86eb0ae31` | — | NO_PR_ASSOCIATION |
| `feat/data1b-inventory-review-workbench-v2` | `4703ec0b2e7b` | [#54](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/54) M | MERGED_PR_EXACT_HEAD |
| `feat/data1c-image-fingerprint-duplicate-gate` | `fde0c83a6da6` | [#59](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/59) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-batch-cancel-region-review` | `ab3d9aa5193a` | [#66](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/66) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-bootstrap-integration` | `0d6e6dff4093` | [#77](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/77) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-controller-integration` | `b59017db879d` | [#73](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/73) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-lifecycle-events` | `59483a5448c7` | [#72](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/72) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-preview-event-wiring` | `c915d8012760` | [#78](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/78) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-update-center-bootstrap` | `693a3f3ee53f` | [#76](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/76) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-update-center-bridge` | `b75857a4982c` | [#75](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/75) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-overlay-update-center-mount` | `38e2f90c8da8` | [#74](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/74) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-region-ai-consent` | `522c84332d97` | [#68](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/68) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-region-ui-preview` | `9a4cc13d55b6` | [#69](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/69) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-review-ui-cancel-wiring` | `c1a659047301` | [#67](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/67) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-runtime-ui-preprocessing` | `2d612183a401` | [#65](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/65) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-thumbnail-overlay-wiring` | `160d43f8b680` | [#71](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/71) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d1-ocr-thumbnail-region-confidence` | `23659d7c2998` | [#70](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/70) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d-local-ocr-runtime-ui` | `ac74d5063949` | [#61](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/61) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d-ocr-first-classification` | `8182102d76d8` | [#60](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/60) M | MERGED_PR_EXACT_HEAD |
| `feat/data1d-ocr-runtime-ui-ai-settings` | `43e1b43111b8` | [#62](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/62) M | MERGED_PR_EXACT_HEAD |
| `feat/debug-trace-manager` | `6d7ccd2ce0a4` | [#50](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/50) M | MERGED_PR_EXACT_HEAD |
| `feat/e3c6b-first-party-ingredient-observation-capture` | `8e4b2cf53fbb` | [#318](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/318) M | MERGED_PR_EXACT_HEAD |
| `feat/g6-1-ingredient-gap-engine` | `df88f4484a2f` | [#21](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/21) M | MERGED_PR_EXACT_HEAD |
| `feat/g6-1b-weekly-selects-data-completion` | `657cb746e071` | [#23](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/23) M | MERGED_PR_EXACT_HEAD |
| `feat/g9r-data-only-append-only-pr-gate` | `fd46613fbe3a` | [#474](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/474) M | MERGED_PR_EXACT_HEAD |
| `feat/g9r-official-event-data-feed` | `f0c7212b77c5` | [#471](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/471) M | MERGED_PR_EXACT_HEAD |
| `feat/g13-2a-ai-project-pool-executor` | `30d5cd6fcd6f` | [#87](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/87) M | MERGED_PR_EXACT_HEAD |
| `feat/g51-personal-recipe-system` | `7b8d1d3874a0` | [#459](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/459) M | MERGED_PR_EXACT_HEAD |
| `feat/g62-recipe-attempt-feedback` | `851997f9b3fa` | — | NO_PR_ASSOCIATION |
| `feat/g121a-authority-closure` | `0c41aa5baa7b` | [#441](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/441) M | MERGED_PR_EXACT_HEAD |
| `feat/g121a-readiness-audit` | `7bddd29a7038` | [#440](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/440) M | MERGED_PR_EXACT_HEAD |
| `feat/g121b-deterministic-evolution-status` | `d94431c5ceaf` | [#442](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/442) M | MERGED_PR_EXACT_HEAD |
| `feat/g121b-schema-safe-read-adapter` | `6267927f52e7` | [#443](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/443) M | MERGED_PR_EXACT_HEAD |
| `feat/g121b-status-read-api` | `67af52409efb` | [#444](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/444) M | MERGED_PR_EXACT_HEAD |
| `feat/g121c-explainable-evolution-recommendation` | `2e0d9cb08674` | [#445](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/445) M | MERGED_PR_EXACT_HEAD |
| `feat/g121d-evolution-recommendation-ui` | `3b919f86f221` | [#446](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/446) M | MERGED_PR_EXACT_HEAD |
| `feat/pwa-visible-version` | `e711e6a11324` | [#26](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/26) M | MERGED_PR_EXACT_HEAD |
| `feat/v0-3-27-identity-completion` | `2580e052fe88` | [#30](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/30) M | MERGED_PR_EXACT_HEAD |
| `feat/v0-3-28-master-data-editor` | `8ab30f0e1f53` | [#31](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/31) M | MERGED_PR_EXACT_HEAD |
| `feat/v0.4.27.18-per-image-target-group-authority` | `875961e4de7a` | [#367](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/367) M | MERGED_PR_EXACT_HEAD |
| `feat/v0.4.27.24-e3c6f-censored-series-observation` | `2b2abc7dc5d0` | [#373](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/373) M | MERGED_PR_EXACT_HEAD |
| `feat/v0353-ocr-sp-thumbnail-preview` | `90b4e4ba2db6` | [#81](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/81) M | MERGED_PR_EXACT_HEAD |
| `feat/v0355-layout-aware-region-ocr` | `6c4ca35831db` | [#83](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/83) M | MERGED_PR_EXACT_HEAD |
| `feat/v0356-manual-reocr` | `a3656f604603` | [#84](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/84) M | MERGED_PR_EXACT_HEAD |
| `feat/v0357-two-stage-ocr-versioned-exports` | `e65293927587` | [#85](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/85) M | MERGED_PR_EXACT_HEAD |
| `feat/v0372-real-ocr-ai-execution` | `312b43a1bd6b` | [#101](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/101) M | MERGED_PR_EXACT_HEAD |
| `feat/v0373-analysis-confirmation-apply` | `8b0d0324f170` | [#102](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/102) M | MERGED_PR_EXACT_HEAD |
| `feat/v0374-ocr-ai-cross-check-confidence` | `1631a94cfe05` | [#103](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/103) M | MERGED_PR_EXACT_HEAD |
| `feat/v0375-unified-import-pipeline` | `a4ad40bd0769` | [#104](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/104) M | MERGED_PR_EXACT_HEAD |
| `feat/v0377a-backup-truth-restore-verification` | `9a41477feb42` | [#106](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/106) M | MERGED_PR_EXACT_HEAD |
| `feat/v0377b-full75-recovery-closure` | `f933b69a23ac` | [#107](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/107) M | MERGED_PR_EXACT_HEAD |
| `feat/v0377c-data-consistency-multicapture` | `fac05a2023a0` | [#108](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/108) M | MERGED_PR_EXACT_HEAD |
| `feat/v0379-canonical-commit-gate` | `754e358f196e` | [#111](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/111) M | MERGED_PR_EXACT_HEAD |
| `feat/v0379-canonical-public-catalog` | `34f4fd6552e3` | [#110](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/110) M | MERGED_PR_EXACT_HEAD |
| `feat/v0379-canonical-terminology-hydration` | `c799a513eebf` | — | NO_PR_ASSOCIATION |
| `feat/v0380-static-shell-admin-debug-gate` | `291fc39626a4` | [#113](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/113) M | MERGED_PR_EXACT_HEAD |
| `feat/v0396-general-json-audit-full75-retirement` | `6bda645ebdc8` | [#145](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/145) M | MERGED_PR_EXACT_HEAD |
| `feat/v0397-profile-completeness-derived-readiness` | `8bc727accfa7` | [#146](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/146) M | MERGED_PR_EXACT_HEAD |
| `feat/v0399-human-readable-diff-review` | `04f83e261a9c` | [#150](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/150) M | MERGED_PR_EXACT_HEAD |
| `feat/v0411-public-master-recognition` | `13dc0b79a7ba` | [#228](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/228) M | MERGED_PR_EXACT_HEAD |
| `feat/v0412-recipe-unified-player-workbench` | `3521b8d44f6d` | [#238](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/238) M | MERGED_PR_EXACT_HEAD |
| `feat/v0413-g7-recipe-portfolio-contention` | `3b8774a80fc7` | [#239](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/239) M | MERGED_PR_EXACT_HEAD |
| `feat/v04132-pot-authority-recipe78` | `8778ca9cab3e` | [#243](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/243) M | MERGED_PR_EXACT_HEAD |
| `feat/v042745-public-reference-evolution-history-ux` | `0c9a3be2e7e5` | [#395](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/395) M | MERGED_PR_EXACT_HEAD |
| `feat/v042746-p0b1-professor-candy-observed-authority` | `f527762e8c3c` | [#396](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/396) M | MERGED_PR_EXACT_HEAD |
| `feat/v042747-p0-b2-public-species-authority` | `d351f5961c61` | [#397](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/397) M | MERGED_PR_EXACT_HEAD |
| `feat/v042749-p0-b3-candy-family-authority` | `56a0593ae143` | [#400](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/400) M, [#399](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/399) C | MERGED_PR_EXACT_HEAD |
| `feat/v042750-p0b4-candy-display-name-authority` | `ee14f57f0545` | [#402](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/402) M, [#401](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/401) C | MERGED_PR_EXACT_HEAD |
| `feat/v042751-p0b5-candy-quantity-confirmation-authority` | `8ee0c52a2c75` | [#403](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/403) M | MERGED_PR_EXACT_HEAD |
| `feat/v042752-p0b5-gap-identity-hotfix` | `74d069dc2b41` | [#404](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/404) M | MERGED_PR_EXACT_HEAD |
| `feat/v042753-p0b5-canonical-key-gap-admission-replay` | `949efed95d0d` | [#406](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/406) M, [#405](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/405) C | MERGED_PR_EXACT_HEAD |
| `feat/v042754-p0b5-ingame-candy-master-promotion` | `87b3c0dab85c` | [#407](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/407) M | MERGED_PR_EXACT_HEAD |
| `feature/data-evo1-observed-evolution-coverage` | `159ec2e40bf1` | [#209](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/209) M | MERGED_PR_EXACT_HEAD |
| `feature/pokemon-visual-evidence-consistency-contract` | `a5aa0174eb73` | [#310](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/310) M | MERGED_PR_EXACT_HEAD |
| `feature/r1-canonical-recognition-normalization` | `20b0370694d3` | [#117](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/117) M | MERGED_PR_EXACT_HEAD |
| `feature/species-ingredient-candidate-authority` | `5e4d92ea9698` | [#311](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/311) M | MERGED_PR_EXACT_HEAD |
| `feature/uc-img-a-unified-screenshot-update-center` | `906cf52fe55a` | [#216](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/216) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.13.7-g72-evidence-authority-pack` | `d7f23bf3879a` | — | NO_PR_ASSOCIATION |
| `feature/v0.4.14-g7-verified-energy-objective` | `86b0575a0ad4` | [#248](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/248) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.15-g7-team-supply-readiness` | `f0c4aecbbaa0` | [#251](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/251) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.16-g73-production-team-search-contract` | `a4abad8770de` | [#253](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/253) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.17-g74-ai-proposal-intake` | `d16a28b02fed` | [#255](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/255) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.18-g75-production-evidence-gate` | `24f52e761782` | [#259](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/259) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.19-g75a-berry-strength-master` | `c6b80c4293d3` | [#261](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/261) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.20-g75b-favorite-berry-multiplier` | `4182abd52511` | [#263](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/263) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.21-g75c-help-event-split` | `ac7a13abdadf` | [#266](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/266) M | MERGED_PR_EXACT_HEAD |
| `feature/v0.4.22-g75d-base-berry-output` | `d8b711d9feea` | [#268](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/268) M | MERGED_PR_EXACT_HEAD |
| `feature/v042-recipe-canonical-master-strategy-readiness` | `ca0f01cc8e0a` | [#171](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/171) M | MERGED_PR_EXACT_HEAD |
| `feature/v043-recipe-zh-tw-reconciliation-team-optimizer` | `a18ab30801e0` | [#176](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/176) M | MERGED_PR_EXACT_HEAD |
| `feature/v043-recipe-zh-tw-team-optimizer-foundation` | `cee2a2f2ba5e` | [#180](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/180) C | CLOSED_UNMERGED_PR_ONLY |
| `feature/v0381-pokemon-detail-review-merge` | `09f26e7353c6` | [#118](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/118) M | MERGED_PR_EXACT_HEAD |
| `feature/v0382-file-snapshot-and-public-catalog` | `af40925dee84` | [#119](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/119) M | MERGED_PR_EXACT_HEAD |
| `feature/v0383-catalog-ocr-review-contract` | `00c13ae01f5d` | [#121](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/121) M | MERGED_PR_EXACT_HEAD |
| `feature/v0386-startup-progress-fail-open` | `ec1a392a1f93` | [#125](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/125) M | MERGED_PR_EXACT_HEAD |
| `feature/v0400-public-pokemon-master-coverage` | `6c1eed009fb6` | [#155](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/155) M | MERGED_PR_EXACT_HEAD |
| `feature/v0423-release-r2` | `11e1a67299fb` | [#271](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/271) M | MERGED_PR_EXACT_HEAD |
| `feature/v0423` | `1f5b528fe0bb` | — | NO_PR_ASSOCIATION |
| `feature/v0424-g75e2a-nature-numeric-modifier` | `d3888bc0cce0` | [#273](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/273) M | MERGED_PR_EXACT_HEAD |
| `feature/v0425-g75e2b-recipe-name-subskill` | `eb4bd8ce5e72` | [#276](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/276) M | MERGED_PR_EXACT_HEAD |
| `feature/v0426-g75e3-species-ingredient-probability` | `7e8c0e0e1891` | — | NO_PR_ASSOCIATION |
| `feature/v0426-g75e3a-ingredient-production-evidence` | `5c4b676014fd` | [#281](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/281) C | CLOSED_UNMERGED_PR_ONLY |
| `feature/v0426-g75e3a-ingredient-rate-reference-boundary` | `7e8c0e0e1891` | — | NO_PR_ASSOCIATION |
| `feature/v0426-g75e3a-ingredient-rate-reference-boundary-r1` | `c543f2652ba4` | [#279](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/279) M | MERGED_PR_EXACT_HEAD |
| `feature/v0427-g75e3b-ingredient-slot-distribution` | `3a6120654753` | [#283](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/283) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c2-public-species-form-roster` | `84c5fdc23a6a` | [#285](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/285) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c3-probability-source-coverage-audit` | `e9e2f856b920` | [#286](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/286) C | CLOSED_UNMERGED_PR_ONLY |
| `feature/v0428-g75e3c4-independent-crosscheck-readiness` | `fa7e2bea83cf` | [#287](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/287) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c4a-independent-source-admission` | `310b5378ac8b` | [#289](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/289) M, [#288](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/288) C | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c4b-independent-snapshot-intake` | `4261a3005cc5` | [#290](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/290) C | CLOSED_UNMERGED_PR_ONLY |
| `feature/v0428-g75e3c4b-independent-snapshot-intake-clean` | `2d4f3b72f1b5` | [#291](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/291) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c5-source-lineage-review` | `9b06f573f880` | [#292](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/292) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c6-first-party-observation` | `e8491c96a6e8` | [#293](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/293) M | MERGED_PR_EXACT_HEAD |
| `feature/v0428-g75e3c-probability-evidence-policy` | `c34b5ec48bbb` | [#284](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/284) M | MERGED_PR_EXACT_HEAD |
| `feature/v03992-guided-ux-public-pokemon-knowledge` | `dcaffbefe35f` | [#152](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/152) M | MERGED_PR_EXACT_HEAD |
| `feature/v03993-public-pokemon-master-coverage` | `d024c84fb48e` | [#153](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/153) M | MERGED_PR_EXACT_HEAD |
| `feature/v04275533-page-hydration-authority` | `def3ce00815b` | [#434](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/434) C | CLOSED_UNMERGED_PR_ONLY |
| `feature/v0427553319-g62-recipe-attempt-feedback` | `7d8eb70cdfe5` | [#468](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/468) M | MERGED_PR_EXACT_HEAD |
| `feature/visual-prompt-hallucination-hardening` | `cb431d71b4c5` | [#312](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/312) M | MERGED_PR_EXACT_HEAD |
| `feature/war1c-evaluation-snapshot-lifecycle` | `df1cb25f3976` | [#189](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/189) M | MERGED_PR_EXACT_HEAD |
| `feature/war2a-current-readiness-runtime-bridge` | `6c260c920757` | [#190](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/190) M | MERGED_PR_EXACT_HEAD |
| `feature/war2b-recipe-discovery-stockpile-team-planner` | `6fb5705b8293` | [#192](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/192) M | MERGED_PR_EXACT_HEAD |
| `feature/war3a-candy-inventory-resource-summary` | `e6b0282fe895` | [#203](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/203) M | MERGED_PR_EXACT_HEAD |
| `feature/war3b-typed-event-effect-registry` | `0ca66fdccbc5` | [#204](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/204) M | MERGED_PR_EXACT_HEAD |
| `feature/war3c-external-ai-strategy-analysis-pack` | `2a4b538d4cf9` | [#205](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/205) M | MERGED_PR_EXACT_HEAD |
| `fix/data1a-export-feedback` | `c229e1631e6b` | [#53](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/53) M | MERGED_PR_EXACT_HEAD |
| `fix/g9r-synthetic-data-only-replay-and-unknown-bonus-hold` | `4f75a8d3c929` | [#472](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/472) M | MERGED_PR_EXACT_HEAD |
| `fix/g51-owner-validation-ui-followup` | `6ee18253eea4` | [#463](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/463) M | MERGED_PR_EXACT_HEAD |
| `fix/g141-cross-device-selfcheck-sha-divergence` | `925456ec1841` | [#485](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/485) M | MERGED_PR_EXACT_HEAD |
| `fix/g479-mobile-warroom-knowledge-containment-v0427553324` | `eebb3aebaf3f` | — | NO_PR_ASSOCIATION |
| `fix/g479-stage-owner-v0427553323-20261017` | `03a44d553165` | [#490](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/490) M | MERGED_PR_EXACT_HEAD |
| `fix/general-user-identity-review-access` | `d3298d7f3374` | [#114](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/114) M | MERGED_PR_EXACT_HEAD |
| `fix/gui-warroom-knowledge-mobile-containment-v0427553324-20261017` | `eebb3aebaf3f` | — | NO_PR_ASSOCIATION |
| `fix/identity-dedup-recipe-render` | `b29eceff0d7c` | [#27](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/27) M | MERGED_PR_EXACT_HEAD |
| `fix/mobile-warroom-knowledge-containment-v0427553324-20261017` | `eebb3aebaf3f` | — | NO_PR_ASSOCIATION |
| `fix/p0-migration-fixture-11` | `d2c4e06156a5` | [#319](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/319) M | MERGED_PR_EXACT_HEAD |
| `fix/p05-ingredient-inventory-integrity` | `47d22402ba8a` | [#320](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/320) M | MERGED_PR_EXACT_HEAD |
| `fix/p051-ingredient-unlock-semantics` | `9e07a3fe1ac1` | [#321](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/321) M | MERGED_PR_EXACT_HEAD |
| `fix/personal-weekly-recommendation` | `3e6f393d2c30` | [#25](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/25) M | MERGED_PR_EXACT_HEAD |
| `fix/recipe-force-rerender` | `6b7ec35ef350` | [#28](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/28) M | MERGED_PR_EXACT_HEAD |
| `fix/update-preview-identity-convergence` | `673cc92ad065` | [#24](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/24) M | MERGED_PR_EXACT_HEAD |
| `fix/v0-3-26-identity-merge-v2` | `0255586685f2` | [#29](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/29) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.12-confirmation-lifecycle-ux` | `c23222db2233` | [#361](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/361) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.13-physical-validation-closure` | `309bbbe459b6` | [#362](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/362) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.14-nickname-guard-bidirectional-review` | `ac60bf58ba72` | [#363](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/363) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.15-platform-identity-doctor-transfer` | `cc6deafdc38f` | [#364](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/364) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.16-existing-baseline-sparse-diff` | `1ccedbf6de10` | [#365](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/365) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.17-review-group-isolation` | `bcc8adce45ac` | [#366](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/366) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.19-manual-draft-querysafe-offline` | `479ed6c91a59` | [#368](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/368) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.20-analysis-ux-flash-lite` | `a2aa7711a80d` | [#369](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/369) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.21-player-evolution-override` | `eefd1350169d` | [#370](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/370) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.22-collapsed-ai-json` | `6e91fed283a3` | [#371](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/371) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.23-player-profile-consistency` | `22df0ed34dcc` | [#372](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/372) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.25-android-byte-snapshot-evidence-binding` | `650c712145f6` | [#374](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/374) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.26-standalone-android-byte-snapshot-closure` | `040f70be3fab` | [#375](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/375) C | CLOSED_UNMERGED_PR_ONLY |
| `fix/v0.4.27.26-standalone-android-byte-snapshot-closure-clean` | `84388e9543d1` | [#376](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/376) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.27-review-berry-group-authority` | `f03fcce6067a` | [#377](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/377) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.28-per-image-target-wiring-recovery` | `dc9b15953a02` | [#378](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/378) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.29-review-first-render-projection-authority` | `bb7bfc49c795` | [#379](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/379) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.30-confirmation-json-mobile-closure` | `f96be2dffce2` | [#380](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/380) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.31-dom-observer-reentrancy-closure` | `4630681d1d52` | [#381](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/381) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.31-single-pass-batch-runtime-closure` | `95c11b79938e` | — | NO_PR_ASSOCIATION |
| `fix/v0.4.27.32-confirmation-first-render-watchdog-closure` | `672008efee2a` | [#382](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/382) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.33-group-coherence-closure` | `190c8b5baed2` | [#383](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/383) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.34-revision-bound-target-context` | `b629862d14c4` | [#384](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/384) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.35-explicit-per-image-ai-context` | `466831caf354` | [#385](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/385) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.36-per-image-identity-projection-isolation` | `ee2ecf81816d` | [#386](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/386) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.37-explicit-manual-draft-save` | `c141120c93ae` | [#387](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/387) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.38-authoritative-draft-navigation` | `1191dd7130b6` | [#388](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/388) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.39-single-confirmation-authority` | `e128139bd7f9` | [#389](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/389) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.40-review-session-authority-partial-merge` | `30c3d529b22b` | [#390](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/390) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.41-single-multicapture-runtime-authority` | `827cc1cd6c09` | [#391](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/391) M | MERGED_PR_EXACT_HEAD |
| `fix/v0.4.27.42-manual-save-authority-promotion` | `b7204dfddd69` | [#392](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/392) M | MERGED_PR_EXACT_HEAD |
| `fix/v0351-device-validation-ocr-ai-flow` | `389c49a47f5a` | [#80](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/80) M | MERGED_PR_EXACT_HEAD |
| `fix/v0354-preview-scroll-and-ocr-precision` | `e966c71ec55f` | [#82](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/82) M | MERGED_PR_EXACT_HEAD |
| `fix/v0358-ocr-export-summary-consistency` | `fe3a8f9a299d` | [#86](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/86) M | MERGED_PR_EXACT_HEAD |
| `fix/v0360-ocr-runtime-hardening` | `ce1b64c5f8e2` | [#88](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/88) M | MERGED_PR_EXACT_HEAD |
| `fix/v0361-ocr-main-thread-isolation-secret-redaction` | `394a9d37e53b` | [#89](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/89) M | MERGED_PR_EXACT_HEAD |
| `fix/v0362-duplicate-only-finalize-isolation` | `52fa7fce9a4f` | [#90](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/90) M | MERGED_PR_EXACT_HEAD |
| `fix/v0363-finalize-nonblocking-workbench` | `fc40e93774ca` | [#91](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/91) M | MERGED_PR_EXACT_HEAD |
| `fix/v0364-region-ai-review-deferred` | `4aee7f504be9` | [#92](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/92) M | MERGED_PR_EXACT_HEAD |
| `fix/v0365-lightweight-ai-review-export-feedback` | `eafeffe73a1c` | [#93](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/93) M | MERGED_PR_EXACT_HEAD |
| `fix/v0366-sequential-advanced-ai-review` | `eea683afde53` | [#94](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/94) M | MERGED_PR_EXACT_HEAD |
| `fix/v0367-single-item-review-bootstrap` | `2db32e7fad1f` | [#95](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/95) M | MERGED_PR_EXACT_HEAD |
| `fix/v0368-android-raf-timeout-fallback` | `e2f6bc9a7d44` | [#96](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/96) M | MERGED_PR_EXACT_HEAD |
| `fix/v0369-direct-minimal-review` | `e748b40613cb` | [#98](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/98) M | MERGED_PR_EXACT_HEAD |
| `fix/v0369-single-item-minimal-core` | `a1794110f828` | [#97](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/97) M | MERGED_PR_EXACT_HEAD |
| `fix/v0370-live-debug-deferred-render` | `83034df5e4f2` | [#99](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/99) M | MERGED_PR_EXACT_HEAD |
| `fix/v0371-ultra-minimal-ai-shell` | `e36d68439127` | [#100](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/100) M | MERGED_PR_EXACT_HEAD |
| `fix/v0379-public-catalog-main-renderer` | `0a233db4d3ed` | [#112](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/112) M | MERGED_PR_EXACT_HEAD |
| `fix/v0380-single-knowledge-authority` | `9d29a4b2daaa` | [#115](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/115) M | MERGED_PR_EXACT_HEAD |
| `fix/v0394-historical-workflow-closure` | `100aa1cdc374` | [#137](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/137) M | MERGED_PR_EXACT_HEAD |
| `fix/v0394-pages-deploy-retry` | `f52d95ffa8c1` | [#139](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/139) M | MERGED_PR_EXACT_HEAD |
| `fix/v0394-pages-postmerge-closure` | `c9af90c08479` | [#138](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/138) M | MERGED_PR_EXACT_HEAD |
| `fix/v0395-standard-catalog-schema-and-first-entry` | `284e9c609277` | [#142](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/142) M | MERGED_PR_EXACT_HEAD |
| `fix/v0398-update-center-multiscenario-dryrun-state` | `3bca9ceb9ee8` | [#147](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/147) M | MERGED_PR_EXACT_HEAD |
| `fix/v0426-g75e3a-semantic-boundary-closure` | `dea6e61b2de8` | [#282](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/282) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427-direct-observation-display-vocabulary` | `8f9332133e05` | [#315](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/315) M | MERGED_PR_EXACT_HEAD |
| `fix/v0483-houndour-camp-mobile-containment` | `af1f8a5d5ae3` | [#210](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/210) M | MERGED_PR_EXACT_HEAD |
| `fix/v0484-touch-first-camp-containment` | `9fa3a42bab35` | [#211](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/211) M | MERGED_PR_EXACT_HEAD |
| `fix/v0485-compact-camp-table-density` | `7382c6b5b642` | [#212](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/212) M | MERGED_PR_EXACT_HEAD |
| `fix/v03751-version-authority-hotfix` | `7ee4b8d4b4e5` | [#105](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/105) M | MERGED_PR_EXACT_HEAD |
| `fix/v03781-public-pages-empty-profile` | `8fb141bbbd73` | [#109](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/109) M | MERGED_PR_EXACT_HEAD |
| `fix/v03952-public-item-authority-render-queue` | `8d81f7271144` | [#143](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/143) M | MERGED_PR_EXACT_HEAD |
| `fix/v03971-pending-audit-and-recipe-status-json` | `3137cca3cb2b` | — | NO_PR_ASSOCIATION |
| `fix/v03981-confirmation-dryrun-handshake` | `e9eed7834a84` | [#148](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/148) M | MERGED_PR_EXACT_HEAD |
| `fix/v03982-mobile-review-preview-ux` | `2112b6c94e6f` | [#149](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/149) M | MERGED_PR_EXACT_HEAD |
| `fix/v03982-update-center-mobile-review-ux` | `bd401709abe9` | — | NO_PR_ASSOCIATION |
| `fix/v03991-review-dryrun-canonical-state` | `dc98ca85d2b8` | [#151](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/151) M | MERGED_PR_EXACT_HEAD |
| `fix/v03994-mobile-validation-hotfix` | `11591e0eb736` | [#154](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/154) M | MERGED_PR_EXACT_HEAD |
| `fix/v04113-weekly-recipe-semantic-safety` | `d1944eabe0a9` | [#234](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/234) M | MERGED_PR_EXACT_HEAD |
| `fix/v04113-weekly-recipe-semantic-safety-copy` | `cd777e66c65c` | — | NO_PR_ASSOCIATION |
| `fix/v04114-recipe-zh-tw-diagnostic-export` | `c1baace24636` | [#236](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/236) M | MERGED_PR_EXACT_HEAD |
| `fix/v04251-recipe-current-authority-lock` | `0304935519ca` | [#277](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/277) M | MERGED_PR_EXACT_HEAD |
| `fix/v04273-main-ci-calendar-residual` | `f680d6959964` | [#331](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/331) M | MERGED_PR_EXACT_HEAD |
| `fix/v04273-weekly-recipe-semantic-intake` | `78569e923dbb` | [#330](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/330) M | MERGED_PR_EXACT_HEAD |
| `fix/v04274-live-s2-s4-hotfix` | `228237b667f0` | [#332](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/332) M | MERGED_PR_EXACT_HEAD |
| `fix/v04274-main-favorite-berry-alias` | `4b0503d33808` | [#333](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/333) M | MERGED_PR_EXACT_HEAD |
| `fix/v042743-group-bound-review-session-cache` | `fa5b946fb38f` | [#393](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/393) M | MERGED_PR_EXACT_HEAD |
| `fix/v042744-deferred-session-authority-and-berry-guard` | `896b5879b87c` | [#394](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/394) M | MERGED_PR_EXACT_HEAD |
| `fix/v042748-explicit-zero-confirmation` | `89f0265de9b0` | [#398](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/398) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755-p0b6-growlithe-candy-display-authority` | `6996c619b4b5` | [#414](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/414) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755-p0b6-local-admission-family-display-fallback` | `dcaa821454bb` | [#419](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/419) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755-ucimg-gemini-compact-schema` | `f0384a7a1c2d` | [#421](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/421) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427551-visible-target-count-confirmation` | `bef28c0dd4bf` | [#424](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/424) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427552-local-gap-field-precedence` | `699da58ce4a2` | [#425](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/425) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553-mobile-snapshot-candy-ui-performance` | `59dfd35f773a` | [#426](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/426) M | MERGED_PR_EXACT_HEAD |
| `fix/v04275531-startup-idb-sw-timeout` | `7319967047ae` | [#427](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/427) M | MERGED_PR_EXACT_HEAD |
| `fix/v04275532-page-aware-static-shell` | `bf6e8f00e8f4` | [#428](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/428) M | MERGED_PR_EXACT_HEAD |
| `fix/v04275532-release-authority` | `317af2a7ac33` | [#429](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/429) C | CLOSED_UNMERGED_PR_ONLY |
| `fix/v04275532-release-version-authority` | `a29637fe4ec7` | [#432](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/432) M | MERGED_PR_EXACT_HEAD |
| `fix/v04275532-version-authority` | `289cce150fe0` | [#430](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/430) C | CLOSED_UNMERGED_PR_ONLY |
| `fix/v04275532-version-authority-closure` | `b8363fa43eb7` | [#431](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/431) C | CLOSED_UNMERGED_PR_ONLY |
| `fix/v04275533-page-hydration-authority` | `398f92bfc8e3` | [#435](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/435) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755321-readiness-rescue-race` | `5244f3a8bd86` | [#433](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/433) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755331-page-prewarm-collapsible-hydration` | `af8af4297072` | [#436](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/436) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755332-ai-key-update-status-knowledge-host` | `a3bc5264d296` | [#437](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/437) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755333-candy-master-progressive-render` | `437c1399dcbb` | [#438](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/438) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755334-page-status-visibility-watchdog` | `9800512c5c58` | [#439](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/439) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755337-g121d-real-device-closure` | `4ff98c32a388` | [#447](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/447) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755338-g121-authority-parity` | `aef99150b96d` | [#448](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/448) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755338-release-authority-closure` | `be31eda5a32b` | [#449](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/449) M | MERGED_PR_EXACT_HEAD |
| `fix/v042755339-duration-berry-visual-authority` | `cda007a98b8a` | [#450](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/450) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553310-postmerge-lineage-restoration` | `4772489fbdb6` | [#453](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/453) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553310-real-device-followup` | `fd136b6f8b0a` | [#452](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/452) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553311-real-device-ucimg-navigation-closure` | `79b8f1dc2e19` | [#454](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/454) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553312-main-p0b2-lineage-closure` | `c8696e01c07d` | — | NO_PR_ASSOCIATION |
| `fix/v0427553312-p0b2-main-ci-lineage-closure` | `c8696e01c07d` | — | NO_PR_ASSOCIATION |
| `fix/v0427553312-p0b2-postmerge-lineage` | `f1df74ae6604` | [#456](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/456) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553312-p0b2-postmerge-lineage-closure` | `c8696e01c07d` | — | NO_PR_ASSOCIATION |
| `fix/v0427553312-p0b2-release-lineage-hotfix` | `c8696e01c07d` | — | NO_PR_ASSOCIATION |
| `fix/v0427553312-weekly-review-navigation-real-device-closure` | `b88d878d4fc4` | [#455](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/455) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553316-personal-recipe-retirement` | `7ec0e26a3127` | [#464](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/464) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553317-weekly-berry-evidence-resolution` | `c82e3dddf28e` | [#466](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/466) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553318-g52-recipe-state-import-hardening` | `ff15701c4214` | [#467](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/467) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553320-unlock-planner-inventory-parity` | `533aa6a8d152` | [#469](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/469) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553321-ingredient-recognition-review-lifecycle` | `d68a8b9e77c1` | [#470](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/470) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553324-mobile-warroom-knowledge-containment` | `31c6b1f88760` | [#491](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/491) M | MERGED_PR_EXACT_HEAD |
| `fix/v0427553325-weekly-pot-capacity-mobile-containment` | `54859d03af58` | [#492](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/492) M | MERGED_PR_EXACT_HEAD |
| `fix/weekly-context-cache-refresh` | `709b70a0f65f` | [#22](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/22) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0.4.13.5-account-capacity-updated-at` | `4772db040594` | [#244](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/244) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0.4.13.6-pot-manual-authority` | `e5f234612539` | [#245](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/245) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0.4.13.7-startup-watchdog-lifecycle` | `18a68443c2f7` | [#247](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/247) C | CLOSED_UNMERGED_PR_ONLY |
| `hotfix/v0.4.17.1-ai-null-score-rendering` | `4953ee24906c` | [#257](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/257) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0.4.22.1-recipe-formula-authority-audit` | `861a8a0b7772` | [#269](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/269) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0382-version-authority` | `5e975b8201d7` | [#120](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/120) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0384-database-catalog-recovery` | `80d8abb2f358` | [#122](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/122) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0385-database-boot-isolation` | `1e7d60938b09` | [#124](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/124) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0387-indexeddb-safe-boot-memory-guard` | `ca9d600dfd2f` | [#126](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/126) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0388-version-authority` | `4dc3eb632600` | [#129](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/129) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0388-zero-sql-rescue` | `075f78f28877` | [#128](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/128) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0389-rescue-catalog-import-recovery` | `56ab2f29e381` | [#130](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/130) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0390-worker-isolated-legacy-sqlite-load` | `211514858161` | [#131](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/131) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0391-worker-lifecycle-race-closure` | `32586ab323bd` | [#132](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/132) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0392-new-user-database-bootstrap-freeze` | `3df6abb52665` | [#133](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/133) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0393-post-migration-startup-isolation` | `365546cbd8f6` | [#134](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/134) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0394-live-version-handoff-and-post-migration-watchdog` | `5e50cca1f529` | [#135](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/135) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0394-postmerge-ci-and-pages-closure` | `b29c501e1693` | [#136](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/136) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0395-canonical-rescue-and-bootstrap-pipeline` | `c814fb7af6a8` | [#140](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/140) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0395-public-berry-contract-gate` | `ead5072bacad` | [#141](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/141) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0427-internal-visual-observation-hardening` | `95f72467f11a` | [#314](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/314) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0431-controlled-selector-search-commit` | `44faeaa44a91` | [#186](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/186) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0432-goal-profile-team-consistency` | `2091c65a56bf` | [#188](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/188) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0461-weekly-context-camp-master-discovery-semantics` | `6df51e7ca650` | [#194](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/194) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0462-weekly-json-robustness-recipe-recommendation` | `926923c206fe` | [#196](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/196) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0463-weekly-ai-type-repair` | `e633c77465af` | [#198](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/198) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0481-live-manual-override-mobile-coverage` | `7d819c9cd88d` | [#207](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/207) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v0491-war3-live-closure-semantic-integrity` | `717dbd6977c6` | [#214](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/214) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v03871-bootstrap-finalize` | `ddc9361caaff` | [#127](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/127) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04001-skill-normalization` | `76c4cdeb6912` | [#156](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/156) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04002-legacy-skill-alias-and-manifest-ux` | `77d6fc92fb71` | [#157](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/157) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04003-canonical-skill-projection-scenario-review` | `f310a6b6b056` | [#158](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/158) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04004-post-apply-state-inventory-summary` | `6b189cf0dc8b` | [#159](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/159) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04111-ucimg-session-timestamp` | `4d8fd9a329b2` | [#230](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/230) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04112-android-eager-image-bytes` | `6df3379f711c` | [#232](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/232) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v04131-data-preservation` | `b62ed56c673c` | [#241](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/241) M | MERGED_PR_EXACT_HEAD |
| `hotfix/v041021-ingredient-key-contract` | `69005a54263b` | [#226](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/226) M | MERGED_PR_EXACT_HEAD |
| `main` | `6b5e2b56216f` | — | MAIN |
| `noop` | `31ef8338e1b6` | — | NO_PR_ASSOCIATION |
| `release/g51-personal-recipe-real-device-closure` | `2a9a2e869dbb` | [#460](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/460) M | MERGED_PR_EXACT_HEAD |
| `release/v0380-runtime-authority` | `e575080c77c5` | [#116](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/116) M | MERGED_PR_EXACT_HEAD |
| `test/data1d1-ocr-overlay-browser-lifecycle-gate` | `fc041f71ddec` | [#79](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/79) M | MERGED_PR_EXACT_HEAD |
| `test/g9r-20261026-verified-offline-phase-preflight` | `c74ed0e5db1a` | [#493](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/493) M | MERGED_PR_EXACT_HEAD |
| `test/g9r-data-only-sqlite-lastgood-runtime-replay` | `5473f6440386` | [#475](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/475) M | MERGED_PR_EXACT_HEAD |
| `test/g141-restore-manifest-receipt-parity-gate` | `2a9709462654` | [#483](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/483) M | MERGED_PR_EXACT_HEAD |
| `test/g141-startup-progress-elapsed-synthetic-20261014` | `f59ead2a8a5a` | — | NO_PR_ASSOCIATION |
| `test/g295-current-watchdog-lifecycle-replay-20261023` | `6b5e2b56216f` | — | NO_PR_ASSOCIATION |
| `test/g479-firstboot-catalog-recovery-metadata-fixture` | `034889749649` | [#487](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/487) M | MERGED_PR_EXACT_HEAD |
| `test/g479-sw-http-response-replay-20261016` | `b496dd085d47` | [#489](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/489) M | MERGED_PR_EXACT_HEAD |
| `test/g479-sw-network-first-transient-fixture` | `56077b971b29` | — | NO_PR_ASSOCIATION |
| `test/tech-1-regression-gate` | `62b2bd4036a9` | [#15](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/15) M | MERGED_PR_EXACT_HEAD |
| `tmp-noop` | `f0e8059549fa` | — | NO_PR_ASSOCIATION |
| `v0.4.1-evolution-master-coverage-completion` | `e38cd0e85043` | [#161](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/161) M | MERGED_PR_EXACT_HEAD |
| `validation/v0384-postpatch` | `6bcf7242dcbd` | [#123](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/123) M | MERGED_PR_EXACT_HEAD |
| `work/g14-1-derived-state-authority` | `28dccd75a373` | [#458](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/458) M | MERGED_PR_EXACT_HEAD |

**Branch classification totals:** MERGED_PR_EXACT_HEAD=346; CLOSED_UNMERGED_PR_ONLY=12; NO_PR_ASSOCIATION=35; MAIN=1.

**Branch namespace counts:** agent 42; archive 8; ci 14; codex 3; data 1; docs 10; feat 74; feature 52; fix 135; hotfix 37; main 1; noop 1; release 2; test 10; tmp-noop 1; v0.4.1-evolution-master-coverage-completion 1; validation 1; work 1.

## PR inventory — all 362 historical PRs (none open)

| PR | Title | State | Head branch | Head SHA |
|---|---|---|---|---|
| [#493](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/493) | test(G9R): preflight verified Halloween 10/26 offline phase boundaries; record .25 Owner PASS | MERGED | `test/g9r-20261026-verified-offline-phase-preflight` | `c74ed0e5db1a` |
| [#492](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/492) | G479-R2: contain Weekly Context pot capacity field on mobile (.25) | MERGED | `fix/v0427553325-weekly-pot-capacity-mobile-containment` | `54859d03af58` |
| [#491](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/491) | G479-R: contain War Room and Knowledge mobile overflow (.24) | MERGED | `fix/v0427553324-mobile-warroom-knowledge-containment` | `31c6b1f88760` |
| [#490](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/490) | fix(G479): preserve App Ready / SQLite stage against background SW (.23) | MERGED | `fix/g479-stage-owner-v0427553323-20261017` | `03a44d553165` |
| [#489](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/489) | test(G479): classify synthetic SW HTTP 503 vs network-rejection ESM failures | MERGED | `test/g479-sw-http-response-replay-20261016` | `b496dd085d47` |
| [#488](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/488) | docs: post-#487 22-Issue closure audit + 13-view UI/API/DB authority reconciliation | MERGED | `docs/20261015-canonical-audit-handoff-post487` | `5c58eca2cf41` |
| [#487](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/487) | test(G479): synthetic virgin-install Public Master recovery and restore-stage proof | MERGED | `test/g479-firstboot-catalog-recovery-metadata-fixture` | `034889749649` |
| [#486](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/486) | docs(G14.1): record #485 merged CI + two-phone SHA review vs source-backup parity | MERGED | `docs/g141-20261014-sha-divergence-postmerge-ledger` | `d73f22a5e09d` |
| [#485](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/485) | G14.1: classify old/new phone self-check SHA mismatch without false data-loss | MERGED | `fix/g141-cross-device-selfcheck-sha-divergence` | `925456ec1841` |
| [#484](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/484) | docs(G14.1): close merged parity contract CI; retain owner exact-SHA receipt HOLD | MERGED | `docs/g141-20261014-postmerge-owner-restore-checkpoint` | `84d9c27e2ad6` |
| [#483](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/483) | G14.1: fail-closed cross-device restore metadata parity evidence Gate | MERGED | `test/g141-restore-manifest-receipt-parity-gate` | `2a9709462654` |
| [#481](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/481) | docs: confirm virgin phone cold-schema expected; scope G14.1 old-to-new restore Gate | MERGED | `docs/g9r-20261014-new-phone-virgin-schema-clarification` | `0a4714bf896f` |
| [#480](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/480) | docs(G9R): Android Halloween Master-version PARTIAL PASS and startup incident #479 | MERGED | `docs/g9r-20261014-owner-partial-pass-startup-triage` | `f6de207dca5f` |
| [#478](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/478) | docs: reconcile official Halloween 2026 G9-R DATA-ONLY main CI/Pages to living baseline | MERGED | `docs/g9r-20261014-halloween-live-data-checkpoint` | `04877dda8b83` |
| [#477](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/477) | G9-R: 2026 Halloween OFFICIAL camp-scoped 04:00 ×2/×3 candy Public Master DATA-ONLY | MERGED | `data/g9r-halloween2026-official-scoped-phase-candy` | `6ac569d4f59a` |
| [#476](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/476) | docs: close G9-R sub-Gate ledger on merged #474/#475, retain real-owner HOLD | MERGED | `docs/g9r-20261013-post-merge-runtime-baseline` | `cbca104171ab` |
| [#475](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/475) | G9-R: run real .22 event refresh against synthetic new-SHA/offline SQLite fault model | MERGED | `test/g9r-data-only-sqlite-lastgood-runtime-replay` | `5473f6440386` |
| [#474](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/474) | G9-R: governed source-verified append-only DATA-ONLY PR admission | MERGED | `feat/g9r-data-only-append-only-pr-gate` | `fd46613fbe3a` |
| [#473](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/473) | docs: adopt dual living Roadmap and UI/API/DB baselines for every Gate | MERGED | `docs/20261013-canonical-roadmap-and-architecture-baseline` | `4cb7ec9bf04c` |
| [#472](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/472) | G9-R: synthetic future data-only replay, unknown official bonus HOLD, .22 authority reconciliation | MERGED | `fix/g9r-synthetic-data-only-replay-and-unknown-bonus-hold` | `4f75a8d3c929` |
| [#471](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/471) | feat(G9-R .22): repair PWA event feed cache and stage verified official auto-refresh | MERGED | `feat/g9r-official-event-data-feed` | `f0c7212b77c5` |
| [#470](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/470) | fix: reconcile ingredient recognition review and add explicit weekly bonuses (.21) | MERGED | `fix/v0427553321-ingredient-recognition-review-lifecycle` | `d68a8b9e77c1` |
| [#469](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/469) | fix: recipe-first unlock planning and ingredient inventory parity (.20) | MERGED | `fix/v0427553320-unlock-planner-inventory-parity` | `533aa6a8d152` |
| [#468](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/468) | feat: add local recipe attempt feedback and recommendation pause | MERGED | `feature/v0427553319-g62-recipe-attempt-feedback` | `7d8eb70cdfe5` |
| [#467](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/467) | fix: harden canonical recipe state import in .18 | MERGED | `fix/v0427553318-g52-recipe-state-import-hardening` | `ff15701c4214` |
| [#466](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/466) | fix: weekly multi-image berry evidence resolution in .17 | MERGED | `fix/v0427553317-weekly-berry-evidence-resolution` | `c82e3dddf28e` |
| [#464](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/464) | fix: retire legacy personal recipe surface in .16 | MERGED | `fix/v0427553316-personal-recipe-retirement` | `7ec0e26a3127` |
| [#463](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/463) | refactor: canonical recipe state cleanup and Advanced OCR anchor | MERGED | `fix/g51-owner-validation-ui-followup` | `6ee18253eea4` |
| [#460](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/460) | release: G5.1 personal recipe real-device closure | MERGED | `release/g51-personal-recipe-real-device-closure` | `2a9a2e869dbb` |
| [#459](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/459) | feat: G5.1 personal recipe CRUD and editor | MERGED | `feat/g51-personal-recipe-system` | `7b8d1d3874a0` |
| [#458](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/458) | feat: .55.3.3.13 G14.1 derived unlock state authority | MERGED | `work/g14-1-derived-state-authority` | `28dccd75a373` |
| [#456](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/456) | fix: .55.3.3.12 P0-B2 post-merge lineage closure | MERGED | `fix/v0427553312-p0b2-postmerge-lineage` | `f1df74ae6604` |
| [#455](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/455) | fix: .55.3.3.12 weekly review and navigation real-device closure | MERGED | `fix/v0427553312-weekly-review-navigation-real-device-closure` | `b88d878d4fc4` |
| [#454](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/454) | fix: .55.3.3.11 UC.IMG-A real-device closure | MERGED | `fix/v0427553311-real-device-ucimg-navigation-closure` | `79b8f1dc2e19` |
| [#453](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/453) | fix: restore .55.3.3.10 post-merge predecessor lineage | MERGED | `fix/v0427553310-postmerge-lineage-restoration` | `4772489fbdb6` |
| [#452](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/452) | fix: .55.3.3.10 real-device follow-up closure | MERGED | `fix/v0427553310-real-device-followup` | `fd136b6f8b0a` |
| [#450](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/450) | fix: .55.3.3.9 duration + UC.IMG-A berry visual authority | MERGED | `fix/v042755339-duration-berry-visual-authority` | `cda007a98b8a` |
| [#449](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/449) | fix: .55.3.3.8 release authority closure | MERGED | `fix/v042755338-release-authority-closure` | `be31eda5a32b` |
| [#448](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/448) | fix: G12.1 .55.3.3.8 authority parity real-device closure | MERGED | `fix/v042755338-g121-authority-parity` | `aef99150b96d` |
| [#447](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/447) | fix: .55.3.3.7 G12.1D/E real-device closure | MERGED | `fix/v042755337-g121d-real-device-closure` | `4ff98c32a388` |
| [#446](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/446) | G12.1D: deterministic evolution recommendation UI | MERGED | `feat/g121d-evolution-recommendation-ui` | `3b919f86f221` |
| [#445](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/445) | G12.1C: explainable deterministic evolution recommendation | MERGED | `feat/g121c-explainable-evolution-recommendation` | `2e0d9cb08674` |
| [#444](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/444) | G12.1B: deterministic evolution status read API | MERGED | `feat/g121b-status-read-api` | `67af52409efb` |
| [#443](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/443) | G12.1B: schema-safe deterministic status read adapter | MERGED | `feat/g121b-schema-safe-read-adapter` | `6267927f52e7` |
| [#442](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/442) | G12.1B: deterministic evolution-status engine | MERGED | `feat/g121b-deterministic-evolution-status` | `d94431c5ceaf` |
| [#441](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/441) | v0.4.27.55.3.3.5: G12.1A authority closure | MERGED | `feat/g121a-authority-closure` | `0c41aa5baa7b` |
| [#440](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/440) | G12.1A: freeze evolution/resource readiness audit | MERGED | `feat/g121a-readiness-audit` | `7bddd29a7038` |
| [#439](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/439) | v0.4.27.55.3.3.4: close stale page status and mobile watchdog false positives | MERGED | `fix/v042755334-page-status-visibility-watchdog` | `9800512c5c58` |
| [#438](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/438) | v0.4.27.55.3.3.3: progressive Candy Master loading | MERGED | `fix/v042755333-candy-master-progressive-render` | `437c1399dcbb` |
| [#437](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/437) | v0.4.27.55.3.3.2: Gemini Key Restore / Update Status / Knowledge Host | MERGED | `fix/v042755332-ai-key-update-status-knowledge-host` | `a3bc5264d296` |
| [#436](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/436) | v0.4.27.55.3.3.1: Page Data Prewarm / Collapsible Hydration Closure | MERGED | `fix/v042755331-page-prewarm-collapsible-hydration` | `af8af4297072` |
| [#435](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/435) | v0.4.27.55.3.3: Page Hydration Authority / Single-Owner Render Closure | MERGED | `fix/v04275533-page-hydration-authority` | `398f92bfc8e3` |
| [#434](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/434) | v0.4.27.55.3.3: Page Hydration Authority / Single-Owner Render Closure | CLOSED_NOT_MERGED | `feature/v04275533-page-hydration-authority` | `def3ce00815b` |
| [#433](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/433) | v0.4.27.55.3.2: preserve explicit safe-boot rescue browser contract | MERGED | `fix/v042755321-readiness-rescue-race` | `5244f3a8bd86` |
| [#432](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/432) | v0.4.27.55.3.2: publish live release version authority | MERGED | `fix/v04275532-release-version-authority` | `a29637fe4ec7` |
| [#431](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/431) | v0.4.27.55.3.2: close release version authority | CLOSED_NOT_MERGED | `fix/v04275532-version-authority-closure` | `b8363fa43eb7` |
| [#430](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/430) | v0.4.27.55.3.2: promote final release version authority | CLOSED_NOT_MERGED | `fix/v04275532-version-authority` | `289cce150fe0` |
| [#429](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/429) | v0.4.27.55.3.2: publish release authority | CLOSED_NOT_MERGED | `fix/v04275532-release-authority` | `317af2a7ac33` |
| [#428](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/428) | v0.4.27.55.3.2: page-aware UI loading and static-shell latency hotfix | MERGED | `fix/v04275532-page-aware-static-shell` | `bf6e8f00e8f4` |
| [#427](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/427) | v0.4.27.55.3.1: startup IndexedDB / Service Worker reliability hotfix | MERGED | `fix/v04275531-startup-idb-sw-timeout` | `7319967047ae` |
| [#426](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/426) | v0.4.27.55.3: mobile snapshot and Candy UI performance hotfix | MERGED | `fix/v0427553-mobile-snapshot-candy-ui-performance` | `59dfd35f773a` |
| [#425](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/425) | v0.4.27.55.2: durable local Candy authority and field precedence | MERGED | `fix/v0427552-local-gap-field-precedence` | `699da58ce4a2` |
| [#424](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/424) | v0.4.27.55.1: explicit Candy visible target count confirmation | MERGED | `fix/v0427551-visible-target-count-confirmation` | `bef28c0dd4bf` |
| [#421](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/421) | Issue #420: compact UC.IMG Gemini provider schema | MERGED | `fix/v042755-ucimg-gemini-compact-schema` | `f0384a7a1c2d` |
| [#419](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/419) | v0.4.27.55 P0-B6 systemic local Candy admission family/display fallback | MERGED | `fix/v042755-p0b6-local-admission-family-display-fallback` | `dcaa821454bb` |
| [#414](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/414) | v0.4.27.55 P0-B6 Growlithe Candy display authority hotfix | MERGED | `fix/v042755-p0b6-growlithe-candy-display-authority` | `6996c619b4b5` |
| [#410](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/410) | v0.4.27.55 P0-B6 Candy mixed-timezone chronology hotfix | MERGED | `codex/v042755-p0b6-candy-timezone-order-hotfix` | `e7784169ab58` |
| [#409](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/409) | v0.4.27.55 P0-B6 real-device Candy authority hotfix | MERGED | `codex/v042755-p0b6-real-device-candy-authority-hotfix` | `ae9ce8e78972` |
| [#408](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/408) | v0.4.27.55 P0-B6 Candy family storage reconciliation | MERGED | `codex/v042755-p0b6-candy-family-storage-reconciliation` | `5b193c95dc0e` |
| [#407](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/407) | v0.4.27.54 P0-B5 In-Game Candy Master Promotion | MERGED | `feat/v042754-p0b5-ingame-candy-master-promotion` | `87b3c0dab85c` |
| [#406](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/406) | v0.4.27.53 P0-B5 canonical-key + direct Candy admission replay | MERGED | `feat/v042753-p0b5-canonical-key-gap-admission-replay` | `949efed95d0d` |
| [#405](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/405) | v0.4.27.53 P0-B5 canonical-key + gap admission/replay | CLOSED_NOT_MERGED | `feat/v042753-p0b5-canonical-key-gap-admission-replay` | `7b036642043c` |
| [#404](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/404) | v0.4.27.52 P0-B5 gap / identity / raw-evidence hotfix | MERGED | `feat/v042752-p0b5-gap-identity-hotfix` | `74d069dc2b41` |
| [#403](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/403) | v0.4.27.51 P0-B5 Candy Quantity Human Confirmation Governance | MERGED | `feat/v042751-p0b5-candy-quantity-confirmation-authority` | `8ee0c52a2c75` |
| [#402](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/402) | v0.4.27.50 P0-B4 Candy Display-Name Authority | MERGED | `feat/v042750-p0b4-candy-display-name-authority` | `ee14f57f0545` |
| [#401](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/401) | v0.4.27.50 P0-B4 Candy Display-Name Authority | CLOSED_NOT_MERGED | `feat/v042750-p0b4-candy-display-name-authority` | `ee14f57f0545` |
| [#400](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/400) | v0.4.27.49 P0-B3 Candy Family Authority | MERGED | `feat/v042749-p0-b3-candy-family-authority` | `56a0593ae143` |
| [#399](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/399) | v0.4.27.49 P0-B3 Candy Family Authority | CLOSED_NOT_MERGED | `feat/v042749-p0-b3-candy-family-authority` | `56a0593ae143` |
| [#398](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/398) | fix(p0): reconcile inferred ingredient zero with integrity confirmation | MERGED | `fix/v042748-explicit-zero-confirmation` | `89f0265de9b0` |
| [#397](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/397) | v0.4.27.47 P0-B2 Public Pokémon Species Authority | MERGED | `feat/v042747-p0-b2-public-species-authority` | `d351f5961c61` |
| [#396](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/396) | v0.4.27.46 P0-B1 observed Professor candy authority | MERGED | `feat/v042746-p0b1-professor-candy-observed-authority` | `f527762e8c3c` |
| [#395](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/395) | v0.4.27.45 public reference, evolution semantics, and import history UX | MERGED | `feat/v042745-public-reference-evolution-history-ux` | `0c9a3be2e7e5` |
| [#394](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/394) | v0.4.27.44 deferred review authority and public-relation apply guard | MERGED | `fix/v042744-deferred-session-authority-and-berry-guard` | `896b5879b87c` |
| [#393](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/393) | v0.4.27.43 group-bound review session cache authority | MERGED | `fix/v042743-group-bound-review-session-cache` | `fa5b946fb38f` |
| [#392](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/392) | v0.4.27.42 manual save authority promotion | MERGED | `fix/v0.4.27.42-manual-save-authority-promotion` | `b7204dfddd69` |
| [#391](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/391) | v0.4.27.41 single multicapture runtime authority | MERGED | `fix/v0.4.27.41-single-multicapture-runtime-authority` | `827cc1cd6c09` |
| [#390](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/390) | fix(v0.4.27.40): preserve review session authority and partial merge | MERGED | `fix/v0.4.27.40-review-session-authority-partial-merge` | `30c3d529b22b` |
| [#389](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/389) | fix(v0.4.27.39): enforce single confirmation authority | MERGED | `fix/v0.4.27.39-single-confirmation-authority` | `e128139bd7f9` |
| [#388](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/388) | fix(v0.4.27.38): allow authoritative navigation across system DOM drift | MERGED | `fix/v0.4.27.38-authoritative-draft-navigation` | `1191dd7130b6` |
| [#387](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/387) | fix(v0.4.27.37): require explicit manual draft save authority | MERGED | `fix/v0.4.27.37-explicit-manual-draft-save` | `c141120c93ae` |
| [#386](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/386) | fix(v0.4.27.36): isolate per-image identity projection after AI analysis | MERGED | `fix/v0.4.27.36-per-image-identity-projection-isolation` | `ee2ecf81816d` |
| [#385](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/385) | v0.4.27.35 explicit per-image AI provider context | MERGED | `fix/v0.4.27.35-explicit-per-image-ai-context` | `466831caf354` |
| [#384](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/384) | v0.4.27.34 revision-bound per-image target authority | MERGED | `fix/v0.4.27.34-revision-bound-target-context` | `b629862d14c4` |
| [#383](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/383) | v0.4.27.33 per-image runtime context / group coherence closure | MERGED | `fix/v0.4.27.33-group-coherence-closure` | `190c8b5baed2` |
| [#382](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/382) | v0.4.27.32 confirmation first-render + watchdog closure | MERGED | `fix/v0.4.27.32-confirmation-first-render-watchdog-closure` | `672008efee2a` |
| [#381](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/381) | v0.4.27.31 DOM observer reentrancy closure | MERGED | `fix/v0.4.27.31-dom-observer-reentrancy-closure` | `4630681d1d52` |
| [#380](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/380) | v0.4.27.30 confirmation + terminal JSON mobile closure | MERGED | `fix/v0.4.27.30-confirmation-json-mobile-closure` | `f96be2dffce2` |
| [#379](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/379) | v0.4.27.29 first-render stale overlay authority | MERGED | `fix/v0.4.27.29-review-first-render-projection-authority` | `bb7bfc49c795` |
| [#378](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/378) | v0.4.27.28 Per-image target wiring recovery | MERGED | `fix/v0.4.27.28-per-image-target-wiring-recovery` | `dc9b15953a02` |
| [#377](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/377) | v0.4.27.27 Review berry and group authority hotfix | MERGED | `fix/v0.4.27.27-review-berry-group-authority` | `f03fcce6067a` |
| [#376](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/376) | v0.4.27.26 Standalone Android byte snapshot closure (clean) | MERGED | `fix/v0.4.27.26-standalone-android-byte-snapshot-closure-clean` | `84388e9543d1` |
| [#375](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/375) | v0.4.27.26 Standalone Android byte snapshot closure | CLOSED_NOT_MERGED | `fix/v0.4.27.26-standalone-android-byte-snapshot-closure` | `040f70be3fab` |
| [#374](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/374) | v0.4.27.25 Android byte snapshot evidence binding | MERGED | `fix/v0.4.27.25-android-byte-snapshot-evidence-binding` | `650c712145f6` |
| [#373](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/373) | feat(v0.4.27.24): add E3C-6F censored repeated-window observations | MERGED | `feat/v0.4.27.24-e3c6f-censored-series-observation` | `2b2abc7dc5d0` |
| [#372](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/372) | fix(v0.4.27.23): player profile consistency after Captain Pikachu validation | MERGED | `fix/v0.4.27.23-player-profile-consistency` | `22df0ed34dcc` |
| [#371](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/371) | fix(v0.4.27.22): collapse AI JSON result cards by default | MERGED | `fix/v0.4.27.22-collapsed-ai-json` | `6e91fed283a3` |
| [#370](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/370) | feat(v0.4.27.21): add player evolution override authority | MERGED | `fix/v0.4.27.21-player-evolution-override` | `eefd1350169d` |
| [#369](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/369) | feat(v0.4.27.20): lock analysis UX and standardize Flash-Lite default | MERGED | `fix/v0.4.27.20-analysis-ux-flash-lite` | `a2aa7711a80d` |
| [#368](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/368) | fix(v0.4.27.19): persist manual review drafts and repair offline modules | MERGED | `fix/v0.4.27.19-manual-draft-querysafe-offline` | `479ed6c91a59` |
| [#367](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/367) | feat(v0.4.27.18): per-image target assignment and immutable review group authority | MERGED | `feat/v0.4.27.18-per-image-target-group-authority` | `875961e4de7a` |
| [#366](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/366) | fix(v0.4.27.17): bind review snapshots to rendered group | MERGED | `fix/v0.4.27.17-review-group-isolation` | `bcc8adce45ac` |
| [#365](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/365) | fix(v0.4.27.16): existing baseline sparse diff and review sync | MERGED | `fix/v0.4.27.16-existing-baseline-sparse-diff` | `1ccedbf6de10` |
| [#364](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/364) | feat(v0.4.27.15): platform identity authority and professor transfer | MERGED | `fix/v0.4.27.15-platform-identity-doctor-transfer` | `cc6deafdc38f` |
| [#363](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/363) | fix(v0.4.27.14): fail-close nickname inference and add previous review navigation | MERGED | `fix/v0.4.27.14-nickname-guard-bidirectional-review` | `ac60bf58ba72` |
| [#362](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/362) | fix(v0.4.27.13): close Android physical validation gaps | MERGED | `fix/v0.4.27.13-physical-validation-closure` | `309bbbe459b6` |
| [#361](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/361) | fix(v0.4.27.12): isolate confirmation lifecycle and expose model failover | MERGED | `fix/v0.4.27.12-confirmation-lifecycle-ux` | `c23222db2233` |
| [#360](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/360) | fix(v0.4.27.12): isolate confirmation lifecycle and surface model failover | CLOSED_NOT_MERGED | `agent/v042712-confirmation-lifecycle-model-status-ux` | `ef7360ea7853` |
| [#359](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/359) | fix(v0.4.27.12): close mobile analysis confirmation UX gaps | CLOSED_NOT_MERGED | `agent/v042712-live-validation-ux-hotfix` | `eaed5c175aef` |
| [#358](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/358) | fix(v0.4.27.11): preserve budget for healthy model fallback | MERGED | `agent/v042711-model-health-fallback-persistence` | `b629324fed1e` |
| [#357](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/357) | fix(v0.4.27.10): bound AI startup and hydrate public review fields | MERGED | `agent/v042710-ai-startup-timeout-public-hydration` | `7e1054545f54` |
| [#356](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/356) | fix(v0.4.27.9): repair multicapture confirmation authority | MERGED | `agent/v04279-confirmation-multicapture-authority-hotfix` | `acfc11545d96` |
| [#355](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/355) | fix(v0.4.27.8): harden AI failover and hydrate evolution confirmation | MERGED | `agent/v04278-evolution-master-ai-resilience-confirmation` | `01c1ad789b33` |
| [#354](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/354) | fix(G13): enforce structured Gemini output and current-file progress | MERGED | `agent/v04277-structured-gemini-current-file-ux` | `6a247f205834` |
| [#353](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/353) | fix(G13): align internal Gemini with Observation v2 and local progress UX | MERGED | `agent/v04276-internal-observation-parity-progress-ux` | `05a6f75c2513` |
| [#352](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/352) | fix(E3C-6E): precache first-party observation runtime closure | MERGED | `agent/e3c6e-first-party-observation-pwa-offline` | `9aaf1306b73e` |
| [#351](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/351) | feat(E3C-6D): expose bias-safe multislot first-party capture UI | MERGED | `agent/e3c6d-multislot-mobile-ui` | `c79203af142e` |
| [#350](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/350) | feat(E3C-6C): support bias-safe equal-quantity multi-slot observations | MERGED | `agent/e3c6c-multislot-unique-event-reconstruction` | `2636645e36c7` |
| [#349](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/349) | fix(E3C-7C6): resolve historical recorded dataset scope | MERGED | `agent/e3c7c7-recorded-dataset-scope-resolution` | `202845fb9733` |
| [#348](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/348) | fix(ci): fall back to authenticated GitHub Contents API for pinned evidence | MERGED | `agent/pinned-evidence-github-api-fallback-hotfix` | `6bb493a40ea5` |
| [#347](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/347) | fix(ci): make pinned evidence fetch resilient to GitHub 429 | MERGED | `agent/pinned-evidence-fetch-429-hotfix` | `f5e13e6b9554` |
| [#346](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/346) | feat(E3C-7C6): add recorded dataset resolution evidence pack | MERGED | `agent/e3c7c6-recorded-dataset-resolution-pack` | `c758d94f9ac9` |
| [#345](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/345) | feat(E3C-7C5): add independent candidate intake gate | MERGED | `agent/e3c7c5-independent-candidate-intake-gate` | `2139e298355c` |
| [#344](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/344) | feat(E3C-7C4): add independent candidate discovery register | MERGED | `agent/e3c7c4-independent-candidate-discovery-register` | `c472ddab2910` |
| [#343](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/343) | feat(E3C-7C3): audit RP-fit as review-required independent candidate | MERGED | `agent/e3c7c3-independent-candidate-discovery-audit` | `226b4598d40a` |
| [#342](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/342) | fix(E3C-7C2): reconcile independent source lineage readiness | MERGED | `agent/e3c7c2-independent-source-lineage-reconciliation` | `9b8cdc324661` |
| [#341](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/341) | feat(E3C-7C1): add deidentified sufficiency evidence pack | MERGED | `agent/e3c7c1-sufficiency-evidence-pack` | `3c3ef4cd2f0c` |
| [#340](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/340) | feat(E3C-7B): show local Ingredient Probability readiness in G7.5 | MERGED | `agent/e3c7b-local-readiness-ui` | `df71494ee57d` |
| [#339](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/339) | feat(E3C-7A): add Ingredient Probability statistical readiness audit | MERGED | `agent/e3c7-ingredient-probability-statistical-readiness` | `258a1a72dba8` |
| [#338](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/338) | fix(v0.4.27.5): block legacy event multiplier in G7.2 | MERGED | `agent/v04275-g72-effective-event-effects-hotfix` | `e9a85a768f9b` |
| [#337](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/337) | fix(v0.4.27.5): align War Room banner with Public Event authority | MERGED | `agent/v04275-pe4-war-room-effective-context-banner` | `e63999542a39` |
| [#336](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/336) | fix(v0.4.27.5): export Public Event provenance to Strategy Pack | MERGED | `agent/v04275-pe6-strategy-event-provenance` | `7904eac77749` |
| [#335](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/335) | fix(v0.4.27.5): hide legacy weekly event observations after Public Event split | MERGED | `agent/v04275-pe7-legacy-event-ui-hotfix` | `617e0294e922` |
| [#334](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/334) | feat(v0.4.27.5): split Public Event Master from Player Weekly Context | MERGED | `agent/v04275-public-event-master` | `352761b147e3` |
| [#333](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/333) | fix(v0.4.27.4): canonicalize legacy berry alias in favorite multiplier | MERGED | `fix/v04274-main-favorite-berry-alias` | `4b0503d33808` |
| [#332](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/332) | fix(v0.4.27.4): close live S2 S3 S4 regressions | MERGED | `fix/v04274-live-s2-s4-hotfix` | `228237b667f0` |
| [#331](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/331) | test(v0.4.27.3): fix UC.IMG current-week CI residual | MERGED | `fix/v04273-main-ci-calendar-residual` | `f680d6959964` |
| [#330](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/330) | fix(v0.4.27.3): correct Grepa berry and screenshot semantic intake | MERGED | `fix/v04273-weekly-recipe-semantic-intake` | `78569e923dbb` |
| [#329](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/329) | ci(p8): retire eight safety-boundary predecessor workflows | MERGED | `ci/p8b-retire-safety-boundaries` | `d35f13066809` |
| [#328](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/328) | ci(p8): prove safety-boundary side-by-side parity | MERGED | `ci/p8a-safety-boundary-parity` | `9e000d2a989e` |
| [#327](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/327) | ci(p7): retire four recipe authority wrappers | MERGED | `ci/p7b-retire-recipe-wrappers` | `61ec5eaa397b` |
| [#326](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/326) | ci(p7): prove recipe authority domain-runner parity | MERGED | `ci/p7a-recipe-regression-parity` | `e872fe42692f` |
| [#325](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/325) | ci(p6b): retire three screenshot domain workflows | MERGED | `ci/p6b2-retire-screenshot-domain-runners` | `2360767a03c9` |
| [#324](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/324) | ci(p6b): prove consolidated screenshot pipeline parity | MERGED | `ci/p6b1-screenshot-pipeline-parity` | `807191569ad2` |
| [#323](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/323) | ci(p6a): retire four v0.4.13 screenshot wrappers | MERGED | `ci/p6a2-retire-v0413-wrappers` | `2e2f0da0b153` |
| [#322](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/322) | ci(p6a): prove UC.IMG wrapper side-by-side parity | MERGED | `ci/p6a1-ucimg-wrapper-parity` | `1876a56f9214` |
| [#321](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/321) | fix(inventory): separate ingredient unlock state from zero quantity | MERGED | `fix/p051-ingredient-unlock-semantics` | `9e07a3fe1ac1` |
| [#320](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/320) | fix(inventory): canonical avocado migration and complete-capture zero reconciliation | MERGED | `fix/p05-ingredient-inventory-integrity` | `47d22402ba8a` |
| [#319](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/319) | fix(ci): accept E3C-6B migration 11 in regression fixtures | MERGED | `fix/p0-migration-fixture-11` | `d2c4e06156a5` |
| [#318](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/318) | feat(e3c6b): capture first-party ingredient help observations | MERGED | `feat/e3c6b-first-party-ingredient-observation-capture` | `8e4b2cf53fbb` |
| [#317](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/317) | ci(p5): retire parity-proven core/update/public wrappers | MERGED | `ci/p5-retire-core-update-public-wrappers` | `1e65cada1a4e` |
| [#316](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/316) | ci(p5): establish core/update/public wrapper parity | MERGED | `ci/p5-core-update-public-parity` | `00d1a3920e79` |
| [#315](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/315) | fix(evidence): accept direct in-game display labels | MERGED | `fix/v0427-direct-observation-display-vocabulary` | `8f9332133e05` |
| [#314](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/314) | fix(evidence): harden partial visibility and fresh 75 re-audit | MERGED | `hotfix/v0427-internal-visual-observation-hardening` | `95f72467f11a` |
| [#312](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/312) | feat(prompt): harden internal and external screenshot evidence prompts | MERGED | `feature/visual-prompt-hallucination-hardening` | `cb431d71b4c5` |
| [#311](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/311) | feat(master): govern public species ingredient candidates | MERGED | `feature/species-ingredient-candidate-authority` | `5e4d92ea9698` |
| [#310](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/310) | feat(evidence): add Pokémon visual evidence consistency contract | MERGED | `feature/pokemon-visual-evidence-consistency-contract` | `a5aa0174eb73` |
| [#309](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/309) | ci: enforce permanent CI topology governance | MERGED | `ci/p4-topology-governance` | `5a6d2cd14e14` |
| [#308](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/308) | ci: consolidate DATA.1D.1 G13 and War Room regressions | MERGED | `ci/p3-data-g13-war-consolidation` | `ffd6d389b48d` |
| [#307](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/307) | ci: consolidate legacy runtime and PWA regression | MERGED | `ci/p2-legacy-runtime-regression` | `f846d1fc5457` |
| [#306](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/306) | ci: consolidate Production evidence regression | MERGED | `ci/p1-production-evidence-regression` | `a1e4bf15f9a2` |
| [#294](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/294) | feat(pokemon): filter roster by unlocked berry ingredient and skills | MERGED | `agent/pokemon-roster-unlocked-filters` | `cd7dd4ae52ea` |
| [#293](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/293) | test(production): gate first-party ingredient help observations | MERGED | `feature/v0428-g75e3c6-first-party-observation` | `e8491c96a6e8` |
| [#292](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/292) | test(production): reject overlapping probability source lineages | MERGED | `feature/v0428-g75e3c5-source-lineage-review` | `9b06f573f880` |
| [#291](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/291) | test(production): govern independent probability snapshot intake | MERGED | `feature/v0428-g75e3c4b-independent-snapshot-intake-clean` | `2d4f3b72f1b5` |
| [#290](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/290) | test(production): govern independent probability snapshot intake | CLOSED_NOT_MERGED | `feature/v0428-g75e3c4b-independent-snapshot-intake` | `4261a3005cc5` |
| [#289](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/289) | test(production): require reviewed independence before source admission | MERGED | `feature/v0428-g75e3c4a-independent-source-admission` | `310b5378ac8b` |
| [#288](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/288) | test(production): require reviewed independence before source admission | CLOSED_NOT_MERGED | `feature/v0428-g75e3c4a-independent-source-admission` | `310b5378ac8b` |
| [#287](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/287) | test(production): govern independent ingredient probability crosschecks | MERGED | `feature/v0428-g75e3c4-independent-crosscheck-readiness` | `fa7e2bea83cf` |
| [#286](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/286) | test(production): audit 242-row ingredient probability source coverage | CLOSED_NOT_MERGED | `feature/v0428-g75e3c3-probability-source-coverage-audit` | `e9e2f856b920` |
| [#285](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/285) | feat(production): govern current 242-key species form roster | MERGED | `feature/v0428-g75e3c2-public-species-form-roster` | `84c5fdc23a6a` |
| [#284](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/284) | test(production): govern ingredient probability activation evidence | MERGED | `feature/v0428-g75e3c-probability-evidence-policy` | `c34b5ec48bbb` |
| [#283](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/283) | feat(production): verify ingredient slot distribution | MERGED | `feature/v0427-g75e3b-ingredient-slot-distribution` | `3a6120654753` |
| [#282](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/282) | fix(production): close G7.5E3A ingredient semantic evidence boundary | MERGED | `fix/v0426-g75e3a-semantic-boundary-closure` | `dea6e61b2de8` |
| [#281](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/281) | feat(production): define G7.5E3A ingredient evidence boundary | CLOSED_NOT_MERGED | `feature/v0426-g75e3a-ingredient-production-evidence` | `5c4b676014fd` |
| [#279](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/279) | v0.4.26 G7.5E3A Species Ingredient Rate Reference Boundary | MERGED | `feature/v0426-g75e3a-ingredient-rate-reference-boundary-r1` | `c543f2652ba4` |
| [#277](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/277) | fix(recipe): lock all 78 recipes to current zh-TW authority | MERGED | `fix/v04251-recipe-current-authority-lock` | `0304935519ca` |
| [#276](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/276) | v0.4.25 G7.5E2B Recipe zh-TW Name Authority + Subskill Numeric | MERGED | `feature/v0425-g75e2b-recipe-name-subskill` | `eb4bd8ce5e72` |
| [#273](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/273) | v0.4.24 G7.5E2A Nature Numeric Modifier Contract | MERGED | `feature/v0424-g75e2a-nature-numeric-modifier` | `d3888bc0cce0` |
| [#271](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/271) | v0.4.23 G7.5E1 Structural Production Modifiers | MERGED | `feature/v0423-release-r2` | `11e1a67299fb` |
| [#269](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/269) | v0.4.22.1 Recipe Formula Authority Audit Hotfix | MERGED | `hotfix/v0.4.22.1-recipe-formula-authority-audit` | `861a8a0b7772` |
| [#268](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/268) | v0.4.22 G7.5D Base Berry Output Numeric Authority | MERGED | `feature/v0.4.22-g75d-base-berry-output` | `d8b711d9feea` |
| [#266](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/266) | v0.4.21 G7.5C Help Event Split Governance | MERGED | `feature/v0.4.21-g75c-help-event-split` | `ac7a13abdadf` |
| [#263](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/263) | v0.4.20 G7.5B Favorite Berry Multiplier Contract | MERGED | `feature/v0.4.20-g75b-favorite-berry-multiplier` | `4182abd52511` |
| [#261](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/261) | v0.4.19 G7.5A Berry Strength Numeric Master | MERGED | `feature/v0.4.19-g75a-berry-strength-master` | `c6b80c4293d3` |
| [#259](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/259) | v0.4.18 G7.5 Production Model Evidence Activation Gate | MERGED | `feature/v0.4.18-g75-production-evidence-gate` | `24f52e761782` |
| [#257](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/257) | v0.4.17.1 AI Proposal Intake null score rendering hotfix | MERGED | `hotfix/v0.4.17.1-ai-null-score-rendering` | `4953ee24906c` |
| [#255](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/255) | v0.4.17 G7.4 AI Proposal Intake + Deterministic Re-evaluation | MERGED | `feature/v0.4.17-g74-ai-proposal-intake` | `d16a28b02fed` |
| [#253](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/253) | v0.4.16 G7.3 Production Authority + bounded team optimization contract | MERGED | `feature/v0.4.16-g73-production-team-search-contract` | `a4abad8770de` |
| [#251](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/251) | v0.4.15 G7.2 Team Supply Readiness + mobile UI polish | MERGED | `feature/v0.4.15-g7-team-supply-readiness` | `f0c4aecbbaa0` |
| [#248](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/248) | v0.4.14 G7 Verified Energy-aware Cooking Planner | MERGED | `feature/v0.4.14-g7-verified-energy-objective` | `86b0575a0ad4` |
| [#247](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/247) | v0.4.13.7 Startup Watchdog False-Positive Closure | CLOSED_NOT_MERGED | `hotfix/v0.4.13.7-startup-watchdog-lifecycle` | `18a68443c2f7` |
| [#245](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/245) | v0.4.13.6 Pot Capacity Manual Authority Alignment | MERGED | `hotfix/v0.4.13.6-pot-manual-authority` | `e5f234612539` |
| [#244](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/244) | v0.4.13.5 account_capacity updated_at apply hotfix | MERGED | `hotfix/v0.4.13.5-account-capacity-updated-at` | `4772db040594` |
| [#243](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/243) | v0.4.13.2 Pot Capacity Authority + Recipe 78 Reconciliation | MERGED | `feat/v04132-pot-authority-recipe78` | `8778ca9cab3e` |
| [#241](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/241) | v0.4.13.1 Data Preservation Hotfix | MERGED | `hotfix/v04131-data-preservation` | `b62ed56c673c` |
| [#239](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/239) | v0.4.13 G7.1 Recipe Portfolio Resource Contention | MERGED | `feat/v0413-g7-recipe-portfolio-contention` | `3b8774a80fc7` |
| [#238](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/238) | v0.4.12 Recipe Unified Player Workbench | MERGED | `feat/v0412-recipe-unified-player-workbench` | `3521b8d44f6d` |
| [#236](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/236) | v0.4.11.4 Recipe zh-TW Authority + Diagnostic Export | MERGED | `fix/v04114-recipe-zh-tw-diagnostic-export` | `c1baace24636` |
| [#234](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/234) | v0.4.11.3 Weekly current-week authority + recipe exact/alias safety | MERGED | `fix/v04113-weekly-recipe-semantic-safety` | `d1944eabe0a9` |
| [#232](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/232) | v0.4.11.2 Android eager image byte snapshot | MERGED | `hotfix/v04112-android-eager-image-bytes` | `6df3379f711c` |
| [#230](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/230) | v0.4.11.1 UC.IMG session cleanup + platform-owned timestamp | MERGED | `hotfix/v04111-ucimg-session-timestamp` | `4d8fd9a329b2` |
| [#228](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/228) | v0.4.11 Public Master Constrained Recognition + Unknown Discovery | MERGED | `feat/v0411-public-master-recognition` | `13dc0b79a7ba` |
| [#226](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/226) | v0.4.10.3 UC.IMG Ingredient Key Contract Hotfix | MERGED | `hotfix/v041021-ingredient-key-contract` | `69005a54263b` |
| [#223](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/223) | CI.1 Phase 3 G13 OCR AI Workflow Consolidation | MERGED | `agent/ci1-g13-ocr-ai-consolidation` | `cbf1382b6909` |
| [#222](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/222) | CI.1 Phase 2 Historical Release Workflow Consolidation | MERGED | `agent/ci1-historical-release-consolidation` | `eb22b1586783` |
| [#221](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/221) | v0.4.10.2 UC.IMG-A Internal Gemini Vision Dual Mode | MERGED | `agent/v04102-internal-gemini-dual-mode` | `185de4aa6582` |
| [#219](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/219) | v0.4.10.1 UC.IMG-A Root Contract Alignment | MERGED | `agent/v04101-root-contract-alignment` | `6682159c8566` |
| [#216](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/216) | UC.IMG-A Unified Screenshot Update Center Phase A | MERGED | `feature/uc-img-a-unified-screenshot-update-center` | `906cf52fe55a` |
| [#214](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/214) | v0.4.9.1 WAR.3 LIVE closure semantic integrity hotfix | MERGED | `hotfix/v0491-war3-live-closure-semantic-integrity` | `717dbd6977c6` |
| [#212](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/212) | v0.4.8.5: compact Camp Berry table density without overflow | MERGED | `fix/v0485-compact-camp-table-density` | `7382c6b5b642` |
| [#211](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/211) | v0.4.8.4: force touch-first Camp Berry containment | MERGED | `fix/v0484-touch-first-camp-containment` | `9fa3a42bab35` |
| [#210](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/210) | v0.4.8.3: close Houndour coverage and harden mobile Camp Berry containment | MERGED | `fix/v0483-houndour-camp-mobile-containment` | `af1f8a5d5ae3` |
| [#209](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/209) | DATA.EVO.1: observed evolution coverage diagnostic and evidence closure | MERGED | `feature/data-evo1-observed-evolution-coverage` | `159ec2e40bf1` |
| [#207](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/207) | v0.4.8.1: Weekly manual override and mobile encyclopedia LIVE follow-up | MERGED | `hotfix/v0481-live-manual-override-mobile-coverage` | `7d819c9cd88d` |
| [#205](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/205) | WAR.3C: provider-neutral External AI Strategy Analysis Pack | MERGED | `feature/war3c-external-ai-strategy-analysis-pack` | `2a4b538d4cf9` |
| [#204](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/204) | WAR.3B: typed Weekly event effect registry and review-safe unknown effects | MERGED | `feature/war3b-typed-event-effect-registry` | `0ca66fdccbc5` |
| [#203](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/203) | WAR.3A: candy inventory and unified resource context | MERGED | `feature/war3a-candy-inventory-resource-summary` | `e6b0282fe895` |
| [#198](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/198) | v0.4.6.3: harden Weekly AI type repair and raw JSON paste | MERGED | `hotfix/v0463-weekly-ai-type-repair` | `e633c77465af` |
| [#196](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/196) | v0.4.6.2: harden weekly JSON and restore recipe recommendations | MERGED | `hotfix/v0462-weekly-json-robustness-recipe-recommendation` | `926923c206fe` |
| [#194](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/194) | v0.4.6.1: synchronize weekly context, camp berries and discovery estimates | MERGED | `hotfix/v0461-weekly-context-camp-master-discovery-semantics` | `6df51e7ca650` |
| [#192](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/192) | WAR.2B: recipe discovery stockpile + weekly player context | MERGED | `feature/war2b-recipe-discovery-stockpile-team-planner` | `6fb5705b8293` |
| [#190](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/190) | WAR.2A: bridge confirmed unlock slots into runtime readiness scoring | MERGED | `feature/war2a-current-readiness-runtime-bridge` | `6c260c920757` |
| [#189](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/189) | WAR.1C: evaluation snapshot lifecycle and zero-write preflight | MERGED | `feature/war1c-evaluation-snapshot-lifecycle` | `df1cb25f3976` |
| [#188](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/188) | v0.4.3.2: enforce Goal Profile draft/team consistency | MERGED | `hotfix/v0432-goal-profile-team-consistency` | `2091c65a56bf` |
| [#186](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/186) | v0.4.3.1: fix controlled selector search commit and Android IME UX | MERGED | `hotfix/v0431-controlled-selector-search-commit` | `44faeaa44a91` |
| [#180](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/180) | v0.4.3: game-verified recipe names and team optimizer foundation | CLOSED_NOT_MERGED | `feature/v043-recipe-zh-tw-team-optimizer-foundation` | `cee2a2f2ba5e` |
| [#176](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/176) | v0.4.3: recipe zh-TW reconciliation, controlled selectors, 5-member Team Optimizer | MERGED | `feature/v043-recipe-zh-tw-reconciliation-team-optimizer` | `a18ab30801e0` |
| [#171](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/171) | v0.4.2: recipe authority baseline audit and strategy readiness | MERGED | `feature/v042-recipe-canonical-master-strategy-readiness` | `ca0f01cc8e0a` |
| [#161](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/161) | v0.4.1 Evolution Master Coverage Completion | MERGED | `v0.4.1-evolution-master-coverage-completion` | `e38cd0e85043` |
| [#159](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/159) | v0.4.0.4 post-Apply terminal state and inventory summary | MERGED | `hotfix/v04004-post-apply-state-inventory-summary` | `6b189cf0dc8b` |
| [#158](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/158) | v0.4.0.3 canonical skill projection and scenario-aware update review | MERGED | `hotfix/v04003-canonical-skill-projection-scenario-review` | `f310a6b6b056` |
| [#157](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/157) | v0.4.0.2 legacy skill alias and Package Manifest UX hotfix | MERGED | `hotfix/v04002-legacy-skill-alias-and-manifest-ux` | `77d6fc92fb71` |
| [#156](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/156) | v0.4.0.1 normalize invisible Unicode in observed main-skill labels | MERGED | `hotfix/v04001-skill-normalization` | `76c4cdeb6912` |
| [#155](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/155) | v0.4.0 public Pokémon master coverage triage and canonical skill closure | MERGED | `feature/v0400-public-pokemon-master-coverage` | `6c1eed009fb6` |
| [#154](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/154) | v0.3.99.4 mobile validation hotfix and FULL75 frontend retirement | MERGED | `fix/v03994-mobile-validation-hotfix` | `11591e0eb736` |
| [#153](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/153) | v0.3.99.3: public Pokémon master coverage and projection integrity | MERGED | `feature/v03993-public-pokemon-master-coverage` | `d024c84fb48e` |
| [#152](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/152) | v0.3.99.2: guided Update Center UX and public Pokémon knowledge projection | MERGED | `feature/v03992-guided-ux-public-pokemon-knowledge` | `dcaffbefe35f` |
| [#151](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/151) | v0.3.99.1: fix review-only Dry Run and game-native field semantics | MERGED | `fix/v03991-review-dryrun-canonical-state` | `dc98ca85d2b8` |
| [#150](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/150) | v0.3.99 human-readable before-after review UX | MERGED | `feat/v0399-human-readable-diff-review` | `04f83e261a9c` |
| [#149](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/149) | v0.3.98.2 mobile confirmation review preview UX hotfix | MERGED | `fix/v03982-mobile-review-preview-ux` | `2112b6c94e6f` |
| [#148](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/148) | v0.3.98.1 confirmation to Dry Run direct handshake hotfix | MERGED | `fix/v03981-confirmation-dryrun-handshake` | `e9eed7834a84` |
| [#147](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/147) | v0.3.98 Update Center multiscenario and Dry Run state sync | MERGED | `fix/v0398-update-center-multiscenario-dryrun-state` | `3bca9ceb9ee8` |
| [#146](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/146) | v0.3.97 profile completeness and derived readiness | MERGED | `feat/v0397-profile-completeness-derived-readiness` | `8bc727accfa7` |
| [#145](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/145) | v0.3.96 general JSON field audit and Full75 retirement | MERGED | `feat/v0396-general-json-audit-full75-retirement` | `6bda645ebdc8` |
| [#143](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/143) | v0.3.95.2 public master version sync and render queue | MERGED | `fix/v03952-public-item-authority-render-queue` | `8d81f7271144` |
| [#142](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/142) | v0.3.95.1 standard catalog schema compatibility and first-entry lazy render | MERGED | `fix/v0395-standard-catalog-schema-and-first-entry` | `284e9c609277` |
| [#141](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/141) | v0.3.95 public berry/type contract gate compatibility | MERGED | `hotfix/v0395-public-berry-contract-gate` | `ead5072bacad` |
| [#140](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/140) | v0.3.95 canonical rescue and staged bootstrap pipeline | MERGED | `hotfix/v0395-canonical-rescue-and-bootstrap-pipeline` | `c814fb7af6a8` |
| [#139](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/139) | CI: retry Pages deployment within supported timeout | MERGED | `fix/v0394-pages-deploy-retry` | `f52d95ffa8c1` |
| [#138](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/138) | CI: close post-merge GitHub Pages deployment failure | MERGED | `fix/v0394-pages-postmerge-closure` | `c9af90c08479` |
| [#137](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/137) | CI: close historical patch workflows as read-only validations | MERGED | `fix/v0394-historical-workflow-closure` | `100aa1cdc374` |
| [#136](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/136) | v0.3.94 post-merge CI and Pages closure | MERGED | `hotfix/v0394-postmerge-ci-and-pages-closure` | `b29c501e1693` |
| [#135](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/135) | v0.3.94 central version authority and live startup watchdog | MERGED | `hotfix/v0394-live-version-handoff-and-post-migration-watchdog` | `5e50cca1f529` |
| [#134](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/134) | v0.3.93 post-migration startup isolation | MERGED | `hotfix/v0393-post-migration-startup-isolation` | `365546cbd8f6` |
| [#133](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/133) | v0.3.92 new-user database bootstrap freeze closure | MERGED | `hotfix/v0392-new-user-database-bootstrap-freeze` | `3df6abb52665` |
| [#132](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/132) | v0.3.91 worker lifecycle race closure | MERGED | `hotfix/v0391-worker-lifecycle-race-closure` | `32586ab323bd` |
| [#131](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/131) | v0.3.90 worker-isolated legacy SQLite load and mobile memory guard | MERGED | `hotfix/v0390-worker-isolated-legacy-sqlite-load` | `211514858161` |
| [#130](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/130) | v0.3.89 rescue catalog, JSON staging and normal-mode recovery | MERGED | `hotfix/v0389-rescue-catalog-import-recovery` | `56ab2f29e381` |
| [#129](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/129) | v0.3.88 version authority and cache activation | MERGED | `hotfix/v0388-version-authority` | `4dc3eb632600` |
| [#128](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/128) | v0.3.88 zero-SQL rescue mode | MERGED | `hotfix/v0388-zero-sql-rescue` | `075f78f28877` |
| [#127](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/127) | v0.3.87 rescue bootstrap finalize hotfix | MERGED | `hotfix/v03871-bootstrap-finalize` | `ddc9361caaff` |
| [#126](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/126) | v0.3.87 IndexedDB safe boot and memory guard | MERGED | `hotfix/v0387-indexeddb-safe-boot-memory-guard` | `ca9d600dfd2f` |
| [#125](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/125) | v0.3.86 startup progress ticker and fail-open diagnostics | MERGED | `feature/v0386-startup-progress-fail-open` | `ec1a392a1f93` |
| [#124](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/124) | v0.3.85 isolate SQLite boot from public catalog projection | MERGED | `hotfix/v0385-database-boot-isolation` | `1e7d60938b09` |
| [#123](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/123) | v0.3.84 post-patch full regression validation | MERGED | `validation/v0384-postpatch` | `6bcf7242dcbd` |
| [#122](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/122) | v0.3.84 database initialization and catalog recovery hotfix | MERGED | `hotfix/v0384-database-catalog-recovery` | `80d8abb2f358` |
| [#121](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/121) | v0.3.83 catalog, OCR terminal state and full review contract | MERGED | `feature/v0383-catalog-ocr-review-contract` | `00c13ae01f5d` |
| [#120](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/120) | v0.3.82 version authority activation hotfix | MERGED | `hotfix/v0382-version-authority` | `5e975b8201d7` |
| [#119](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/119) | v0.3.82 Android image snapshot and public catalog completion | MERGED | `feature/v0382-file-snapshot-and-public-catalog` | `af40925dee84` |
| [#118](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/118) | v0.3.81 Pokémon detail parity and additive recognition review | MERGED | `feature/v0381-pokemon-detail-review-merge` | `09f26e7353c6` |
| [#117](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/117) | R1.1 Canonical recognition normalization audit gate | MERGED | `feature/r1-canonical-recognition-normalization` | `20b0370694d3` |
| [#116](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/116) | v0.3.80 Runtime Version Authority closure | MERGED | `release/v0380-runtime-authority` | `e575080c77c5` |
| [#115](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/115) | Fix duplicate knowledge page authority | MERGED | `fix/v0380-single-knowledge-authority` | `9d29a4b2daaa` |
| [#114](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/114) | Development-open debug access and general-user identity review | MERGED | `fix/general-user-identity-review-access` | `d3298d7f3374` |
| [#113](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/113) | v0.3.80 static app shell and local admin debug gate | MERGED | `feat/v0380-static-shell-admin-debug-gate` | `291fc39626a4` |
| [#112](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/112) | v0.3.79 keep public catalog views authoritative | MERGED | `fix/v0379-public-catalog-main-renderer` | `0a233db4d3ed` |
| [#111](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/111) | v0.3.79 Canonical commit gate for AI/OCR ingredient writes | MERGED | `feat/v0379-canonical-commit-gate` | `754e358f196e` |
| [#110](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/110) | v0.3.79 Canonical terminology and editable public zero-state catalogs | MERGED | `feat/v0379-canonical-public-catalog` | `34f4fd6552e3` |
| [#109](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/109) | privacy: public Pages must start with an empty player profile | MERGED | `fix/v03781-public-pages-empty-profile` | `8fb141bbbd73` |
| [#108](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/108) | v0.3.78 G14 data consistency and multi-capture safety | MERGED | `feat/v0377c-data-consistency-multicapture` | `fac05a2023a0` |
| [#107](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/107) | V0.3.77B FULL75 Recovery Closure | MERGED | `feat/v0377b-full75-recovery-closure` | `f933b69a23ac` |
| [#106](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/106) | v0.3.77A Backup Truth & Restore Verification | MERGED | `feat/v0377a-backup-truth-restore-verification` | `9a41477feb42` |
| [#105](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/105) | fix: v0.3.76 version authority and service worker cache rotation | MERGED | `fix/v03751-version-authority-hotfix` | `7ee4b8d4b4e5` |
| [#104](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/104) | feat: v0.3.75 unified image and ZIP analysis pipeline | MERGED | `feat/v0375-unified-import-pipeline` | `a4ad40bd0769` |
| [#103](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/103) | feat: v0.3.74 OCR AI cross-check and confidence engine | MERGED | `feat/v0374-ocr-ai-cross-check-confidence` | `1631a94cfe05` |
| [#102](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/102) | feat: v0.3.73 normalize and confirm OCR/AI results before apply | MERGED | `feat/v0373-analysis-confirmation-apply` | `8b0d0324f170` |
| [#101](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/101) | feat: v0.3.72 execute real OCR and AI on duplicate-selected images | MERGED | `feat/v0372-real-ocr-ai-execution` | `312b43a1bd6b` |
| [#100](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/100) | fix: v0.3.71 replace shared AI core with ultra-minimal shell | MERGED | `fix/v0371-ultra-minimal-ai-shell` | `e36d68439127` |
| [#99](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/99) | fix: v0.3.70 isolate OCR and standalone single-image AI diagnostics | MERGED | `fix/v0370-live-debug-deferred-render` | `83034df5e4f2` |
| [#98](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/98) | fix: v0.3.69 preempt legacy Android AI review freeze | MERGED | `fix/v0369-direct-minimal-review` | `e748b40613cb` |
| [#97](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/97) | fix: v0.3.68.1 single-item minimal advanced review takeover | MERGED | `fix/v0369-single-item-minimal-core` | `a1794110f828` |
| [#96](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/96) | fix: v0.3.68 Android RAF timeout fallback | MERGED | `fix/v0368-android-raf-timeout-fallback` | `e2f6bc9a7d44` |
| [#95](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/95) | fix: v0.3.67 progressive single-item AI review bootstrap | MERGED | `fix/v0367-single-item-review-bootstrap` | `2db32e7fad1f` |
| [#94](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/94) | G13.2H: v0.3.66 sequential advanced AI review | MERGED | `fix/v0366-sequential-advanced-ai-review` | `eea683afde53` |
| [#93](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/93) | G13.2G: v0.3.65 lightweight AI review and export feedback | MERGED | `fix/v0365-lightweight-ai-review-export-feedback` | `eafeffe73a1c` |
| [#92](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/92) | G13.2F: v0.3.64 defer region AI review and heavy workbench | MERGED | `fix/v0364-region-ai-review-deferred` | `4aee7f504be9` |
| [#91](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/91) | G13.2E: v0.3.63 finalize nonblocking workbench isolation | MERGED | `fix/v0363-finalize-nonblocking-workbench` | `fc40e93774ca` |
| [#90](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/90) | G13.2D: v0.3.62 duplicate-only finalize isolation and update-center live debug | MERGED | `fix/v0362-duplicate-only-finalize-isolation` | `52fa7fce9a4f` |
| [#89](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/89) | G13.2C: v0.3.61 OCR isolation, progress state machine, and secret redaction | MERGED | `fix/v0361-ocr-main-thread-isolation-secret-redaction` | `394a9d37e53b` |
| [#88](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/88) | G13.2B: v0.3.60 OCR runtime watchdog and recovery | MERGED | `fix/v0360-ocr-runtime-hardening` | `ce1b64c5f8e2` |
| [#87](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/87) | G13.2A: v0.3.59 encrypted Project Pool and AI queue executor | MERGED | `feat/g13-2a-ai-project-pool-executor` | `30d5cd6fcd6f` |
| [#86](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/86) | DATA.1D.1: v0.3.58 OCR export summary consistency | MERGED | `fix/v0358-ocr-export-summary-consistency` | `fe3a8f9a299d` |
| [#85](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/85) | DATA.1D.1: v0.3.57 two-stage OCR and versioned exports | MERGED | `feat/v0357-two-stage-ocr-versioned-exports` | `e65293927587` |
| [#84](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/84) | DATA.1D.1: release v0.3.56 manual re-OCR | MERGED | `feat/v0356-manual-reocr` | `a3656f604603` |
| [#83](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/83) | DATA.1D.1: release v0.3.55 layout-aware multi-region OCR | MERGED | `feat/v0355-layout-aware-region-ocr` | `6c4ca35831db` |
| [#82](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/82) | DATA.1D.1: release v0.3.54 preview scroll and OCR precision fix | MERGED | `fix/v0354-preview-scroll-and-ocr-precision` | `e966c71ec55f` |
| [#81](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/81) | DATA.1D.1: release v0.3.53 OCR SP signature and real thumbnail preview | MERGED | `feat/v0353-ocr-sp-thumbnail-preview` | `90b4e4ba2db6` |
| [#80](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/80) | DATA.1D.1: fix v0.3.51 device validation regressions | MERGED | `fix/v0351-device-validation-ocr-ai-flow` | `389c49a47f5a` |
| [#79](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/79) | DATA.1D.1: add OCR overlay browser lifecycle gate | MERGED | `test/data1d1-ocr-overlay-browser-lifecycle-gate` | `fc041f71ddec` |
| [#78](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/78) | DATA.1D.1: wire OCR review items to overlay preview events | MERGED | `feat/data1d1-ocr-overlay-preview-event-wiring` | `c915d8012760` |
| [#77](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/77) | DATA.1D.1: integrate and gate OCR overlay bootstrap | MERGED | `feat/data1d1-ocr-overlay-bootstrap-integration` | `0d6e6dff4093` |
| [#76](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/76) | DATA.1D.1: bootstrap OCR overlay bridge after update center mount | MERGED | `feat/data1d1-ocr-overlay-update-center-bootstrap` | `693a3f3ee53f` |
| [#75](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/75) | DATA.1D.1: bridge update center OCR overlay events | MERGED | `feat/data1d1-ocr-overlay-update-center-bridge` | `b75857a4982c` |
| [#74](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/74) | DATA.1D.1: mount OCR overlay integration in update center | MERGED | `feat/data1d1-ocr-overlay-update-center-mount` | `38e2f90c8da8` |
| [#73](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/73) | DATA.1D.1: integrate OCR overlay controller with lifecycle | MERGED | `feat/data1d1-ocr-overlay-controller-integration` | `b59017db879d` |
| [#72](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/72) | DATA.1D.1: release OCR overlays on import lifecycle events | MERGED | `feat/data1d1-ocr-overlay-lifecycle-events` | `59483a5448c7` |
| [#71](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/71) | DATA.1D.1: wire real thumbnail overlay preview | MERGED | `feat/data1d1-ocr-thumbnail-overlay-wiring` | `160d43f8b680` |
| [#70](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/70) | DATA.1D.1: start OCR thumbnail lifecycle and region confidence | MERGED | `feat/data1d1-ocr-thumbnail-region-confidence` | `23659d7c2998` |
| [#69](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/69) | DATA.1D.1: add OCR region preview and explicit AI consent UI | MERGED | `feat/data1d1-ocr-region-ui-preview` | `9a4cc13d55b6` |
| [#68](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/68) | DATA.1D.1: add OCR region presets and explicit AI consent contract | MERGED | `feat/data1d1-ocr-region-ai-consent` | `522c84332d97` |
| [#67](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/67) | DATA.1D.1: wire OCR cancellation and review queue UI | MERGED | `feat/data1d1-ocr-review-ui-cancel-wiring` | `c1a659047301` |
| [#66](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/66) | DATA.1D.1: add cancellable OCR batch and private review package | MERGED | `feat/data1d1-ocr-batch-cancel-region-review` | `ab3d9aa5193a` |
| [#65](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/65) | DATA.1D.1: add OCR runtime UI and local small-text preprocessing | MERGED | `feat/data1d1-ocr-runtime-ui-preprocessing` | `2d612183a401` |
| [#62](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/62) | DATA.1D: add OCR UI and browser-local AI project settings | MERGED | `feat/data1d-ocr-runtime-ui-ai-settings` | `43e1b43111b8` |
| [#61](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/61) | DATA.1D: add lazy local OCR runtime foundation | MERGED | `feat/data1d-local-ocr-runtime-ui` | `ac74d5063949` |
| [#60](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/60) | DATA.1D: add OCR-first classification foundation | MERGED | `feat/data1d-ocr-first-classification` | `8182102d76d8` |
| [#59](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/59) | DATA.1C: add SHA-256 image fingerprint and exact duplicate gate | MERGED | `feat/data1c-image-fingerprint-duplicate-gate` | `fde0c83a6da6` |
| [#54](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/54) | DATA.1B: add inventory review workbench foundation | MERGED | `feat/data1b-inventory-review-workbench-v2` | `4703ec0b2e7b` |
| [#53](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/53) | DATA.1A Hotfix: add manifest export success feedback | MERGED | `fix/data1a-export-feedback` | `c229e1631e6b` |
| [#52](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/52) | DATA.1A: add private ZIP inventory manifest foundation | MERGED | `feat/data1a-zip-inventory-manifest` | `6f10a0f13a7c` |
| [#51](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/51) | CORE.DEBUG.2: improve trace modes and Android import UX | MERGED | `feat/core-debug-2-import-ux` | `5b182d291800` |
| [#50](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/50) | CORE.DEBUG.1: add global Debug Trace Manager | MERGED | `feat/debug-trace-manager` | `6d7ccd2ce0a4` |
| [#49](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/49) | docs: add canonical roadmap, architecture, and product milestones | MERGED | `docs/product-roadmap-and-architecture` | `b43e68c3ef31` |
| [#46](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/46) | TECH.2D: add guarded identity import wizard | MERGED | `agent/tech-2d-import-wizard` | `2bab27678e2b` |
| [#45](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/45) | TECH.2C: add identity confirmation state model | MERGED | `agent/tech-2c-confirmation-ui` | `c95f26333c31` |
| [#39](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/39) | TECH.2B: add identity candidate classification engine | MERGED | `agent/tech-2b-identity-candidate-engine` | `504f9e41d337` |
| [#38](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/38) | TECH.2A: add model-neutral AI Observation v2 contract | MERGED | `agent/tech-2a-ai-observation-contract` | `e7f3aa03027d` |
| [#36](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/36) | TECH.1C: converge legacy duplicates by profile completeness | MERGED | `agent/tech-1c-profile-completeness-guard` | `d5d52ebf02f2` |
| [#34](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/34) | TECH.1B: repair duplicate skeleton Pokémon records | MERGED | `agent/tech-1b-duplicate-skeleton-guard` | `d14fe463e84a` |
| [#32](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/32) | TECH.1A: add Chromium browser runtime gate | MERGED | `agent/tech-1a-browser-runtime-gate` | `dd8a0526e3e4` |
| [#31](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/31) | v0.3.28 Pokémon Master Data Editor | MERGED | `feat/v0-3-28-master-data-editor` | `8ab30f0e1f53` |
| [#30](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/30) | v0.3.27 Identity Completion / Evidence Builder | MERGED | `feat/v0-3-27-identity-completion` | `2580e052fe88` |
| [#29](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/29) | v0.3.26 Identity Merge v2 | MERGED | `fix/v0-3-26-identity-merge-v2` | `0255586685f2` |
| [#28](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/28) | Hotfix: force enhanced recipe rerender after legacy overwrite | MERGED | `fix/recipe-force-rerender` | `6b7ec35ef350` |
| [#27](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/27) | Fix duplicate Pokémon convergence and recipe render race | MERGED | `fix/identity-dedup-recipe-render` | `b29eceff0d7c` |
| [#26](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/26) | UI: show PWA release version in header | MERGED | `feat/pwa-visible-version` | `e711e6a11324` |
| [#25](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/25) | G6.1D: add weekly recommendations to personal recipes | MERGED | `fix/personal-weekly-recommendation` | `3e6f393d2c30` |
| [#24](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/24) | G6.1C: reset stale previews and converge strong identities | MERGED | `fix/update-preview-identity-convergence` | `673cc92ad065` |
| [#23](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/23) | G6.1B: controlled weekly selectors and validation | MERGED | `feat/g6-1b-weekly-selects-data-completion` | `657cb746e071` |
| [#22](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/22) | Hotfix: force refresh weekly context modules | MERGED | `fix/weekly-context-cache-refresh` | `709b70a0f65f` |
| [#21](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/21) | G6.1A: add deterministic ingredient gap engine | MERGED | `feat/g6-1-ingredient-gap-engine` | `df88f4484a2f` |
| [#15](https://github.com/easonliu714/pokemon-sleep-ai-manager/pull/15) | TECH.1: add regression gate and isolate recipe data flows | MERGED | `test/tech-1-regression-gate` | `62b2bd4036a9` |

## Minimal-prune safety gates

- Confirm current branch ref SHA and exact matching merged PR HEAD; no open PR referencing the branch; check protected/branch rules, automation, Release/CI dependencies, and independent commits before branch deletion. All deletions are auditable and do not affect retained PR commits/history.
- For `CLOSED_UNMERGED_PR_ONLY` do not delete until successor PR/commit that supersedes it has been independently traced; source can contain unique work.
- For `NO_PR_ASSOCIATION` do not assume stale: read-only compare with main, then categorize `duplicate-main`, `archive-keep`, `unmerged-unique-review`, `noop` or `diagnostic-candidate`. Investigate archive of 7 same-SHA aliases for dedup as a group.
- All existing GitHub Open Issues need their original DoD and relevant Owner/CI proof; never close parent Epic while child gates remain open. A closed PR is NOT sufficient closure proof.

## Canonical living governance authority

- [PROJECT_GATE_ROADMAP](./PROJECT_GATE_ROADMAP.md)
- [Roadmap / PR / Issue Closure Audit](./Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md)
- [UI/API/DB Feature Architecture Tree](./Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md)

_This snapshot is source-level evidence only. The user's Git checkout and Android UAT are not inferred by this audit._
