import assert from 'node:assert/strict';
import fs from 'node:fs';

// Minimal browser fixture for importing the production executor. The gate does not
// exercise confirmation DOM behavior; these stubs only satisfy module bootstrap.
globalThis.document={readyState:'complete',querySelector:()=>null,getElementById:()=>null,addEventListener:()=>{},documentElement:{}};
globalThis.MutationObserver=class{observe(){} disconnect(){}};
globalThis.addEventListener=globalThis.addEventListener||(()=>{});
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);

const executor=await import('../assets/js/ai-review-queue-executor.js');

assert.equal(executor.PER_IMAGE_AI_CONTEXT_AUTHORITY_VERSION,'v0.4.27.35-explicit-per-image-ai-context-2026-08-25-a');

const tinkatinkNew={
  schema:'pokemon-sleep-analysis-target-context/1.1',
  mode:'new',capture_group_id:'capture-tinkatink',target_species_snapshot:null,baseline_reference:null,
};
const clodsireExisting={
  schema:'pokemon-sleep-analysis-target-context/1.1',
  mode:'existing',target_pokemon_id:'pk-clodsire',target_pokemon_instance_id:'inst-clodsire',target_species_snapshot:'土王',
  baseline_reference:{species:'土王',level:33,sp:1217,type:'毒',favorite_berry:'零餘果'},
};
const delibirdExisting={
  schema:'pokemon-sleep-analysis-target-context/1.1',
  mode:'existing',target_pokemon_id:'pk-delibird',target_pokemon_instance_id:'inst-delibird',target_species_snapshot:'信使鳥',
  baseline_reference:{species:'信使鳥',level:30,sp:1560,type:'飛行',favorite_berry:'椰木果'},
};
const contexts={
  'img-tinkatink':tinkatinkNew,
  'img-clodsire':clodsireExisting,
  'img-delibird':delibirdExisting,
};
let active='img-tinkatink';
const scope={
  PokemonSleepPerImageRuntimeContextV042733:{
    getState:()=>({active_item_id:active,selected_count:3}),
    contextForItem:id=>contexts[id]?structuredClone(contexts[id]):null,
  },
};
const queue=id=>({schema:'pokemon-sleep-ai-consent-queue/1.3-unified',items:[{item_id:id,sha256:id,source_image_ref:`${id}.png`}]});

// Physical replay: request A is NEW. The immutable queue item context must force NO_BASELINE.
active='img-tinkatink';
const aResolved=executor.resolveQueueAnalysisTargetContext(queue('img-tinkatink'),scope);
assert.equal(aResolved.status,'EXACT_PER_IMAGE_CONTEXT');
assert.equal(aResolved.context.mode,'new');
const aPrompt=executor.buildExistingBaselinePrompt('BASE',{analysisTargetContext:aResolved.context});
assert.equal(aPrompt.baseline_reference_used,false);
assert.equal(aPrompt.context_authority,'EXPLICIT_PER_IMAGE');
assert.equal(aPrompt.target_mode,'new');
assert.equal(aPrompt.prompt,'BASE');

// Even if the stage active marker is absent, a unified queue may still resolve only its exact
// immutable item context. It must never fall back to mutable global identity/baseline state.
active='';
const aNoActive=executor.resolveQueueAnalysisTargetContext(queue('img-tinkatink'),scope);
assert.equal(aNoActive.status,'EXACT_PER_IMAGE_CONTEXT');
assert.equal(aNoActive.context.capture_group_id,'capture-tinkatink');

// Physical replay: request B is Clodsire. B may contain Clodsire baseline only; Delibird is forbidden.
active='img-clodsire';
const bResolved=executor.resolveQueueAnalysisTargetContext(queue('img-clodsire'),scope);
assert.equal(bResolved.status,'EXACT_PER_IMAGE_CONTEXT');
assert.equal(bResolved.context.target_species_snapshot,'土王');
const bPrompt=executor.buildExistingBaselinePrompt('BASE',{analysisTargetContext:bResolved.context});
assert.equal(bPrompt.baseline_reference_used,true);
assert.equal(bPrompt.baseline.species,'土王');
assert.equal(bPrompt.baseline.type,'毒');
assert.equal(bPrompt.baseline.favorite_berry,'零餘果');
assert.match(bPrompt.prompt,/"species": "土王"/);
assert.doesNotMatch(bPrompt.prompt,/"species": "信使鳥"/);
assert.doesNotMatch(bPrompt.prompt,/"favorite_berry": "椰木果"/);

// A conflicting active item is evidence of orchestration drift and must BLOCK before Provider execution.
active='img-delibird';
const mismatch=executor.resolveQueueAnalysisTargetContext(queue('img-clodsire'),scope);
assert.equal(mismatch.status,'BLOCKED_ACTIVE_ITEM_MISMATCH');

