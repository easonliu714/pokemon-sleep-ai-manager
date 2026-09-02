import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectPokemonCandidateFeatures,CURRENT_READINESS_SLOT_BRIDGE_VERSION} from '../assets/js/pokemon-candidate-feature-projection.js';
import {scorePokemonCandidateFeatures} from '../assets/js/pokemon-scoring-engine.js';
import {POKEMON_SCORING_RULES} from '../assets/js/pokemon-scoring-rule-registry.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1];
const build=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
const releaseMatch=String(app||'').match(/^v0\.4\.(\d+)(?:\.\d+)*$/);
assert.ok(releaseMatch,'current release must remain in v0.4.x family, including nested hotfix versions, for this historical readiness baseline');
assert.ok(Number(releaseMatch[1])>=5,'current release must be v0.4.5 or newer');
if(app==='v0.4.5'){
  assert.equal(build,'20260810-v045-current-readiness-runtime-bridge');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.5-v045-current-readiness-runtime-bridge');
}
assert.equal(CURRENT_READINESS_SLOT_BRIDGE_VERSION,'current-readiness-slot-bridge-2026-08-10-a');

const pokemon=[{pokemon_id:'release_p1',species:'伊布',current_species:'伊布',level:25,specialty:'技能',type:'一般',nature:'勤奮',main_skill:'能量填充S',main_skill_level:3,helper_seconds:2500,carry_limit:15,favorite_berry:'柿仔果',status:'active'}];
const pokemonDetails=[{pokemon_id:'release_p1',ingredients:[{unlock_level:1,ingredient_name:'哞哞鮮奶',quantity:1},{unlock_level:30,ingredient_name:'放鬆可可',quantity:1}],subskills:[{unlock_level:10,subskill_name:'幫忙速度S',is_unlocked:1},{unlock_level:50,subskill_name:'技能機率提升M',is_unlocked:0}]}];
const featureProjection=projectPokemonCandidateFeatures({pokemon,pokemonDetails,goalProfile:{goal_profile_id:'release_goal',hard_constraints:{current_unlocks_only:false}},weeklyContext:{context_id:'release_week'}});
const feature=featureProjection.candidates[0];
assert.equal(feature.known_unlock_slot_count,4);
assert.equal(feature.unlocked_known_slot_count,2);
const scored=scorePokemonCandidateFeatures(featureProjection).candidates[0];
assert.equal(scored.current_readiness_score,50);
assert.equal(scored.score_breakdown.current_readiness_score.rule_version,'current-unlock-readiness-2026-08-09-a');
assert.equal(scored.score_breakdown.current_readiness_score.formula,'100 * unlocked_known_slots / known_unlock_slots');
assert.equal(POKEMON_SCORING_RULES.current_readiness_score.status,'ACTIVE_VERIFIED');
for(const dimension of ['intrinsic_score','weekly_fit_score','roster_marginal_value_score','training_roi_score']){
  assert.equal(scored[dimension],null,`${dimension} must remain NULL until evidence activates it`);
  assert.notEqual(POKEMON_SCORING_RULES[dimension].status,'ACTIVE_VERIFIED',`${dimension} activated without release evidence`);
}

const source=read('assets/js/pokemon-candidate-feature-projection.js');
for(const token of ['currentUnlockSlotCounts','known_ingredient_slot_count','known_subskill_slot_count','unlocked_ingredient_slot_count','unlocked_subskill_slot_count','known_unlock_slot_count','unlocked_known_slot_count'])assert.ok(source.includes(token),`runtime slot bridge missing: ${token}`);
const local=read('assets/js/pokemon-candidate-local.js');
assert.ok(local.includes('scorePokemonCandidateFeatures'),'local candidate adapter must invoke evidence-gated scoring');
const candidateUi=read('assets/js/war-room-candidate-feature-ui.js');
for(const token of ['current_readiness_score','分數明細','known','unlocked','rule_version','formula','missing_score_inputs'])assert.ok(candidateUi.includes(token),`War Room score breakdown UI missing: ${token}`);
assert.ok(candidateUi.includes('不代表產能、總體強度、七日能量或長期價值'),'War Room must explain readiness score semantics');
const teamUi=read('assets/js/war-room-team-optimizer-ui.js');
assert.ok(teamUi.includes('current_readiness_score'),'Team card must expose readiness score');
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
assert.ok(sw.includes('caches.match(event.request)')||sw.includes('caches.match(request,{ignoreSearch:true})'),'historical JS cache fallback must remain; query-safe successor is allowed');
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('current-readiness-slot-bridge'),false,'readiness bridge must remain migration-free');
for(const deterministic of [source,read('assets/js/pokemon-scoring-engine.js')])for(const forbidden of ['Gemini','fetch(','run(','persist('])assert.equal(deterministic.includes(forbidden),false,`readiness runtime bridge must remain local/read-only: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.5_CURRENT_READINESS_RUNTIME_BASELINE',minimum_release:'v0.4.5',app_version:app,build,cache,
  four_part_patch_version_supported:true,nested_hotfix_version_supported:true,bridge_version:CURRENT_READINESS_SLOT_BRIDGE_VERSION,known_unlock_slots:4,unlocked_known_slots:2,current_readiness_score:50,
  score_breakdown_ui:true,current_readiness_semantics:'UNLOCK_MATURITY_ONLY',inactive_dimensions_remain_null:true,schema_migration_added:false,player_data_write:false,gemini_used:false,
},null,2));
