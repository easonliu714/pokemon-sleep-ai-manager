import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_BERRY_TYPES} from '../assets/js/shared-master-data.js';
import {
  PUBLIC_BERRY_STRENGTH_MASTER,
  PUBLIC_BERRY_STRENGTH_VERSION,
  BERRY_STRENGTH_FORMULA_VERSION,
  BERRY_STRENGTH_MIN_LEVEL,
  BERRY_STRENGTH_MAX_LEVEL,
  berryStrengthAtLevel,
  resolveBerryStrength,
  resolveBerryStrengthForTypeAtLevel,
} from '../assets/js/public-berry-strength-master.js';
import {currentProductionAuthorityRegistry} from '../assets/js/production-authority-registry.js';
import {buildProductionEvidenceSnapshot,EVIDENCE_STATUS} from '../assets/js/production-evidence-registry.js';
import {projectMemberProductionEvidence,evaluateTeamObjective} from '../assets/js/team-objective-evaluator.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.19','v0.4.20','v0.4.21'].includes(appVersion),`unexpected G7.5A release/successor ${appVersion}`);
if(['v0.4.20','v0.4.21'].includes(appVersion))assert.ok(version.includes("// app_version: 'v0.4.19'"),`${appVersion} must retain v0.4.19 lineage bridge`);
const favoriteMultiplierSuccessor=['v0.4.20','v0.4.21'].includes(appVersion);
assert.equal(BERRY_STRENGTH_MIN_LEVEL,1);
assert.equal(BERRY_STRENGTH_MAX_LEVEL,70);
assert.equal(PUBLIC_BERRY_STRENGTH_MASTER.length,18);
assert.equal(new Set(PUBLIC_BERRY_STRENGTH_MASTER.map(row=>row.berry_name)).size,18);
assert.equal(new Set(PUBLIC_BERRY_STRENGTH_MASTER.map(row=>row.type_name)).size,18);
assert.ok(PUBLIC_BERRY_STRENGTH_VERSION.includes('2026-08-13'));
assert.ok(BERRY_STRENGTH_FORMULA_VERSION.includes('1.025'));

const publicPairs=PUBLIC_BERRY_TYPES.map(row=>`${row.type_name}:${row.berry_name}`).sort();
const strengthPairs=PUBLIC_BERRY_STRENGTH_MASTER.map(row=>`${row.type_name}:${row.berry_name}`).sort();
assert.deepEqual(strengthPairs,publicPairs,'berry strength master must exactly cover existing type→berry authority');

const expectedBases={
  '柿仔果':28,'蘋野果':27,'橙橙果':31,'葡萄果':25,'金枕果':30,'莓莓果':32,'櫻子果':27,'零餘果':32,'勿花果':29,
  '椰木果':24,'芒芒果':26,'木子果':24,'文柚果':30,'墨莓果':26,'番荔果':35,'異奇果':31,'靛莓果':33,'桃桃果':26,
};
for(const row of PUBLIC_BERRY_STRENGTH_MASTER)assert.equal(row.base_strength,expectedBases[row.berry_name],`base strength mismatch ${row.berry_name}`);

const anchorLevels=[1,10,20,30,40,50,60,70];
const anchors={
  '柿仔果':[28,37,47,57,73,94,120,154],'蘋野果':[27,36,46,56,71,91,116,148],'橙橙果':[31,40,50,63,81,104,133,170],
  '葡萄果':[25,34,44,54,65,84,107,137],'金枕果':[30,39,49,61,79,101,129,165],'莓莓果':[32,41,51,65,84,107,137,176],
  '櫻子果':[27,36,46,56,71,91,116,148],'零餘果':[32,41,51,65,84,107,137,176],'勿花果':[29,38,48,59,76,97,124,159],
  '椰木果':[24,33,43,53,63,80,103,132],'芒芒果':[26,35,45,55,68,87,112,143],'木子果':[24,33,43,53,63,80,103,132],
  '文柚果':[30,39,49,61,79,101,129,165],'墨莓果':[26,35,45,55,68,87,112,143],'番荔果':[35,44,56,72,92,117,150,192],
  '異奇果':[31,40,50,63,81,104,133,170],'靛莓果':[33,42,53,68,86,111,142,181],'桃桃果':[26,35,45,55,68,87,112,143],
};
for(const [berry,values] of Object.entries(anchors))anchorLevels.forEach((level,index)=>assert.equal(berryStrengthAtLevel(berry,level),values[index],`${berry} Lv.${level} anchor mismatch`));
assert.equal(berryStrengthAtLevel('葡萄果',70),137);
assert.equal(berryStrengthAtLevel('番荔果',70),192);
assert.equal(berryStrengthAtLevel('不存在果',30),null);
for(const invalid of [0,71,1.5,null,''])assert.equal(berryStrengthAtLevel('葡萄果',invalid),null,`invalid level must fail closed: ${String(invalid)}`);
assert.equal(resolveBerryStrength('不存在果',30).status,'UNKNOWN_BERRY');
assert.equal(resolveBerryStrength('葡萄果',71).status,'LEVEL_OUT_OF_VERIFIED_RANGE');
assert.equal(resolveBerryStrength('葡萄果',71).strength,null);
assert.equal(resolveBerryStrengthForTypeAtLevel('電',70).berry_name,'葡萄果');
assert.equal(resolveBerryStrengthForTypeAtLevel('電',70).strength,137);
assert.equal(resolveBerryStrengthForTypeAtLevel('未知',30).status,'UNKNOWN_TYPE');

