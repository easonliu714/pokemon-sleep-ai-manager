# G12.1E Evolution UI CI Boundary

Status: APPROVED INDEPENDENT SAFETY/UI BOUNDARY

`g121e-evolution-ui-regression.yml` is intentionally retained as a separately visible workflow rather than folded into a historical or domain-consolidated runner.

Reason: G12.1D introduces a new user-visible PWA evolution recommendation surface whose correctness depends on a cross-boundary contract: deterministic G12.1B/C read-side authority, fail-closed recommendation semantics, `pokemon_instance_id` isolation, acquisition-authority suppression, verified-only night projection, read-only/no-mutation behavior, War Room page-loader wiring, and mobile render smoke. A single independent Gate makes this release-critical boundary visible without granting repository-content mutation permission.

This approval is narrow:
- it does not weaken or replace any predecessor regression;
- it does not authorize frontend business-logic recomputation;
- it does not authorize AI to decide evolution status or recommendation;
- it does not change P0-B6 migration 15 or G12.1 migration 16;
- it remains read-only and must not request `contents: write`;
- the repository topology becomes 13 workflow YAML files, still inside the governed 11–14 band;
- P8 historical retirement evidence remains frozen; only its post-retirement topology assertion is made successor-aware for this explicitly approved independent Gate.

Any future standalone workflow still requires its own topology-policy amendment and independent-boundary justification.