from pathlib import Path

root = Path(__file__).resolve().parents[1]
module = (root / 'assets/js/public-catalog-workbench.js').read_text(encoding='utf-8')
recipe_workbench_path = root / 'assets/js/recipe-unified-player-workbench.js'
recipe_workbench = recipe_workbench_path.read_text(encoding='utf-8') if recipe_workbench_path.exists() else ''
app = (root / 'assets/js/app.js').read_text(encoding='utf-8')
version = (root / 'assets/js/version-authority.js').read_text(encoding='utf-8')
migrations = (root / 'assets/js/migrations.js').read_text(encoding='utf-8')
database = (root / 'assets/js/database.js').read_text(encoding='utf-8')
item_master = (root / 'assets/js/public-item-master.js').read_text(encoding='utf-8')
item_seed = (root / 'assets/js/public-empty-profile-master.js').read_text(encoding='utf-8')
recipe_master = (root / 'assets/js/public-recipe-master.js').read_text(encoding='utf-8')
recipe_canonical = (root / 'assets/js/public-recipe-canonical-authority.js').read_text(encoding='utf-8')
recipe_current = (root / 'assets/js/public-recipe-current-authority.js').read_text(encoding='utf-8')
legacy_recipe = (root / 'assets/js/v0383-catalog-ocr-review-contract.js').read_text(encoding='utf-8')
shared_master = (root / 'assets/js/shared-master-data.js').read_text(encoding='utf-8')
rescue = (root / 'assets/js/v0389-rescue-catalog-import.js').read_text(encoding='utf-8')
shared_ui = (root / 'assets/js/shared-knowledge-ui.js').read_text(encoding='utf-8')
contract = root / 'docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md'

required = [
    'ingredient_catalog_state', 'item_catalog_state',
    "document.readyState==='loading'", 'activeView', 'requestRender',
    'drainRenderQueue', 'requestedGeneration', 'completedGeneration',
    'pokemon-sleep:data-changed', 'pokemon-sleep:database-ready',
    'PUBLIC_CATALOG_LAZY_READY', 'lazy_renderer:true',
    'mutation_observer:false', 'first_entry_after_navigation:true',
    'cause_aware_generation_queue:true', 'schema_compatible_items:true',
    'canonical-ingredient-qty', 'canonical-item-qty',
]
for token in required:
    assert token in module, f'missing public catalog lazy-render contract: {token}'

assert 'MutationObserver' not in module
assert 'catalogIsMissing' not in module
assert 'ensureCatalogAuthority' not in module
assert "[0,80,250,750,1500]" not in module
assert "button.addEventListener('click',scheduleRender,true)" not in module
assert "button.addEventListener('click',()=>requestRender(button.dataset.view,'navigation'))" in module
assert 'requestAnimationFrame' in module
assert "['ingredients','items','recipes'].includes(view)" in module
assert "view==='ingredients'" in module
assert "view==='items'" in module

if recipe_workbench_path.exists():
    # v0.4.12+: public-catalog-workbench remains the lazy render shell, while one
    # dedicated Recipe Workbench owns recipe_catalog_state, recipeTable and player edits.
    for token in [
        "from './recipe-unified-player-workbench.js'",
        'renderRecipeUnifiedWorkbench()',
        'recipe_workbench_version',
        'recipe_workbench_authority',
    ]:
        assert token in module, f'missing unified recipe delegation contract: {token}'
    for token in [
        'recipe_catalog_state', 'canonical-recipe-unlocked',
        "from './public-recipe-current-authority.js'",
        "document.getElementById('recipeTable')", 'lockedRecipeTable',
    ]:
        assert token in recipe_workbench, f'missing unified recipe owner contract: {token}'
    assert "from './public-recipe-canonical-authority.js'" not in recipe_workbench, 'unified recipe workbench must not bypass current recipe authority'
    assert 'INSERT INTO recipes' not in module, 'public catalog shell must not own a second recipe writer'
    assert 'renderRecipeCatalog()' not in module, 'legacy recipe renderer must be retired after delegation'
else:
    for token in ['recipe_catalog_state', 'canonical-recipe-unlocked']:
        assert token in module, f'missing historical recipe catalog contract: {token}'
    assert 'else renderRecipeCatalog()' in module

# Formal public-master database version contract is normative and CI-blocking.
assert contract.exists(), 'missing formal public master database version contract'
text = contract.read_text(encoding='utf-8')
for phrase in [
    'Fresh database contract', 'Existing database startup contract',
    'Master update safety contract', 'Single-authority contract',
    'Required version keys', 'CI enforcement',
]:
    assert phrase in text, f'missing contract section: {phrase}'

# Rescue and standard mode must consume one item authority.
assert 'export const PUBLIC_ITEM_MASTER=' in item_master
assert 'export const PUBLIC_ITEM_MASTER_VERSION=' in item_master
assert "import {PUBLIC_ITEM_MASTER} from './public-item-master.js'" in rescue
assert 'const ITEM_EFFECTS=' not in rescue
assert "import {PUBLIC_ITEM_MASTER,PUBLIC_ITEM_MASTER_VERSION} from './public-item-master.js'" in item_seed
assert 'effect_description_zh_tw=excluded.effect_description_zh_tw' in item_seed
assert "VALUES('public_item_master_version'" in item_seed

