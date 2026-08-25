export const PER_IMAGE_RUNTIME_CONTEXT_VERSION='v0.4.27.33-per-image-runtime-context-2026-08-25-a';

const text=value=>String(value??'').trim();
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const uuid=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

export function normalizeAssignment(row={}){
  const mode=row?.mode==='existing'?'existing':row?.mode==='new'?'new':'';
  return Object.freeze({
    item_id:text(row?.item_id),
    mode,
    pokemon_id:mode==='existing'?text(row?.pokemon_id):'',
    new_group_key:mode==='new'?text(row?.new_group_key):'',
  });
}

export function snapshotAssignmentsFromRows(rows=[]){
  const map=new Map();
  for(const raw of rows){
    const row=normalizeAssignment(raw);
    if(!row.item_id||!row.mode)continue;
    if(row.mode==='existing'&&!row.pokemon_id)continue;
    if(row.mode==='new'&&!row.new_group_key)continue;
    map.set(row.item_id,row);
  }
  return map;
}

export function buildExistingRuntimeContext(row,baseline=null,createdAt=new Date().toISOString()){
  const pokemonId=text(row?.pokemon_id),instanceId=text(row?.pokemon_instance_id);
  if(!pokemonId||!instanceId)throw new Error('PER_IMAGE_EXISTING_TARGET_INSTANCE_MISSING');
  return Object.freeze({
    schema:'pokemon-sleep-analysis-target-context/1.1',
    version:PER_IMAGE_RUNTIME_CONTEXT_VERSION,
    mode:'existing',
    target_pokemon_id:pokemonId,
    target_pokemon_instance_id:instanceId,
    capture_group_id:null,
    target_species_snapshot:text(row?.target_species||row?.current_species||row?.species)||null,
    target_label_snapshot:text(row?.target_label||row?.original_label||row?.nickname||row?.target_species||row?.species)||null,
    baseline_reference:clone(baseline),
    baseline_reference_provider_visible:true,
    created_at:createdAt,
    provider_visible:false,
  });
}

export function buildNewRuntimeContext(newGroupKey,captureGroupId=null,createdAt=new Date().toISOString()){
  const key=text(newGroupKey);if(!key)throw new Error('PER_IMAGE_NEW_GROUP_KEY_MISSING');
  return Object.freeze({
    schema:'pokemon-sleep-analysis-target-context/1.1',
    version:PER_IMAGE_RUNTIME_CONTEXT_VERSION,
    mode:'new',
    target_pokemon_id:null,
    target_pokemon_instance_id:null,
    capture_group_id:text(captureGroupId)||uuid(`capture-${key}`),
    target_species_snapshot:null,
    target_label_snapshot:null,
    baseline_reference:null,
    baseline_reference_provider_visible:false,
    created_at:createdAt,
    provider_visible:false,
  });
}

export function contextIdentityKey(context){
  if(context?.mode==='existing'&&text(context?.target_pokemon_instance_id))return `existing:${text(context.target_pokemon_instance_id)}`;
  if(context?.mode==='new'&&text(context?.capture_group_id))return `new:${text(context.capture_group_id)}`;
  return null;
}

