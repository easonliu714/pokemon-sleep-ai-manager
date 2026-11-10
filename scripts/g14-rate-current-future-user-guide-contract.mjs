import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  scorePokemonProvisionalRating,planPokemonRosterProvisionalRegrade,
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,
  POKEMON_PROVISIONAL_RATING_LABELS,
  POKEMON_PROVISIONAL_RATING_GUIDE,
} from '../assets/js/pokemon-provisional-rating.js';
import {
  buildPokemonRosterRatingView,renderPokemonRosterRatingViewHtml,
  createPokemonRatingSelection,changePokemonRatingSelection,reviewPokemonRatingSelection,
} from '../assets/js/pokemon-roster-rating-preview.js';
import {renderPokemonRatingGuideHtml} from '../assets/js/pokemon-rating-guide.js';
import {projectPokemonRatingChange,renderPokemonRatingChangeAdvice} from '../assets/js/pokemon-rating-reactive-advice.js';

// Disposable synthetic facts only: no SQLite, Web Locks, network or player DB.
const skills=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
const levels=[10,25,50,70,80];
const pokemon={pokemon_id:'testA',pokemon_instance_id:'fixture-A',species:'fixture',
  specialty:'樹果',nature:'固執',nature_bonus:'幫忙速度',nature_penalty:'食材機率',
  level:20,rating:'D-'};
