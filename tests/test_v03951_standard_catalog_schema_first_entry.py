from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_standard_catalog_schema_compatibility_contract():
    migrations = read("assets/js/migrations.js")
    schema = read("assets/js/shared-master-schema.js")
    renderer = read("assets/js/public-catalog-workbench.js")

    assert "applyStandardCatalogCompatibilityMigration" in migrations
    assert "hadEffectDescription" in migrations
    assert "if(hadEffectDescription)return false" in migrations
    assert "addColumnIfMissing(db,'item_master','effect_description_zh_tw','TEXT')" in migrations
    assert "applyStandardCatalogCompatibilityMigration(db);" in migrations
    assert "VALUES(8,datetime('now'))" not in migrations
    assert "effect_description_zh_tw TEXT" in schema
    assert "tableHasColumn('item_master','effect_description_zh_tw')" in renderer
    assert "NULL AS effect_description_zh_tw" in renderer
    assert "PUBLIC_CATALOG_RENDER_FAILED" in renderer


def test_first_entry_lazy_render_contract():
    renderer = read("assets/js/public-catalog-workbench.js")

    assert "requestAnimationFrame" in renderer
    assert "button.addEventListener('click',scheduleRender)" in renderer
    assert "button.addEventListener('click',scheduleRender,true)" not in renderer
    assert "window.addEventListener('pokemon-sleep:database-ready'" in renderer
    assert "scheduleRender();" in renderer
    assert "first_entry_after_navigation:true" in renderer
    assert "schema_compatible_items:true" in renderer
    assert "MutationObserver" not in renderer
