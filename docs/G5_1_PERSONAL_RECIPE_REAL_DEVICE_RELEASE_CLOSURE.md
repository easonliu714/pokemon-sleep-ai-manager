# G5.1 Personal Recipe System — Real-device Release Closure

## Authority

- Payload already merged by PR #459 into main.
- Issue #1 remains OPEN until owner Android/PWA physical validation passes.
- G14.1 `.55.3.3.13` has merged to main; this branch is reconciled from that exact predecessor before `.14` release-authority mutation.

## Successor reservation

G5.1 closure reserves the next exact tuple:

- version: `v0.4.27.55.3.3.14`
- build: `20260927-v0427553314-g51-personal-recipe-real-device-closure`
- cache: `pokemon-sleep-ai-v0.4.27.55.3.3.14-v0427553314-g51-personal-recipe-real-device-closure`

`.14` must explicitly preserve `.13` predecessor version/build/cache lineage.

## Required closure work

1. Reconcile branch with current main immediately before release-authority mutation.
2. Promote version/build/cache only after predecessor lineage is exact.
3. Ensure `personal-recipe-authority.js` and `personal-recipe-service.js` are included in PWA offline precache.
4. Preserve public Recipe Master read-only and player-private SQLite boundaries.
5. Run focused G5.1 regressions plus all required exact-head CI.
6. Mark Ready only on one unchanged all-green exact head.
7. Merge with expected-head SHA protection.
8. Require new-main exact-SHA CI all green and GitHub Pages deployment on the same SHA.
9. Verify live exact version/build/cache.
10. Request owner Android/PWA physical validation. Issue #1 stays OPEN until owner PASS evidence exists.

## Owner physical acceptance

- Empty/local-only state can create a personal recipe.
- Edit category, name, unlocked state, recipe level, current energy, notes.
- Add/edit/delete ingredient rows and quantities; `total_ingredients` equals deterministic quantity sum.
- Reload preserves the full recipe and ingredients.
- Public-master refresh neither overwrites nor deletes player recipes.
- Delete is explicit and persists after reload.
- Backup JSON/SQLite retains all personal recipe fields and ingredient rows.
- Mobile editor remains usable on Android/PWA.
