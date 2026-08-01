# Product Milestones

## M0 Core Platform

目標：PWA、SQLite、資料隔離、Migration、Snapshot、Rollback、Private Data Guard 與 Frontend Regression 基礎。

Definition of Done：TECH.1 全 Gate 關閉，Android 離線啟動、資料持久化與版本更新皆 PASS。

## M1 Safe Import Platform

相依：TECH.2A～2D、Issue #37、PR #46。

Definition of Done：
- JSON、圖片與 ZIP 可匯入。
- Observation v2、Identity Resolver、Confirmation Queue 與 Import Plan 完整串接。
- 正式寫入前有 allowlist、Snapshot、Transaction、Rollback。
- Android File Picker、JSZip lazy-load、離線 Smoke Test 與 Frontend Regression PASS。
- Android 實機完成正常提交與失敗 rollback 驗證。

## M2 Versioned Master Database

相依：Issue #48。

Definition of Done：
- 產出 Coverage Report。
- stable ID、schema version、data version、source manifest 與 checksum 可用。
- Pokémon→Type→Berry、Pokémon→Ingredient slot、Recipe→Ingredient 等核心關聯完整。
- Master patch 可 Dry Run、Snapshot、Apply、Integrity Check、Rollback。

## M3 AI Training Coach

相依：Issues #42、#43、#48。

Definition of Done：版本化評分規則、Gemini 結構化建議、input signature cache、人工鎖定、批次缺值回補與 regression 全部完成。

## M4 Goal Planner Strategy Assistant

Definition of Done：支援料理圖鑑、食材解鎖、樹果覆蓋、營地攻略、高分衝榜、圖鑑完成、長期培養及自訂權重；每項建議可追溯 Master 與 Profile 證據。

## M5 War Room

相依：Issue #40。

Definition of Done：多隊伍 CRUD、手動編組、能量 deterministic model、隊伍比較、AI 草稿、共眠五人批次累計與 Android UX PASS。

## M6 Android PWA Beta

Definition of Done：首次導引、OCR-only、Gemini BYOK、ZIP、離線、備份還原、大量圖片壓力測試與可讀錯誤處理完成。

## M7 Public Release v1.0

Definition of Done：公開使用文件、隱私說明、資料備份、Master 更新、版本升級與還原流程可由一般手機使用者完成。

## M8 Community Master Updates

Definition of Done：社群資料提案不可直接進正式 Master；具來源、差異、審核、簽章、checksum、回歸與撤回機制。