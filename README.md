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

## 正式資料治理文件

- [Public Master Database Version Audit / Update Contract](docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md)

此契約為規範性文件。新資料庫建立、公版版本核對、既有 SQLite 更新、救援模式共用 authority、玩家資料保護與 CI 阻擋條件均必須遵循該文件。
