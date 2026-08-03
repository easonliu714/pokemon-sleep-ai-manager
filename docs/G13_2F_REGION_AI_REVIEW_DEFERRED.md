# G13.2F Region AI Review Deferred

Version: v0.3.64
Build: 20260803-g13-2f-region-ai-review-deferred

## Contract

- Required review render batches are limited to `inventory_export` and `ocr_actions`.
- `review-render-completed` and the import terminal event must occur before any heavy AI review or full inventory workbench initialization.
- The OCR region AI review panel is loaded only after an explicit user action.
- The full inventory workbench is loaded only after an explicit user action.
- Optional panel failures must not roll back or block an already completed import batch.
- Duplicate-only ZIP batches remain usable for Manifest export and manual AI review selection without automatic heavy panel mounting.
