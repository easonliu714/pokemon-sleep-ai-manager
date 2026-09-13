import assert from 'node:assert/strict';
import {
  evaluateG121BDeterministicEvolutionStatus,
  G121B_DETERMINISTIC_STATUS,
  G121B_REQUIREMENT_STATE,
} from '../assets/js/g121b-deterministic-evolution-status.js';

const baseRoute={
  route_id:'sleep-evolution:皮卡丘→雷丘',
  evolution_branch_id:'sleep-evolution-branch:皮卡丘',
  from_species:'皮卡丘',
  to_species:'雷丘',
  required_level:25,
  required_sleep_hours:80,
  required_candy:80,
  required_item:'雷之石',
  required_dream_shards:1000,
  other_requirement:null,
  effective_from:null,
  effective_until:null,
  effective_period_status:'CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW',
  confidence:1,
};
const knownResources={
  dream_shards:{knowledge_state:'KNOWN',numeric_value:5000},
  sleep_points:{knowledge_state:'KNOWN',numeric_value:5000},
  diamonds:{knowledge_state:'UNKNOWN',numeric_value:null},
  premium_pass_state:{knowledge_state:'KNOWN',text_value:'INACTIVE'},
};
const base={
  pokemon_instance_id:'pokemon-instance-001',
  sleep_hours:100,
  account_total_sleep_time:99999,
  level:30,
  route:baseRoute,
  canonical_family_candy:{knowledge_state:'KNOWN',quantity:100,candy_family_id:'pikachu-family'},
  item_inventory:{'雷之石':2},
  safe_reserve:{'雷之石':1},
  item_acquisition_rows:[],
  player_resources:knownResources,
  now:'2026-09-09T00:00:00.000Z',
};

assert.deepEqual(Object.values(G121B_DETERMINISTIC_STATUS),[
  'ready_now',
  'missing_sleep_hours',
  'missing_level',
  'missing_candy',
  'missing_item',
  'missing_dream_shards',
  'time_window_pending',
  'multiple_requirements_missing',
  'data_incomplete',
  'evolution_not_recommended_yet',
]);
assert.deepEqual(Object.values(G121B_REQUIREMENT_STATE),[
  'SATISFIED','MISSING','UNKNOWN','NOT_APPLICABLE',
]);

const ready=evaluateG121BDeterministicEvolutionStatus(base);
assert.equal(ready.status,G121B_DETERMINISTIC_STATUS.READY_NOW);
assert.equal(ready.pokemon_instance_id,'pokemon-instance-001');
assert.equal(ready.route_id,baseRoute.route_id);
assert.equal(ready.evolution_branch_id,baseRoute.evolution_branch_id);
assert.deepEqual(ready.missing_requirements,[]);

const missingSleepAuthority=evaluateG121BDeterministicEvolutionStatus({...base,sleep_hours:null});
assert.equal(missingSleepAuthority.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingSleepAuthority.reason,'authoritative_requirements_incomplete');
assert.ok(missingSleepAuthority.unknown_reasons.includes('missing_per_instance_sleep_hours'));
assert.equal(missingSleepAuthority.requirement_states.sleep_hours,G121B_REQUIREMENT_STATE.UNKNOWN);
assert.equal(missingSleepAuthority.requirement_states.level,G121B_REQUIREMENT_STATE.SATISFIED);
assert.equal(missingSleepAuthority.account_total_sleep_time_ignored,true,'account total sleep time must never substitute per-instance sleep hours');

const missingSleep=evaluateG121BDeterministicEvolutionStatus({...base,sleep_hours:20});
assert.equal(missingSleep.status,G121B_DETERMINISTIC_STATUS.MISSING_SLEEP_HOURS);
assert.equal(missingSleep.requirement_states.sleep_hours,G121B_REQUIREMENT_STATE.MISSING);

const missingLevel=evaluateG121BDeterministicEvolutionStatus({...base,level:10});
assert.equal(missingLevel.status,G121B_DETERMINISTIC_STATUS.MISSING_LEVEL);

