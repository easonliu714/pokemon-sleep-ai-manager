const STEPS=['select','validate','resolve','confirm','plan','ready'];

const clone=value=>JSON.parse(JSON.stringify(value));

export function createIdentityImportWizard(){
  return {
    step:'select',
    source:null,
    observation_payload:null,
    validation:null,
    resolutions:[],
    confirmation_queue:[],
    import_plan:null,
    errors:[],
    audit:[]
  };
}

function stamp(state,event,detail={}){
  return {...state,audit:[...state.audit,{event,detail,at:new Date().toISOString()}]};
}

function requireStep(state,allowed){
  if(!allowed.includes(state.step))throw new Error(`invalid wizard transition from ${state.step}`);
}

export function selectIdentityImportSource(state,source){
  requireStep(state,['select']);
  if(!source||!['json','screenshots','zip'].includes(source.kind)){
    return stamp({...state,errors:['invalid_source']},'source_rejected');
  }
  return stamp({...state,step:'validate',source:clone(source),errors:[]},'source_selected',{kind:source.kind});
}

export function attachValidatedObservation(state,{payload,validation}){
  requireStep(state,['validate']);
  if(!validation?.ok){
    return stamp({...state,validation:clone(validation||{ok:false}),errors:['observation_invalid']},'validation_failed');
  }
  if(!Array.isArray(payload?.observations)||!payload.observations.length){
    return stamp({...state,validation:{ok:false},errors:['observation_empty']},'validation_failed');
  }
  return stamp({...state,step:'resolve',observation_payload:clone(payload),validation:clone(validation),errors:[]},'validation_passed',{count:payload.observations.length});
}

export function attachIdentityResolutions(state,resolutions){
  requireStep(state,['resolve']);
  if(!Array.isArray(resolutions)||resolutions.length!==state.observation_payload.observations.length){
    return stamp({...state,errors:['resolution_count_mismatch']},'resolution_failed');
  }
  const incoming=new Set(state.observation_payload.observations.map(item=>item.incoming_ref));
  if(resolutions.some(item=>!incoming.has(item.incoming_ref))){
    return stamp({...state,errors:['resolution_reference_mismatch']},'resolution_failed');
  }
  return stamp({...state,step:'confirm',resolutions:clone(resolutions),errors:[]},'resolution_completed',{count:resolutions.length});
}

export function attachConfirmationQueue(state,queue){
  requireStep(state,['confirm']);
  if(!Array.isArray(queue)||queue.length!==state.resolutions.length){
    return stamp({...state,errors:['confirmation_count_mismatch']},'confirmation_failed');
  }
  const unresolved=queue.filter(item=>!item.decision||item.validation_errors?.length);
  return stamp({...state,confirmation_queue:clone(queue),step:unresolved.length?'confirm':'plan',errors:unresolved.length?['confirmation_incomplete']:[]},unresolved.length?'confirmation_pending':'confirmation_completed',{unresolved:unresolved.length});
}

export function attachConfirmedImportPlan(state,plan){
  requireStep(state,['plan']);
  if(!plan?.ok||!Array.isArray(plan.operations)){
    return stamp({...state,errors:['import_plan_invalid']},'plan_failed');
  }
  const allowed=new Set(state.confirmation_queue.filter(item=>item.decision?.action!=='skip').map(item=>item.incoming_ref));
  if(plan.operations.some(operation=>!allowed.has(operation.incoming_ref))){
    return stamp({...state,errors:['import_plan_reference_mismatch']},'plan_failed');
  }
  return stamp({...state,step:'ready',import_plan:clone(plan),errors:[]},'plan_ready',{operations:plan.operations.length});
}

export function resetIdentityImportWizard(state){
  const next=createIdentityImportWizard();
  next.audit=[...state.audit,{event:'wizard_reset',detail:{},at:new Date().toISOString()}];
  return next;
}

export function summarizeIdentityImportWizard(state){
  const index=Math.max(0,STEPS.indexOf(state.step));
  return {
    step:state.step,
    progress_percent:Math.round(index/(STEPS.length-1)*100),
    source_kind:state.source?.kind||null,
    observation_count:state.observation_payload?.observations?.length||0,
    resolution_count:state.resolutions.length,
    confirmation_count:state.confirmation_queue.length,
    operation_count:state.import_plan?.operations?.length||0,
    ready:state.step==='ready'&&!state.errors.length,
    errors:[...state.errors]
  };
}
