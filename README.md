# Pokémon Sleep AI Manager PWA

目前正式版本由 `assets/js/version-authority.js` 統一管理。

核心能力：

- 純瀏覽器 GitHub Pages PWA
- SQLite WebAssembly + IndexedDB
- 公版主檔與玩家本機資料分離
- 食材、道具、寶可夢、食譜資料表
- JSON Dry Run / Apply / Rollback
- SQLite / JSON 備份與還原
- AI 截圖轉 JSON 工作流程
- Zero-SQL 救援／唯讀模式

使用網址：

`https://easonliu714.github.io/pokemon-sleep-ai-manager/`

個人資料只保存在目前裝置與瀏覽器，請定期下載 `.sqlite3` 或完整 JSON 備份。

## 正式進度基準（每輪必讀、同步更新）

- [Roadmap／PR／Issue 結案與進度稽核](docs/Pokemon_Sleep_Roadmap_PR_Issue_Closure_Audit_20261013.md)
- [UI／功能 API／SQLite／Public Master 功能架構樹](docs/Pokemon_Sleep_UI_API_DB_Feature_Architecture_Tree_20261013.md)
- [Canonical Gate Roadmap](docs/PROJECT_GATE_ROADMAP.md)

上述三份是協作與交接的正式基準。每次對話、任務輪詢或 Gate 更新時先讀取 GitHub main／相關 PR HEAD／Issues／CI／Pages，遇到**實質變動**需於同一受控 branch/PR 同步更新 Roadmap/Issue Audit 與 UI/API/DB Architecture Tree；不可只改聊天摘要或以舊 snapshot SHA 推定 current。純 read-only 且無變動者記錄 NO_DELTA，不為了日期製造空 Commit。已 CLOSED Gate 不重開，未實機驗證不得聲稱完成。

## 正式資料治理文件

- [Public Master Database Version Audit / Update Contract](docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md)

此契約為規範性文件。新資料庫建立、公版版本核對、既有 SQLite 更新、救援模式共用 authority、玩家資料保護與 CI 阻擋條件均必須遵循該文件。