const subskills=skills.map((name,i)=>({pokemon_id:'testA',subskill_name:name,unlock_level:levels[i],is_unlocked:1}));
const source={pokemon:[pokemon],ingredients:[],subskills};
const before=JSON.stringify(source);
const scored=scorePokemonProvisionalRating({pokemon,subskills});
assert.equal(scored.status,'PROVISIONAL_HEURISTIC');
assert.deepEqual([scored.current_heuristic_score,scored.future_heuristic_score],[80,100]);
assert.deepEqual([scored.current_rating,scored.future_rating],['S-','S+']);
assert.equal(scored.proposed_rating,scored.future_rating,'original long-term rule must remain compatible');
assert.deepEqual([scored.current_contribution,scored.future_contribution],[30,33]);
const upgraded=scorePokemonProvisionalRating({pokemon:{...pokemon,level:70},subskills});
assert.equal(upgraded.current_rating,'S+','known future abilities become CURRENT by observed level only');
assert.equal(upgraded.future_rating,'S+');
const oldUnlocked=scorePokemonProvisionalRating({pokemon,subskills:subskills.map(x=>({...x,is_unlocked:1}))});
assert.equal(oldUnlocked.current_rating,'S-','stale is_unlocked flag must not promote future slots');
const held=scorePokemonProvisionalRating({pokemon,subskills:subskills.slice(0,2)});
assert.equal(held.current_rating,null);assert.equal(held.future_rating,null);
assert.equal(held.proposed_rating,null);assert.ok(held.missing_inputs.includes('subskill_level_50'));
const planning=planPokemonRosterProvisionalRegrade({pokemon:[pokemon],details:[{pokemon_id:'testA',subskills}]});
assert.equal(planning.proposals[0].current_rating,'S-');
assert.equal(planning.proposals[0].future_rating,'S+');
const view=buildPokemonRosterRatingView(source),model=createPokemonRatingSelection(view);
assert.equal(view.rows[0].current_heuristic_score,80);
assert.equal(view.rows[0].future_heuristic_score,100);
assert.equal(model.selected.size,0,'adoption remains opt-in and non-persistent');
assert.equal(changePokemonRatingSelection(model,'fixture-A',true),true);
const review=reviewPokemonRatingSelection(model);
assert.equal(review.adopt[0].current_rating,'S-');
assert.equal(review.adopt[0].future_rating,'S+');
assert.equal(review.player_data_write,false);
const html=renderPokemonRosterRatingViewHtml(view,model,{reviewOpen:true});
assert.match(html,/現在評級 CURRENT/);
assert.match(html,/未來評級 FUTURE/);
assert.match(html,/舊評（已儲存）/);
assert.match(html,/現在 S-／未來 S\+/);
assert.match(html,/未來評級篩選/);
assert.match(html,/data-rate4-readonly="true"/);
assert.doesNotMatch(html,/<button[^>]+(?:apply|save|overwrite)/i);
const doc=renderPokemonRatingGuideHtml();
const rule=POKEMON_PROVISIONAL_RATING_GUIDE;
assert.equal(rule.lower_bounds.length,15);
for(let i=0;i<POKEMON_PROVISIONAL_RATING_LABELS.length;i++){
  const max=i?rule.lower_bounds[i-1]-1:100,min=rule.lower_bounds[i];
  assert.ok(doc.includes('>'+POKEMON_PROVISIONAL_RATING_LABELS[i]+'</td><td>'+min+'～'+max+'</td>'),
    'help grade table must match live scoring thresholds');
}
for(const token of ['現在 CURRENT','未來 FUTURE','clamp(40 + 性格分 + 已解鎖副技能分',
  'clamp(40 + 性格分 + 全部已知副技能分','現在 = 40 + 10 + 30 = 80',
  '未來 = clamp(80 + 14 + 12 + 7) = 100',
  POKEMON_PROVISIONAL_RATING_RULE_VERSION,'HOLD','尚未匯入','尚未解鎖',
  '評級是什麼','舊評','不代表即時產能']){
  assert.ok(doc.includes(token),'guide explanatory fact missing: '+token);
}
const index=fs.readFileSync('index.html','utf8');
const line=index.split('\n').find(x=>x.includes('<section id="guide"'));
assert.ok(line.includes('<div id="adminAuthPanel" class="panel"></div><div class="panel prose" data-rating-guide-bottom="true">'));
assert.equal((index.match(/id="ratingRuleGuide"/g)||[]).length,1);
const app=fs.readFileSync('assets/js/app.js','utf8');
assert.match(app,/setupPokemonRatingGuide\(\)/);
assert.equal(JSON.stringify(source),before,'read-only preview mutated player source');
assert.equal(pokemon.rating,'D-','old rating must remain untouched');
// Verified main-skill-level upgrades must re-evaluate the small, explicit
// versioned product weight. A missing level is *not* silently treated as 1.
const previous={
  pokemon:{...pokemon,main_skill_level:1},ingredients:[],subskills,
};
const future={
  pokemon:{...pokemon,level:25,main_skill_level:3},ingredients:[],subskills,
};
const growth=projectPokemonRatingChange({previous,current:future,committed:false});
assert.equal(growth.current.current_heuristic_score,96);
assert.equal(growth.previous.current_heuristic_score,80);
assert.equal(growth.current.current_rating,'S+');
assert.equal(growth.current.future_rating,'S+');
assert.equal(growth.player_data_write,false);
assert.ok(growth.changes.some(x=>x.kind==='主技能等級'));
assert.ok(growth.changes.some(x=>x.kind==='寶可夢等級'));
assert.match(renderPokemonRatingChangeAdvice(growth),/尚未儲存的個體修改情境預覽/);
assert.match(renderPokemonRatingChangeAdvice(growth),/變動原因/);
assert.equal(JSON.stringify(previous.pokemon),JSON.stringify({...pokemon,main_skill_level:1}));
const natureScenario=projectPokemonRatingChange({previous,current:{
  ...future,pokemon:{...future.pokemon,nature:'內斂',nature_bonus:'食材機率',
    nature_penalty:'幫忙速度'},
},committed:false});
assert.ok(natureScenario.changes.some(x=>x.kind==='性格'));
assert.notEqual(natureScenario.current.current_heuristic_score,growth.current.current_heuristic_score);
const noSkillLevel=scorePokemonProvisionalRating({
  pokemon:{...pokemon,main_skill_level:null},subskills,
});
assert.equal(noSkillLevel.main_skill_level_scored,false);
assert.equal(noSkillLevel.main_skill_level_contribution,null);
const invalidSkillLevel=scorePokemonProvisionalRating({
  pokemon:{...pokemon,main_skill_level:'3'},subskills,
});
assert.equal(invalidSkillLevel.status,'REVIEW_REQUIRED');
assert.ok(invalidSkillLevel.missing_inputs.includes('invalid_main_skill_level'));
const skillUpgrade=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'技能',main_skill:'能量填充S',main_skill_level:4},
  subskills,
});
assert.equal(skillUpgrade.main_skill_level_contribution,6);
assert.equal(skillUpgrade.main_skill_level_scored,true);
assert.match(doc,/技能專長 \+2 分/);
assert.match(doc,/樹果與食材專長 \+1 分/);
// RATE.1 negative-first: nonempty but unverified specialty evidence must not
// be promoted into a reproducible grade merely because it has a name.
const fakeIngredient=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,ingredient_name:'__NOT_A_PUBLIC_INGREDIENT__'}],
});
assert.equal(fakeIngredient.status,'REVIEW_REQUIRED',
  'unverified Lv1 ingredient name must HOLD, not produce a 15-band grade');
