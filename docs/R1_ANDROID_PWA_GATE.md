# R1.1 Android PWA Post-Merge Gate

## Preconditions

- PR CI is green.
- PR is merged to `main`.
- GitHub Pages serves the merged main revision.
- Existing local backup is available.

## PASS gates

1. Version authority does not downgrade after refresh or full-close/reopen.
2. `CANONICAL_EXACT` resolves the unchanged official name and allows commit.
3. `CANONICAL_ALIAS_SAFE` shows raw and canonical names and allows commit.
4. `CANONICAL_ALIAS_REVIEW` requires explicit manual confirmation and cannot auto-commit.
5. `CANONICAL_UNKNOWN` is blocked and added only to the review candidate queue.
6. Resolution evidence retains source reference and evidence revision.
7. Pokemon count remains 75.
8. Player ingredient/item quantities remain identical to the pre-test snapshot.
9. Player recipe unlock states remain identical to the pre-test snapshot.
10. SQLite export, JSON export, refresh, PWA reopen and offline app shell remain operational.

Any failed gate requires a hotfix branch and another full CI/merge/deploy cycle.