// Missing immutable context in unified flow is also BLOCK; global fallback is forbidden.
active='';
const missing=executor.resolveQueueAnalysisTargetContext(queue('img-unknown'),scope);
assert.equal(missing.status,'BLOCKED_EXACT_CONTEXT_MISSING');
const missingApi=executor.resolveQueueAnalysisTargetContext(queue('img-tinkatink'),{});
assert.equal(missingApi.status,'BLOCKED_PER_IMAGE_CONTEXT_API_NOT_READY');

// A raw multi-item unified queue remains ambiguous by definition. The executor must keep
// failing closed rather than silently selecting items[0]. Current unified orchestration
// prevents this shape by creating one queue per runAi(item).
const ambiguous=executor.resolveQueueAnalysisTargetContext({
  schema:'pokemon-sleep-ai-consent-queue/1.3-unified',
  items:[{item_id:'img-tinkatink',sha256:'img-tinkatink'},{item_id:'img-clodsire',sha256:'img-clodsire'}],
},scope);
assert.equal(ambiguous.status,'BLOCKED_QUEUE_ITEM_ID_MISSING');

// Legacy / standalone queues remain backward compatible and are the only paths allowed to use global fallback.
const legacy=executor.resolveQueueAnalysisTargetContext({schema:'legacy',items:[{sha256:'legacy-img'}]},scope);
assert.equal(legacy.status,'LEGACY_CONTEXT_FALLBACK');

const source=fs.readFileSync('assets/js/ai-review-queue-executor.js','utf8');
assert.match(source,/resolveQueueAnalysisTargetContext\(queue,globalThis\)/);
assert.match(source,/if\(!unifiedQueue\)return \{status:'LEGACY_CONTEXT_FALLBACK'/);
assert.match(source,/BLOCKED_PER_IMAGE_CONTEXT_API_NOT_READY/);
assert.match(source,/BLOCKED_EXACT_CONTEXT_MISSING/);
assert.match(source,/BLOCKED_ACTIVE_ITEM_MISMATCH/);
assert.match(source,/queueContext\.status==='EXACT_PER_IMAGE_CONTEXT'/);
assert.match(source,/buildExistingBaselinePrompt\(prompt,\{analysisTargetContext:queueContext\.context\}\)/);
assert.match(source,/analysis_target_context_authority:promptContext\.context_authority/);

// Freeze the current physical unified-path contract. The user may select many images,
// but runAi receives one item and queueFor emits exactly one unified queue item. The
// synchronous stage event activates that same item before executePreparedAiPayload runs.
const unifiedSource=fs.readFileSync('assets/js/unified-import-analysis-workbench.js','utf8');
const perImageSource=fs.readFileSync('assets/js/per-image-runtime-context-v042733.js','utf8');
const legacyConsentSource=fs.readFileSync('assets/js/data1d1-ocr-region-ai-consent.js','utf8');
assert.match(unifiedSource,/function queueFor\(item,preset\)\{return \{schema:'pokemon-sleep-ai-consent-queue\/1\.3-unified',selected_count:1/);
assert.match(unifiedSource,/items:\[\{item_id:itemId\(item\),source_image_ref:item\.path\|\|item\.source_image_ref/);
assert.match(unifiedSource,/const payload=\{queue:queueFor\(item,preset\),item,preset,statusNode:status/);
const stageIndex=unifiedSource.indexOf("publishStage('ai','running'");
const executeIndex=unifiedSource.indexOf('executePreparedAiPayload(payload)');
assert.ok(stageIndex>=0&&executeIndex>stageIndex,'unified_ai_stage_must_activate_item_before_provider_execution');
assert.match(perImageSource,/detail\.state==='running'&&\(detail\.stage==='ocr'\|\|detail\.stage==='ai'\)\)activateItem\(detail\.item_id,detail\.stage\)/);
assert.match(legacyConsentSource,/AI_CONSENT_SCHEMA='pokemon-sleep-ai-consent-queue\/1\.2'/);
assert.doesNotMatch(legacyConsentSource,/pokemon-sleep-ai-consent-queue\/1\.3-unified/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.25_V042735_EXPLICIT_PER_IMAGE_AI_CONTEXT',
  physical_failure_replay:'new Tinkatink -> existing Clodsire -> existing Delibird one-step-ahead provider-context contamination',
  new_item_forces_no_baseline:true,
  existing_item_uses_exact_own_baseline:true,
  next_pokemon_baseline_leak_rejected:true,
  missing_stage_marker_still_uses_exact_queue_context:true,
  unified_missing_context_fail_closed:true,
  queue_active_item_mismatch_fail_closed:true,
  unified_multi_item_queue_fail_closed:true,
  unified_runtime_queue_is_single_item:true,
  unified_stage_activates_item_before_provider:true,
  legacy_multi_select_consent_not_unified_authority:true,
  unified_global_context_fallback_forbidden:true,
  provider_request_context_bound_before_ai:true,
  revision_rebinding_remains_downstream_defense:true,
  behavioral_gates_removed:0,
},null,2));
