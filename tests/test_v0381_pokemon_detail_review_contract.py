from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_v0381_runtime_authority_and_cache_rotation():
    bootstrap = read("assets/js/bootstrap.js")
    worker = read("service-worker.js")
    assert "APP_VERSION='v0.3.81'" in bootstrap
    assert "20260804-v0381-pokemon-detail-review-merge" in bootstrap
    assert "const APP_VERSION = 'v0.3.81'" in worker
    assert "pokemon-sleep-ai-v0.3.81-v0381-pokemon-detail-review-merge" in worker


def test_ai_contract_includes_sleep_and_evolution_fields():
    source = read("assets/js/ai-review-queue-executor.js")
    for token in [
        '"sleep_hours": null',
        '"sleep_time_text": null',
        '"evolution_requirements"',
        '"sleep_hours_required": null',
        '"field_evidence": {}',
    ]:
        assert token in source


def test_review_ui_matches_detail_and_uses_patch_semantics():
    source = read("assets/js/analysis-confirmation-workbench.js")
    for token in [
        "共眠時數",
        "進化條件",
        "CANONICAL_ALIAS_SAFE",
        "CANONICAL_UNKNOWN",
        "pokemon_analysis_observation",
        "ON CONFLICT(pokemon_id,unlock_level) DO UPDATE",
        "暫存待判斷",
    ]:
        assert token in source
    assert "DELETE FROM pokemon_subskills" not in source
    assert "DELETE FROM pokemon_ingredients" not in source


def test_detail_page_exposes_new_fields_and_evidence():
    source = read("assets/js/pokemon-detail.js")
    for token in [
        "共眠時數",
        "共眠時間原文",
        "進化條件",
        "進化共眠時數門檻",
        "pokemon_analysis_observation",
        "辨識 Evidence",
    ]:
        assert token in source
