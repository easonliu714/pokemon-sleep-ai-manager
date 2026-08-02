# v0.3.57 Two-Stage OCR / Versioned Exports Validation

## Required build

- App Version: `v0.3.57`
- Build: `20260803-data1d1-two-stage-ocr-versioned-exports`
- Cache: `pokemon-sleep-ai-v0.3.57-data1d1-two-stage-ocr-versioned-exports`

## Two-stage OCR

1. Import or re-open an existing duplicate screenshot ZIP.
2. Select a Pokemon basic or skill-detail preset.
3. Select one or more screenshots.
4. Run `兩階段重新 OCR 已勾選圖片`.
5. Confirm trace records `two_stage=true`, `general_scale=2`, and `small_text_scale=4`.
6. Confirm `ocr_stage_summary.evidence_merged=true` and region evidence includes `general` and `small_text` stages.
7. Confirm binary preprocessing is not forced on.

## Versioned exports

Export each available JSON package and confirm:

- File name contains `v0.3.57`.
- File name contains `20260803-data1d1-two-stage-ocr-versioned-exports`.
- Source ZIP name, when present, is only a trailing source hint.
- JSON top level contains `app_version` and `app_build`.
- The source archive name remains available separately and does not replace app version.

## Privacy

No export may contain image bytes, Base64 images, full API keys, or full OCR text.
