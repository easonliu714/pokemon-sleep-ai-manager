from pathlib import Path

root = Path(__file__).resolve().parents[1]
module = (root / 'assets/js/public-catalog-workbench.js').read_text(encoding='utf-8')
app = (root / 'assets/js/app.js').read_text(encoding='utf-8')

required = [
    'ingredient_catalog_state',
    'item_catalog_state',
    'recipe_catalog_state',
    "document.readyState==='loading'",
    'activeView',
    'renderCurrent',
    'scheduleRender',
    'pokemon-sleep:data-changed',
    'pokemon-sleep:database-ready',
    'PUBLIC_CATALOG_LAZY_READY',
    'lazy_renderer:true',
    'mutation_observer:false',
    'canonical-ingredient-qty',
    'canonical-item-qty',
    'canonical-recipe-unlocked',
]
for token in required:
    assert token in module, f'missing public catalog lazy-render contract: {token}'

# v0.3.95 intentionally removed the MutationObserver and repeated repair timers
# that competed with app.refresh() and caused Android main-thread stalls.
assert 'MutationObserver' not in module
assert 'catalogIsMissing' not in module
assert 'ensureCatalogAuthority' not in module
assert "[0,80,250,750,1500]" not in module

# Legacy application rendering remains for compatibility. The canonical
# controller now renders only the active public page after navigation/data events.
assert 'SELECT * FROM ingredient_inventory' in app
assert 'SELECT *, MAX(0, quantity-safe_reserve)' in app
assert "rows('SELECT * FROM recipes ORDER BY category, recipe_name')" in app
assert "view==='ingredients'" in module
assert "view==='items'" in module
assert "view==='recipes'" in module
assert "document.querySelectorAll('nav button')" in module

print({
    'ok': True,
    'gate': 'G14.5_PUBLIC_CATALOG_RENDERER_AUTHORITY',
    'catalog_views': ['ingredient_catalog_state', 'item_catalog_state', 'recipe_catalog_state'],
    'renderer': 'active_view_lazy',
    'mutation_observer': False,
    'player_default': 'zero_or_locked',
    'private_seed': False,
})