# Recipe base facts remain in public-recipe-master.js. The predecessor canonical projection
# is historical evidence only; runtime display/sync consumers must use current authority.
assert 'export const PUBLIC_RECIPE_MASTER_VERSION=' in recipe_master
assert 'export const PUBLIC_RECIPE_MASTER=' in recipe_master
assert 'export const PUBLIC_RECIPE_ALIASES=' in recipe_master
assert 'export function applyPublicRecipeMaster' in recipe_master
assert 'export const PUBLIC_RECIPE_CANONICAL_NAME_VERSION=' in recipe_canonical
assert 'export const PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES=' in recipe_canonical
assert "from './public-recipe-master.js'" in recipe_canonical
assert "from './public-recipe-canonical-authority.js'" in recipe_current
recipe_runtime_owner = recipe_workbench if recipe_workbench_path.exists() else module
assert "from './public-recipe-current-authority.js'" in recipe_runtime_owner
assert "from './public-recipe-canonical-authority.js'" not in recipe_runtime_owner
assert "from './public-recipe-master.js'" not in recipe_runtime_owner
assert 'PokemonSleepPublicRecipeRegistry' not in recipe_runtime_owner
assert 'const RECIPES' not in shared_master
assert 'const RECIPES' not in legacy_recipe
assert "authority:'public-recipe-master.js'" in legacy_recipe
assert 'database_write_performed:false' in legacy_recipe
assert 'player_state_write:false' in legacy_recipe
for forbidden in [
    'DELETE FROM recipes', 'UPDATE recipes SET', 'INSERT INTO recipes(',
    'INSERT OR REPLACE INTO recipes',
]:
    assert forbidden not in recipe_master, f'public recipe updater mutates player data: {forbidden}'
    assert forbidden not in recipe_canonical, f'canonical recipe projection mutates player data: {forbidden}'
    assert forbidden not in recipe_current, f'current recipe projection mutates player data: {forbidden}'

# Version audit must be local-first and only persist when schema/master changed.
for token in [
    'auditAndSyncPublicMasters', 'shared_master_version',
    'public_recipe_master_version', 'public_item_master_version',
    'canonical_registry_version', 'applied.shared!==expected.shared',
    'applied.recipes!==expected.recipes', 'applied.items!==expected.items',
    'applied.canonical!==expected.canonical',
]:
    assert token in migrations, f'missing public master version audit token: {token}'
assert 'BOOT_PERSIST_SKIPPED' in database
assert 'Schema 與公版版本未變更；直接使用本機 SQLite' in database
assert "persistRequired=!restored||Boolean(migrationResult?.database_changed)" in database

# Public updaters may not mutate player projections.
for forbidden in [
    'UPDATE item_inventory', 'INSERT INTO item_inventory',
    'UPDATE ingredient_inventory', 'INSERT INTO ingredient_inventory',
    'UPDATE recipes SET unlocked', 'DELETE FROM recipes',
]:
    assert forbidden not in item_seed, f'public item updater mutates player data: {forbidden}'

# recipeTable has one owner. v0.4.12 folds unlocked analysis into that owner and keeps
# locked recipes in one separate table; older releases used two shared-knowledge tables.
if recipe_workbench_path.exists():
    assert "document.getElementById('recipeTable')" in recipe_workbench
    assert 'personalRecipeAnalysisTable' not in shared_ui
    assert 'referenceRecipeTable' not in shared_ui
    assert "document.getElementById('recipeTable')" not in shared_ui
    assert recipe_workbench.count('INSERT INTO recipes') == 1
else:
    assert "document.getElementById('personalRecipeAnalysisTable')" in shared_ui
    assert "document.getElementById('referenceRecipeTable')" in shared_ui
    assert "document.getElementById('recipeTable')" not in shared_ui

# Legacy application rendering remains before the .55.3.3.1 page-hydration successor.
# The successor intentionally removes hidden Recipe DOM materialization from App Ready;
# recipeTable remains governed by public-catalog-workbench -> unified Recipe Workbench.
is_page_hydration_successor = "app_version: 'v0.4.27.55.3.3.1'" in version
assert 'SELECT * FROM ingredient_inventory' in app
assert 'SELECT *, MAX(0, quantity-safe_reserve)' in app
if is_page_hydration_successor:
    assert "rows('SELECT * FROM recipes ORDER BY category, recipe_name')" not in app
    assert "from './recipe-unified-player-workbench.js'" in module
    assert 'renderRecipeUnifiedWorkbench()' in module
else:
    assert "rows('SELECT * FROM recipes ORDER BY category, recipe_name')" in app

print({
    'ok': True,
    'gate': 'G14.5_PUBLIC_MASTER_DATABASE_VERSION_AND_RENDER_AUTHORITY',
    'catalog_views': ['ingredient_catalog_state', 'item_catalog_state', 'recipe_catalog_state'],
    'renderer': 'cause_aware_generation_queue',
    'single_item_authority': True,
    'single_recipe_authority': True,
    'recipe_workbench_successor': recipe_workbench_path.exists(),
    'recipe_runtime_authority': 'public-recipe-current-authority.js',
    'recipe_base_fact_authority': 'public-recipe-master.js',
    'page_hydration_successor': is_page_hydration_successor,
    'version_audit': True,
    'unchanged_version_persist': False,
    'mutation_observer': False,
    'player_default': 'zero_or_locked',
    'private_seed': False,
})
