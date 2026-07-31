import assert from 'node:assert/strict';
import {applyIdentityImportTransaction,validateReadyImportPlan} from '../assets/js/identity-import-transaction.js';

const ready={state:{step:'ready',errors:[],import_plan:{ok:true,operations:[{incoming_ref:'obs-1',action:'accept_existing'},{incoming_ref:'obs-2',action:'create_new'}]}}};
assert.equal(validateReadyImportPlan(ready).ok,true);
assert.equal(validateReadyImportPlan({state:{step:'confirm',errors:[],import_plan:null}}).ok,false);

const calls=[];
const db={snapshot:async label=>{calls.push(['snapshot',label]);return 'snap-1';},begin:async()=>calls.push(['begin']),commit:async()=>calls.push(['commit']),rollback:async()=>calls.push(['rollback'])};
const applied=await applyIdentityImportTransaction({db,prepared:ready,applyOperation:async({operation})=>{calls.push(['apply',operation.incoming_ref]);return operation.incoming_ref;}});
assert.equal(applied.ok,true);
assert.equal(applied.applied,2);
assert.deepEqual(calls.map(row=>row[0]),['snapshot','begin','apply','apply','commit']);

const failCalls=[];
const failDb={snapshot:async()=> 'snap-2',begin:async()=>failCalls.push('begin'),commit:async()=>failCalls.push('commit'),rollback:async()=>failCalls.push('rollback')};
const failed=await applyIdentityImportTransaction({db:failDb,prepared:ready,applyOperation:async({operation})=>{if(operation.incoming_ref==='obs-2')throw new Error('write_failed');return true;}});
assert.equal(failed.ok,false);
assert.equal(failed.applied,1);
assert.deepEqual(failCalls,['begin','rollback']);
assert.match(failed.errors[0],/write_failed/);
console.log('PASS TECH.2D snapshot transaction handoff');
