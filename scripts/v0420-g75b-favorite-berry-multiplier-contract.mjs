import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID,
  FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION,
  FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,
  NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,
  FAVORITE_BERRY_MULTIPLIER_BOUNDARY,
  resolveFavoriteBerryMultiplier,
  resolveFavoriteBerryMultiplierFromMatch,
} from '../assets/js/favorite-berry-multiplier-contract.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {projectMemberProductionEvidence,evaluateTeamObjective} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.20','v0.4.21'].includes(appVersion),`v0.4.20 favorite multiplier contract requires v0.4.20 or governed successor, got ${appVersion}`);
assert.ok(version.includes("// app_version: 'v0.4.19'"),'favorite multiplier release must retain v0.4.19 lineage bridge');
if(appVersion==='v0.4.21')assert.ok(version.includes("// app_version: 'v0.4.20'"),'v0.4.21 must retain v0.4.20 lineage bridge');
assert.equal(FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,2);
assert.equal(NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,1);
assert.ok(FAVORITE_BERRY_MULTIPLIER_CONTRACT_ID.includes('2026-08-13'));
assert.ok(FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION.includes('x2'));

const favorites=['蘋野果','橙橙果','番荔果'];
const favorite=resolveFavoriteBerryMultiplier({berry_name:'蘋野果',weekly_favorite_berries:favorites});
assert.equal(favorite.status,'ACTIVE_VERIFIED');
assert.equal(favorite.is_favorite,true);
assert.equal(favorite.multiplier,2);
const nonFavorite=resolveFavoriteBerryMultiplier({berry_name:'葡萄果',weekly_favorite_berries:favorites});
assert.equal(nonFavorite.status,'ACTIVE_VERIFIED');
assert.equal(nonFavorite.is_favorite,false);
assert.equal(nonFavorite.multiplier,1);
assert.equal(resolveFavoriteBerryMultiplier({berry_name:'蘋野果',weekly_favorite_berries:['蘋野果']}).multiplier,null,'incomplete weekly favorite context must fail closed');
assert.equal(resolveFavoriteBerryMultiplier({berry_name:'不存在果',weekly_favorite_berries:favorites}).status,'UNKNOWN_BERRY');
assert.equal(resolveFavoriteBerryMultiplier({berry_name:null,weekly_favorite_berries:favorites}).status,'BERRY_IDENTITY_MISSING');
assert.equal(resolveFavoriteBerryMultiplierFromMatch(true).multiplier,2);
assert.equal(resolveFavoriteBerryMultiplierFromMatch(false).multiplier,1);
assert.equal(resolveFavoriteBerryMultiplierFromMatch(null).multiplier,null);
for(const boundary of ['EXPERT_MODE_MAIN_FAVORITE_HELPING_FREQUENCY_BONUS','EXPERT_MODE_NON_FAVORITE_HELPING_FREQUENCY_PENALTY','EXPERT_MODE_ADDITIONAL_FAVORITE_STRENGTH_EFFECT','EVENT_BERRY_STRENGTH_MULTIPLIER','EVENT_BERRY_OUTPUT_PER_HELP_BONUS','AREA_OR_EXPERT_BONUS'])assert.ok(FAVORITE_BERRY_MULTIPLIER_BOUNDARY.excluded_modifiers.includes(boundary),`missing boundary ${boundary}`);
assert.equal(FAVORITE_BERRY_MULTIPLIER_BOUNDARY.runtime_network_fetch,false);
assert.equal(FAVORITE_BERRY_MULTIPLIER_BOUNDARY.missing_is_zero,false);

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.berry_energy_per_berry.status,'ACTIVE_VERIFIED');
assert.equal(registry.rules.favorite_berry_multiplier.status,'ACTIVE_VERIFIED');
assert.equal(registry.rules.favorite_berry_multiplier.rule_version,FAVORITE_BERRY_MULTIPLIER_CONTRACT_VERSION);
assert.equal(registry.rules.berry_output_per_help.status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.active_verified_dimensions,['berry_energy_per_berry','favorite_berry_multiplier']);

const candidateFeatures={candidates:[
  {pokemon_id:'private-fire',type:'火',level:30,helper_seconds:2100,main_skill:'能量填充S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'火辣香草',quantity:2}]},
  {pokemon_id:'private-water',type:'水',level:60,helper_seconds:2200,main_skill:'食材獲取S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'哞哞鮮奶',quantity:2}]},
  {pokemon_id:'private-electric',type:'電',level:70,helper_seconds:2300,main_skill:'活力全體療癒S',favorite_berry_match:false,unlocked_ingredients:[{ingredient_name:'甜甜蜜',quantity:2}]},
]};
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'番荔果'};
const snapshot=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.ok(['pokemon-sleep-production-evidence-snapshot/1.1','pokemon-sleep-production-evidence-snapshot/1.2'].includes(snapshot.schema));
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(snapshot.summary.active_numeric_dimension_count,2);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,5);
assert.equal(snapshot.summary.berry_strength_resolved_candidate_count,3);
assert.equal(snapshot.summary.favorite_berry_multiplier_resolved_candidate_count,3);
const favoriteRow=snapshot.rules.find(row=>row.dimension==='favorite_berry_multiplier');
assert.equal(favoriteRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_CONTRACT);
assert.equal(favoriteRow.authority_status,'ACTIVE_VERIFIED');
assert.equal(favoriteRow.runtime_numeric_activation,true);
assert.equal(favoriteRow.coverage.observed_count,3);
assert.equal(favoriteRow.coverage.ratio,1);
assert.deepEqual(favoriteRow.blocking_reasons,[]);
assert.ok(favoriteRow.source_refs.some(value=>String(value).includes('RaenonX')));
assert.equal(JSON.stringify(snapshot).includes('private-fire'),false,'private candidate id must not enter evidence snapshot');

