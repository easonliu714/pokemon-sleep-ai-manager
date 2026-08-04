# G13.5 統一圖片匯入與辨識流程契約

更新日期：2026-08-04
狀態：正式流程契約

## 目標

單張圖片、多張圖片與 ZIP 不再走不同的 Inventory、Preview、OCR 或 AI 路徑。所有來源固定進入同一條流程：

```text
新增圖片／新增 ZIP
→ 建立可讀取原圖的 Archive Adapter
→ 建立統一 Inventory
→ SHA-256 清點與重複標示
→ 使用者預覽與勾選
→ 選擇辨識底板與重新辨識策略
→ 兩階段 OCR（2× 全圖＋4× 小字）
→ 單張 AI Vision
→ OCR／AI Cross Check
→ Confidence Engine
→ 人工確認
→ Snapshot／SQLite Transaction／Commit
```

## 必要規則

1. 圖片來源必須建立與 ZIP 相同的 `archive.readImage()` 能力，不得只回傳 File 清單而沒有 Inventory。
2. SHA-256 重複只代表預設略過，不能阻擋預覽、重新 OCR 或重新 AI。
3. Inventory 是預覽、OCR、AI 與 Revision 的唯一來源。
4. 預設策略為 `兩階段 OCR → 自動 AI → Cross Check`。
5. 使用者可選擇：OCR＋AI、只 OCR、只 AI、使用既有 Revision。
6. 策略包含 AI 時，必須先取得圖片上傳同意。
7. OCR 固定保留 `general_scale = 2` 與 `small_text_scale = 4`。
8. 一次只處理目前一張圖片，完成後才進下一張。
9. 單張圖片 AI 診斷區塊不再作為獨立正式入口；正式入口只有統一匯入工作台。
10. Cross Check 與 Confidence Engine 不得自動寫入正式資料；仍需人工確認。

## 實機 Gate

- 單張圖片匯入後 `inventory.total >= 1`。
- ZIP 匯入後 Inventory 與單張圖片具有相同操作。
- 重複圖片可預覽。
- 重複圖片可強制執行兩階段 OCR。
- 預設策略可依序完成 OCR、AI、Cross Check。
- 執行期間可取消目前 OCR，不破壞已完成 Revision。
- 頁面不得 Freeze；API Key 不得進入 Queue、Revision 或 DebugTrace。
