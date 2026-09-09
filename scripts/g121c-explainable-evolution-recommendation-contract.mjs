import assert from 'node:assert/strict';
import {
  G121C_RECOMMENDATION_SCHEMA,
  readG121CExplainableEvolutionRecommendation,
} from '../assets/js/g121c-explainable-evolution-recommendation.js';

const route={
  route_id:'sleep-evolution:皮卡丘→雷丘',
  evolution_branch_id:'sleep-evolution-branch:皮卡丘',
  from_species:'皮卡丘',
  to_species:'雷丘',
  required_level:10,
  required_sleep_hours:null,
  required_candy:20,
  required_item:'',
  required_dream_shards:null,
  other_requirement:null,
  effective_from:null,
  effective_until:null,
  effective_period_status:'CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW',
  confidence:1,
};
const request={
  pokemon_instance_id:'p-001',
  route_id:route.route_id,
  evolution_branch_id:route.evolution_branch_id,
  now:'2026-09-09T12:00:00.000Z',
};
const snapshot={
  pokemon_rows:[{pokemon_instance_id:'p-001',level:12,sleep_hours:30,candy_family_id:'candy-family:pikachu'}],
  evolution_master_rows:[route],
  canonical_family_candy_rows:[{candy_family_id:'candy-family:pikachu',quantity:25,knowledge_state:'KNOWN'}],
  legacy_species_candy_rows:[{species:'皮卡丘',quantity:9999}],
  item_inventory_rows:[],
  item_acquisition_rows:[],
  player_resource_state_rows:[],
  account_total_sleep_time:9999,
};
const verifiedRecommendationAuthority={
  cultivation_value:{authority_status:'VERIFIED',value:true},
  team_need:{authority_status:'VERIFIED',value:true},
  opportunity_cost_acceptable:{authority_status:'VERIFIED',value:true},
};

const incompleteReady=readG121CExplainableEvolutionRecommendation(snapshot,request,{});
assert.equal(incompleteReady.schema,G121C_RECOMMENDATION_SCHEMA);
assert.equal(incompleteReady.deterministic_status,'ready_now');
assert.equal(incompleteReady.can_evolve_now,true);
assert.equal(incompleteReady.recommendation_status,'data_incomplete','ready_now must not imply recommendation without recommendation authority');
assert.equal(incompleteReady.rationale,'missing_recommendation_authority');
assert.equal(incompleteReady.ai_recommendation_decision,false);
assert.equal(incompleteReady.read_only,true);

const recommend=readG121CExplainableEvolutionRecommendation(snapshot,request,verifiedRecommendationAuthority);
assert.equal(recommend.recommendation_status,'recommend_now');
assert.equal(recommend.completed_requirements.length,2);
assert.equal(recommend.missing_requirements.length,0);
assert.equal(recommend.acquisition_guidance_authority,'NOT_REQUIRED');

const deferred=readG121CExplainableEvolutionRecommendation(snapshot,request,{
  ...verifiedRecommendationAuthority,
  opportunity_cost_acceptable:{authority_status:'VERIFIED',value:false},
});
assert.equal(deferred.recommendation_status,'defer');
assert.equal(deferred.rationale,'verified_recommendation_authority_supports_deferral');

const sleepRoute={...route,route_id:'sleep-evolution:伊布→太陽伊布',evolution_branch_id:'sleep-evolution-branch:伊布',from_species:'伊布',to_species:'太陽伊布',required_level:null,required_sleep_hours:50,required_candy:0};
const sleepSnapshot={
  ...snapshot,
  pokemon_rows:[{pokemon_instance_id:'p-002',level:1,sleep_hours:34,candy_family_id:'candy-family:eevee'}],
  evolution_master_rows:[sleepRoute],
  canonical_family_candy_rows:[],
};
const sleepRequest={pokemon_instance_id:'p-002',route_id:sleepRoute.route_id,evolution_branch_id:sleepRoute.evolution_branch_id,now:request.now};
const noNightAuthority=readG121CExplainableEvolutionRecommendation(sleepSnapshot,sleepRequest,verifiedRecommendationAuthority);
assert.equal(noNightAuthority.deterministic_status,'missing_sleep_hours');
assert.equal(noNightAuthority.sleep_hours_remaining,16);
assert.equal(noNightAuthority.remaining_nights,null,'night projection must not assume nightly sleep duration');
assert.equal(noNightAuthority.completion_date,null);
assert.equal(noNightAuthority.projection_status,'MISSING_AUTHORITY');
const verifiedNight=readG121CExplainableEvolutionRecommendation(sleepSnapshot,sleepRequest,{
  ...verifiedRecommendationAuthority,
  nightly_sleep:{authority_status:'VERIFIED',nightly_sleep_hours:8,projection_start_date:'2026-09-10'},
});
assert.equal(verifiedNight.remaining_nights,2);
assert.equal(verifiedNight.completion_date,'2026-09-11');
assert.equal(verifiedNight.projection_status,'VERIFIED');

