from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_general_importer_preserves_existing_values_for_empty_incoming():
    source = read("assets/js/importer.js")
    assert "preserve_existing_empty_incoming" in source
    assert "clear_fields" in source
    assert "null_overwrite_policy:'preserve_existing_unless_clear_fields'" in source
    assert "field_audit" in source
    assert "profile_audit_confirmations" in source


def test_user_review_acceptance_is_recorded():
    source = read("assets/js/ai-workflow.js")
    assert "accepted_current_observation:true" in source
    assert "confirmed_at:reviewedAt" in source
    assert "empty_field_count" in source
    assert "空值欄位" in source


def test_full75_dedicated_apply_is_retired():
    workbench = read("assets/js/full75-recovery-workbench.js")
    engine = read("assets/js/full75-recovery-engine.js")
    assert "panel.dataset.status = 'retired'" in workbench
    assert "送至一般更新中心" in workbench
    assert "此區不再提供獨立 Dry Run 或 Apply" in workbench
    assert "applyFull75Payload()" in engine
    assert "throw new Error(RETIRED_MESSAGE)" in engine
    assert "import { applyPayload" not in engine


def test_update_center_exposes_field_audit_and_confirmation_ui():
    source = read("assets/js/general-update-field-audit-ui.js")
    assert "一般 JSON 欄位稽核" in source
    assert "user_confirmed_not_visible" in source
    assert "採納目前辨識結果" in source
    assert "fieldAuditTable" in source
    assert "dryRun(loadedPayload)" in source


def test_prompt_catalog_uses_non_destructive_update_contract():
    source = read("assets/js/prompt-catalog.js")
    assert "空字串與省略欄位代表「不更新」" in source
    assert "operation.clear_fields" in source
    assert "profile_audit_confirmations" in source
    assert "public_candidate_fill" not in source or "不得使用公版物種候選值" in source
    assert "blank_values:'preserve_existing'" in source
    assert "accepted_current_observation:false" in source


def test_observation_v2_exposes_non_visible_slot_audit_candidates():
    source = read("assets/js/ai-observation.js")
    assert "audit_candidates" in source
    assert "user_confirmed_not_visible" in source
    assert "public_candidate_fill:'forbidden'" in source
    assert "空值在更新中心代表保留既有值" in source
    assert "confirmed_by_user:false" in source


def test_version_authority_is_v0396():
    source = read("assets/js/version-authority.js")
    assert "app_version: 'v0.3.96'" in source
    assert "20260807-v0396-general-json-audit-full75-retirement" in source
