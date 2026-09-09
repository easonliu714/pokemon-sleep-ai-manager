import assert from 'node:assert/strict';
import {
  evaluateG121BDeterministicEvolutionStatus,
  G121B_DETERMINISTIC_STATUS,
} from '../assets/js/g121b-deterministic-evolution-status.js';

const baseRoute={
  route_id:'sleep-evolution:皮卡丘→雷丘',
  evolution_branch_id:'sleep-evolution-branch:皮卡丘',
  from_species:'皮卡丘',
  to_species:'雷丘',
  required_level:null,
  required_sleep_hours:80,
  required_candy:80,
  required_item:'雷之石',
  required_dream_shards:null,
  effective_from:null,
  effective_until:null,
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

const ready=evaluateG121BDeterministicEvolutionStatus(base);
assert.equal(ready.status,G121B_DETERMINISTIC_STATUS.CURRENT_AVAILABLE);
assert.equal(ready.pokemon_instance_id,'pokemon-instance-001');
assert.deepEqual(ready.missing_requirements,[]);

const missingSleep=evaluateG121BDeterministicEvolutionStatus({...base,sleep_hours:null});
assert.equal(missingSleep.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingSleep.reason,'missing_per_instance_sleep_hours');
assert.equal(missingSleep.account_total_sleep_time_ignored,true,'account total sleep time must never substitute per-instance sleep hours');

const nearTerm=evaluateG121BDeterministicEvolutionStatus({...base,sleep_hours:20});
assert.equal(nearTerm.status,G121B_DETERMINISTIC_STATUS.NEAR_TERM);
assert.deepEqual(nearTerm.missing_requirements,['sleep_hours']);

const missingCandyAuthority=evaluateG121BDeterministicEvolutionStatus({...base,canonical_family_candy:{knowledge_state:'UNKNOWN',quantity:999}});
assert.equal(missingCandyAuthority.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(missingCandyAuthority.reason,'missing_canonical_family_candy_authority');

const safeReserveBlocks=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':1},
  safe_reserve:{'雷之石':1},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'unknown',authority_status:'MISSING_AUTHORITY',sleep_point_cost:null,diamond_cost:null}],
});
assert.equal(safeReserveBlocks.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(safeReserveBlocks.reason,'missing_item_acquisition_authority');
assert.equal(safeReserveBlocks.acquisition_guidance_suppressed,true,'MISSING_AUTHORITY must fail closed');

const noFabricatedSleepPointCost=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':0},
  safe_reserve:{'雷之石':0},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'regular_sleep_point_exchange',authority_status:'REFERENCE_VERIFIED',sleep_point_cost:null}],
});
assert.equal(noFabricatedSleepPointCost.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(noFabricatedSleepPointCost.reason,'missing_sleep_point_cost_authority');

const knownAcquisition=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':0},
  safe_reserve:{'雷之石':0},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'regular_sleep_point_exchange',authority_status:'REFERENCE_VERIFIED',sleep_point_cost:1400}],
});
assert.equal(knownAcquisition.status,G121B_DETERMINISTIC_STATUS.NEAR_TERM);
assert.deepEqual(knownAcquisition.missing_requirements,['item']);

const unknownSleepPoints=evaluateG121BDeterministicEvolutionStatus({
  ...base,
  item_inventory:{'雷之石':0},
  safe_reserve:{'雷之石':0},
  item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'regular_sleep_point_exchange',authority_status:'REFERENCE_VERIFIED',sleep_point_cost:1400}],
  player_resources:{...knownResources,sleep_points:{knowledge_state:'UNKNOWN',numeric_value:0}},
});
assert.equal(unknownSleepPoints.status,G121B_DETERMINISTIC_STATUS.DATA_INCOMPLETE);
assert.equal(unknownSleepPoints.reason,'missing_sleep_points_authority');

const futureLocked=evaluateG121BDeterministicEvolutionStatus({...base,route:{...baseRoute,effective_from:'2026-10-01T00:00:00.000Z'}});
assert.equal(futureLocked.status,G121B_DETERMINISTIC_STATUS.FUTURE_LOCKED);

assert.deepEqual(Object.values(G121B_DETERMINISTIC_STATUS),[
  'current_available','near_term','future_locked','data_incomplete',
]);

console.log(JSON.stringify({
  gate:'G12.1B_DETERMINISTIC_EVOLUTION_STATUS',
  status:'PASS',
  per_instance_sleep_hours:true,
  canonical_family_candy:true,
  safe_reserve:true,
  player_resource_unknown_fail_closed:true,
  missing_acquisition_authority_fail_closed:true,
  fabricated_sleep_point_or_diamond_cost:false,
  vocabulary:Object.values(G121B_DETERMINISTIC_STATUS),
},null,2));
