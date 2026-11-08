import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPokemonRosterRatingView,createPokemonRatingSelection,changePokemonRatingSelection,reviewPokemonRatingSelection,sourceTokenForPokemonRating} from '../assets/js/pokemon-roster-rating-preview.js';
import {POKEMON_PROVISIONAL_RATING_LABELS} from '../assets/js/pokemon-provisional-rating.js';

const levels=[10,25,50,70,80];
const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const skills=id=>levels.map((unlock_level,i)=>({pokemon_id:id,unlock_level,subskill_name:names[i]}));
const pokemon=(id,instance,extra={})=>({pokemon_id:id,pokemon_instance_id:instance,
  species:'同物種',level:20,specialty:'樹果',nature:'固執',
  nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-',...extra});
const input={pokemon:[pokemon('p1','one'),pokemon('p2','two',{nature:null})],
  ingredients:[],subskills:[...skills('p1'),...skills('p2')]};
const frozen=JSON.stringify(input),view=buildPokemonRosterRatingView(input);
const model=createPokemonRatingSelection(view);
assert.equal(model.eligible.length,1);
assert.equal(model.held.length,1);
assert.equal(model.selected.size,0,'original ratings must be kept by default');
assert.equal(changePokemonRatingSelection(model,'one',true),true);
assert.equal(changePokemonRatingSelection(model,'two',true),false,'HOLD must not be selectable');
let review=reviewPokemonRatingSelection(model);
assert.equal(review.status,'NON_PERSISTENT_REVIEW_ONLY');
assert.equal(review.adopt.length,1);
assert.equal(review.keep.length,0);
assert.equal(review.held.length,1);
assert.equal(review.adopt[0].old_rating,'D-');
assert.equal(review.adopt[0].new_rating,'S+');
assert.equal(review.player_data_write,false);
assert.equal(review.overwrite_allowed,false);
assert.equal(changePokemonRatingSelection(model,'one',false),true);
assert.equal(reviewPokemonRatingSelection(model).adopt.length,0);
assert.equal(reviewPokemonRatingSelection(model).keep.length,1);
assert.equal(JSON.stringify(input),frozen,'preview/selection must not mutate inputs');
const collision=buildPokemonRosterRatingView({...input,pokemon:[pokemon('p1','same'),pokemon('p2','same')]});
assert.equal(createPokemonRatingSelection(collision).eligible.length,0,'duplicate instance must HOLD both');
const duplicate=buildPokemonRosterRatingView({...input,pokemon:[pokemon('p1','one'),pokemon('p1','one')]});
assert.equal(createPokemonRatingSelection(duplicate).eligible.length,0,'duplicate pokemon id must HOLD both');
const noIdentity=buildPokemonRosterRatingView({...input,pokemon:[pokemon('p1',null)]});
assert.equal(createPokemonRatingSelection(noIdentity).eligible.length,0,'missing instance identity must HOLD');
const token=sourceTokenForPokemonRating(input);
assert.equal(sourceTokenForPokemonRating({...input,pokemon:input.pokemon.map(x=>({...x}))}),token);
assert.notEqual(sourceTokenForPokemonRating({...input,pokemon:[{...input.pokemon[0],level:21},input.pokemon[1]]}),token);
assert.notEqual(sourceTokenForPokemonRating({...input,pokemon:[{...input.pokemon[0],rating:'S'},input.pokemon[1]]}),token);
assert.notEqual(sourceTokenForPokemonRating({...input,subskills:[{...input.subskills[0],subskill_name:'幫忙速度S'},...input.subskills.slice(1)]}),token);
// Negative-first: JSON.stringify silently aliases noncanonical SQL/Observation facts.
// A missing field versus undefined, or null versus NaN, must never certify a fresh selection.
const withMissing={pokemon:[{pokemon_id:'p1',level:20}],ingredients:[],subskills:[]};
const withUndefined={pokemon:[{pokemon_id:'p1',level:20,source_revision:undefined}],ingredients:[],subskills:[]};
const withNull={pokemon:[{pokemon_id:'p1',level:null}],ingredients:[],subskills:[]};
const withNaN={pokemon:[{pokemon_id:'p1',level:Number.NaN}],ingredients:[],subskills:[]};
assert.ok(sourceTokenForPokemonRating(withMissing),'canonical source must remain readable');
assert.equal(sourceTokenForPokemonRating(withUndefined),null,'undefined source must fail closed, not alias a missing field');
assert.ok(sourceTokenForPokemonRating(withNull),'explicit SQL null is canonical UNKNOWN, not zero');
assert.equal(sourceTokenForPokemonRating(withNaN),null,'NaN must not alias explicit SQL null');
assert.equal(sourceTokenForPokemonRating({...withMissing,pokemon:[{pokemon_id:'p1',level:Infinity}]}),null);
assert.equal(sourceTokenForPokemonRating({...withMissing,pokemon:[{pokemon_id:'p1',level:20,opaque:()=>0}]}),null);
assert.deepEqual(POKEMON_PROVISIONAL_RATING_LABELS,['S+','S','S-','A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-']);
const index=fs.readFileSync('index.html','utf8');
const select=index.match(/<select id="ratingFilter">([\s\S]*?)<\/select>/)?.[1]||'';
for(const grade of POKEMON_PROVISIONAL_RATING_LABELS)assert.ok(select.includes('<option>'+grade+'</option>'),'missing 15-level rating filter '+grade);
const ui=fs.readFileSync('assets/js/pokemon-roster-rating-preview.js','utf8');
for(const hook of ['data-rate4-choice','data-rate4-select-all','data-rate4-keep-all','data-rate4-review','data-rate4-filter','data-rate4-sort','data-rate4-stale'])
  assert.ok(ui.includes(hook),'missing nonpersistent intent UI '+hook);
assert.doesNotMatch(ui,/\b(?:run|persist|snapshot|begin|commit|rollback)\s*\(/);
assert.doesNotMatch(ui,/\b(?:indexedDB|localStorage|sessionStorage)\s*\(/);
console.log('PASS G14_RATE_READONLY_PER_INDIVIDUAL_INTENT_15_LEVELS_STALE_DUPLICATE_NO_PLAYER_WRITE');
