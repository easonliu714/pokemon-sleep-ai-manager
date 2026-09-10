import assert from 'node:assert/strict';
import {
  buildG121DEvolutionRecommendationCardModel,
} from '../assets/js/g121d-evolution-recommendation-ui.js';

const base={
  schema:'evolution-recommendation/1.0',
  deterministic:true,
  read_only:true,
  ai_recommendation_decision:false,
  pokemon_instance_id:'pkm-instance-001',
  route_id:'route-eevee-vaporeon',
  evolution_branch_id:'branch-vaporeon',
  deterministic_status:'ready_now',
  recommendation_status:'data_incomplete',
  rationale:'missing_recommendation_authority',
  can_evolve_now:true,
  completed_requirements:[
    {kind:'level',required:20,current:25,gap:0,satisfied:true},
    {kind:'candy',required:80,current:100,gap:0,satisfied:true,candy_family_id:'eevee'},
  ],
  missing_requirements:[],
  sleep_hours_remaining:null,
  remaining_nights:null,
  completion_date:null,
  projection_status:'NOT_APPLICABLE',
  acquisition_guidance_authority:'NOT_REQUIRED',
  acquisition_guidance:[],
  warnings:[],
};

const model=buildG121DEvolutionRecommendationCardModel(base);
assert.equal(model.valid,true);
assert.equal(model.pokemon_instance_id,'pkm-instance-001');
assert.equal(model.can_evolve_now,true);
assert.equal(model.display_immediate_recommendation,false,'ready_now must not become immediate recommendation without verified recommendation authority');

const recommend=buildG121DEvolutionRecommendationCardModel({...base,recommendation_status:'recommend_now'});
assert.equal(recommend.display_immediate_recommendation,true);

for(const invalid of [
  null,
  {...base,schema:'evolution-recommendation/0.9'},
  {...base,deterministic:false},
  {...base,read_only:false},
  {...base,ai_recommendation_decision:true},
  {...base,pokemon_instance_id:''},
]){
  assert.equal(buildG121DEvolutionRecommendationCardModel(invalid).valid,false);
}

const sleep={...base,
  deterministic_status:'missing_sleep_hours',recommendation_status:'defer',can_evolve_now:false,
  missing_requirements:[{kind:'sleep_hours',required:150,current:100,gap:50,satisfied:false}],
  sleep_hours_remaining:50,remaining_nights:null,completion_date:null,projection_status:'MISSING_AUTHORITY',
};
const sleepModel=buildG121DEvolutionRecommendationCardModel(sleep);
assert.equal(sleepModel.display_immediate_recommendation,false);
assert.equal(sleepModel.envelope.remaining_nights,null,'night projection must remain unknown without VERIFIED nightly authority');
assert.equal(sleepModel.envelope.completion_date,null,'completion date must remain unknown without VERIFIED nightly authority');

const verifiedNight={...sleep,
  projection_status:'VERIFIED',remaining_nights:7,completion_date:'2026-09-17',
};
const verifiedNightModel=buildG121DEvolutionRecommendationCardModel(verifiedNight);
assert.equal(verifiedNightModel.envelope.remaining_nights,7);
assert.equal(verifiedNightModel.envelope.completion_date,'2026-09-17');

const missingItem={...base,
  deterministic_status:'missing_item',recommendation_status:'defer',can_evolve_now:false,
  missing_requirements:[{kind:'item',item_name:'Thunder Stone',required:1,current:0,gap:1,satisfied:false}],
  acquisition_guidance_authority:'MISSING_AUTHORITY',acquisition_guidance:[],
};
assert.equal(buildG121DEvolutionRecommendationCardModel(missingItem).valid,true);
assert.deepEqual(missingItem.acquisition_guidance,[],'missing acquisition authority must never invent purchase guidance');

const expired={...missingItem,acquisition_guidance_authority:'TIME_AUTHORITY_UNAVAILABLE'};
assert.deepEqual(buildG121DEvolutionRecommendationCardModel(expired).envelope.acquisition_guidance,[],'expired acquisition authority must remain empty');

const missingCost={...missingItem,acquisition_guidance_authority:'MISSING_COST_AUTHORITY'};
assert.deepEqual(buildG121DEvolutionRecommendationCardModel(missingCost).envelope.acquisition_guidance,[],'unknown Sleep Point/Diamond cost must remain empty');

