from pathlib import Path

root = Path(__file__).resolve().parents[1]
module = (root / 'assets/js/public-catalog-workbench.js').read_text(encoding='utf-8')
app = (root / 'assets/js/app.js').read_text(encoding='utf-8')

required = [
    'ingredient_catalog_state',
    'item_catalog_state',
    'recipe_catalog_state',
    "document.readyState==='loading'",
    'MutationObserver',
    'catalogIsMissing',
    'ensureCatalogAuthority',
    'authoritative_renderer:true',
    "['ingredientTable','itemTable','recipeTable']",
    'canonical-ingredient-qty',
    'canonical-item-qty',
    'canonical-recipe-unlocked',
]
for token in required:
    assert token in module, f'missing public catalog authority contract: {token}'

# Legacy application rendering is allowed to remain for compatibility, but the
# public catalog controller must explicitly detect and repair its empty-player
# table output after initialization and every later refresh.
assert 'SELECT * FROM ingredient_inventory' in app
assert 'SELECT *, MAX(0, quantity-safe_reserve)' in app
assert "rows('SELECT * FROM recipes ORDER BY category, recipe_name')" in app
assert 'scheduleRender' in module
assert 'pokemon-sleep:data-changed' in module
assert 'pageshow' in module

print({
    'ok': True,
    'gate': 'G14.5_PUBLIC_CATALOG_RENDERER_AUTHORITY',
    'catalog_views': ['ingredient_catalog_state', 'item_catalog_state', 'recipe_catalog_state'],
    'player_default': 'zero_or_locked',
    'private_seed': False,
})
