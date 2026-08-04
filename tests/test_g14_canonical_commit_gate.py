from pathlib import Path

root = Path(__file__).resolve().parents[1]
gate = (root / "assets/js/canonical-commit-gate.js").read_text(encoding="utf-8")
public_master = (root / "assets/js/public-empty-profile-master.js").read_text(encoding="utf-8")
registry = (root / "assets/js/canonical-registry.js").read_text(encoding="utf-8")
multicapture = (root / "assets/js/data-consistency-multicapture.js").read_text(encoding="utf-8")

required_gate_tokens = [
    "window.addEventListener('click',gate,true)",
    "#applyConfirmedAnalysis",
    "CANONICAL_EXACT",
    "CANONICAL_ALIAS_SAFE",
    "CANONICAL_ALIAS_REVIEW",
    "CANONICAL_UNKNOWN",
    "event.preventDefault()",
    "event.stopImmediatePropagation()",
    "canonical_source_value",
    "canonical_resolution",
    "canonical_term_id",
    "canonical_commit_gate_checked",
    "canonical_commit_gate_blocked",
]
for token in required_gate_tokens:
    assert token in gate, f"missing canonical gate contract: {token}"

assert "import('./canonical-commit-gate.js?v=20260804-v0379-canonical-commit-gate')" in public_master
assert "INSERT INTO ingredient_inventory" not in public_master
assert "INSERT INTO item_inventory" not in public_master
assert "INSERT INTO pokemon" not in public_master

for alias, canonical in [
    ("辣味香草", "火辣香草"),
    ("品質雞蛋", "特選蛋"),
    ("特殊蛋", "特選蛋"),
]:
    assert f"'{alias}':'{canonical}'" in registry

assert "document.addEventListener('click',safeApply,true)" in multicapture
assert gate.index("window.addEventListener('click',gate,true)") >= 0

print({
    "ok": True,
    "gate": "G14.4_CANONICAL_COMMIT_GATE",
    "entities_enforced": ["ingredient"],
    "safe_aliases_checked": 3,
    "unknown_terms_blocked": True,
    "private_seed": False,
})
