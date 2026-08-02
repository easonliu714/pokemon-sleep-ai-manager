# DATA.1D.1 OCR Overlay Browser Lifecycle Gate

本 Gate 為 Android PWA 實機驗證前的最後軟體驗證，不新增產品功能。

## 自動化驗證範圍

- Object URL 建立與 revoke 數量必須完全一致。
- 超過 `maxActive` 時，自動回收最舊 URL。
- 同一 ID 重新附加圖片時，先 revoke 舊 URL。
- `release(id)` 與 `releaseAll()` 後 active count 正確。
- 匯入來源切換後 active count 歸零。
- OCR 取消後 active count 歸零。
- ZIP selection clear 後 active count 歸零。
- `pagehide` 後 active count 歸零。
- lifecycle `dispose()` 後 active count 歸零。
- 不允許同一 Object URL 被重複 revoke。

## 邊界

此 Gate 無法取代 Android Chrome/PWA 的真實記憶體、背景切換、裝置效能與觸控操作驗證。CI 通過後，下一 Gate 為 `DATA1D1_OCR_OVERLAY_ANDROID_PWA_VALIDATION.md`。
