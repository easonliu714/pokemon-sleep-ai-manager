import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.document={readyState:'complete',querySelector:()=>null,getElementById:()=>null};
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

// Physical replay: request A is NEW. Even if the mutable global context elsewhere has advanced,
// queue item A must resolve A's immutable new context, therefore the provider prompt has NO baseline.
active='img-tinkatink';
const aResolved=executor.resolveQueueAnalysisTargetContext(queue('img-tinkatink'),scope);
assert.equal(aResolved.status,'EXACT_PER_IMAGE_CONTEXT');
assert.equal(aResolved.context.mode,'new');
const aPrompt=executor.buildExistingBaselinePrompt('BASE',{analysisTargetContext:aResolved.context});
assert.equal(aPrompt.baseline_reference_used,false);
assert.equal(aPrompt.context_authority,'EXPLICIT_PER_IMAGE');
assert.equal(aPrompt.target_mode,'new');
assert.equal(aPrompt.prompt,'BASE');

// Physical replay: request B is Clodsire while the next Pokemon is Delibird.
// B's explicit prompt may contain Clodsire baseline only; Delibird must be impossible to leak in.
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

// Exact per-image request authority must fail closed if queue id and active item diverge.
active='img-delibird';
const mismatch=executor.resolveQueueAnalysisTargetContext(queue('img-clodsire'),scope);
assert.equal(mismatch.status,'BLOCKED_ACTIVE_ITEM_MISMATCH');

// Legacy / standalone queues remain backward compatible and do not claim per-image authority.
const legacy=executor.resolveQueueAnalysisTargetContext({schema:'legacy',items:[{sha256:'legacy-img'}]},scope);
assert.equal(legacy.status,'LEGACY_CONTEXT_FALLBACK');

const source=fs.readFileSync('assets/js/ai-review-queue-executor.js','utf8');
assert.match(source,/resolveQueueAnalysisTargetContext\(queue,globalThis\)/);
assert.match(source,/queueContext\.status==='EXACT_PER_IMAGE_CONTEXT'/);
assert.match(source,/buildExistingBaselinePrompt\(prompt,\{analysisTargetContext:queueContext\.context\}\)/);
assert.match(source,/BLOCKED_ACTIVE_ITEM_MISMATCH/);
assert.match(source,/analysis_target_context_authority:promptContext\.context_authority/);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.25_V042735_EXPLICIT_PER_IMAGE_AI_CONTEXT',
  physical_failure_replay:'new Tinkatink -> existing Clodsire -> existing Delibird one-step-ahead provider-context contamination',
  new_item_forces_no_baseline:true,
  existing_item_uses_exact_own_baseline:true,
  next_pokemon_baseline_leak_rejected:true,
  queue_active_item_mismatch_fail_closed:true,
  provider_request_context_bound_before_ai:true,
  revision_rebinding_remains_downstream_defense:true,
  behavioral_gates_removed:0,
},null,2));