assert.ok(fakeIngredient.missing_inputs.includes('level_1_ingredient'));
const fakeMainSkill=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'技能',main_skill:'__NOT_A_PUBLIC_MAIN_SKILL__'},subskills,
});
assert.equal(fakeMainSkill.status,'REVIEW_REQUIRED',
  'unverified main skill name must HOLD, not produce a 15-band grade');
assert.ok(fakeMainSkill.missing_inputs.includes('main_skill'));
// RATE.1 negative-first: two different slots with the SAME verified subskill
// cannot be independently counted twice as two trustworthy observations.
// Such a contradictory five-slot source must HOLD rather than inflate CURRENT
// or FUTURE. This test is intentionally introduced before the Source repair.
const duplicateSubskillName=scorePokemonProvisionalRating({
  pokemon,subskills:subskills.map((row,i)=>i===1
    ?{...row,subskill_name:subskills[0].subskill_name}:row),
});
assert.equal(duplicateSubskillName.status,'REVIEW_REQUIRED',
  'duplicate subskill names across levels must HOLD rather than double-score');
assert.ok(duplicateSubskillName.missing_inputs.includes('duplicate_subskill_name'));
// RATE.1 source-bound negative-first: contradictory aliases on the SAME
// imported subskill row must not certify a five-slot verified profile.
// The existing nullish-precedence reader silently trusts one alias.
const conflictingSubskillNameAlias=scorePokemonProvisionalRating({
  pokemon,subskills:subskills.map((row,i)=>i===0
    ?{...row,name:'技能機率提升M'}:row),
});
assert.equal(conflictingSubskillNameAlias.status,'REVIEW_REQUIRED',
  'contradictory subskill name aliases must HOLD instead of grading');
assert.ok(conflictingSubskillNameAlias.missing_inputs.includes('conflicting_subskill_name_alias'));
const conflictingSubskillLevelAlias=scorePokemonProvisionalRating({
  pokemon,subskills:subskills.map((row,i)=>i===0
    ?{...row,level:25}:row),
});
assert.equal(conflictingSubskillLevelAlias.status,'REVIEW_REQUIRED',
  'contradictory subskill unlock-level aliases must HOLD instead of grading');
assert.ok(conflictingSubskillLevelAlias.missing_inputs.includes('conflicting_subskill_level_alias'));
const matchingSubskillAliases=scorePokemonProvisionalRating({
  pokemon,subskills:subskills.map(row=>({...row,
    name:row.subskill_name,level:row.unlock_level})),
});
assert.equal(matchingSubskillAliases.status,'PROVISIONAL_HEURISTIC',
  'agreeing canonical aliases must preserve legitimate source evidence');

// RATE.1 source-bound negative-first: identity-review authority is a tri-state
// safety signal, not an arbitrary truthy/falsy scalar. Noncanonical imported
// flags must not silently certify a 15-band recommendation.
for(const unverifiedFlag of ['true','false',2,[],{}]){
  const ambiguousIdentity=scorePokemonProvisionalRating({
    pokemon:{...pokemon,identity_review_required:unverifiedFlag},subskills,
  });
  assert.equal(ambiguousIdentity.status,'REVIEW_REQUIRED',
    'noncanonical identity-review flag must HOLD: '+JSON.stringify(unverifiedFlag));
  assert.ok(ambiguousIdentity.reason_codes.includes('noncanonical_identity_review_flag'));
}
const explicitIdentityReview=scorePokemonProvisionalRating({
  pokemon:{...pokemon,identity_review_required:1},subskills,
});
assert.equal(explicitIdentityReview.status,'REVIEW_REQUIRED');
assert.ok(explicitIdentityReview.reason_codes.includes('identity_review_required'));
const explicitLegacyReview=scorePokemonProvisionalRating({
  pokemon:{...pokemon,identity_review_required:'1'},subskills,
});
assert.equal(explicitLegacyReview.status,'REVIEW_REQUIRED');
assert.ok(explicitLegacyReview.reason_codes.includes('identity_review_required'));
const explicitLegacyClear=scorePokemonProvisionalRating({
  pokemon:{...pokemon,identity_review_required:'0'},subskills,
});
assert.equal(explicitLegacyClear.status,'PROVISIONAL_HEURISTIC');
const explicitIdentityClear=scorePokemonProvisionalRating({
  pokemon:{...pokemon,identity_review_required:0},subskills,
});
assert.equal(explicitIdentityClear.status,'PROVISIONAL_HEURISTIC');
// Canonical public identities remain eligible; do not regress valid facts.
const canonicalIngredient=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,ingredient_name:'特選蘋果'}],
});
assert.equal(canonicalIngredient.status,'PROVISIONAL_HEURISTIC');
// RATE.1 negative-first: a single Pokémon has exactly one Lv1 ingredient
// identity. A valid Lv1 row must not mask a contradictory second Lv1 row.
// The existing .some(valid) implementation currently returns a grade.
const contradictoryLevelOneIngredients=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[
    {unlock_level:1,ingredient_name:'特選蘋果'},
    {unlock_level:1,ingredient_name:'豆製肉'},
  ],
});
assert.equal(contradictoryLevelOneIngredients.status,'REVIEW_REQUIRED',
  'contradictory Lv1 ingredient identities must HOLD instead of grading');
