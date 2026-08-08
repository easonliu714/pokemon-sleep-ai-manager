from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def test_profile_completeness_engine_exists_and_classifies_slots():
    source = read('assets/js/profile-completeness.js')
    assert 'buildProfileCompletenessReport' in source
    assert 'user_confirmed_not_visible' in source
    assert "status: 'missing'" in source
    assert 'INGREDIENT_LEVELS' in source
    assert 'SUBSKILL_LEVELS' in source


def test_derived_unlock_state_uses_current_level():
    source = read('assets/js/profile-completeness.js')
    assert 'unlocked: level >= unlockLevel' in source
    assert 'currentIngredientMissing' in source
    assert 'currentSubskillMissing' in source


def test_analysis_readiness_is_explicit_and_degradable():
    source = read('assets/js/profile-completeness.js')
    assert 'profile_analysis_ready' in source
    assert 'team_builder' in source
    assert 'training_coach' in source
    assert 'evolution_planner' in source
    assert 'reasons:' in source


def test_confirmations_are_persisted_in_general_import_history():
    importer = read('assets/js/importer.js')
    assert 'profile_audit_confirmations:payload.profile_audit_confirmations||[]' in importer
    assert 'result_json' in importer


def test_full75_compatibility_anchor_keeps_general_completeness_without_ui():
    workbench = read('assets/js/full75-recovery-workbench.js')
    assert "import './profile-completeness.js';" in workbench
    assert 'profile_completeness_enabled: true' in workbench
    assert 'general_update_center_required: true' in workbench
    assert 'dedicated_ui_present: false' in workbench
    assert 'full75RecoveryWorkbench' not in workbench


def test_v0397_contract_remains_available_after_release_advances():
    authority = read('assets/js/version-authority.js')
    completeness = read('assets/js/profile-completeness.js')
    assert "app_version: 'v0.3.97'" in authority
    assert 'buildProfileCompletenessReport' in completeness
    assert 'profile_completeness_rendered' in completeness
