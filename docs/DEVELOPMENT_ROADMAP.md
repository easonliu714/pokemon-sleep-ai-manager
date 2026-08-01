# Pokémon Sleep AI Manager 開發 Roadmap

> 本文件是新對話、交接與階段決策的主要入口。最後更新：2026-08-01。

## 專案定位

手機優先、純瀏覽器 PWA、個人 SQLite 保存在本機裝置。產品由資料管理工具演進為可解釋的 Pokémon Sleep AI 戰略助手。核心架構採 deterministic engine 作為數值與排名 source of truth，Gemini 僅負責結構化辨識、比較與說明。

## 不可違反原則

- Master Database 與玩家 Profile Database 分離。
- AI Observation 不得直接建立或覆寫正式個體。
- 所有正式寫入須經 validation、identity resolution、人工確認、operation preview、snapshot、transaction 與 rollback。
- 公共 Master 需版本化、可追溯來源，不得由 Gemini 直接更新。
- Android PWA、離線快取與本機資料持久化是正式 Gate。

## Product Milestones

| Milestone | 目的 | 目前狀態 | 完成條件 |
|---|---|---|---|
| M0 Core Platform | PWA、SQLite、回歸與隱私防護 | 已完成主要基礎 | TECH.1 Gate 全部關閉 |
| M1 Safe Import Platform | Observation、Identity、Confirmation、Import Wizard | TECH.2D 進行中 | Android ZIP 匯入、Snapshot、Rollback PASS |
| M2 Versioned Master Database | 公共規則與物種關聯 source of truth | Issue #48 待開始 | Coverage、Schema、核心關聯與版本更新 Gate PASS |
| M3 AI Training Coach | 版本化評分、培養與進化建議 | Issue #43 已規劃 | 可重現評分、缺值保護、批次回補 |
| M4 Goal Planner | 依玩家目標調整捕獲、培養、解鎖策略 | 已納入 #40/#48 | deterministic 權重、理由與缺口證據 |
| M5 War Room | 多隊伍、AI 建議與本週能量預估 | Issue #40 已規劃 | 手動組隊、能量模型、AI 草稿與比較 |
| M6 Android PWA Beta | 可供手機使用者完整初始化與日常操作 | 待開發 | Onboarding、OCR/Gemini、離線與壓力測試 |
| M7 Public Release v1.0 | 可公開分享的平台與使用教學 | 待規劃 | 文件、資料治理、升級與還原均可用 |
| M8 Community Master Updates | 社群可審核的 Master 更新機制 | 長期 | signed patch、source manifest、審核流程 |

## 階段順序

### Phase 0：TECH.2 Safe Import

- TECH.2A Observation v2：完成。
- TECH.2B Identity Candidate Engine：完成。
- TECH.2C Confirmation UI：完成主要功能。
- TECH.2D Guarded Import Wizard：PR #46 進行中。

TECH.2D 收尾順序：

1. 修正 PR #46 Base 與分支歷史。
2. Android 檔案選擇 UI。
3. JSZip lazy-load 與離線 Smoke Test。
4. Frontend Regression Gate。
5. Android PWA 實機驗證。
6. Ready for review 並合併。

### Phase 1：DATA.1 Versioned Master Database

Issue #48。

1. DATA.1A 現況盤點與 Coverage Report。
2. DATA.1B Schema、stable ID、版本與來源契約。
3. DATA.1C Pokémon／Type／Berry／Ingredient。
4. DATA.1D Recipe／Island／Evolution／Item。
5. DATA.1E Skill／Nature／公式。
6. DATA.1F Profile Unlock 與研究筆記匯入。
7. DATA.1G Goal Planner Integration。

### Phase 2：G13 AI Assistant Center 與 Onboarding

Issues #42、#47。

- 單一頁面類型批次與 ZIP 優先。
- 研究筆記、營地、寶可夢盒、個體詳情、隊伍、庫存分開處理。
- OCR 優先，Gemini 只補低信心欄位。
- Historical Screenshot Replay 與 Prompt regression。

### Phase 3：G14 Training Coach

Issue #43。

- 基礎評分由版本化規則引擎產生。
- Gemini 產生角色定位、培養、進化與風險說明。
- input signature 未變時不重複呼叫。
- 支援缺值回補、資料更新後重算及人工鎖定。

### Phase 4：Goal Mode Strategy Assistant

目標模式：料理圖鑑、食材解鎖、樹果覆蓋、營地攻略、高分衝榜、圖鑑完成、長期培養、自訂權重。

Master 與 Profile 缺口先由 deterministic engine 排名，再由 Gemini 解釋。

### Phase 5：WAR.1 戰情室

Issue #40。

1. WAR.1A 隊伍資料模型與手動編組。
2. WAR.1B 可解釋能量預估。
3. WAR.1C 多隊伍 UI 與比較。
4. WAR.1D AI 組隊建議。
5. Goal Mode 整合。
6. 共眠 Session 五人批次累計。

## 當前唯一下一步

完成 PR #46 的 TECH.2D Gate；不得跳過 Android PWA 實機驗證直接進 DATA.1A。

## 新對話承接檢查表

1. 讀取本文件與 `PRODUCT_MILESTONES.md`。
2. 查看最新 open PR、head SHA、Base、CI 與 Draft 狀態。
3. 查看 Issues #40、#42、#43、#47、#48。
4. 只從「當前唯一下一步」繼續，不重複已關閉工作。
5. 所有結論以 GitHub 實際狀態為準。