export function installPerImageRuntimeContext(scope=globalThis){
  if(!scope?.document||typeof scope.addEventListener!=='function')return false;
  if(scope.PokemonSleepPerImageRuntimeContextV042733?.version===PER_IMAGE_RUNTIME_CONTEXT_VERSION)return true;

  let assignmentSnapshot=new Map();
  let contextByItemId=new Map();
  const newGroupContexts=new Map();
  let activeItemId=null;

  const trace=(event,detail={})=>{
    const safe={version:PER_IMAGE_RUNTIME_CONTEXT_VERSION,...detail};
    scope.UpdateCenterLiveDebug?.record?.(event,safe);
    scope.DebugTrace?.record?.('unified_pipeline',event,{status:detail.status||'completed',details:safe});
  };

  function readDomAssignments(){
    const node=scope.document.getElementById('unifiedImportAnalysisWorkbench');if(!node)return new Map();
    const rows=[];
    for(const box of node.querySelectorAll('[data-unified-item]:checked')){
      const itemId=text(box.value),card=box.closest?.('.light-review-item');
      const section=card?.querySelector?.('[data-v042718-target-assignment]');if(!itemId||!section)continue;
      rows.push({
        item_id:itemId,
        mode:section.querySelector('[data-v042718-target-mode]')?.value||'',
        pokemon_id:section.querySelector('[data-v042718-existing-target]')?.value||'',
        new_group_key:section.querySelector('[data-v042718-new-group]')?.value||'',
      });
    }
    return snapshotAssignmentsFromRows(rows);
  }

  function rebuildContexts(){
    const identityApi=scope.PokemonSleepAnalysisTargetIdentity;
    if(!identityApi)return {status:'IDENTITY_API_NOT_READY',count:0};
    const targets=identityApi.listActivePokemonAnalysisTargets?.()||[];
    const next=new Map();
    for(const [itemId,assignment] of assignmentSnapshot){
      if(assignment.mode==='existing'){
        const row=targets.find(target=>text(target?.pokemon_id)===assignment.pokemon_id);
        if(!row||!text(row.pokemon_instance_id))continue;
        const baseline=identityApi.buildExistingPokemonBaselineReference?.(assignment.pokemon_id)||null;
        next.set(itemId,buildExistingRuntimeContext(row,baseline));
      }else{
        if(!newGroupContexts.has(assignment.new_group_key))newGroupContexts.set(assignment.new_group_key,buildNewRuntimeContext(assignment.new_group_key));
        next.set(itemId,newGroupContexts.get(assignment.new_group_key));
      }
    }
    contextByItemId=next;
    return {status:'READY',count:next.size};
  }

  function prepareSnapshot(reason='run_capture'){
    assignmentSnapshot=readDomAssignments();
    contextByItemId=new Map();
    activeItemId=null;
    const result=rebuildContexts();
    trace('v042733_per_image_assignment_snapshot',{status:result.count===assignmentSnapshot.size?'completed':'pending',reason,selected_count:assignmentSnapshot.size,prepared_context_count:result.count});
    return result;
  }

  function contextForItem(itemId){
    const id=text(itemId);if(!id)return null;
    let context=contextByItemId.get(id)||null;
    if(!context){rebuildContexts();context=contextByItemId.get(id)||null;}
    return context?clone(context):null;
  }

  function activateItem(itemId,stage='unknown'){
    const id=text(itemId),identityApi=scope.PokemonSleepAnalysisTargetIdentity;
    if(!id||!assignmentSnapshot.has(id)||!identityApi?.setActiveAnalysisTargetContext)return {status:'NO_ITEM_CONTEXT'};
    const context=contextForItem(id);
    if(!context){
      trace('v042733_per_image_context_missing',{status:'blocked',item_id:id,stage,assignment_mode:assignmentSnapshot.get(id)?.mode||null});
      return {status:'CONTEXT_MISSING'};
    }
    identityApi.setActiveAnalysisTargetContext(context);activeItemId=id;
    trace('v042733_per_image_context_activated',{status:'completed',item_id:id,stage,assignment_mode:context.mode,identity_key:contextIdentityKey(context),per_item_runtime_switch:true});
    return {status:'ACTIVATED',context};
  }

  function repairRevisionBinding(revision){
    if(!revision)return {status:'NO_REVISION'};
    const revisionItem=text(revision.image_sha256||revision.item_id);
    const id=assignmentSnapshot.has(revisionItem)?revisionItem:activeItemId;
    if(!id)return {status:'NO_MATCHED_ITEM'};
    const expected=contextForItem(id);if(!expected)return {status:'NO_CONTEXT'};
    const before=contextIdentityKey(revision.identity_context);
    const after=contextIdentityKey(expected);
    if(before!==after)revision.identity_context=clone(expected);
    trace('v042733_revision_identity_bound',{status:'completed',item_id:id,analysis_id:revision.analysis_id||null,before_identity_key:before,after_identity_key:after,repaired:before!==after});
    return {status:'BOUND',repaired:before!==after,context:expected};
  }

  scope.document.addEventListener('click',event=>{
    if(event.target?.closest?.('#unifiedRun'))prepareSnapshot('run_click_capture');
  },true);

  scope.addEventListener('pokemon-sleep:unified-analysis-stage',event=>{
    const detail=event.detail||{};
    if(detail.state==='running'&&(detail.stage==='ocr'||detail.stage==='ai'))activateItem(detail.item_id,detail.stage);
  },true);

  scope.addEventListener('pokemon-sleep:analysis-revision-saved',event=>repairRevisionBinding(event.detail?.revision||event.detail||null),true);

  const api=Object.freeze({
    version:PER_IMAGE_RUNTIME_CONTEXT_VERSION,
    prepareSnapshot,
    contextForItem,
    activateItem,
    repairRevisionBinding,
    getState:()=>({selected_count:assignmentSnapshot.size,prepared_context_count:contextByItemId.size,active_item_id:activeItemId,assignments:[...assignmentSnapshot.values()].map(clone)}),
  });
  scope.PokemonSleepPerImageRuntimeContextV042733=api;
  trace('v042733_per_image_runtime_context_ready',{status:'completed',per_item_runtime_switch:true,revision_binding_capture_guard:true,legacy_batch_first_target_not_authoritative:true});
  return true;
}

if(typeof globalThis!=='undefined'&&typeof globalThis.document!=='undefined')installPerImageRuntimeContext(globalThis);
