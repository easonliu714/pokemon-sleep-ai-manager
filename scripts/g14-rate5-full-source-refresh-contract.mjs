import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POKEMON_PROVISIONAL_RATING_RULE_VERSION as rule} from '../assets/js/pokemon-provisional-rating.js';
import {capturePokemonRatingRefreshAuthority as capture,
  reviewPokemonRatingRefreshAuthority as review} from '../assets/js/pokemon-rating-refresh-authority.js';

// Synthetic source facts only; no SQLite/IDB, HTTP, storage, player writes or app import.
const original={
  rule_version:rule,sqlite_generation:3,sqlite_sha256:'a'.repeat(64),
  import_revision:'import-1',restore_revision:'restore-1',
  observation_revision:'observation-1',
  pokemon:[
    {pokemon_id:'A',pokemon_instance_id:'unique-A',species:'same',rating:'S',level:20,nature:'固執'},
    {pokemon_id:'B',pokemon_instance_id:'unique-B',species:'same',rating:'S',level:20,nature:'固執'}
  ],
  ingredients:[{pokemon_id:'A',slot:1,name:'apple'},{pokemon_id:'B',slot:1,name:'milk'}],
  subskills:[{pokemon_id:'A',unlock_level:10,name:'幫忙速度S'},
    {pokemon_id:'B',unlock_level:50,name:'幫忙速度S'}]
};
const baseline=JSON.stringify(original);
const captured=capture(original);
assert.equal(captured.status,'CAPTURED_READ_ONLY');
assert.equal(Object.isFrozen(captured.token),true);
assert.equal(review({captured,latest:original}).status,'FRESH_READ_ONLY_SOURCE_TEST');
assert.equal(review({captured,latest:{
  ...original,pokemon:[...original.pokemon].reverse(),
  ingredients:[...original.ingredients].reverse(),
  subskills:[...original.subskills].reverse()
}}).status,'FRESH_READ_ONLY_SOURCE_TEST','row order is not a fact change');
const changed=(patch,reason)=>{
  const observed=review({captured,latest:{...original,...patch}});
  assert.equal(observed.status,'STALE_REVIEW_REQUIRED');
  assert.deepEqual(observed.reason_codes,[reason]);
  assert.equal(observed.overwrite_allowed,false);
  assert.equal(observed.player_data_write,false);
};
changed({rule_version:'different-rule'},'RULE_VERSION_STALE');
changed({sqlite_generation:4},'DURABLE_GENERATION_CHANGED');
changed({sqlite_sha256:'b'.repeat(64)},'DURABLE_BYTES_CHANGED');
changed({import_revision:'import-2'},'IMPORT_REVISION_CHANGED');
changed({restore_revision:'restore-2'},'RESTORE_REVISION_CHANGED');
changed({observation_revision:'observation-2'},'OBSERVATION_REVISION_CHANGED');
changed({pokemon:original.pokemon.map((r,i)=>i===0?{...r,level:21}:r)},'ROSTER_FACTS_CHANGED');
changed({pokemon:original.pokemon.map((r,i)=>i===0?{...r,nature:'勇敢'}:r)},'ROSTER_FACTS_CHANGED');
changed({pokemon:original.pokemon.map((r,i)=>i===0?{...r,pokemon_instance_id:'changed-A'}:r)},'ROSTER_FACTS_CHANGED');
changed({ingredients:original.ingredients.map((r,i)=>i===0?{...r,name:'honey'}:r)},'INGREDIENT_FACTS_CHANGED');
changed({subskills:original.subskills.map((r,i)=>i===1?{...r,unlock_level:25}:r)},'SUBSKILL_FACTS_CHANGED');
for(const bad of [
  {...original,sqlite_sha256:null},
  {...original,subskills:null},
  {...original,pokemon:[original.pokemon[0],{...original.pokemon[0]}]},
  {...original,pokemon:[original.pokemon[0],{...original.pokemon[1],pokemon_instance_id:'unique-A'}]},
  {...original,ingredients:[{pokemon_id:'unknown',slot:1}]},
  {...original,subskills:[{pokemon_id:'unknown',unlock_level:10}]},
  {...original,pokemon:[{...original.pokemon[0],nature:undefined}]}
]){
  assert.equal(capture(bad).status,'HOLD_SOURCE_UNVERIFIED');
  assert.equal(review({captured,latest:bad}).status,'HOLD_SOURCE_UNVERIFIED');
}
assert.equal(review({captured:null,latest:original}).status,'HOLD_SOURCE_UNVERIFIED');
assert.equal(JSON.stringify(original),baseline,'capture or review mutated source facts');
assert.equal(original.pokemon[0].rating,'S','old grade must be untouched');
const code=fs.readFileSync('assets/js/pokemon-rating-refresh-authority.js','utf8');
const app=fs.readFileSync('assets/js/app.js','utf8');
assert.doesNotMatch(code,/\b(?:run|persist|snapshot|begin|commit|rollback|indexedDB|localStorage|fetch)\s*\(/);
assert.doesNotMatch(app,/pokemon-rating-refresh-authority/,'not production admitted');
console.log('PASS G14_RATE5_FULL_SOURCE_REFRESH_STALE_GUARD_SYNTHETIC');
console.log('HOLD G14_RATE5_PRODUCTION_AUTHORITY_AND_ALL_WRITER_ADMISSION');
