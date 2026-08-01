# Onboarding Flow

## Goal

讓一般使用者只靠手機完成本機資料初始化。每個批次只處理一種頁面，優先接受 ZIP，並可暫停、恢復或略過。

## Steps

1. 初始化 SQLite／IndexedDB，說明資料只在本機，建立第一份備份。
2. 帳號摘要：食材包、道具包、寶可夢盒、鍋子、食譜數。
3. 研究筆記：食譜、食材、樹果解鎖狀態；`???` 明確表示未解鎖。
4. 營地研究資訊：最高能量、營地獎勵、研究率、夥伴率、建議隊伍 SP。
5. 寶可夢盒總覽：建立候選清單，不直接建立完整個體。
6. 個體詳情：同角色 N 張截圖，從頂部拍至共眠時間，依名稱＋等級＋SP＋縮圖分組。
7. 隊伍：上傳組隊截圖或手動選擇多個命名隊伍。
8. 背包：食材與道具庫存，與永久解鎖狀態分離。
9. 資料品質總結：缺少個體欄位、共眠、評分、營地、解鎖與庫存。

## ZIP naming

- `research_notes_recipes_YYYYMMDD.zip`
- `research_notes_ingredients_YYYYMMDD.zip`
- `research_notes_berries_YYYYMMDD.zip`
- `camp_research_YYYYMMDD.zip`
- `pokemon_box_YYYYMMDD.zip`
- `pokemon_details_YYYYMMDD.zip`
- `teams_YYYYMMDD.zip`
- `inventory_YYYYMMDD.zip`

混入其他頁面時必須隔離並顯示縮圖，不可交給錯誤 Prompt。

## Mobile UX

- Android File Picker、相簿多選與 ZIP。
- 44px 以上觸控目標。
- 顯示檔案數、分類數、低信心與待審數。
- 長任務可取消，不阻塞主畫面。
- 正式寫入前顯示差異、來源、Snapshot 與 rollback 能力。