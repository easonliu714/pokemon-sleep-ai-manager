# CI Topology Policy

Status: ACTIVE GOVERNANCE CONTRACT

## Purpose
Keep GitHub Actions small, auditable and successor-aware without deleting behavioral evidence.

The authoritative CI topology is the set of YAML files tracked on the current `main` branch under `.github/workflows/`. GitHub Actions can retain registry identities after a workflow file or stale PR branch is gone; those registry entries are historical UI/API state and must not be used as evidence that a workflow should be recreated.

## Default rule for new work
A new feature, fix or evidence contract should add its behavioral test to an existing domain/consolidated runner whenever one exists. Creating a new standalone workflow is **deny by default**.

A new standalone workflow requires an intentional amendment to `scripts/ci-topology-policy-contract.mjs` in the same PR and a documented reason that it represents a genuinely independent safety/runtime boundary that should remain separately visible. Version numbers, roadmap phase names, or the existence of a new script are not sufficient justification.

## Protected independent workflows
The policy intentionally preserves independently visible high-value boundaries including:
- Frontend/browser regression
- JavaScript syntax
- Private Data Guard
- Android import
- GitHub Pages deploy
- Public empty-player-profile safety
- Historical release regression
- Production evidence regression
- Legacy runtime regression
- DATA.1D.1 OCR regression
- G13 OCR/AI regression
- War Room regression
- G14 Backup / FULL75 / Data Consistency / Public Catalog
- UC.IMG unified screenshot update center

## Historical behavioral contracts
Retiring a workflow wrapper does not authorize deletion of its behavioral script/test. Consolidation contracts must continue proving that the behavioral evidence remains present and is replayed by the replacement runner.

Current topology meta-contracts replayed by the global policy:
- `ci-workflow-consolidation-contract.mjs`
- `ci-g13-workflow-consolidation-contract.mjs`
- `ci-production-workflow-consolidation-contract.mjs`
- `ci-legacy-runtime-workflow-consolidation-contract.mjs`
- `ci-data1d1-workflow-consolidation-contract.mjs`
- `ci-war-room-workflow-consolidation-contract.mjs`
- `ci-p5-wrapper-parity-contract.mjs`
- `ci-p6a-ucimg-wrapper-parity-contract.mjs`

## P5 core / Update Center / public-knowledge convergence
P5 uses a two-PR retirement protocol so predecessor evidence is never deleted before replacement parity exists.

P5A parity proof:
- PR: `#316`
- fixed head: `00d1a3920e792f1db4218c8ba3fde1d1a6484c41`
- merge SHA: `62cb13599e7956c0e2ca9d60872d53d6783ba036`
- six predecessor workflows and both successor domain runners executed on the same PR head;
- 16 triggered PR workflows completed successfully;
- post-merge main push completed 10 workflows with zero failures.

P5B retires these six wrapper files only after that proof:
- `debug-trace-manager-regression.yml`
- `v0396-general-json-audit.yml`
- `v0397-profile-completeness.yml`
- `v0398-update-center-multiscenario.yml`
- `v0399-human-readable-diff-review.yml`
- `data-evo1-observed-evolution-coverage.yml`

Their behaviors remain executable in:
- `regression-gate.yml` for Debug Trace, General JSON, Profile Completeness, Update Center multiscenario, and human-readable review;
- `historical-release-regression.yml` for Public Pokémon Knowledge / Evolution / Candy historical coverage.

P5 topology target is therefore **33 → 27 workflow YAML files**, with `behavioral_contracts_removed=0`. Core trigger coverage is widened to every PR/push on `main`; historical public-knowledge trigger coverage is the union of the retired evolution/public paths. Both successors remain read-only and repository-non-mutating.

## P6A Screenshot / OCR / UC.IMG convergence
P6A also uses parity-before-retirement. Stage P6A-1 keeps all four predecessor wrappers while the UC.IMG domain runner executes the same behavioral contracts on the same fixed PR head.

P6A-1 predecessors:
- `v04133-shared-gemini-transport-diagnostic.yml`
- `v04134-recipe-pot-scenario-contract.yml`
- `v04135-account-capacity-apply-not-null.yml`
- `v04136-pot-manual-authority-alignment.yml`

Successor ownership is `uc-img-a.yml` because these wrappers govern shared Gemini transport/diagnostics, recipe-pot screenshot scenario handling, account-capacity Update Center apply semantics, and weekly-context/pot manual authority alignment. DATA.1D.1 remains the local OCR boundary and G13 remains the OCR/AI bridge boundary; P6A does not move unrelated behavior merely to distribute wrappers across runners.

During P6A-1:
- workflow YAML count remains **27**;
- all four predecessor wrappers remain tracked;
- predecessor PR triggers are temporarily widened so all four can execute side-by-side with UC.IMG on the same PR head;
- UC.IMG preserves or widens the predecessor trigger union across PR, `main`, `hotfix/**`, and `workflow_dispatch`;
- all behavioral scripts remain executable;
- all workflows remain `contents: read` and repository-non-mutating;
- retirement is forbidden until fixed-head predecessor + successor CI is all green and the subsequent main push has zero new failures.

Only after that evidence is recorded may P6A-2 retire the four version wrappers, reducing the main-tree workflow topology from **27 → 23** with `behavioral_contracts_removed=0`.

## Release mutation policy
Test/regression workflows are not release writers.

Main workflows must not:
- request `contents: write`;
- run `git push`;
- run `git commit`;
- reintroduce old version-named `fix/`, `feature/`, or `hotfix/` branch listeners.

Deployment-specific GitHub Pages permissions such as `pages: write` / `id-token: write` are a separate deployment boundary and are not repository-content mutation authority.

## Version-specific workflow policy
The small set of version-specific workflows still tracked after P0–P5 cleanup is grandfathered as the current baseline. It is not a template for future growth.

Any additional `v*.yml` standalone workflow causes the topology contract to fail until the PR either:
1. moves the new behavior into an existing consolidated/domain runner; or
2. explicitly updates the topology baseline and documents why an independent workflow is required.

## Registry-stale workflow identities
Known examples such as the old v0.3.93 release/startup workflow identities and the six P5-retired wrapper identities may remain visible through GitHub Actions even though no corresponding YAML exists on `main`. These are classified `REGISTRY_STALE_NO_MAIN_FILE`. Main-tree truth wins; do not recreate them to make registry counts match.

## Change procedure
For any CI topology change:
1. preserve or add the behavioral contract first;
2. prove replacement parity before retiring a wrapper;
3. retire wrappers in a controlled change rather than deleting evidence;
4. keep high-value independent safety gates visible;
5. update the topology policy only when the new shape is intentional;
6. require `Frontend Regression Gate` to pass the global topology policy before expensive browser work proceeds.