assert.ok(contradictoryLevelOneIngredients.missing_inputs.includes('conflicting_level_1_ingredient'),
  'conflicting Lv1 ingredient evidence must have a named reason');
// Duplicate same-name Lv1 records are also unverified; do not double-count.
const duplicateLevelOne=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[
    {unlock_level:1,ingredient_name:'特選蘋果'},
    {unlock_level:1,ingredient_name:'特選蘋果'},
  ],
});
assert.equal(duplicateLevelOne.status,'REVIEW_REQUIRED');
assert.ok(duplicateLevelOne.missing_inputs.includes('conflicting_level_1_ingredient'));
// A distinct canonical future ingredient is legitimate and must not be
// mistaken for a second Lv1 source fact.
const validFutureIngredient=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[
    {unlock_level:1,ingredient_name:'特選蘋果'},
    {unlock_level:30,ingredient_name:'豆製肉'},
  ],
});
assert.equal(validFutureIngredient.status,'PROVISIONAL_HEURISTIC');

// RATE.1 source-bound negative-first: two populated aliases on one imported
// ingredient observation must agree before that Lv1 identity is certified.
// Preserve the original conflicting facts; never guess which alias is right.
const conflictingIngredientNameAlias=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,ingredient_name:'特選蘋果',name:'豆製肉'}],
});
assert.equal(conflictingIngredientNameAlias.status,'REVIEW_REQUIRED',
  'contradictory Lv1 ingredient name aliases must HOLD instead of grading');
assert.ok(conflictingIngredientNameAlias.missing_inputs.includes('conflicting_ingredient_name_alias'));
const conflictingIngredientLevelAlias=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,level:30,ingredient_name:'特選蘋果'}],
});
assert.equal(conflictingIngredientLevelAlias.status,'REVIEW_REQUIRED',
  'contradictory ingredient unlock-level aliases must HOLD instead of grading');
assert.ok(conflictingIngredientLevelAlias.missing_inputs.includes('conflicting_ingredient_level_alias'));
const matchingIngredientAliases=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,level:1,ingredient_name:'特選蘋果',name:'特選蘋果'}],
});
assert.equal(matchingIngredientAliases.status,'PROVISIONAL_HEURISTIC',
  'agreeing canonical Lv1 ingredient aliases must remain eligible');

