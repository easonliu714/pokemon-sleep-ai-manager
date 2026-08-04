# Phase R1.1 Canonical Recognition Normalization

## Scope

This phase normalizes OCR/AI recognition results against the public canonical registry before any formal data commit.

It does not seed or modify:

- player ingredient quantity
- player item quantity
- player recipe unlock state
- private Pokemon records

## Resolution contract

| Status | Automatic canonical replacement | Formal commit |
|---|---:|---:|
| `CANONICAL_EXACT` | no replacement required | allowed |
| `CANONICAL_ALIAS_SAFE` | allowed | allowed |
| `CANONICAL_ALIAS_REVIEW` | prohibited | blocked until manual review |
| `CANONICAL_UNKNOWN` | prohibited | blocked |

Every resolution is recorded in `canonical_resolution_log`. Review and unknown observations are accumulated in `canonical_alias_candidate` without modifying `canonical_term_alias`.

## Evidence

Each recognition can preserve:

- source type
- source reference
- evidence revision
- raw text
- normalized text
- selected canonical term
- confidence
- observed time
- committed time

## PWA validation after merge

1. Existing canonical name resolves as `CANONICAL_EXACT`.
2. Approved safe OCR alias resolves as `CANONICAL_ALIAS_SAFE`.
3. Review alias is shown for manual confirmation and cannot commit automatically.
4. Unknown text cannot commit and appears in the candidate queue.
5. Existing 75 Pokemon and all player inventory/unlock values remain unchanged.
6. Refresh, full-close/reopen, offline shell, SQLite export and JSON export remain operational.
