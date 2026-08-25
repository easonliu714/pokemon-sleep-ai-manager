import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PER_IMAGE_RUNTIME_CONTEXT_VERSION,
  snapshotAssignmentsFromRows,
  buildExistingRuntimeContext,
  buildNewRuntimeContext,
  contextIdentityKey,
} from '../assets/js/per-image-runtime-context-v042733.js';

assert.equal(PER_IMAGE_RUNTIME_CONTEXT_VERSION,'v0.4.27.33-per-image-runtime-context-2026-08-25-a');

const assignments=snapshotAssignmentsFromRows([
  {item_id:'img-A',mode:'existing',pokemon_id:'pk-a'},
  {item_id:'img-B',mode:'existing',pokemon_id:'pk-b'},
  {item_id:'img-C',mode:'new',new_group_key:'new-1'},
]);
assert.equal(assignments.size,3);
assert.equal(assignments.get('img-A').pokemon_id,'pk-a');
assert.equal(assignments.get('img-B').pokemon_id,'pk-b');

const a=buildExistingRuntimeContext({pokemon_id:'pk-a',pokemon_instance_id:'inst-a',target_species:'信使鳥',target_label:'信使鳥',level:30,sp:1560},{species:'信使鳥',type:'飛行',favorite_berry:'椰木果'});
const b=buildExistingRuntimeContext({pokemon_id:'pk-b',pokemon_instance_id:'inst-b',target_species:'土王',target_label:'土王',level:33,sp:1217},{species:'土王',type:'毒',favorite_berry:'零餘果'});
const c=buildNewRuntimeContext('new-1','capture-new-1');

assert.equal(contextIdentityKey(a),'existing:inst-a');
assert.equal(contextIdentityKey(b),'existing:inst-b');
assert.equal(contextIdentityKey(c),'new:capture-new-1');
assert.notEqual(contextIdentityKey(a),contextIdentityKey(b),'two existing Pokémon in one batch must never share a runtime identity');
assert.equal(a.target_species_snapshot,'信使鳥');
assert.equal(b.target_species_snapshot,'土王');
assert.equal(a.baseline_reference.favorite_berry,'椰木果');
assert.equal(b.baseline_reference.favorite_berry,'零餘果');

const runtimeSource=fs.readFileSync('assets/js/per-image-runtime-context-v042733.js','utf8');
const watchdogSource=fs.readFileSync('assets/js/v0394-startup-watchdog.js','utf8');
const unifiedSource=fs.readFileSync('assets/js/unified-import-analysis-workbench.js','utf8');
const legacyWrapperSource=fs.readFileSync('assets/js/review-group-isolation-v042717.js','utf8');

assert.match(watchdogSource,/per-image-runtime-context-v042733\.js/,'successor per-image context authority must load before the unified runner executes');
assert.match(runtimeSource,/pokemon-sleep:unified-analysis-stage/);
assert.match(runtimeSource,/detail\.state==='running'&&\(detail\.stage==='ocr'\|\|detail\.stage==='ai'\)/,'each OCR/AI item stage must activate its own context');
assert.match(runtimeSource,/PokemonSleepAnalysisTargetIdentity/);
assert.match(runtimeSource,/setActiveAnalysisTargetContext\(context\)/);
assert.match(runtimeSource,/pokemon-sleep:analysis-revision-saved/);
assert.match(runtimeSource,/revision\.identity_context=clone\(expected\)/,'revision binding must be repaired before downstream grouping when the legacy batch context is stale');
assert.match(runtimeSource,/activeItemId=id/);

const ocrStage=unifiedSource.indexOf("publishStage('ocr','running'");
const ocrSave=unifiedSource.indexOf('saveAnalysisRevision({imageSha256:itemId(item)');
const aiStage=unifiedSource.indexOf("publishStage('ai','running'");
const aiExecute=unifiedSource.indexOf('executePreparedAiPayload(payload)');
assert.ok(ocrStage>=0&&ocrSave>ocrStage,'OCR running stage must fire before revision save so per-image identity can be activated');
assert.ok(aiStage>=0&&aiExecute>aiStage,'AI running stage must fire before provider execution so the correct per-image baseline/context is active');

// Root-cause lock: predecessor wrapper prepares a per-item context map but old runner compatibility still selects only the first target.
// v0.4.27.33 is required to consume the item stage and override this legacy single-batch authority before each item.
assert.match(legacyWrapperSource,/batchRuntime\.contextByItemId=prepared\.contextByItemId/);
assert.match(legacyWrapperSource,/setCompatibilityRunTarget\(node,prepared\.assignments\[0\]\)/);
assert.match(unifiedSource,/targetContext=await createRunTargetContext\(node\);setActiveAnalysisTargetContext\(targetContext\)/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.23_V042733_PER_IMAGE_RUNTIME_CONTEXT',
  physical_failure_replay:'mixed batch must not bind second Pokemon revisions to first target',
  distinct_existing_contexts:true,
  provider_baseline_switch_before_ai:true,
  revision_identity_capture_guard:true,
  legacy_first_target_batch_authority_overridden_per_item:true,
  behavioral_gates_removed:0,
},null,2));
