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
- Screenshot Pipeline Regression with independent local OCR, OCR/AI bridge, and UC.IMG jobs
- War Room regression
- G14 Backup / FULL75 / Data Consistency / Public Catalog

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
- `ci-p6b-screenshot-pipeline-parity-contract.mjs`

## P5 core / Update Center / public-knowledge convergence
P5 uses a two-PR retirement protocol so predecessor evidence is never deleted before replacement parity exists.

P5A parity proof:
- PR: `#316`
- fixed head: `00d1a3920e792f1db4218c8ba3fde1d1a6484c41`
- merge SHA: `62cb13599e7956c0e2ca9d60872d53d6783ba036`
- six predecessor workflows and both successor domain runners executed on the same PR head;
- 16 triggered PR workflows completed successfully;
- post-merge main push completed 10 workflows with zero failures.

P5B retired six wrappers only after that proof. Their behaviors remain in `regression-gate.yml` and `historical-release-regression.yml`. P5 topology result was **33 → 27**, `behavioral_contracts_removed=0`; later phases may reduce the current count below that historical milestone.

## P6A Screenshot / OCR / UC.IMG convergence
P6A used the same parity-before-retirement protocol.

P6A-1 parity proof:
- PR: `#322`
- fixed head: `1876a56f92142f29b015b7085f751041e8a9380a`
- merge SHA: `bd84d2b9e4cd7797ef71c7ccd304f8de0c65ebb8`
- 15/15 triggered PR workflows PASS;
- post-merge main push: 15 success / 0 failure / 0 queued / 0 in-progress.

P6A-2 retired:
- `v04133-shared-gemini-transport-diagnostic.yml`
- `v04134-recipe-pot-scenario-contract.yml`
- `v04135-account-capacity-apply-not-null.yml`
- `v04136-pot-manual-authority-alignment.yml`

P6A topology result was **27 → 23**, `behavioral_contracts_removed=0`. The exact v0.4.13.x behavioral scripts first moved into `uc-img-a.yml` and, after P6B, remain preserved in the UC.IMG job of `screenshot-pipeline-regression.yml`.

## P6B Screenshot pipeline domain-runner convergence
P6B replaces the three screenshot-domain workflow files with one domain workflow while preserving independent job boundaries.

### P6B-1 — side-by-side parity
- PR: `#324`
- fixed head: `807191569ad29ee27022e95ef685efde1ac32808`
- merge SHA: `fd9adc9894787e4b4b75e08dcab521005e468887`
- 13/13 triggered PR workflows PASS;
- predecessor workflows `data1d1-ocr-regression.yml`, `g13-ocr-ai-regression.yml`, and `uc-img-a.yml` all executed on the same fixed head as `screenshot-pipeline-regression.yml`;
- the successor's three jobs (`local-ocr`, `ocr-ai-bridge`, `uc-img-update-center`) each completed successfully;
- post-merge main push: 13 success / 0 failure / 0 queued / 0 in-progress.

### P6B-2 — controlled retirement
Only after that proof, retire:
- `data1d1-ocr-regression.yml`
- `g13-ocr-ai-regression.yml`
- `uc-img-a.yml`

Behavior is not deleted. `screenshot-pipeline-regression.yml` keeps three independent jobs:
- `local-ocr` runs the DATA.1D.1 runner and historical consolidation contract;
- `ocr-ai-bridge` keeps G13 core-on-push/full-on-PR behavior plus syntax and repository-non-mutation checks;
- `uc-img-update-center` retains UC.IMG/Gemini/Update Center contracts, including all P6A-retired v0.4.13.x behavior.

Trigger coverage is preserved or deliberately widened to all pull requests, pushes to `main`, pushes to `hotfix/**`, and `workflow_dispatch`. The successor remains `contents: read`, contains no `git commit`/`git push`, and does not mutate player SQLite data.

P6B final topology result is **23 → 21 workflow YAML files** relative to the P6A baseline (temporary parity topology 24 → 21 at retirement), with `behavioral_contracts_removed=0`.

## Release mutation policy
Test/regression workflows are not release writers.

Main workflows must not:
- request `contents: write`;
- run `git push`;
- run `git commit`;
- reintroduce old version-named `fix/`, `feature/`, or `hotfix/` branch listeners.

Deployment-specific GitHub Pages permissions such as `pages: write` / `id-token: write` are a separate deployment boundary and are not repository-content mutation authority.

## Version-specific workflow policy
The small set of version-specific workflows still tracked after P0–P6B cleanup is grandfathered as the current baseline. It is not a template for future growth.

Any additional `v*.yml` standalone workflow causes the topology contract to fail until the PR either:
1. moves the new behavior into an existing consolidated/domain runner; or
2. explicitly updates the topology baseline and documents why an independent workflow is required.

## Registry-stale workflow identities
Known retired workflow identities may remain visible through GitHub Actions even though no corresponding YAML exists on `main`. This includes the old v0.3.93 identities, the P5-retired wrappers, the P6A-retired v0.4.13.x wrappers, and after P6B the retired DATA.1D.1/G13/UC.IMG workflow identities. These are classified `REGISTRY_STALE_NO_MAIN_FILE`. Main-tree truth wins; do not recreate them to make registry counts match.

## Change procedure
For any CI topology change:
1. preserve or add the behavioral contract first;
2. prove replacement parity before retiring a wrapper;
3. retire wrappers in a controlled change rather than deleting evidence;
4. keep high-value independent safety gates visible;
5. update the topology policy only when the new shape is intentional;
6. require `Frontend Regression Gate` to pass the global topology policy before expensive browser work proceeds.
