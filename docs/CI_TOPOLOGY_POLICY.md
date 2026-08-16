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
- JavaScript syntax / failure-notification boundary
- Android import
- GitHub Pages deploy
- Historical release regression
- Production evidence regression
- Legacy runtime regression
- Screenshot Pipeline Regression with independent local OCR, OCR/AI bridge, and UC.IMG jobs
- Recipe Regression with independent authority/formula/evidence/release jobs
- War Room regression
- G14 Safety Regression during P8 parity
- Data Boundary Regression during P8 parity

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
- `ci-p8-safety-boundary-parity-contract.mjs`

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
P7 used the same two-stage protocol.

P7A:
- PR #326 final fixed head `e872fe42692fb176c3ed3e03e8218d741609a627`;
- 17/17 PR workflows PASS;
- all four predecessor recipe wrappers and four successor jobs PASS;
- merge `681b5f53b80c1317a49edf881df5333d1747fb46`;
- post-merge main 16 success / 0 failure.

P7B:
- PR #327 final fixed head `61ec5eaa397bd33f0ddca86b7f7088096b4570e9`;
- 13/13 PR workflows PASS;
- merge `04ba6441d07a5581cda76ceb634c11f97bf3cafc`;
- post-merge main 13 terminal workflows / zero failure, queued, in-progress, or cancelled;
- retired four recipe authority wrappers only after parity;
- final topology **21 → 18** with `recipe-regression.yml` preserving four independent jobs;
- `behavioral_contracts_removed=0`, Production numeric authority unchanged.

## P8 Safety-boundary workflow-file convergence
P8A is side-by-side parity only. The P7 final main-tree topology starts at **18**. Two new candidate safety-domain workflows are temporarily added while all eight planned predecessors remain tracked, so parity topology is **18 → 20**.

### G14 candidate successor
`g14-safety-regression.yml` preserves four independently visible jobs:
- `backup-truth-restore`
- `data-consistency-multicapture`
- `full75-recovery`
- `public-catalog-authority`

Predecessors retained during P8A:
- `g14-backup-truth-restore.yml`
- `g14-data-consistency-multicapture.yml`
- `g14-full75-recovery.yml`
- `g14-public-catalog-renderer-authority.yml`

The successor preserves all-PR coverage and push-to-main coverage. The old backup workflow's exact `feat/v0377a-backup-truth-restore-verification` listener is deliberately widened to `feat/**` rather than retaining a stale implementation branch identity. Jobs remain independent; no fail-fast mega-job is introduced.

### Data-boundary candidate successor
`data-boundary-regression.yml` preserves two independent jobs:
- `private-data-guard` — exact tracked-private-artifact rejection, including full-history checkout;
- `empty-player-public-pages` — exact public/private separation and zero-state view contract.

Predecessors retained during P8A:
- `privacy-guard.yml`
- `public-pages-empty-profile.yml`

The successor preserves all-PR and push-to-main coverage, remains `contents: read`, and does not weaken private-data or empty-profile separation.

### v0.4.8 wrapper classification
The remaining version wrappers are classified by exact behavioral contents rather than their labels:
- `v0481-live-followup.yml`
- `v0484-touch-first-camp-containment.yml`

Both are historical/public-knowledge/weekly-context/camp-containment regression wrappers. Their exact behavioral contracts are absorbed into `historical-release-regression.yml` / `ci-historical-release-regression.mjs`, including v0.4.8.1 release semantics, LIVE follow-up behavior, v0.4.8 historical release behavior, typed event effects, candy inventory, weekly AI type repair, weekly-context integration, and the original syntax checks. A comment-only change to the already-governed `v0481-live-followup-contract.mjs` forces both predecessors onto the P8A fixed parity head without changing behavior.

### Standalone JavaScript syntax evaluation
P8 explicitly evaluated retirement of `js-syntax-check.yml` and **does not retire it**. It remains an independent boundary because it owns both:
- exhaustive `find assets/js -type f -name '*.js'` syntax coverage; and
- an `issues: write` failure-notification behavior that creates/updates a syntax failure issue.

Moving only the syntax loop into a read-only domain runner would lose notification behavior; moving `issues: write` into a broad regression runner would unnecessarily widen write permissions. Since the preferred final target is a band rather than a forced numeric minimum, keeping this boundary is the safer result.

### P8A retirement gate
No workflow may be retired until the same fixed PR head proves all eight predecessors plus all successors green, followed by a fully terminal main push with zero failure / queued / in-progress jobs. All new P8 safety-domain workflows remain read-only and repository-non-mutating.

If P8A parity passes, P8B may retire exactly eight predecessors:
- four G14 workflows;
- `privacy-guard.yml` and `public-pages-empty-profile.yml`;
- `v0481-live-followup.yml` and `v0484-touch-first-camp-containment.yml`.

Expected P8 final topology: **20 → 12** at retirement, equivalently **18 → 12** relative to the P7 baseline. This is inside the preferred 11–14 band with `behavioral_contracts_removed=0`; no additional syntax retirement is required.

## Release mutation policy
Test/regression workflows are not release writers.

Main workflows must not:
- request `contents: write`;
- run `git push`;
- run `git commit`;
- reintroduce old version-named `fix/`, `feature/`, or `hotfix/` branch listeners.

`js-syntax-check.yml` retains `issues: write` only for its existing failure-notification boundary; it does not receive repository `contents: write`. Deployment-specific GitHub Pages permissions such as `pages: write` / `id-token: write` are a separate deployment boundary and are not repository-content mutation authority.

## Version-specific workflow policy
During P8A, `v0481-live-followup.yml` and `v0484-touch-first-camp-containment.yml` are grandfathered only as fixed-head predecessor evidence. They are not a template for future growth and become retirement candidates only after parity proof.

## Registry-stale workflow identities
Retired identities may remain visible in GitHub Actions even though their YAML no longer exists on `main`. These are `REGISTRY_STALE_NO_MAIN_FILE`; main-tree truth wins.

## Change procedure
For any CI topology change:
1. preserve or add the behavioral contract first;
2. prove replacement parity before retiring a wrapper;
3. retire wrappers in a controlled change rather than deleting evidence;
4. keep high-value independent safety gates visible;
5. update the topology policy only when the new shape is intentional;
6. require `Frontend Regression Gate` to pass the global topology policy before expensive browser work proceeds.