const missingCandy=evaluateG121BDeterministicEvolutionStatus({...base,canonical_family_candy:{knowledge_state:'KNOWN',quantity:10,candy_family_id:'pikachu-family'}});
assert.equal(missingCandy.status,G121B_DETERMINISTIC_STATUS.MISSING_CANDY);

const missingCandyAuthority=evaluateG121BDeterministicEvolutionStatus({...base,canonical_family_candy:{knowledge_state:'UNKNOWN',quantity:999,candy_family_id:'pikachu-family'}});
assert.equal(missingCandyAuthority.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingCandyAuthority.reason,'authoritative_requirements_incomplete');
assert.ok(missingCandyAuthority.unknown_reasons.includes('missing_canonical_family_candy_authority'));
assert.equal(missingCandyAuthority.requirement_states.candy,G121B_REQUIREMENT_STATE.UNKNOWN);
assert.equal(missingCandyAuthority.requirement_states.sleep_hours,G121B_REQUIREMENT_STATE.SATISFIED,'Candy UNKNOWN must not erase known sleep status');

const partialKnownTogepi=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  route:{...baseRoute,route_id:'sleep-evolution:波克比→波克基古',evolution_branch_id:'sleep-evolution-branch:波克比',from_species:'波克比',to_species:'波克基古',required_level:null,required_sleep_hours:50,required_candy:20,required_item:null,required_dream_shards:null},
  sleep_hours:8.5,
  canonical_family_candy:{knowledge_state:'UNKNOWN',quantity:null,candy_family_id:null},
});
assert.equal(partialKnownTogepi.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(partialKnownTogepi.requirement_states.sleep_hours,G121B_REQUIREMENT_STATE.MISSING);
assert.equal(partialKnownTogepi.requirement_states.candy,G121B_REQUIREMENT_STATE.UNKNOWN);
assert.deepEqual(partialKnownTogepi.missing_requirements,['sleep_hours']);
assert.ok(partialKnownTogepi.unknown_reasons.includes('missing_canonical_family_candy_authority'));
const togepiSleepRequirement=partialKnownTogepi.requirements.find(row=>row.kind==='sleep_hours');
assert.equal(togepiSleepRequirement.current,8.5,'8.5h player progress must remain numeric and not collapse to UNKNOWN');
assert.equal(togepiSleepRequirement.remaining,41.5,'50h - 8.5h must preserve a deterministic 41.5h gap');

const missingDreamShards=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  player_resources:{...knownResources,dream_shards:{knowledge_state:'KNOWN',numeric_value:500}},
});
assert.equal(missingDreamShards.status,G121B_DETERMINISTIC_STATUS.MISSING_DREAM_SHARDS);

const unknownDreamShards=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  player_resources:{...knownResources,dream_shards:{knowledge_state:'UNKNOWN',numeric_value:0}},
});
assert.equal(unknownDreamShards.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(unknownDreamShards.reason,'authoritative_requirements_incomplete');
assert.ok(unknownDreamShards.unknown_reasons.includes('missing_dream_shards_authority'));
assert.equal(unknownDreamShards.requirement_states.dream_shards,G121B_REQUIREMENT_STATE.UNKNOWN);

const missingItem=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':1},
  safe_reserve:{'雷之石':1},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'mission',authority_status:'REFERENCE_VERIFIED'}],
});
assert.equal(missingItem.status,G121B_DETERMINISTIC_STATUS.MISSING_ITEM);

