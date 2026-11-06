import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPokemonRosterRatingView,renderPokemonRosterRatingViewHtml} from '../assets/js/pokemon-roster-rating-preview.js';
import {POKEMON_PROVISIONAL_RATING_RULE_VERSION} from '../assets/js/pokemon-provisional-rating.js';

// Synthetic-only: no player SQLite/IDB, storage, HTTP or mutation.
const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const slots=id=>names.map((subskill_name,index)=>({pokemon_id:id,unlock_level:[10,25,50,70,80][index],subskill_name,is_unlocked:1}));
const base={pokemon_id:'instance-A',pokemon_instance_id:'unique-A',species:'同物種',nickname:'<img src=x onerror=alert(1)>',
  level:20,specialty:'樹果',nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-'};
const other={...base,pokemon_id:'instance-B',pokemon_instance_id:'unique-B',nickname:'second',nature:null,rating:'A'};
const input={pokemon:[base,other],subskills:[...slots('instance-A'),...slots('instance-B')],ingredients:[]};
const before=JSON.stringify(input);
const view=buildPokemonRosterRatingView(input);
assert.equal(view.status,'PREVIEW_ONLY');
assert.equal(view.plan.rule_version,POKEMON_PROVISIONAL_RATING_RULE_VERSION);
assert.deepEqual(view.plan.summary,{total:2,eligible:1,changed:1,held:1});
assert.equal(view.rows.length,2);
assert.equal(view.rows.find(x=>x.pokemon_id==='instance-A').previous_rating,'D-');
assert.equal(view.rows.find(x=>x.pokemon_id==='instance-A').proposed_rating,'S+');
assert.equal(view.rows.find(x=>x.pokemon_id==='instance-B').proposed_rating,null);
assert.ok(view.rows.find(x=>x.pokemon_id==='instance-B').missing_inputs.includes('verified_nature'));
assert.ok(view.rows.find(x=>x.pokemon_id==='instance-A').future_evidence.some(x=>x.unlock_level===50));
assert.ok(view.rows.find(x=>x.pokemon_id==='instance-A').current_evidence.every(x=>x.unlock_level<=20),
  'future is_unlocked must not count as CURRENT');
assert.equal(JSON.stringify(input),before,'read-only preview mutated its source rows');
assert.equal(base.rating,'D-','legacy rating overwritten');
assert.equal(other.rating,'A','held rating overwritten');
assert.equal(view.player_data_write,false);
assert.equal(view.overwrite_allowed,false);
const html=renderPokemonRosterRatingViewHtml(view);
assert.match(html,/全盒評等差異預覽（唯讀，未覆寫）/);
assert.match(html,/CURRENT 證據/);
assert.match(html,/FUTURE 證據/);
assert.match(html,/data-rate3-state="HOLD"/);
assert.match(html,/data-rate3-state="PROVISIONAL"/);
assert.doesNotMatch(html,/<img src=x onerror/,'HTML injection must be escaped');
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html,/<button[^>]+(?:apply|save|overwrite)/i,'preview must not offer a write action');

for(const missing of [{},{pokemon:[base]},{pokemon:[base],ingredients:[]}]) {
  const held=buildPokemonRosterRatingView(missing);
  assert.equal(held.status,'HOLD_SOURCE_UNAVAILABLE');
  assert.equal(held.plan,null);
  assert.match(renderPokemonRosterRatingViewHtml(held),/data-rate3-hold/);
}
const duplicate=buildPokemonRosterRatingView({...input,pokemon:[base,{...base}]});
assert.ok(duplicate.plan.held.some(x=>x.reason_codes.includes('missing_or_duplicate_pokemon_id')));
const noRows=buildPokemonRosterRatingView({pokemon:[],ingredients:[],subskills:[]});
assert.equal(noRows.plan.summary.total,0);
assert.match(renderPokemonRosterRatingViewHtml(noRows),/目前沒有可比對個體/);

const ui=fs.readFileSync('assets/js/pokemon-roster-rating-preview.js','utf8');
const app=fs.readFileSync('assets/js/app.js','utf8');
assert.match(app,/setupPokemonRosterRatingPreview\(/,'existing Pokémon view must mount RATE.3');
assert.match(app,/invalidatePokemonRosterRatingPreview\(\)/,'stale view must be invalidated on refresh');
assert.match(app,/isRescueReadonly\(\)\|\|getSqlitePersistStatus\(\)\.status!=='READY'/);
assert.match(ui,/button\.addEventListener\('click'/,'rating projection must be user-triggered');
assert.doesNotMatch(ui,/\b(?:run|persist|snapshot|begin|commit|rollback)\s*\(/,'preview must not write player DB');
assert.doesNotMatch(ui,/\b(?:fetch|indexedDB|localStorage|sessionStorage)\s*\(/,'preview must remain local');
console.log(JSON.stringify({gate:'G14_RATE3_ROSTER_VISIBLE_OLD_NEW_DIFF_SOURCE_TEST',status:'PASS',
  read_only:true,synthetic_only:true,missing_hold:true,identity_isolation:true,
  current_future_separate:true,previous_rating_unchanged:true,stale_invalidation:true}));
