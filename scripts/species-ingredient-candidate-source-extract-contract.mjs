import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_SPECIES_FORM_ROSTER_ROWS} from '../assets/js/public-pokemon-species-form-roster.js';
import {PUBLIC_INGREDIENT_CANONICAL_NAMES} from '../assets/js/public-ingredient-identity.js';

const source=fs.readFileSync('scripts/species-ingredient-candidate-source-extract.mjs','utf8');
assert.equal(PUBLIC_SPECIES_FORM_ROSTER_ROWS.length,242);
assert.equal(PUBLIC_INGREDIENT_CANONICAL_NAMES.length,19);
for(const token of [
  "PINNED_COMMIT='fc36317b195125c63bf56d3777fa3ed1a9548831'",
  "'common/src/types/pokemon/berry-pokemon.ts'",
  "'common/src/types/pokemon/ingredient-pokemon.ts'",
  "'common/src/types/pokemon/skill-pokemon.ts'",
  "'common/src/types/pokemon/all-pokemon.ts'",
  'PINNED_SOURCE_BLOB_SHA_MISMATCH',
  "candidate_lifecycle:'IDENTITY_GENERATION_TIME'",
  "production_slot_distribution_authority:false",
  "ingredient_probability_authority:false",
  "private_player_data_used:false",
  "player_slot_identity_generated:false",
])assert.ok(source.includes(token),`extractor boundary token missing: ${token}`);
assert.equal(source.includes('ingredientPercentage:'),false,'extractor must not embed hidden-rate values');
assert.equal(source.includes('pokemon_ingredients'),false,'extractor must not write player ingredient rows');
assert.equal(source.includes('INSERT INTO'),false,'extractor must not write SQLite');
assert.equal(source.includes('UPDATE '),false,'extractor must not mutate player/public DB');

const workflow=fs.readFileSync('.github/workflows/regression-gate.yml','utf8');
const legacyInvocation=workflow.includes('node scripts/species-ingredient-candidate-source-extract.mjs');
const resilientInvocation=workflow.includes('node --import ./scripts/pinned-evidence-fetch-resilience-preload.mjs scripts/species-ingredient-candidate-source-extract.mjs');
assert.equal(legacyInvocation||resilientInvocation,true,'pinned species ingredient extractor invocation missing');
if(resilientInvocation){
  assert.ok(fs.existsSync('scripts/pinned-evidence-fetch-resilience-preload.mjs'),'resilient preload missing');
  assert.ok(fs.existsSync('scripts/pinned-evidence-fetch-resilience-contract.mjs'),'resilient transport contract missing');
  assert.ok(workflow.includes('node scripts/pinned-evidence-fetch-resilience-contract.mjs'),'resilient transport contract must run before pinned extraction');
  assert.ok(workflow.includes('node --import ./scripts/pinned-evidence-fetch-resilience-preload.mjs scripts/species-form-zh-tw-identity-source-extract.mjs'),'zh-TW pinned extractor must use the same resilience boundary');
}
assert.ok(workflow.includes("ALLOW_PINNED_EVIDENCE_FETCH: '1'"));
assert.ok(workflow.includes('public-species-ingredient-and-identity-source-audit'));
assert.ok(workflow.includes('artifacts/public-species-ingredient-candidate-source.json'));
assert.ok(workflow.includes('artifacts/public-species-form-zh-tw-identity-source.json'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'PUBLIC_SPECIES_INGREDIENT_CANDIDATE_SOURCE_BOUNDARY',
  governed_roster_rows:242,
  current_canonical_ingredients:19,
  pinned_source_files:4,
  invocation_mode:resilientInvocation?'PINNED_RESILIENT_PRELOAD':'LEGACY_DIRECT',
  combined_source_artifact_upload:true,
  hidden_rate_authority:false,
  production_slot_distribution_authority:false,
  player_slot_generation:false,
  sqlite_write:false,
},null,2));