const canonicalMainSkill=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'技能',main_skill:'能量填充S'},subskills,
});
assert.equal(canonicalMainSkill.status,'PROVISIONAL_HEURISTIC');
// Release-authority regression: do not instruct Owner to use an Apply button
// intentionally hidden by the production default-off gate.
assert.match(doc,/RATE\.4 評級套用尚未獲正式授權/);
assert.match(doc,/不顯示「確認儲存選定評級」按鈕/);
assert.doesNotMatch(doc,/再選擇 CURRENT／FUTURE 和「確認儲存選定評級」/);
assert.match(renderPokemonRatingChangeAdvice(growth),/RATE\.4 評級套用尚未獲正式授權/);
const detailSource=fs.readFileSync('assets/js/pokemon-detail.js','utf8');
const manualSource=fs.readFileSync('assets/js/manual-editor.js','utf8');
assert.match(detailSource,/bindDraftRatingAdvice\(/);
assert.match(detailSource,/mountSavedRatingAdvice\(/);
assert.match(detailSource,/saveConfirmedPokemonSuggestedRating\(/);
assert.match(manualSource,/saveConfirmedPokemonSuggestedRating/);
assert.match(manualSource,/RATE4_STALE_SOURCE_RELOAD_REQUIRED/);
assert.match(manualSource,/snapshot\('rate4:confirmed:/);
assert.match(manualSource,/withPrimarySqliteMutationLock\(async lease=>/);
assert.match(manualSource,/primaryMutationLease:lease/);
assert.match(manualSource,/confirmed!==true/);
// RATE.4 production Apply is not Owner-authorized. The proposed production
// button and writer must remain OFF by default even if this Draft is merged
// accidentally; isolated synthetic Chromium tests opt in explicitly.
assert.match(manualSource,/export const RATE4_PRODUCTION_APPLY_ENABLED=false;/,
  'production rating Apply must be disabled by default');
assert.match(manualSource,/if\(RATE4_PRODUCTION_APPLY_ENABLED!==true\)/,
  'production rating writer must reject without explicit feature admission');
assert.match(detailSource,/if\(advice\.can_propose_save&&RATE4_PRODUCTION_APPLY_ENABLED\)/,
  'production detail UI must not expose the rating Apply control while HOLD');
// RATE.1 negative-first: malformed observation conflict carriers must not
// certify an otherwise complete profile. The canonical field_conflicts is an
// object map, and evidenceConflicts is an array of unresolved field names.
for(const malformed of ['nature',1,[]]){
  const result=scorePokemonProvisionalRating({
    pokemon:{...pokemon,field_conflicts:malformed},subskills,
  });
  assert.equal(result.status,'REVIEW_REQUIRED',
    'malformed field_conflicts must HOLD: '+JSON.stringify(malformed));
  assert.ok(result.reason_codes.includes('noncanonical_observation_field_conflicts'));
}
for(const malformed of ['nature',1,null]){
  const result=scorePokemonProvisionalRating({pokemon,subskills,evidenceConflicts:malformed});
  assert.equal(result.status,'REVIEW_REQUIRED',
    'malformed evidenceConflicts must HOLD: '+JSON.stringify(malformed));
  assert.ok(result.reason_codes.includes('noncanonical_evidence_conflicts'));
}
// RATE.1 negative-first: exotic conflict maps can have zero enumerable keys
// while hiding provenance. Date/Map/null-prototype are not JSON object maps;
// they must never certify an otherwise complete player profile.
for(const malformed of [new Date('2026-11-10T00:00:00Z'),new Map(),Object.create(null)]){
  const result=scorePokemonProvisionalRating({
    pokemon:{...pokemon,field_conflicts:malformed},subskills,
  });
  assert.equal(result.status,'REVIEW_REQUIRED',
    'non-plain field_conflicts must HOLD instead of silently appearing empty');
  assert.ok(result.reason_codes.includes('noncanonical_observation_field_conflicts'));
}
assert.equal(scorePokemonProvisionalRating({pokemon:{...pokemon,field_conflicts:{}},subskills,
  evidenceConflicts:[]}).status,'PROVISIONAL_HEURISTIC',
  'canonical empty conflict carriers must preserve eligible source facts');
assert.equal(scorePokemonProvisionalRating({pokemon:{...pokemon,field_conflicts:{nature:{status:'CONFLICT'}}},
  subskills}).status,'REVIEW_REQUIRED',
  'canonical nonempty conflict map must continue to HOLD');
// RATE.1 negative-first: array-backed labels are not verified primitive
// evidence even when String([label]) would equal a canonical name. Do not
// silently promote imported/OCR list carriers into source authority.
for(const [label,changedPokemon,changedSlots] of [
  ['specialty',{...pokemon,specialty:['樹果']},subskills],
  ['nature',{...pokemon,nature:['固執']},subskills],
  ['subskill',pokemon,subskills.map((row,i)=>i===0
    ?{...row,subskill_name:['樹果數量S']}:row)],
]){
  const result=scorePokemonProvisionalRating({
    pokemon:changedPokemon,subskills:changedSlots,
  });
  assert.equal(result.status,'REVIEW_REQUIRED',
    'array-backed '+label+' must HOLD rather than receive a confident grade');
  assert.equal(result.proposed_rating,null);
}
const arrayIngredient=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,ingredient_name:['特選蘋果']}],
});
assert.equal(arrayIngredient.status,'REVIEW_REQUIRED',
  'array-backed ingredient identity must HOLD');
const arrayMainSkill=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'技能',main_skill:['能量填充S']},subskills,
});
assert.equal(arrayMainSkill.status,'REVIEW_REQUIRED',
  'array-backed main skill identity must HOLD');
assert.equal(pokemon.rating,'D-');
console.log(JSON.stringify({gate:'G14_RATE_CURRENT_FUTURE_GUIDE_SOURCE',status:'PASS',
  current:'S-',future:'S+',dual_grade:true,guide_bottom:true,
  thresholds_exact:true,source_unchanged:true,no_rating_write:true}));