const safeReserveBlocks=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':1},
  safe_reserve:{'雷之石':1},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'unknown',authority_status:'MISSING_AUTHORITY',sleep_point_cost:null,diamond_cost:null}],
});
assert.equal(safeReserveBlocks.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(safeReserveBlocks.reason,'authoritative_requirements_incomplete');
assert.ok(safeReserveBlocks.unknown_reasons.includes('missing_item_acquisition_authority'));
assert.equal(safeReserveBlocks.requirement_states.item,G121B_REQUIREMENT_STATE.MISSING);
assert.equal(safeReserveBlocks.acquisition_guidance_suppressed,true,'MISSING_AUTHORITY must fail closed');

const noFabricatedSleepPointCost=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':0},
  safe_reserve:{'雷之石':0},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'regular_sleep_point_exchange',authority_status:'REFERENCE_VERIFIED',sleep_point_cost:null}],
});
assert.equal(noFabricatedSleepPointCost.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(noFabricatedSleepPointCost.reason,'authoritative_requirements_incomplete');
assert.ok(noFabricatedSleepPointCost.unknown_reasons.includes('missing_sleep_point_cost_authority'));

const unknownSleepPoints=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':0},
  safe_reserve:{'雷之石':0},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'regular_sleep_point_exchange',authority_status:'REFERENCE_VERIFIED',sleep_point_cost:1}],
  player_resources:{...knownResources,sleep_points:{knowledge_state:'UNKNOWN',numeric_value:0}},
});
assert.equal(unknownSleepPoints.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(unknownSleepPoints.reason,'authoritative_requirements_incomplete');
assert.ok(unknownSleepPoints.unknown_reasons.includes('missing_sleep_points_authority'));

const futureWindow=evaluateG121BDeterministicEvolutionStatus({...base,route:{...baseRoute,effective_from:'2026-10-01T00:00:00.000Z',effective_period_status:'FUTURE'}});
assert.equal(futureWindow.status,G121B_DETERMINISTIC_STATUS.TIME_WINDOW_PENDING);

const multiple=evaluateG121BDeterministicEvolutionStatus({...base,sleep_hours:20,level:10});
assert.equal(multiple.status,G121B_DETERMINISTIC_STATUS.MULTIPLE_REQUIREMENTS_MISSING);
assert.deepEqual(multiple.missing_requirements,['level','sleep_hours']);

const otherRequirement=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  route:{...baseRoute,other_requirement:'deterministic external condition'},
  other_requirement_satisfied:false,
});
assert.equal(otherRequirement.status,G121B_DETERMINISTIC_STATUS.EVOLUTION_NOT_RECOMMENDED_YET);

const missingOtherAuthority=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  route:{...baseRoute,other_requirement:'deterministic external condition'},
});
assert.equal(missingOtherAuthority.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingOtherAuthority.reason,'authoritative_requirements_incomplete');
assert.ok(missingOtherAuthority.unknown_reasons.includes('missing_other_requirement_authority'));
assert.equal(missingOtherAuthority.requirement_states.other_requirement,G121B_REQUIREMENT_STATE.UNKNOWN);

const ambiguousConfidence=evaluateG121BDeterministicEvolutionStatus({...base,route:{...baseRoute,confidence:0.8}});
assert.equal(ambiguousConfidence.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(ambiguousConfidence.reason,'unverified_evolution_route_authority');

const missingEffectivePeriodAuthority=evaluateG121BDeterministicEvolutionStatus({...base,route:{...baseRoute,effective_period_status:null}});
assert.equal(missingEffectivePeriodAuthority.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingEffectivePeriodAuthority.reason,'missing_effective_period_authority');

console.log(JSON.stringify({
  gate:'G12.1B_DETERMINISTIC_EVOLUTION_STATUS',
  status:'PASS',
  pokemon_instance_id_only:true,
  per_instance_sleep_hours:true,
  fractional_sleep_hours:true,
  account_total_sleep_time_substitution:false,
  canonical_family_candy:true,
  partial_known_requirement_semantics:true,
  safe_reserve:true,
  player_resource_unknown_fail_closed:true,
  missing_acquisition_authority_fail_closed:true,
  fabricated_sleep_point_or_diamond_cost:false,
  ai_status_computation:false,
  vocabulary:Object.values(G121B_DETERMINISTIC_STATUS),
  requirement_states:Object.values(G121B_REQUIREMENT_STATE),
},null,2));