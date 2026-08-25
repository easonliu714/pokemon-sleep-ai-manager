import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  REVISION_BOUND_TARGET_CONTEXT_VERSION,
  revisionItemIdentity,
  resolveExactRevisionContext,
  enforceRevisionBoundTargetContext,
} from '../assets/js/revision-bound-target-context-v042734.js';

assert.equal(REVISION_BOUND_TARGET_CONTEXT_VERSION,'v0.4.27.34-revision-bound-target-context-2026-08-25-a');
assert.equal(revisionItemIdentity({image_sha256:'img-A'}),'img-A');
assert.equal(revisionItemIdentity({item_id:'img-B'}),'img-B');

const contexts={
  'img-tinkatink':{schema:'pokemon-sleep-analysis-target-context/1.1',mode:'new',capture_group_id:'capture-tinkatink',target_species_snapshot:null,baseline_reference:null},
  'img-clodsire':{schema:'pokemon-sleep-analysis-target-context/1.1',mode:'new',capture_group_id:'capture-clodsire',target_species_snapshot:null,baseline_reference:null},
  'img-delibird':{schema:'pokemon-sleep-analysis-target-context/1.1',mode:'existing',target_pokemon_id:'pk-delibird',target_pokemon_instance_id:'inst-delibird',capture_group_id:null,target_species_snapshot:'信使鳥',baseline_reference:{species:'信使鳥',type:'飛行',favorite_berry:'椰木果'}},
};
let activeContext=structuredClone(contexts['img-clodsire']);
let clearCount=0;
const scope={
  PokemonSleepPerImageRuntimeContextV042733:{
    getState:()=>({selected_count:3,prepared_context_count:3,active_item_id:'img-clodsire'}),
    contextForItem:itemId=>contexts[itemId]?structuredClone(contexts[itemId]):null,
  },
  PokemonSleepAnalysisTargetIdentity:{
    setActiveAnalysisTargetContext:context=>{activeContext=structuredClone(context);return structuredClone(activeContext);},
    clearActiveAnalysisTargetContext:()=>{activeContext=null;clearCount+=1;},
  },
};

// Physical replay 1: Tinkatink revision arrives while mutable global active item already points at Clodsire.
const tinkatinkRevision={image_sha256:'img-tinkatink',analysis_id:'rev-tink',identity_context:structuredClone(contexts['img-clodsire'])};
const tinkResult=enforceRevisionBoundTargetContext(scope,tinkatinkRevision);
assert.equal(tinkResult.status,'BOUND');
assert.equal(tinkatinkRevision.identity_context.capture_group_id,'capture-tinkatink');
assert.equal(activeContext.capture_group_id,'capture-tinkatink','capture listener must move global active context back to the revision item before legacy persistence runs');

// Simulate the predecessor bindRevisionToActiveContext listener. It is now harmless because global active is already exact.
tinkatinkRevision.identity_context=structuredClone(activeContext);
assert.equal(tinkatinkRevision.identity_context.capture_group_id,'capture-tinkatink');

// Physical replay 2: Clodsire revision arrives while mutable global active has advanced to Delibird.
activeContext=structuredClone(contexts['img-delibird']);
const clodsireRevision={image_sha256:'img-clodsire',analysis_id:'rev-clod',identity_context:structuredClone(contexts['img-delibird'])};
const clodResult=enforceRevisionBoundTargetContext(scope,clodsireRevision);
assert.equal(clodResult.status,'BOUND');
assert.equal(clodsireRevision.identity_context.capture_group_id,'capture-clodsire');
assert.equal(activeContext.capture_group_id,'capture-clodsire');
assert.equal(clodsireRevision.identity_context.target_species_snapshot,null,'Clodsire new-group revision must not inherit Delibird species/profile baseline');

// Exact image binding is mandatory during an active per-image batch. No mutable active-item fallback is allowed.
activeContext=structuredClone(contexts['img-delibird']);
const unknownRevision={image_sha256:'img-unknown',analysis_id:'rev-unknown',identity_context:structuredClone(contexts['img-delibird'])};
const missingResult=enforceRevisionBoundTargetContext(scope,unknownRevision);
assert.equal(missingResult.status,'BLOCKED_NO_EXACT_CONTEXT');
assert.equal(unknownRevision.identity_context,null);
assert.equal(activeContext,null);
assert.equal(clearCount,1);

const resolved=resolveExactRevisionContext(scope,{image_sha256:'img-delibird'});
assert.equal(resolved.status,'EXACT_CONTEXT');
assert.equal(resolved.context.target_pokemon_instance_id,'inst-delibird');

// Outside this workflow the historical single-target path is intentionally unchanged.
const legacyScope={PokemonSleepPerImageRuntimeContextV042733:{getState:()=>({selected_count:0}),contextForItem:()=>null}};
assert.equal(enforceRevisionBoundTargetContext(legacyScope,{image_sha256:'legacy'}).status,'LEGACY_PATH_UNCHANGED');

const successorSource=fs.readFileSync('assets/js/revision-bound-target-context-v042734.js','utf8');
const predecessorSource=fs.readFileSync('assets/js/analysis-target-identity.js','utf8');
const v33Source=fs.readFileSync('assets/js/per-image-runtime-context-v042733.js','utf8');
const watchdogSource=fs.readFileSync('assets/js/v0394-startup-watchdog.js','utf8');

assert.match(watchdogSource,/revision-bound-target-context-v042734\.js/,'v0.4.27.34 exact revision authority must load at startup');
assert.match(successorSource,/revision\.image_sha256\|\|revision\?\.item_id/);
assert.match(successorSource,/contextForItem\(itemId\)/,'saved revision must resolve exact per-image context by immutable item id');
assert.match(successorSource,/setActiveAnalysisTargetContext\?\.\(resolved\.context\)/,'exact context must be restored globally before predecessor persistence listeners run');
assert.match(successorSource,/addEventListener\('pokemon-sleep:analysis-revision-saved',handler,true\)/,'capture phase must run before legacy non-capture saved-revision listeners');
assert.match(successorSource,/BLOCKED_NO_EXACT_CONTEXT/);
assert.doesNotMatch(successorSource,/activeItemId/,'v0.4.27.34 must not use mutable activeItemId as revision identity authority');

// Lock the two predecessor hazards proven by the Android recording.
assert.match(v33Source,/assignmentSnapshot\.has\(revisionItem\)\?revisionItem:activeItemId/,'v0.4.27.33 mutable fallback is the physical predecessor defect being superseded');
assert.match(predecessorSource,/const context=clone\(activeContext\)/);
assert.match(predecessorSource,/revision\.identity_context=context/,'legacy listener can overwrite revision identity from mutable global context unless v0.4.27.34 rebinds first');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.24_V042734_REVISION_BOUND_TARGET_CONTEXT',
  physical_failure_replay:'Tinkatink -> Clodsire -> Delibird one-step-ahead context contamination',
  exact_image_sha_binding:true,
  predecessor_global_overwrite_neutralized:true,
  missing_exact_context_fail_closed:true,
  mutable_active_item_fallback:false,
  third_delibird_last_item_control_preserved:true,
  behavioral_gates_removed:0,
},null,2));