const incomplete=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext:{favorite_berry_1:'蘋野果'},productionRegistry:registry});
const incompleteFavorite=incomplete.rules.find(row=>row.dimension==='favorite_berry_multiplier');
assert.equal(incompleteFavorite.coverage.observed_count,0);
assert.ok(incompleteFavorite.blocking_reasons.includes('INCOMPLETE_FAVORITE_BERRY_MULTIPLIER_INPUT_COVERAGE'));
assert.equal(incomplete.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');

const favoriteMember=projectMemberProductionEvidence({pokemon_id:'p-fire',type:'火',level:30,helper_seconds:2500,favorite_berry_match:true,unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(favoriteMember.berry_name,'蘋野果');
assert.equal(favoriteMember.berry_energy_per_berry,56);
assert.equal(favoriteMember.favorite_berry_multiplier,2);
assert.equal(favoriteMember.favorite_berry_multiplier_status,'ACTIVE_VERIFIED');
assert.equal(favoriteMember.favorite_adjusted_berry_energy_per_berry,112);
assert.equal(favoriteMember.favorite_adjusted_berry_energy_status,'ACTIVE_VERIFIED_PARTIAL_COMPONENT');
assert.equal(favoriteMember.berry_rate_status,'NOT_YET_VERIFIED');
assert.equal(favoriteMember.berry_energy_per_hour,null);
const nonFavoriteMember=projectMemberProductionEvidence({pokemon_id:'p-electric',type:'電',level:70,helper_seconds:2500,favorite_berry_match:false,unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(nonFavoriteMember.berry_energy_per_berry,137);
assert.equal(nonFavoriteMember.favorite_berry_multiplier,1);
assert.equal(nonFavoriteMember.favorite_adjusted_berry_energy_per_berry,137);
const missingMatchMember=projectMemberProductionEvidence({pokemon_id:'p-missing',type:'電',level:70,helper_seconds:2500,favorite_berry_match:null,unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(missingMatchMember.favorite_berry_multiplier,null);
assert.equal(missingMatchMember.favorite_adjusted_berry_energy_per_berry,null);
assert.equal(missingMatchMember.berry_energy_per_hour,null);

const team={team_id:'favorite-partial-only',slots:[{pokemon_id:'p1'},{pokemon_id:'p2'},{pokemon_id:'p3'},{pokemon_id:'p4'},{pokemon_id:'p5'}]};
const teamFeatures={candidates:[1,2,3,4,5].map((n,index)=>({pokemon_id:`p${n}`,type:['火','水','電','草','龍'][index],level:30,helper_seconds:2400+index*50,favorite_berry_match:index<2,unlocked_ingredients:[]}))};
const objective=evaluateTeamObjective({team,candidateFeatures:teamFeatures,goalProfile:{primary_goal:'max_snorlax_energy'},productionRegistry:registry});
assert.equal(objective.objective_status,'NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(objective.objective_score,null);
assert.equal(objective.components.berry_energy_per_hour,null);
assert.ok(objective.members.every(row=>row.favorite_berry_multiplier_status==='ACTIVE_VERIFIED'));
assert.ok(objective.members.every(row=>row.favorite_adjusted_berry_energy_per_berry>0));
assert.ok(objective.members.every(row=>row.berry_energy_per_hour===null));
assert.ok(objective.missing_inputs.includes('berry_energy_per_hour:NOT_YET_VERIFIED'));

for(const file of ['assets/js/favorite-berry-multiplier-contract.js','assets/js/production-evidence-registry.js']){
  const source=read(file);for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`${file} owns forbidden mutation/network path: ${forbidden}`);
}
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/favorite-berry-multiplier-contract.js'"),'first-offline precache missing favorite berry multiplier contract');
const ui=read('assets/js/production-evidence-ui.js');
if(appVersion==='v0.4.20')for(const token of ['favorite multiplier','Favorite ×2','Evidence ·','Authority ·'])assert.ok(ui.includes(token),`v0.4.20 evidence UI token missing ${token}`);
else for(const token of ['evidence-metric-grid','數值模型','進階 Evidence / JSON','favorite_berry_multiplier'])assert.ok(ui.includes(token),`compact successor evidence UI token missing ${token}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0420_G75B_FAVORITE_BERRY_MULTIPLIER_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,
  base_favorite_multiplier:FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,non_favorite_multiplier:NON_FAVORITE_BERRY_BASE_STRENGTH_MULTIPLIER,
  favorite_coverage:snapshot.summary.favorite_berry_multiplier_resolved_candidate_count,
  active_numeric_dimension_count:snapshot.summary.active_numeric_dimension_count,blocked_numeric_dimension_count:snapshot.summary.blocked_numeric_dimension_count,
  overall_numeric_model_status:registry.numeric_rate_model_status,berry_energy_per_hour_still_blocked:true,
  expert_mode_extra_modifiers_excluded:true,event_modifiers_excluded:true,missing_context_fail_closed:true,
  player_write:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
