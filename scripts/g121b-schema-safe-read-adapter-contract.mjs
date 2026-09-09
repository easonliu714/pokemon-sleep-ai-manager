import assert from 'node:assert/strict';
import {evaluateG121BFromAuthoritativeSnapshot} from '../assets/js/g121b-schema-safe-read-adapter.js';

const route={
  route_id:'sleep-evolution:皮卡丘→雷丘',
  evolution_branch_id:'sleep-evolution-branch:皮卡丘',
  from_species:'皮卡丘',to_species:'雷丘',required_level:25,required_sleep_hours:80,
  required_candy:80,required_item:'雷之石',required_dream_shards:1000,other_requirement:null,
  effective_from:null,effective_until:null,effective_period_status:'CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW',confidence:1,
};
const resources=[
  {resource_key:'dream_shards',resource_kind:'numeric',knowledge_state:'KNOWN',numeric_value:5000},
  {resource_key:'sleep_points',resource_kind:'numeric',knowledge_state:'KNOWN',numeric_value:5000},
  {resource_key:'diamonds',resource_kind:'numeric',knowledge_state:'UNKNOWN',numeric_value:null},
  {resource_key:'premium_pass_state',resource_kind:'enum',knowledge_state:'KNOWN',text_value:'INACTIVE'},
];
const snapshot={
  pokemon_rows:[
    {pokemon_instance_id:'p-001',species:'皮卡丘',level:30,sleep_hours:100,candy_family_id:'pikachu-family'},
    {pokemon_instance_id:'p-002',species:'皮卡丘',level:30,sleep_hours:12,candy_family_id:'pikachu-family'},
  ],
  evolution_master_rows:[route],
  canonical_family_candy_rows:[{candy_family_id:'pikachu-family',knowledge_state:'KNOWN',quantity:100}],
  legacy_species_candy_rows:[{species:'皮卡丘',quantity:999999}],
  item_inventory_rows:[{item_name:'雷之石',quantity:2,safe_reserve:1}],
  item_acquisition_rows:[],
  player_resource_state_rows:resources,
  account_total_sleep_time:99999,
};
const request={pokemon_instance_id:'p-001',route_id:route.route_id,evolution_branch_id:route.evolution_branch_id,now:'2026-09-09T00:00:00.000Z'};

const ready=evaluateG121BFromAuthoritativeSnapshot(snapshot,request);
assert.equal(ready.status,'ready_now');
assert.equal(ready.pokemon_instance_id,'p-001');

const second=evaluateG121BFromAuthoritativeSnapshot(snapshot,{...request,pokemon_instance_id:'p-002'});
assert.equal(second.status,'missing_sleep_hours','must bind sleep hours to requested instance only');

const missingPerInstance=evaluateG121BFromAuthoritativeSnapshot({...snapshot,pokemon_rows:[{...snapshot.pokemon_rows[0],sleep_hours:null}]},request);
assert.equal(missingPerInstance.status,'data_incomplete');
assert.equal(missingPerInstance.reason,'missing_per_instance_sleep_hours');
assert.equal(missingPerInstance.account_total_sleep_time_ignored,true,'account total must never substitute per-instance sleep hours');

const legacyCandyCannotSubstitute=evaluateG121BFromAuthoritativeSnapshot({...snapshot,canonical_family_candy_rows:[],legacy_species_candy_rows:[{species:'皮卡丘',quantity:999999}]},request);
assert.equal(legacyCandyCannotSubstitute.status,'data_incomplete');
assert.equal(legacyCandyCannotSubstitute.reason,'missing_canonical_family_candy_authority');

const reserve=evaluateG121BFromAuthoritativeSnapshot({...snapshot,item_inventory_rows:[{item_name:'雷之石',quantity:1,safe_reserve:1}],item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'mission',authority_status:'REFERENCE_VERIFIED'}]},request);
assert.equal(reserve.status,'missing_item');

const acquisitionUnknown=evaluateG121BFromAuthoritativeSnapshot({...snapshot,item_inventory_rows:[{item_name:'雷之石',quantity:0,safe_reserve:0}],item_acquisition_rows:[{item_name:'雷之石',acquisition_type:'unknown',authority_status:'MISSING_AUTHORITY',sleep_point_cost:null,diamond_cost:null}]},request);
assert.equal(acquisitionUnknown.status,'data_incomplete');
assert.equal(acquisitionUnknown.reason,'missing_item_acquisition_authority');
assert.equal(acquisitionUnknown.acquisition_guidance_suppressed,true);

const unknownShards=evaluateG121BFromAuthoritativeSnapshot({...snapshot,player_resource_state_rows:resources.map(row=>row.resource_key==='dream_shards'?{...row,knowledge_state:'UNKNOWN',numeric_value:0}:row)},request);
assert.equal(unknownShards.status,'data_incomplete');
assert.equal(unknownShards.reason,'missing_dream_shards_authority');

const duplicateInstance=evaluateG121BFromAuthoritativeSnapshot({...snapshot,pokemon_rows:[snapshot.pokemon_rows[0],snapshot.pokemon_rows[0]]},request);
assert.equal(duplicateInstance.status,'data_incomplete');
assert.equal(duplicateInstance.reason,'ambiguous_pokemon_instance_authority');

const duplicateRoute=evaluateG121BFromAuthoritativeSnapshot({...snapshot,evolution_master_rows:[route,route]},request);
assert.equal(duplicateRoute.status,'data_incomplete');
assert.equal(duplicateRoute.reason,'ambiguous_evolution_route_authority');

console.log(JSON.stringify({
  gate:'G12.1B_SCHEMA_SAFE_READ_ADAPTER',status:'PASS',read_only:true,ai_status_computation:false,
  pokemon_instance_id_only:true,account_total_sleep_time_substitution:false,legacy_species_candy_consumed:false,
  canonical_family_candy:true,safe_reserve:true,missing_authority_fail_closed:true,
},null,2));