const registry=currentProductionAuthorityRegistry();
assert.equal(registry.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.berry_energy_per_berry.status,'ACTIVE_VERIFIED');
assert.equal(registry.rules.berry_energy_per_berry.rule_version,BERRY_STRENGTH_FORMULA_VERSION);
assert.equal(registry.rules.berry_output_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.favorite_berry_multiplier.status,favoriteMultiplierSuccessor?'ACTIVE_VERIFIED':'NOT_YET_VERIFIED');
assert.equal(registry.rules.ingredient_probability_per_help.status,'NOT_YET_VERIFIED');
assert.equal(registry.rules.main_skill_trigger_probability.status,'NOT_YET_VERIFIED');
assert.deepEqual(registry.active_verified_dimensions,favoriteMultiplierSuccessor?['berry_energy_per_berry','favorite_berry_multiplier']:['berry_energy_per_berry']);

const candidateFeatures={candidates:[
  {pokemon_id:'private-fire',type:'火',level:30,helper_seconds:2100,main_skill:'能量填充S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'火辣香草',quantity:2}]},
  {pokemon_id:'private-water',type:'水',level:60,helper_seconds:2200,main_skill:'食材獲取S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'哞哞鮮奶',quantity:2}]},
  {pokemon_id:'private-dragon',type:'龍',level:70,helper_seconds:2300,main_skill:'活力全體療癒S',favorite_berry_match:true,unlocked_ingredients:[{ingredient_name:'甜甜蜜',quantity:2}]},
]};
const weeklyContext={favorite_berry_1:'蘋野果',favorite_berry_2:'橙橙果',favorite_berry_3:'番荔果'};
const snapshot=buildProductionEvidenceSnapshot({candidateFeatures,weeklyContext,productionRegistry:registry});
assert.ok(['pokemon-sleep-production-evidence-snapshot/1.1','pokemon-sleep-production-evidence-snapshot/1.2'].includes(snapshot.schema));
assert.equal(snapshot.activation_decision,'HOLD_NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(snapshot.numeric_rate_model_status,'NOT_YET_VERIFIED');
assert.equal(snapshot.summary.active_numeric_dimension_count,favoriteMultiplierSuccessor?2:1);
assert.equal(snapshot.summary.blocked_numeric_dimension_count,favoriteMultiplierSuccessor?5:6);
assert.equal(snapshot.summary.berry_strength_resolved_candidate_count,3);
const berryRow=snapshot.rules.find(row=>row.dimension==='berry_energy_per_berry');
assert.equal(berryRow.evidence_status,EVIDENCE_STATUS.ACTIVE_VERIFIED_LOCAL_NUMERIC_MASTER);
assert.equal(berryRow.authority_status,'ACTIVE_VERIFIED');
assert.equal(berryRow.runtime_numeric_activation,true);
assert.equal(berryRow.coverage.observed_count,3);
assert.equal(berryRow.coverage.ratio,1);
assert.deepEqual(berryRow.blocking_reasons,[]);
if(favoriteMultiplierSuccessor){
  const favoriteRow=snapshot.rules.find(row=>row.dimension==='favorite_berry_multiplier');
  assert.equal(favoriteRow.authority_status,'ACTIVE_VERIFIED');
  assert.equal(favoriteRow.runtime_numeric_activation,true);
  assert.equal(favoriteRow.coverage.observed_count,3);
  assert.equal(snapshot.summary.favorite_berry_multiplier_resolved_candidate_count,3);
}
assert.equal(JSON.stringify(snapshot).includes('private-fire'),false,'private candidate id must not enter evidence snapshot');
assert.equal(snapshot.safety.missing_is_zero,false);
assert.equal(snapshot.safety.player_data_write,false);
assert.equal(snapshot.safety.sqlite_write,false);
assert.equal(snapshot.safety.runtime_network_fetch,false);
assert.equal(snapshot.safety.ai_numeric_authority,false);

const member=projectMemberProductionEvidence({pokemon_id:'p-electric',type:'電',level:70,helper_seconds:2500,favorite_berry_match:false,main_skill:'能量填充S',unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(member.berry_name,'葡萄果');
assert.equal(member.berry_energy_per_berry,137);
assert.equal(member.berry_energy_per_berry_status,'ACTIVE_VERIFIED');
if(favoriteMultiplierSuccessor){assert.equal(member.favorite_berry_multiplier,1);assert.equal(member.favorite_adjusted_berry_energy_per_berry,137);}
assert.equal(member.berry_rate_status,'NOT_YET_VERIFIED','berry/hour must remain blocked until berry_output_per_help is verified');
assert.equal(member.berry_energy_per_hour,null);
const invalidMember=projectMemberProductionEvidence({pokemon_id:'p-invalid',type:'電',level:71,helper_seconds:2500,favorite_berry_match:false,unlocked_ingredients:[]},{productionRegistry:registry});
assert.equal(invalidMember.berry_energy_per_berry,null);
assert.equal(invalidMember.berry_energy_per_berry_status,'LEVEL_OUT_OF_VERIFIED_RANGE');

const team={team_id:'berry-strength-only',slots:[{pokemon_id:'p1'},{pokemon_id:'p2'},{pokemon_id:'p3'},{pokemon_id:'p4'},{pokemon_id:'p5'}]};
const teamFeatures={candidates:[1,2,3,4,5].map((n,index)=>({pokemon_id:`p${n}`,type:['火','水','電','草','龍'][index],level:30,helper_seconds:2400+index*50,favorite_berry_match:index<2,unlocked_ingredients:[]}))};
const objective=evaluateTeamObjective({team,candidateFeatures:teamFeatures,goalProfile:{primary_goal:'max_snorlax_energy'},productionRegistry:registry});
assert.equal(objective.objective_status,'NUMERIC_MODEL_NOT_ACTIVE');
assert.equal(objective.objective_score,null);
assert.equal(objective.components.berry_energy_per_hour,null);
assert.ok(objective.members.every(row=>row.berry_energy_per_berry_status==='ACTIVE_VERIFIED'&&row.berry_energy_per_berry>0));
assert.ok(objective.members.every(row=>row.berry_energy_per_hour===null));
assert.ok(objective.missing_inputs.includes('berry_energy_per_hour:NOT_YET_VERIFIED'));

const source=read('assets/js/public-berry-strength-master.js');
for(const forbidden of ['INSERT INTO','UPDATE pokemon','UPDATE ingredient_inventory','DELETE FROM','applyPayload(','dryRun(','fetch('])assert.equal(source.includes(forbidden),false,`berry strength master owns forbidden mutation/network path: ${forbidden}`);
const sw=read('service-worker.js');
assert.ok(sw.includes("'./assets/js/public-berry-strength-master.js'"),'first-offline precache missing berry strength master');
const ui=read('assets/js/production-evidence-ui.js');
if(appVersion==='v0.4.21')for(const token of ['G7.5 產能模型','單顆樹果能量','已啟用數值','進階 Evidence / JSON'])assert.ok(ui.includes(token),`compact successor evidence UI token missing ${token}`);
else for(const token of ['berry strength','局部 ACTIVE_VERIFIED ≠ 完整 Production Model 已啟用'])assert.ok(ui.includes(token),`v0.4.19 evidence UI token missing ${token}`);

console.log(JSON.stringify({
  status:'PASS',gate:'V0419_G75A_BERRY_STRENGTH_NUMERIC_MASTER_SUCCESSOR_AWARE',app_version:appVersion,
  berry_master_rows:PUBLIC_BERRY_STRENGTH_MASTER.length,verified_level_min:BERRY_STRENGTH_MIN_LEVEL,verified_level_max:BERRY_STRENGTH_MAX_LEVEL,
  anchor_points:Object.keys(anchors).length*anchorLevels.length,berry_energy_per_berry_status:registry.rules.berry_energy_per_berry.status,
  active_numeric_dimension_count:snapshot.summary.active_numeric_dimension_count,blocked_numeric_dimension_count:snapshot.summary.blocked_numeric_dimension_count,
  overall_numeric_model_status:registry.numeric_rate_model_status,berry_energy_per_hour_still_blocked:true,out_of_range_fail_closed:true,
  favorite_multiplier_successor:favoriteMultiplierSuccessor,player_write:false,runtime_network_fetch:false,ai_numeric_authority:false,
},null,2));
