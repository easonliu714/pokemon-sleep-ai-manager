import assert from 'node:assert/strict';
import {buildConfirmationQueue,applyConfirmationDecision,summarizeConfirmationQueue,buildConfirmedImportPlan} from '../assets/js/identity-confirmation-model.js';

const resolutions=[
  {incoming_ref:'obs-1',status:'exact_existing',requires_confirmation:false,selected_pokemon_instance_id:'inst-1',candidates:[{pokemon_instance_id:'inst-1'}]},
  {incoming_ref:'obs-2',status:'ambiguous_existing',requires_confirmation:true,selected_pokemon_instance_id:null,candidates:[{pokemon_instance_id:'inst-2'},{pokemon_instance_id:'inst-3'}]},
  {incoming_ref:'obs-3',status:'no_candidate',requires_confirmation:true,selected_pokemon_instance_id:null,candidates:[]}
];

let queue=buildConfirmationQueue(resolutions);
assert.equal(queue[0].decision.action,'accept_existing');
assert.equal(summarizeConfirmationQueue(queue).pending,2);

queue[1]=applyConfirmationDecision(queue[1],{action:'accept_existing',pokemon_instance_id:'inst-3'});
assert.equal(queue[1].decision.pokemon_instance_id,'inst-3');
queue[2]=applyConfirmationDecision(queue[2],{action:'create_new'});
assert.equal(queue[2].decision.action,'create_new');

const invalid=applyConfirmationDecision(queue[1],{action:'accept_existing',pokemon_instance_id:'missing'});
assert.deepEqual(invalid.validation_errors,['candidate_required']);
assert.equal(buildConfirmedImportPlan([queue[0],invalid,queue[2]]).ok,false);

const plan=buildConfirmedImportPlan(queue);
assert.equal(plan.ok,true);
assert.deepEqual(plan.operations,[
  {incoming_ref:'obs-1',action:'accept_existing',pokemon_instance_id:'inst-1'},
  {incoming_ref:'obs-2',action:'accept_existing',pokemon_instance_id:'inst-3'},
  {incoming_ref:'obs-3',action:'create_new',pokemon_instance_id:null}
]);
console.log('PASS TECH.2C identity confirmation model');