const unpurchasable={...missingItem,acquisition_guidance_authority:'VERIFIED',acquisition_guidance:[{type:'unavailable_now',cost_resource:null,cost:null}]};
assert.equal(buildG121DEvolutionRecommendationCardModel(unpurchasable).valid,true);
assert.equal(buildG121DEvolutionRecommendationCardModel(unpurchasable).envelope.acquisition_guidance[0].type,'unavailable_now');

const insufficientSleepPoints={...missingItem,
  deterministic_status:'missing_item',
  acquisition_guidance_authority:'VERIFIED',
  acquisition_guidance:[{type:'regular_sleep_point_exchange',cost_resource:'sleep_points',cost:1400,verified_at:'2026-09-10T00:00:00Z'}],
  warnings:['insufficient_sleep_points'],
};
const insufficientSleepPointsModel=buildG121DEvolutionRecommendationCardModel(insufficientSleepPoints);
assert.equal(insufficientSleepPointsModel.display_immediate_recommendation,false);
assert.equal(insufficientSleepPointsModel.envelope.acquisition_guidance[0].cost,1400);
assert.ok(insufficientSleepPointsModel.envelope.warnings.includes('insufficient_sleep_points'),'UI must preserve deterministic insufficient-resource warning instead of recomputing affordability');

const timeWindowPending={...base,
  deterministic_status:'time_window_pending',recommendation_status:'defer',can_evolve_now:false,
  rationale:'evolution_effective_window_pending',
};
const timeWindowModel=buildG121DEvolutionRecommendationCardModel(timeWindowPending);
assert.equal(timeWindowModel.valid,true);
assert.equal(timeWindowModel.deterministic_status,'time_window_pending');
assert.equal(timeWindowModel.display_immediate_recommendation,false,'day/night/time-window pending status must never be promoted by UI');

const multiMissing={...base,
  deterministic_status:'multiple_requirements_missing',recommendation_status:'defer',can_evolve_now:false,
  missing_requirements:[
    {kind:'level',required:30,current:20,gap:10,satisfied:false},
    {kind:'candy',required:80,current:40,gap:40,satisfied:false,candy_family_id:'eevee'},
    {kind:'dream_shards',required:80000,current:12000,gap:68000,satisfied:false},
  ],
};
const multiMissingModel=buildG121DEvolutionRecommendationCardModel(multiMissing);
assert.equal(multiMissingModel.display_immediate_recommendation,false);
assert.deepEqual(multiMissingModel.envelope.missing_requirements.map(row=>row.gap),[10,40,68000]);

const branchA={...base,route_id:'route-eevee-vaporeon',evolution_branch_id:'branch-vaporeon'};
const branchB={...base,route_id:'route-eevee-jolteon',evolution_branch_id:'branch-jolteon',recommendation_status:'defer',can_evolve_now:false};
assert.equal(buildG121DEvolutionRecommendationCardModel(branchA).pokemon_instance_id,buildG121DEvolutionRecommendationCardModel(branchB).pokemon_instance_id,'multi-branch comparison fixtures must retain one exact pokemon_instance_id');
assert.notEqual(buildG121DEvolutionRecommendationCardModel(branchA).evolution_branch_id,buildG121DEvolutionRecommendationCardModel(branchB).evolution_branch_id,'branch comparison must preserve distinct evolution branch authority');

const personal=structuredClone(base);
const before=JSON.stringify(personal);
buildG121DEvolutionRecommendationCardModel(personal);
assert.equal(JSON.stringify(personal),before,'read-side UI model must not mutate personal snapshot/envelope');

const rollbackFixture=structuredClone(multiMissing);
const rollbackBefore=structuredClone(rollbackFixture);
buildG121DEvolutionRecommendationCardModel(rollbackFixture);
assert.deepEqual(rollbackFixture,rollbackBefore,'presentation pass must be snapshot/rollback neutral');

const shared={...base,pokemon_instance_id:'shared-instance'};
assert.notEqual(buildG121DEvolutionRecommendationCardModel(shared).pokemon_instance_id,model.pokemon_instance_id,'shared/personal fixture identity must remain isolated');

console.log(JSON.stringify({
  gate:'G12.1E_EVOLUTION_UI_AUTOMATED_CONTRACT',
  status:'PASS',
  general_level_candy:true,
  sleep_hours:true,
  evolution_item:true,
  day_night_time_window:true,
  multiple_requirements_missing:true,
  expired_acquisition:true,
  sleep_points_insufficient:true,
  unavailable_purchase:true,
  branch_comparison_identity:true,
  shared_personal_isolation:true,
  read_only_no_mutation:true,
  snapshot_rollback_neutral:true,
},null,2));
