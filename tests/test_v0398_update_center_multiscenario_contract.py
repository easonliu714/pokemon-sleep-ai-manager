import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def test_release_may_advance_while_v0398_contract_remains_supported():
    source = read('assets/js/version-authority.js')
    match = re.search(r"app_version:\s*'v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?'", source)
    assert match, 'central app_version must remain parseable'
    version = tuple(int(value or 0) for value in match.groups())
    assert version >= (0, 3, 98, 0), 'current release must not regress below v0.3.98'
    assert Path(ROOT / 'docs/V0398_UPDATE_CENTER_MULTISCENARIO_CONTRACT.md').exists()


def test_profile_confirmation_changes_sync_to_main_update_center_payload():
    audit = read('assets/js/general-update-field-audit-ui.js')
    app = read('assets/js/app.js')
    assert 'synchronizeCanonicalPayload' in audit
    assert 'input.onchange' in audit
    assert 'await mainHandler.call' in audit
    assert 'profile_confirmation_checkbox_changed' in audit
    assert 'canonical_payload_rebuilt' in audit
    assert 'main_state_payload_reloaded' in audit
    assert 'workflow_validation_completed' in audit
    assert 'dry_run_eligibility_changed' in audit
    assert '全部採納目前辨識結果' in audit
    assert 'state.payload = JSON.parse(await file.text())' in app
    assert 'state.workflow = validateWorkflow(state.payload)' in app
    assert "$('dryRunBtn').disabled = Boolean(result.errors.length || result.review.length)" in app


def test_mobile_review_ui_groups_confirmations_and_preserves_human_review_evidence():
    audit = read('assets/js/general-update-field-audit-ui.js')
    app_css = read('assets/css/app.css')
    review_css = read('assets/css/v0399-review.css')
    assert "issues.insertAdjacentElement('afterend', panel)" in audit
    assert 'profile-confirmation-groups' in audit
    assert 'profile-confirmation-card' in audit
    assert 'semanticPokemonPreview' in audit
    assert '目前 SQLite' in audit
    assert '玩家資料無差異' in audit
    assert '食材配置' in audit
    assert '副技能' in audit
    assert '.profile-confirmation-check{display:grid' in app_css
    assert 'overflow-wrap:anywhere' in app_css
    assert '@media(max-width:700px)' in app_css
    assert '.profile-confirmation-groups{grid-template-columns:1fr' in app_css
    assert '.review-detail-grid' in review_css
    assert '.no-player-change' in review_css
    assert 'profile-preview-key' not in audit


def test_general_importer_supports_all_private_update_scenarios():
    source = read('assets/js/importer.js')
    assert "ingredient_inventory: ['ingredient_name']" in source
    assert "item_inventory: ['item_name']" in source
    assert "recipes: ['recipe_id']" in source
    assert 'resolveOperationKey' in source
    assert "recipe_name=?" in source
    assert 'managedData' in source
    assert "ingredient_master" in source
    assert "item_master" in source
    assert "recipe_master" in source


def test_zero_and_false_are_values_not_empty():
    importer = read('assets/js/importer.js')
    workflow = read('assets/js/ai-workflow.js')
    assert 'value === 0 || value === false' in importer
    assert 'explicit_zero_and_false_are_values:true' in importer
    assert "[true,false,0,1]" in workflow
    assert 'validNonNegativeInteger' in workflow


def test_recipe_status_can_resolve_public_recipe_name_and_hydrate_insert():
    source = read('assets/js/importer.js')
    assert "operation.key?.recipe_name" in source or "key.recipe_name" in source
    assert "SELECT recipe_id FROM recipe_master WHERE recipe_name=?" in source
    assert "SELECT recipe_id,category,recipe_name,total_ingredients FROM recipe_master" in source
    assert "data.category = master.category" in source
    assert "data.recipe_name = master.recipe_name" in source


def test_prompt_catalog_exposes_inventory_and_recipe_status_contracts():
    source = read('assets/js/prompt-catalog.js')
    contract = read('assets/js/update-package-contract.js')
    assert 'scenario=ingredient_inventory_update' in source
    assert 'scenario=item_inventory_update' in source
    assert 'scenario=recipe_status_update' in source
    assert 'quantity=0' in source
    assert 'unlocked=false' in source
    assert "explicit_zero_and_false:'write_value'" in contract
    assert "recipes:['recipes']" not in source


def test_scenario_entity_boundaries_are_enforced():
    source = read('assets/js/ai-workflow.js')
    assert 'SCENARIO_ENTITIES' in source
    assert 'ingredient_inventory_update' in source
    assert 'item_inventory_update' in source
    assert 'recipe_status_update' in source
    assert '不屬於 scenario=' in source


def test_no_special_inventory_or_recipe_apply_path_is_introduced():
    source = read('assets/js/importer.js')
    prompt = read('assets/js/prompt-catalog.js')
    assert 'applyIngredient' not in source
    assert 'applyItemInventory' not in source
    assert 'applyRecipeStatus' not in source
    assert "contract:'update-package-v1.1'" in prompt
