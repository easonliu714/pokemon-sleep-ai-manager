# TECH.1B Duplicate / Skeleton Pokémon Guard

## Problem

A weak placeholder can retain an older level while the completed record has already advanced. The previous convergence rule required an exact level match, leaving active incomplete duplicates such as:

- 土王 Lv31 complete + 土王 Lv30 skeleton
- 猛火猴 Lv25 complete + 猛火猴 Lv21 skeleton

## Safe convergence contract

A weak skeleton is eligible only when all of the following are true:

- `identity_review_required = 1`
- `identity_confidence < 0.95`
- no `registered_at`
- no `identity_fingerprint`
- at most one of `main_skill`, `nature`, `helper_seconds`, `carry_limit`, `sp` is populated

It can merge only into exactly one strong candidate with:

- same original label/species
- same specialty
- same type
- no conflict in any populated nickname/rating/AI recommendation evidence
- level difference no greater than 10

Ambiguous or conflicting candidates remain untouched for manual review.

## Preservation

The transaction preserves ingredients, subskills, history, evolution relations and identity evidence. The losing record is archived rather than deleted. A pre-merge snapshot is created and the transaction rolls back on failure.

## Regression fixtures

Executable cases cover:

- 土王 Lv31 + stale Lv30 skeleton => one merge
- 猛火猴 Lv25 + stale Lv21 skeleton => one merge
- two strong 土王 candidates => no automatic merge
- conflicting recommendation evidence => no automatic merge
- active skeleton audit => gate failure
