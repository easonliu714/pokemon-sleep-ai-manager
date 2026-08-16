# CI Topology Policy

Status: ACTIVE GOVERNANCE CONTRACT

## Purpose
Keep GitHub Actions small, auditable and successor-aware without deleting behavioral evidence.

The authoritative CI topology is the set of YAML files tracked on the current `main` branch under `.github/workflows/`. GitHub Actions can retain registry identities after a workflow file or stale PR branch is gone; those registry entries are historical UI/API state and must not be used as evidence that a workflow should be recreated.

## Default rule for new work
A new feature, fix or evidence contract should add its behavioral test to an existing domain/consolidated runner whenever one exists. Creating a new standalone workflow is **deny by default**.

A new standalone workflow requires an intentional amendment to `scripts/ci-topology-policy-contract.mjs` in the same PR and a documented reason that it represents a genuinely independent safety/runtime boundary that should remain separately visible. Version numbers, roadmap phase names, or the existence of a new script are not sufficient justification.

## Final protected domain workflows
After P5–P8 convergence, the intended main-tree topology is 12 workflow YAML files:
- `regression-gate.yml` — core frontend/browser and global topology policy
- `js-syntax-check.yml` — exhaustive JS syntax + failure issue notification boundary
- `tech2d-android-import-regression.yml` — Android/file-picker boundary
- `deploy-pages.yml` — deployment boundary
- `data-boundary-regression.yml` — private-data guard + empty-player public-pages safety
- `historical-release-regression.yml` — predecessor/release compatibility and historical wrapper behavior
- `production-evidence-regression.yml` — numeric-authority safety boundary
- `legacy-runtime-regression.yml` — PWA/runtime migration compatibility
- `screenshot-pipeline-regression.yml` — local OCR + OCR/AI bridge + UC.IMG jobs
- `recipe-regression.yml` — recipe authority/formula/evidence/release jobs
- `war-room-regression.yml` — strategy/optimization domain
- `g14-safety-regression.yml` — backup/data-consistency/FULL75/public-catalog jobs

This 12-workflow topology is inside the preferred **11–14** band. The band is not itself the safety proof; the safety proof remains zero behavioral-contract loss, preserved/widened triggers, permission isolation, and parity-before-retirement.

## Historical behavioral contracts
Retiring a workflow wrapper does not authorize deletion of its behavioral script/test. Consolidation contracts continue proving that behavioral evidence remains present and is replayed by replacement runners.

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
- final topology **23 → 21** with `screenshot-pipeline-regression.yml` preserving three independent jobs.
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
P8 completes the convergence into the preferred target band.

### P8A — side-by-side parity proof
- PR: `#328`
- final fixed head: `9e000d2a989e67c0e644018641c07bc1406b810c`
- merge SHA: `5282362e895fdf62e43f84bb5038db02693cd8a8`
- 16/16 triggered PR workflows PASS;
- all eight planned predecessors ran successfully on the same fixed head as their successors;
- new `g14-safety-regression.yml` and `data-boundary-regression.yml` successors passed, while existing `historical-release-regression.yml` replayed the v0.4.8 wrapper behavior;
- an initial parity head exposed a test-self-reference in the FULL75 private-marker grep because the new successor embedded the same literal. The successor was corrected to construct the marker from split shell fragments, preserving the exact privacy guard without weakening it;
- post-merge main push completed **14 success / 0 failure / 0 queued / 0 in-progress / 0 cancelled** before P8B began.

### G14 successor
`g14-safety-regression.yml` preserves four independently visible jobs:
- `backup-truth-restore`
- `data-consistency-multicapture`
- `full75-recovery`
- `public-catalog-authority`

The old exact `feat/v0377a-backup-truth-restore-verification` listener is deliberately widened to `feat/**`, avoiding reintroduction of a stale implementation-branch identity while preserving that branch family coverage.

### Data-boundary successor
`data-boundary-regression.yml` preserves two independent jobs:
- `private-data-guard` — tracked-private-artifact rejection with full-history checkout;
- `empty-player-public-pages` — public/private separation and zero-state public-master rendering.

### v0.4.8 wrapper successor
`historical-release-regression.yml` / `ci-historical-release-regression.mjs` preserve the exact v0.4.8.1 / v0.4.8.4 behavior: release contracts, LIVE follow-up, typed event effects, candy inventory, weekly AI type repair, weekly-context integration, camp containment, and original syntax checks. The temporary comment-only P8A trigger is removed in P8B.

### Standalone JavaScript syntax decision
`js-syntax-check.yml` is intentionally **retained**. It owns both exhaustive `find assets/js -type f -name '*.js'` syntax coverage and an independent `issues: write` failure-notification behavior. Folding it into a read-only domain runner would either lose the notification contract or unnecessarily widen write permission. The preferred 11–14 band is met without doing so.

### P8B — controlled retirement
Only after the P8A proof, retire exactly eight predecessor workflow files:
- `g14-backup-truth-restore.yml`
- `g14-data-consistency-multicapture.yml`
- `g14-full75-recovery.yml`
- `g14-public-catalog-renderer-authority.yml`
- `privacy-guard.yml`
- `public-pages-empty-profile.yml`
- `v0481-live-followup.yml`
- `v0484-touch-first-camp-containment.yml`

P8 final topology is **18 → 12 workflow YAML files** relative to the P7 baseline (temporary parity topology 20 → 12 at retirement), with:
- `behavioral_contracts_removed=0`;
- target band 11–14 satisfied;
- test workflows read-only except the pre-existing syntax `issues: write` notification boundary;
- no repository-content mutation authority introduced;
- no player SQLite mutation;
- Production numeric authority unchanged.

## Release mutation policy
Test/regression workflows are not release writers.

Main workflows must not:
- request `contents: write`;
- run `git push`;
- run `git commit`;
- reintroduce old version-named `fix/`, `feature/`, or `hotfix/` branch listeners.

`js-syntax-check.yml` retains `issues: write` only for its existing failure-notification boundary; it does not receive repository `contents: write`. Deployment-specific GitHub Pages permissions such as `pages: write` / `id-token: write` are a separate deployment boundary and are not repository-content mutation authority.

## Version-specific workflow policy
After P8 retirement there are no version-specific workflow YAML files in the approved main-tree topology. Historical version strings and behavioral scripts remain evidence/fixtures, not workflow identities. Any future `v*.yml` standalone workflow fails topology policy unless explicitly justified as an independent safety boundary.

## Registry-stale workflow identities
Retired workflow identities may remain visible through GitHub Actions even though corresponding YAML files no longer exist on `main`. They are classified `REGISTRY_STALE_NO_MAIN_FILE`; main-tree YAML is authoritative and retired identities must not be recreated to make Actions registry counts match.

## Change procedure
For any future CI topology change:
1. preserve or add the behavioral contract first;
2. prove replacement parity before retiring a wrapper;
3. retire wrappers in a controlled change rather than deleting evidence;
4. keep high-value independent safety gates visible;
5. update the topology policy only when the new shape is intentional;
6. require `Frontend Regression Gate` to pass the global topology policy before expensive browser work proceeds.
