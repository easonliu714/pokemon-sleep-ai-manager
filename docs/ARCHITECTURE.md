# System Architecture

## Runtime

Android／Desktop Browser PWA → Bootstrap／Service Worker → UI modules → local SQLite／IndexedDB／OPFS。私人資料預設不離開裝置。

## Data layers

### Versioned Master Database
公共遊戲規則：物種、屬性、樹果、食材候選、食譜、營地固定規則、進化、道具、技能、性格與公式。具 stable ID、來源、版本與 checksum。

### Player Profile Database
個體、等級、SP、實際食材配置、技能、共眠、解鎖狀態、庫存、營地進度、隊伍、AI 評分與歷史紀錄。

兩層禁止混寫。研究筆記更新 Profile unlock，不修改 Master。

## Safe Import Pipeline

Source(JSON／screenshots／ZIP) → page classification → OCR → Gemini low-confidence supplement → Observation v2 normalization → Identity Candidate Engine → Confirmation UI → Import Plan → field allowlist → Snapshot → Transaction → Integrity result／Rollback。

AI 不得跳過 Identity 與人工確認。

## Strategy Architecture

Master + Profile + Weekly Context → deterministic gap／score／energy engines → Goal Mode weighting → candidate ranking → Gemini explanation layer → draft suggestion → user confirmation。

Gemini 不得成為數值 source of truth，也不得自造 Master 關聯或不存在的個體。

## Major modules

- TECH.2：安全匯入與身分治理。
- DATA.1：版本化 Master Database。
- G13：OCR、Gemini BYOK、Prompt Library、待審中心。
- G14：評分、培養、進化、共眠與 ROI。
- Goal Planner：使用者目標與 deterministic 權重。
- WAR.1：隊伍、能量、比較與 AI 組隊。

## Security and reliability

- API Key 僅本機加密保存，備份與 log 預設排除。
- 圖片採獨立 image store、hash 去重與 lazy-load。
- 所有正式寫入具 Snapshot、Transaction、Rollback 與 audit event。
- PWA 版本更新需同步 Bootstrap query、Service Worker cache 與 regression expectations。
- Master patch 需 manifest、checksum、Dry Run 與 provenance。