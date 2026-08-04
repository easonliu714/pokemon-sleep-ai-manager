# Data Consistency & Multi-Capture Contract

Status: normative architecture contract.

## Formal flow

Image revisions from the same Pokémon may be complementary. OCR and AI revisions are accumulated in a capture group before formal commit.

`multiple screenshots -> merged draft -> conflict review -> snapshot -> transaction -> persist -> immediate UI refresh`

## Required rules

1. `missing` does not mean `clear`.
2. An empty child array does not authorize deleting existing subskills or ingredients.
3. Existing Pokémon updates use patch semantics. Only non-empty, user-confirmed fields may replace existing scalar values.
4. Child tables may be replaced only when the confirmed draft contains a non-empty validated array.
5. Multiple screenshot revisions stay in the same capture group until the user explicitly starts a new Pokémon group.
6. Conflicting non-empty values must be surfaced for manual confirmation; the system must not silently choose either value.
7. Object values must be normalized to supported scalar fields. Strings such as `[object Object]`, `[object Array]`, `undefined`, and `null` are forbidden in formal Pokémon fields.
8. Every formal write requires a snapshot, transaction, persist, history record, and source revision/group references.
9. A successful commit must publish `pokemon-sleep:data-changed` and refresh the Pokémon list from SQLite without a page reload.
10. Entering the Pokémon view must re-query SQLite to prevent stale in-memory lists.
11. Rating absence is distinct from ability-data absence and must display as `未設定`, not as a blank cell.
12. Special Pokémon may use an explicit completeness exception contract; they must not be forced into the ordinary 5-subskill/3-ingredient shape without source evidence.

## Forbidden regressions

- Replacing the current draft whenever a new screenshot revision arrives.
- Unconditional `DELETE FROM pokemon_subskills` or `DELETE FROM pokemon_ingredients` on an existing-Pokémon update.
- Requiring browser refresh to display a committed Pokémon.
- Treating a missing field in a later screenshot as an instruction to erase an earlier confirmed value.
- Automatically merging individuals based only on species name.
