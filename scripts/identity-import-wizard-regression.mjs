import assert from 'node:assert/strict';
import {
  createIdentityImportWizard,
  selectIdentityImportSource,
  attachValidatedObservation,
  attachIdentityResolutions,
  attachConfirmationQueue,
  attachConfirmedImportPlan,
  summarizeIdentityImportWizard,
  resetIdentityImportWizard
} from '../assets/js/identity-import-wizard.js';

let state=createIdentityImportWizard();
state=selectIdentityImportSource(state,{kind:'zip',name:'pokemon.zip'});
assert.equal(state.step,'validate');

const payload={observations:[{incoming_ref:'obs-1'},{incoming_ref:'obs-2'}]};
state=attachValidatedObservation(state,{payload,validation:{ok:true}});
assert.equal(state.step,'resolve');

const badResolution=attachIdentityResolutions(state,[{incoming_ref:'missing'}]);
assert.deepEqual(badResolution.errors,['resolution_count_mismatch']);

state=attachIdentityResolutions(state,[
  {incoming_ref:'obs-1',status:'unique_high_confidence'},
  {incoming_ref:'obs-2',status:'no_candidate'}
]);
assert.equal(state.step,'confirm');

state=attachConfirmationQueue(state,[
  {incoming_ref:'obs-1',decision:{action:'accept_existing',pokemon_instance_id:'inst-1'},validation_errors:[]},
  {incoming_ref:'obs-2',decision:null,validation_errors:[]}
]);
assert.equal(state.step,'confirm');
assert.deepEqual(state.errors,['confirmation_incomplete']);

state=attachConfirmationQueue(state,[
  {incoming_ref:'obs-1',decision:{action:'accept_existing',pokemon_instance_id:'inst-1'},validation_errors:[]},
  {incoming_ref:'obs-2',decision:{action:'create_new',pokemon_instance_id:null},validation_errors:[]}
]);
assert.equal(state.step,'plan');

state=attachConfirmedImportPlan(state,{ok:true,operations:[
  {incoming_ref:'obs-1',action:'accept_existing',pokemon_instance_id:'inst-1'},
  {incoming_ref:'obs-2',action:'create_new',pokemon_instance_id:null}
]});
assert.equal(state.step,'ready');
assert.equal(summarizeIdentityImportWizard(state).ready,true);
assert.equal(summarizeIdentityImportWizard(state).progress_percent,100);

const reset=resetIdentityImportWizard(state);
assert.equal(reset.step,'select');
assert.equal(reset.audit.at(-1).event,'wizard_reset');
console.log('PASS TECH.2D identity import wizard state machine');