const itemRoute={...route,route_id:'sleep-evolution:測試→測試2',evolution_branch_id:'sleep-evolution-branch:test',from_species:'測試',to_species:'測試2',required_level:null,required_candy:0,required_item:'測試石'};
const itemSnapshot={
  ...snapshot,
  pokemon_rows:[{pokemon_instance_id:'p-003',level:1,sleep_hours:0,candy_family_id:'candy-family:test'}],
  evolution_master_rows:[itemRoute],
  canonical_family_candy_rows:[],
  item_inventory_rows:[{item_name:'測試石',quantity:0,safe_reserve:0}],
  item_acquisition_rows:[{item_name:'測試石',acquisition_type:'unknown',authority_status:'MISSING_AUTHORITY',sleep_point_cost:null,diamond_cost:null}],
};
const itemRequest={pokemon_instance_id:'p-003',route_id:itemRoute.route_id,evolution_branch_id:itemRoute.evolution_branch_id,now:request.now};
const missingAcquisition=readG121CExplainableEvolutionRecommendation(itemSnapshot,itemRequest,verifiedRecommendationAuthority);
assert.equal(missingAcquisition.recommendation_status,'data_incomplete');
assert.equal(missingAcquisition.deterministic_status,'data_incomplete');
assert.equal(missingAcquisition.acquisition_guidance_authority,'MISSING_AUTHORITY');
assert.ok(!('acquisition_guidance' in missingAcquisition)||!missingAcquisition.acquisition_guidance?.length);

const expiredAcquisitionSnapshot={
  ...itemSnapshot,
  item_acquisition_rows:[{item_name:'測試石',acquisition_type:'regular_sleep_point_exchange',authority_status:'VERIFIED',sleep_point_cost:100,available_until:'2026-09-08T00:00:00.000Z',verified_at:'2026-09-01'}],
  player_resource_state_rows:[{resource_key:'sleep_points',knowledge_state:'KNOWN',numeric_value:999,text_value:null}],
};
const expired=readG121CExplainableEvolutionRecommendation(expiredAcquisitionSnapshot,itemRequest,verifiedRecommendationAuthority);
assert.equal(expired.deterministic_status,'missing_item');
assert.equal(expired.acquisition_guidance_authority,'TIME_AUTHORITY_UNAVAILABLE');
assert.deepEqual(expired.acquisition_guidance,[],'expired acquisition authority must never produce purchase guidance');
assert.ok(expired.warnings.includes('item_acquisition_time_authority_unavailable'));

const missingCostSnapshot={
  ...itemSnapshot,
  item_acquisition_rows:[{item_name:'測試石',acquisition_type:'regular_sleep_point_exchange',authority_status:'VERIFIED',sleep_point_cost:null,verified_at:'2026-09-09'}],
  player_resource_state_rows:[{resource_key:'sleep_points',knowledge_state:'KNOWN',numeric_value:999,text_value:null}],
};
const missingCost=readG121CExplainableEvolutionRecommendation(missingCostSnapshot,itemRequest,verifiedRecommendationAuthority);
assert.equal(missingCost.recommendation_status,'data_incomplete','G12.1B missing cost must fail closed before recommendation');
assert.equal(missingCost.deterministic_status,'data_incomplete');
assert.ok(!('acquisition_guidance' in missingCost)||!missingCost.acquisition_guidance?.length);

console.log(JSON.stringify({
  gate:'G12.1C_EXPLAINABLE_EVOLUTION_RECOMMENDATION',
  status:'PASS',
  ready_now_requires_recommendation_authority:true,
  per_instance_sleep_projection_fail_closed:true,
  acquisition_missing_or_expired_fail_closed:true,
  ai_recommendation_decision:false,
},null,2));
