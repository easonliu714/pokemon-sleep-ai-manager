const clone=value=>JSON.parse(JSON.stringify(value));

async function call(db,names,...args){
  for(const name of names){
    if(typeof db?.[name]==='function')return db[name](...args);
  }
  throw new TypeError(`database method unavailable: ${names.join('/')}`);
}

export function validateReadyImportPlan(prepared){
  const state=prepared?.state||prepared;
  const plan=prepared?.plan||state?.import_plan;
  const errors=[];
  if(state?.step!=='ready')errors.push('wizard_not_ready');
  if(state?.errors?.length)errors.push('wizard_has_errors');
  if(!plan?.ok||!Array.isArray(plan.operations))errors.push('import_plan_invalid');
  if(plan?.operations?.some(item=>!item?.incoming_ref||!['accept_existing','create_new'].includes(item.action)))errors.push('operation_invalid');
  return {ok:errors.length===0,errors,plan};
}

export async function createImportSnapshot(db,{label='identity-import',metadata={}}={}){
  const createdAt=new Date().toISOString();
  if(typeof db?.snapshot==='function'){
    const snapshotId=await db.snapshot(`${label}:${createdAt}`,clone(metadata));
    return {snapshot_id:snapshotId,created_at:createdAt,mode:'native'};
  }
  if(typeof db?.export==='function'){
    const bytes=await db.export();
    return {snapshot_id:`memory:${createdAt}`,created_at:createdAt,mode:'memory_export',bytes};
  }
  throw new TypeError('database snapshot or export method required');
}

export async function applyIdentityImportTransaction({db,prepared,applyOperation,snapshotMetadata={}}={}){
  const validation=validateReadyImportPlan(prepared);
  if(!validation.ok)return {ok:false,applied:0,errors:validation.errors,snapshot:null};
  if(typeof applyOperation!=='function')throw new TypeError('applyOperation function required');

  const snapshot=await createImportSnapshot(db,{metadata:{operation_count:validation.plan.operations.length,...snapshotMetadata}});
  const results=[];
  await call(db,['begin','beginTransaction']);
  try{
    for(const operation of validation.plan.operations){
      results.push(await applyOperation({db,operation:clone(operation),snapshot}));
    }
    await call(db,['commit','commitTransaction']);
    return {ok:true,applied:results.length,results,snapshot,errors:[]};
  }catch(error){
    try{await call(db,['rollback','rollbackTransaction']);}catch(rollbackError){
      return {ok:false,applied:results.length,results,snapshot,errors:[error.message,`rollback_failed:${rollbackError.message}`]};
    }
    return {ok:false,applied:results.length,results,snapshot,errors:[error.message]};
  }
}
