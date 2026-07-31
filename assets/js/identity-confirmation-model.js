const VALID_ACTIONS=new Set(['accept_existing','create_new','skip']);

export function buildConfirmationQueue(resolutions=[]){
  return resolutions.map((item,index)=>({
    queue_id:item.incoming_ref||`incoming-${index+1}`,
    incoming_ref:item.incoming_ref||null,
    status:item.status,
    reason:item.reason||null,
    requires_confirmation:Boolean(item.requires_confirmation),
    selected_pokemon_instance_id:item.selected_pokemon_instance_id||null,
    candidates:Array.isArray(item.candidates)?item.candidates:[],
    decision:item.requires_confirmation?null:{action:'accept_existing',pokemon_instance_id:item.selected_pokemon_instance_id||null},
    validation_errors:[]
  }));
}

export function applyConfirmationDecision(queueItem,decision){
  const next={...queueItem,validation_errors:[]};
  if(!decision||!VALID_ACTIONS.has(decision.action)){
    return {...next,decision:null,validation_errors:['invalid_action']};
  }
  if(decision.action==='accept_existing'){
    const id=decision.pokemon_instance_id||null;
    const allowed=(queueItem.candidates||[]).some(candidate=>candidate.pokemon_instance_id===id)||queueItem.selected_pokemon_instance_id===id;
    if(!id||!allowed)return {...next,decision:null,validation_errors:['candidate_required']};
    return {...next,decision:{action:'accept_existing',pokemon_instance_id:id}};
  }
  if(decision.action==='create_new'){
    if(queueItem.status!=='no_candidate'&&queueItem.status!=='possible_existing'){
      return {...next,decision:null,validation_errors:['create_new_not_allowed']};
    }
    return {...next,decision:{action:'create_new',pokemon_instance_id:null}};
  }
  return {...next,decision:{action:'skip',pokemon_instance_id:null}};
}

export function summarizeConfirmationQueue(queue=[]){
  const summary={total:queue.length,ready:0,pending:0,invalid:0,by_status:{}};
  for(const item of queue){
    summary.by_status[item.status]=(summary.by_status[item.status]||0)+1;
    if(item.validation_errors?.length)summary.invalid+=1;
    else if(item.decision)summary.ready+=1;
    else summary.pending+=1;
  }
  return summary;
}

export function buildConfirmedImportPlan(queue=[]){
  const unresolved=queue.filter(item=>!item.decision||item.validation_errors?.length);
  if(unresolved.length)return {ok:false,reason:'confirmation_incomplete',unresolved:unresolved.map(item=>item.queue_id),operations:[]};
  return {
    ok:true,
    reason:'confirmed_by_user',
    operations:queue.filter(item=>item.decision.action!=='skip').map(item=>({
      incoming_ref:item.incoming_ref,
      action:item.decision.action,
      pokemon_instance_id:item.decision.pokemon_instance_id||null
    }))
  };
}
