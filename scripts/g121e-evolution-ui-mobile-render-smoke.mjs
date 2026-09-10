import assert from 'node:assert/strict';
import {
  renderG121DEvolutionRecommendationCard,
  renderG121DBranchComparison,
} from '../assets/js/g121d-evolution-recommendation-ui.js';

function makeContainer(){
  const grid={children:[],appendChild(node){this.children.push(node);}};
  return {
    _html:'',
    grid,
    set innerHTML(value){this._html=String(value);},
    get innerHTML(){return this._html;},
    querySelector(selector){return selector==='.g121d-branch-grid'?grid:null;},
  };
}

globalThis.document={createElement(){return makeContainer();}};

const base={
  schema:'evolution-recommendation/1.0',
  deterministic:true,
  read_only:true,
  ai_recommendation_decision:false,
  pokemon_instance_id:'mobile-instance-001',
  route_id:'route-eevee-vaporeon',
  evolution_branch_id:'branch-vaporeon',
  current_label:'伊布',
  target_label:'水伊布',
  deterministic_status:'ready_now',
  recommendation_status:'data_incomplete',
  rationale:'missing_recommendation_authority',
  can_evolve_now:true,
  completed_requirements:[
    {kind:'level',required:20,current:25,gap:0,satisfied:true},
    {kind:'candy',required:80,current:100,gap:0,satisfied:true},
  ],
  missing_requirements:[],
  sleep_hours_remaining:null,
  remaining_nights:null,
  completion_date:null,
  projection_status:'NOT_APPLICABLE',
  acquisition_guidance_authority:'MISSING_AUTHORITY',
  acquisition_guidance:[],
  warnings:[],
  source:'g121c-test-double',
  verified_at:'2026-09-10T06:00:00Z',
  confidence:'VERIFIED',
};

const single=makeContainer();
const singleResult=renderG121DEvolutionRecommendationCard(single,base);
assert.equal(singleResult.rendered,true);
assert.equal(singleResult.valid,true);
assert.match(single.innerHTML,/進化建議卡/);
assert.match(single.innerHTML,/伊布 → 水伊布/);
assert.match(single.innerHTML,/mobile-instance-001/);
assert.match(single.innerHTML,/資料不足／暫緩/,'ready_now must not be promoted when recommendation authority is incomplete');
assert.match(single.innerHTML,/取得方式：資料不足／需確認/);
assert.doesNotMatch(single.innerHTML,/Sleep Points \d+/,'missing acquisition authority must not create Sleep Points purchase claims');
assert.doesNotMatch(single.innerHTML,/Diamonds \d+/,'missing acquisition authority must not create Diamond purchase claims');

const sleep=makeContainer();
renderG121DEvolutionRecommendationCard(sleep,{
  ...base,
  deterministic_status:'missing_sleep_hours',
  recommendation_status:'defer',
  can_evolve_now:false,
  missing_requirements:[{kind:'sleep_hours',required:150,current:100,gap:50,satisfied:false}],
  sleep_hours_remaining:50,
  projection_status:'MISSING_AUTHORITY',
});
assert.match(sleep.innerHTML,/尚差 50 小時/);
assert.match(sleep.innerHTML,/剩餘夜數／完成日未知/,'night projection must stay unknown without VERIFIED nightly authority');

const verifiedNight=makeContainer();
renderG121DEvolutionRecommendationCard(verifiedNight,{
  ...base,
  deterministic_status:'missing_sleep_hours',
  recommendation_status:'defer',
  can_evolve_now:false,
  missing_requirements:[{kind:'sleep_hours',required:150,current:100,gap:50,satisfied:false}],
  sleep_hours_remaining:50,
  projection_status:'VERIFIED',
  remaining_nights:7,
  completion_date:'2026-09-17',
});
assert.match(verifiedNight.innerHTML,/剩餘 7 夜/);
assert.match(verifiedNight.innerHTML,/2026-09-17/);

const branchContainer=makeContainer();
const branchB={...base,route_id:'route-eevee-jolteon',evolution_branch_id:'branch-jolteon',target_label:'雷伊布',recommendation_status:'defer',can_evolve_now:false};
const branchResult=renderG121DBranchComparison(branchContainer,[base,branchB]);
assert.equal(branchResult.valid,true);
assert.equal(branchResult.branch_count,2);
assert.equal(branchContainer.grid.children.length,2);
assert.match(branchContainer.grid.children[0].innerHTML,/水伊布/);
assert.match(branchContainer.grid.children[1].innerHTML,/雷伊布/);

const isolation=makeContainer();
const isolationResult=renderG121DBranchComparison(isolation,[base,{...branchB,pokemon_instance_id:'other-instance'}]);
assert.equal(isolationResult.valid,false);
assert.match(isolation.innerHTML,/資料不足／需確認/,'cross-instance branch comparison must fail closed');

const invalid=makeContainer();
const invalidResult=renderG121DEvolutionRecommendationCard(invalid,{...base,read_only:false});
assert.equal(invalidResult.valid,false);
assert.match(invalid.innerHTML,/資料不足／需確認/);

console.log(JSON.stringify({
  gate:'G12.1E_EVOLUTION_UI_MOBILE_RENDER_SMOKE',
  status:'PASS',
  single_card:true,
  required_fields_visible:true,
  ready_now_not_auto_recommended:true,
  missing_acquisition_fail_closed:true,
  nightly_projection_authority:true,
  branch_comparison:true,
  shared_personal_isolation:true,
  invalid_envelope_fail_closed:true,
},null,2));
