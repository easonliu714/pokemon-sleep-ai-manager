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
assert.equal(buildG121DEvolutionRecommendationCardModel(sleep).display_immediate_recommendation,false);
assert.equal(sleep.remaining_nights,null,'night projection must remain unknown without VERIFIED nightly authority');

const missingItem={...base,
  deterministic_status:'missing_item',recommendation_status:'defer',can_evolve_now:false,
  missing_requirements:[{kind:'item',item_name:'Thunder Stone',required:1,current:0,gap:1,satisfied:false}],
  acquisition_guidance_authority:'MISSING_AUTHORITY',acquisition_guidance:[],
};
assert.equal(buildG121DEvolutionRecommendationCardModel(missingItem).valid,true);
assert.deepEqual(missingItem.acquisition_guidance,[],'missing acquisition authority must never invent purchase guidance');

const expired={...missingItem,acquisition_guidance_authority:'TIME_AUTHORITY_UNAVAILABLE'};
assert.deepEqual(expired.acquisition_guidance,[]);
const unpurchasable={...missingItem,acquisition_guidance_authority:'VERIFIED',acquisition_guidance:[{type:'unavailable_now',cost_resource:null,cost:null}]};
assert.equal(buildG121DEvolutionRecommendationCardModel(unpurchasable).valid,true);

const multiMissing={...base,
  deterministic_status:'multiple_requirements_missing',recommendation_status:'defer',can_evolve_now:false,
  missing_requirements:[
    {kind:'level',required:30,current:20,gap:10,satisfied:false},
    {kind:'candy',required:80,current:40,gap:40,satisfied:false,candy_family_id:'eevee'},
  ],
};
assert.equal(buildG121DEvolutionRecommendationCardModel(multiMissing).display_immediate_recommendation,false);

const personal=structuredClone(base);
const before=JSON.stringify(personal);
buildG121DEvolutionRecommendationCardModel(personal);
assert.equal(JSON.stringify(personal),before,'read-side UI model must not mutate personal snapshot/envelope');

const shared={...base,pokemon_instance_id:'shared-instance'};
assert.notEqual(buildG121DEvolutionRecommendationCardModel(shared).pokemon_instance_id,model.pokemon_instance_id,'shared/personal fixture identity must remain isolated');

console.log('G12.1D_EVOLUTION_RECOMMENDATION_UI_CONTRACT=PASS');
