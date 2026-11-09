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
// Canonical public identities remain eligible; do not regress valid facts.
const canonicalIngredient=scorePokemonProvisionalRating({
  pokemon:{...pokemon,specialty:'食材'},subskills,
  ingredients:[{unlock_level:1,ingredient_name:'特選蘋果'}],
});
assert.equal(canonicalIngredient.status,'PROVISIONAL_HEURISTIC');
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
assert.equal(pokemon.rating,'D-');
console.log(JSON.stringify({gate:'G14_RATE_CURRENT_FUTURE_GUIDE_SOURCE',status:'PASS',
  current:'S-',future:'S+',dual_grade:true,guide_bottom:true,
  thresholds_exact:true,source_unchanged:true,no_rating_write:true}));
