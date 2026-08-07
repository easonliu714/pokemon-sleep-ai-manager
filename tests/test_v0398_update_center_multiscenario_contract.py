from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def test_version_authority_is_v0398():
    source = read('assets/js/version-authority.js')
    assert "app_version: 'v0.3.98'" in source
    assert '20260807-v0398-update-center-multiscenario-dryrun-state' in source


def test_profile_confirmation_changes_replace_canonical_json_input():
    source = read('assets/js/general-update-field-audit-ui.js')
    assert 'replaceCanonicalFilePayload' in source
    assert "input.dispatchEvent(new Event('change', { bubbles: true }))" in source
    assert "profile_audit_confirmation_changed" in source
    assert 'canonical_payload_synced:true' in source
    assert '全部採納目前辨識結果' in source


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
    assert 'scenario=ingredient_inventory_update' in source
    assert 'scenario=item_inventory_update' in source
    assert 'scenario=recipe_status_update' in source
    assert 'quantity=0' in source
    assert 'unlocked=false' in source
    assert "explicit_zero_and_false:'write_value'" in source
    assert "recipes:['recipes']" not in source  # prevent accidental static malformed mapping


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
