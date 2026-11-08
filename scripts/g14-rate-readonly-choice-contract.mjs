// G14 RATE Owner #796: disposable nonpersistent selection, full-source stale,
// 15-grade filter/sort, unknown/duplicate/conflict HOLD. No player DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPokemonRosterRatingView,renderPokemonRosterRatingViewHtml}
  from '../assets/js/pokemon-roster-rating-preview.js';
import {eligiblePokemonRosterRatingChoiceIds,selectPokemonRosterRatingRows,
  reviewPokemonRosterRatingChoiceIntent} from '../assets/js/pokemon-roster-rating-choice.js';
import {POKEMON_PROVISIONAL_RATING_LABELS as GRADES}
  from '../assets/js/pokemon-provisional-rating.js';

const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const slots=id=>names.map((subskill_name,index)=>({
  pokemon_id:id,unlock_level:[10,25,50,70,80][index],subskill_name
}));
const base={pokemon_id:'p-A',pokemon_instance_id:'instance-A',species:'測試同物種',
  nickname:'<img src=x onerror=alert(1)>',level:20,specialty:'樹果',
  nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',rating:'D-'};
const held={...base,pokemon_id:'p-B',pokemon_instance_id:'instance-B',
  nickname:'資料缺漏',nature:null,rating:'A'};
const input={pokemon:[base,held],ingredients:[],
  subskills:[...slots('p-A'),...slots('p-B')]};
const before=JSON.stringify(input);
const view=buildPokemonRosterRatingView(input);
assert.equal(view.status,'PREVIEW_ONLY');
assert.deepEqual(eligiblePokemonRosterRatingChoiceIds(view),['p-A']);
assert.equal(view.rows.find(x=>x.pokemon_id==='p-A').proposed_rating,'S+');
assert.equal(view.rows.find(x=>x.pokemon_id==='p-B').status,'REVIEW_REQUIRED');
const noReview=reviewPokemonRosterRatingChoiceIntent({
  preview:view,freshView:view,selectedPokemonIds:['p-A']});
assert.equal(noReview.status,'HOLD_READ_ONLY_REVIEW');
assert.deepEqual(noReview.reason_codes,['EXPLICIT_REVIEW_REQUIRED']);
const intent=reviewPokemonRosterRatingChoiceIntent({
  preview:view,freshView:buildPokemonRosterRatingView(input),
  selectedPokemonIds:['p-A'],explicitReview:true});
assert.equal(intent.status,'REVIEWED_NONPERSISTENT_INTENT');
assert.equal(intent.selected_count,1);
assert.equal(intent.reviewed_diffs[0].previous_rating,'D-');
assert.equal(intent.reviewed_diffs[0].proposed_rating,'S+');
assert.equal(intent.player_data_write,false);
assert.equal(intent.production_apply,false);
assert.equal(intent.overwrite_allowed,false);
assert.equal(base.rating,'D-');
assert.equal(JSON.stringify(input),before);
const invalids=[
  {ids:['p-B'],reason:'SELECTED_RECORD_HOLD_OR_UNKNOWN'},
  {ids:['p-A','p-A'],reason:'SELECTION_MISSING_OR_DUPLICATE'},
  {ids:['not-in-roster'],reason:'SELECTED_RECORD_HOLD_OR_UNKNOWN'},
  {ids:[],reason:'SELECTION_MISSING_OR_DUPLICATE'},
];
for(const item of invalids){
  const result=reviewPokemonRosterRatingChoiceIntent({
    preview:view,freshView:view,selectedPokemonIds:item.ids,explicitReview:true});
  assert.deepEqual(result.reason_codes,[item.reason]);
}
const stale=buildPokemonRosterRatingView({...input,pokemon:[{...base,nickname:'資料已更新'},held]});
assert.deepEqual(reviewPokemonRosterRatingChoiceIntent({
  preview:view,freshView:stale,selectedPokemonIds:['p-A'],explicitReview:true
}).reason_codes,['FULL_SOURCE_STALE_RECALCULATE']);
const sameGradeChanged=buildPokemonRosterRatingView({...input,pokemon:[{...base,level:21},held]});
assert.deepEqual(reviewPokemonRosterRatingChoiceIntent({
  preview:view,freshView:sameGradeChanged,selectedPokemonIds:['p-A'],explicitReview:true
}).reason_codes,['FULL_SOURCE_STALE_RECALCULATE']);
const unknown=buildPokemonRosterRatingView({...input,pokemon:[{...base,rating:'UNKNOWN'},held]});
assert.deepEqual(eligiblePokemonRosterRatingChoiceIds(unknown),[]);
const duplicate=buildPokemonRosterRatingView({...input,pokemon:[base,{...held,pokemon_instance_id:'instance-A'}]});
assert.deepEqual(eligiblePokemonRosterRatingChoiceIds(duplicate),[]);
const conflict=buildPokemonRosterRatingView({...input,pokemon:[{...base,identity_review_required:1},held]});
assert.deepEqual(eligiblePokemonRosterRatingChoiceIds(conflict),[]);
assert.deepEqual(eligiblePokemonRosterRatingChoiceIds(buildPokemonRosterRatingView({})),[]);
assert.deepEqual(selectPokemonRosterRatingRows(view,{gradeFilter:'S+'}).map(x=>x.pokemon_id),['p-A']);
assert.deepEqual(selectPokemonRosterRatingRows(view,{gradeFilter:'D-',gradeTarget:'old'}).map(x=>x.pokemon_id),['p-A']);
assert.deepEqual(selectPokemonRosterRatingRows(view,{sortBy:'status'}).map(x=>x.pokemon_id),['p-A','p-B']);
assert.deepEqual(selectPokemonRosterRatingRows(view,{sortBy:'status',descending:true}).map(x=>x.pokemon_id),['p-B','p-A']);
const html=renderPokemonRosterRatingViewHtml(view,{selectedPokemonIds:['p-A']});
assert.match(html,/data-rate-choice-row="p-A" checked/);
assert.doesNotMatch(html,/data-rate-choice-row="p-B"/,'held row must not be selectable');
assert.match(html,/HOLD／維持原評/);
assert.match(html,/擬採用 1／1 隻/);
assert.doesNotMatch(html,/<img src=x onerror/);
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html,/\b(?:savePokemonDetail|saveDatabaseBytes|indexedDB|localStorage)\b/);
const index=fs.readFileSync('index.html','utf8');
const rosterFilter=index.match(/<select id="ratingFilter">([\s\S]*?)<\/select>/)?.[1]||'';
for(const grade of GRADES){
  assert.match(rosterFilter,new RegExp('<option>'+grade.replace('+','\\+')+'</option>'));
  assert.match(html,new RegExp('<option value="'+grade.replace('+','\\+')+'"'));
}
const previewSource=fs.readFileSync('assets/js/pokemon-roster-rating-preview.js','utf8');
const choiceSource=fs.readFileSync('assets/js/pokemon-roster-rating-choice.js','utf8');
assert.doesNotMatch(previewSource+choiceSource,/\b(?:savePokemonDetail|saveDatabaseBytes|replaceDatabase|indexedDB|localStorage|sessionStorage)\s*\(/);
console.log('PASS G14_RATE_READONLY_SELECTION_REVIEW_STALE_15_GRADE_NO_PLAYER_WRITE');
