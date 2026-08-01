import assert from 'node:assert/strict';
import {prepareIdentityImport,finalizeIdentityImport} from '../assets/js/identity-import-pipeline.js';
import {applyConfirmationDecision} from '../assets/js/identity-confirmation-model.js';

const db={
  all:async sql=>{
    if(sql.includes('FROM pokemon_instance pi'))return [{pokemon_instance_id:'inst-1',pokemon_id:'pkm-1',nickname:'測試個體',species:'土王',current_species:'土王',capture_species:'烏波',level:31,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S',registered_date:'2026-07-01'}];
    if(sql.includes('pokemon_instance_ingredient'))return [{pokemon_instance_id:'inst-1',unlock_level:1,ingredient_name:'放鬆可可'}];
    if(sql.includes('pokemon_instance_subskill'))return [{pokemon_instance_id:'inst-1',unlock_level:10,subskill_name:'技能機率提升S'}];
    if(sql.includes('pokemon_instance_evolution_chain'))return [{pokemon_instance_id:'inst-1',species_name:'烏波'},{pokemon_instance_id:'inst-1',species_name:'土王'}];
    return [];
  }
};

const input={schema_version:'2.0-observation',observations:[{
  incoming_ref:'obs-1',
  profile:{species:'土王',level:31,nature:'慢吞吞',specialty:'食材',type:'毒',main_skill:'活力填充S'},
  ingredients:[{unlock_level:1,ingredient_name:'放鬆可可'}],
  subskills:[{unlock_level:10,subskill_name:'技能機率提升S'}]
}]};

const prepared=await prepareIdentityImport({source:{kind:'json',name:'observation.json'},input,db});
assert.equal(prepared.validation.errors.length,0);
assert.equal(prepared.candidates.length,1);
assert.equal(prepared.resolutions.length,1);
assert.equal(prepared.resolutions[0].status,'unique_high_confidence');
assert.equal(prepared.state.step,'plan');

const finalized=finalizeIdentityImport(prepared,prepared.confirmation_queue);
assert.equal(finalized.state.step,'ready');
assert.equal(finalized.plan.ok,true);
assert.equal(finalized.plan.operations[0].pokemon_instance_id,'inst-1');

const invalid=await prepareIdentityImport({source:{kind:'json'},input:{observations:[]},db});
assert.equal(invalid.state.step,'validate');
assert.deepEqual(invalid.state.errors,['observation_invalid']);

const ambiguousPrepared=await prepareIdentityImport({source:{kind:'json'},input:{schema_version:'2.0-observation',observations:[{incoming_ref:'obs-2',profile:{species:'未知角色'}}]},db});
assert.equal(ambiguousPrepared.state.step,'confirm');
const decided=ambiguousPrepared.confirmation_queue.map(item=>applyConfirmationDecision(item,{action:'create_new'}));
const created=finalizeIdentityImport(ambiguousPrepared,decided);
assert.equal(created.state.step,'ready');
assert.equal(created.plan.operations[0].action,'create_new');
console.log('PASS TECH.2D integrated observation resolver confirmation pipeline');
