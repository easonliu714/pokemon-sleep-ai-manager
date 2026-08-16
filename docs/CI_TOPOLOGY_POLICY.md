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
- Recipe Regression with independent authority/formula/evidence/release jobs
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
- `ci-p7-recipe-regression-parity-contract.mjs`

## P5 core / Update Center / public-knowledge convergence
P5 used a two-PR retirement protocol. P5A fixed head `00d1a3920e792f1db4218c8ba3fde1d1a6484c41` in PR #316 proved side-by-side parity; P5B then retired six wrappers. Historical topology milestone: **33 → 27**, `behavioral_contracts_removed=0`.

## P6 Screenshot / OCR / UC.IMG convergence
P6 also used parity-before-retirement.

P6A:
- PR #322 fixed head `1876a56f92142f29b015b7085f751041e8a9380a`; 15/15 PR workflows PASS; main 15 success / 0 failure.
- PR #323 retired four v0.4.13.x wrappers after proof.
- topology **27 → 23**, behavior loss 0.

P6B:
- PR #324 fixed head `807191569ad29ee27022e95ef685efde1ac32808`; 13/13 PR workflows PASS; all three candidate successor jobs PASS; main 13 success / 0 failure.
- PR #325 retired `data1d1-ocr-regression.yml`, `g13-ocr-ai-regression.yml`, and `uc-img-a.yml` after proof.
- final topology **23 → 21** with `screenshot-pipeline-regression.yml` preserving three independent jobs: `local-ocr`, `ocr-ai-bridge`, and `uc-img-update-center`.
- `behavioral_contracts_removed=0`.

## P7 Recipe authority consolidation
P7 follows the same two-stage parity-before-retirement protocol.

### P7A — side-by-side parity proof
- PR: `#326`
- final fixed head: `e872fe42692fb176c3ed3e03e8218d741609a627`
- merge SHA: `681b5f53b80c1317a49edf881df5333d1747fb46`
- 17/17 triggered PR workflows PASS;
- all four predecessor recipe wrappers executed successfully on the same fixed head;
- `recipe-regression.yml` executed all four independent jobs successfully: `base-current-authority`, `formula-energy-parity`, `zh-tw-evidence`, `release-integration`;
- post-merge main push: 16 success / 0 failure / 0 queued / 0 in-progress.

P7A predecessors:
- `v042-recipe-authority-audit.yml`
- `v04221-recipe-formula-authority-audit.yml`
- `v043-r21-recipe-zh-tw-evidence-audit.yml`
- `v043-release-integration.yml`

### P7B — controlled retirement
PR #327 retires the four wrappers only after the P7A proof above. Behavioral ownership remains in `recipe-regression.yml` under four independently visible jobs:
- `base-current-authority` — v0.4.2 single/current recipe authority, provenance, strategy projection, player-state preservation, and related evidence-gated contracts;
- `formula-energy-parity` — version authority, full 78-recipe formula audit, level/energy authority, and predecessor release replay;
- `zh-tw-evidence` — synthetic/privacy-safe screenshot evidence, canonical zh-TW naming, FULL50 reconciliation, selector/team contracts, G14 renderer authority, and existing-player preservation;
- `release-integration` — unified workbench predecessor replay, controlled selector/team contracts, v0.4.2 historical compatibility, v0.4.3 release integration, private-source guard, and non-mutation check.

The temporary P7A no-op trigger marker is removed during P7B, and the R2.6 comment-only trigger change is restored. Trigger coverage remains deliberately widened in the successor to all pull requests, pushes to `main`, `hotfix/**`, `feature/**`, and `workflow_dispatch`.

P7 topology target/result on P7B merge is **21 → 18 workflow YAML files** relative to the P6B baseline (temporary parity topology 22 → 18 at retirement), with:
- `behavioral_contracts_removed=0`;
- Production numeric authority unchanged;
- all retained test CI read-only and repository-non-mutating;
- no player SQLite mutation.

## Release mutation policy
Test/regression workflows are not release writers.

Main workflows must not:
- request `contents: write`;
- run `git push`;
- run `git commit`;
- reintroduce old version-named `fix/`, `feature/`, or `hotfix/` branch listeners.

Deployment-specific GitHub Pages permissions such as `pages: write` / `id-token: write` are a separate deployment boundary and are not repository-content mutation authority.

## Version-specific workflow policy
After P7 retirement, only version-specific workflows explicitly retained by topology policy remain grandfathered. They are not a template for future growth. Any additional `v*.yml` standalone workflow fails topology policy unless explicitly justified as an independent safety boundary.

## Registry-stale workflow identities
Retired identities may remain visible in GitHub Actions even though their YAML no longer exists on `main`. These are `REGISTRY_STALE_NO_MAIN_FILE`; main-tree truth wins. This includes P5, P6A, P6B, and P7 retired workflow identities.

## Change procedure
For any CI topology change:
1. preserve or add the behavioral contract first;
2. prove replacement parity before retiring a wrapper;
3. retire wrappers in a controlled change rather than deleting evidence;
4. keep high-value independent safety gates visible;
5. update the topology policy only when the new shape is intentional;
6. require `Frontend Regression Gate` to pass the global topology policy before expensive browser work proceeds.
