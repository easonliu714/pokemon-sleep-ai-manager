// Git-blob-pinned historical legacy importer source from main 057f7031d41854983dbd65e97ee42279d4259f52.
// Used ONLY by pre-admission two-ACK and isolated opt-in feasibility negatives.
// Never import this into production; the real importer.js is independently protected.
function write(entity, key, data, mode) {
  const record = { ...key, ...data };
  const columns = Object.keys(record);
  const keys = KEYS[entity];
  if (mode === 'insert') {
    run(`INSERT INTO ${quote(entity)}(${columns.map(quote).join(',')}) VALUES(${columns.map(() => '?').join(',')})`,columns.map(column=>record[column]));
    return;
  }
  const updates = columns.filter(column=>!keys.includes(column));
  if (!updates.length) return;
  run(`UPDATE ${quote(entity)} SET ${updates.map(column=>`${quote(column)}=?`).join(',')} WHERE ${keys.map(column=>`${quote(column)}=?`).join(' AND ')}`,[...updates.map(column=>record[column]),...keys.map(column=>key[column])]);
}

export async function applyPayload(payload) {
  const preview = dryRun(payload);
  if (preview.conflict_count) throw new Error('更新包仍有衝突');
  await snapshot(`before:${payload.update_id}`);
  begin();
  try {
    let weeklyManualOverrideRebase=null;
    if(payload.scenario==='weekly_context_update'){
      const weeklyIndex=payload.operations.findIndex(operation=>operation?.entity==='weekly_context');
      if(weeklyIndex>=0){
        const operation=payload.operations[weeklyIndex];
        const change=preview.changes[weeklyIndex];
        weeklyManualOverrideRebase=rebaseWeeklyManualOverrideForImport({
          weekStart:operation.data?.week_start??change?.after?.week_start??change?.before?.week_start??null,
          newImportRevision:payload.update_id,
          incomingData:operation.data||{},
          clearFields:operation.clear_fields||[],
          previousCamp:change?.before?.camp??null,
        });
      }
    }
    payload.operations.forEach((operation,index)=>{
      const change=preview.changes[index];
      if(change.effective_action==='insert')write(operation.entity,change.key,change.data,'insert');
      else if(change.effective_action==='update')write(operation.entity,change.key,change.data,'update');
      else if(change.effective_action==='skip'){}
      else if(operation.action==='archive')write(operation.entity,change.key,{status:'archived'},'update');
      else if(operation.action==='delete'){
        const keys=KEYS[operation.entity];
        run(`DELETE FROM ${quote(operation.entity)} WHERE ${keys.map(key=>`${quote(key)}=?`).join(' AND ')}`,keys.map(key=>change.key[key]));
      }
      if(change.candy_storage&&change.candy_event_at&&hasOwn(operation.data||{},'quantity')&&isMeaningful(operation.data?.quantity)&&change.effective_action!=='skip'){
        recordCandyInventoryEvent(run,{
          event_id:`import:${payload.update_id}:${index}`,
          family_id:change.candy_storage.family_id,
          canonical_candy_id:change.key.candy_id,
          source_candy_id:operation.key?.candy_id||change.key.candy_id,
          mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,
          quantity_value:Number(change.after.quantity),
          event_at:change.candy_event_at,
          source_update_id:payload.update_id,
          authority:operation.evidence?.quantity_confirmation_authority||'USER_IMPORT_ABSOLUTE_STATE_WRITE',
          evidence:{operation_evidence:operation.evidence||{},original_key:operation.key||{},generated_at:payload.generated_at,source:payload.source||null},
          created_at:localIso(),
        });
      }
      run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[payload.update_id,index,operation.entity,operation.action,JSON.stringify(change.key),change.before?JSON.stringify(change.before):null,change.after?JSON.stringify(change.after):null,change.effective_action==='skip'?'skipped':'applied',change.message||'']);
    });
    const resultJson = {
      status:'applied',
      scenario:payload.scenario||'general',
      audit_summary:preview.audit_summary,
      pokemon_visual_preflight:preview.visual_preflight,
      profile_audit_confirmations:payload.profile_audit_confirmations||[],
      null_overwrite_policy:'preserve_existing_unless_clear_fields',
      explicit_zero_and_false_are_values:true,
      candy_family_storage_authority:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
      candy_quantity_mutation_semantics:'ABSOLUTE_SNAPSHOT',
      ...(weeklyManualOverrideRebase?{weekly_manual_override_rebase:weeklyManualOverrideRebase}:{}),
    };
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[payload.update_id,String(payload.schema_version),payload.generated_at,localIso(),payload.source||'',payload.operations.length,JSON.stringify(resultJson)]);
    commit();
    await persist();
    return {operation_count:payload.operations.length,scenario:payload.scenario||'general',audit_summary:preview.audit_summary,visual_preflight:preview.visual_preflight,weekly_manual_override_rebase:weeklyManualOverrideRebase};
  } catch(error){rollback();throw error;}
}
