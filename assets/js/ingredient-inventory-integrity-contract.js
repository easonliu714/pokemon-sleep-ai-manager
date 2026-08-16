export const INGREDIENT_INVENTORY_INTEGRITY_VERSION='ingredient-inventory-integrity-2026-08-16-a';
export const INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION=12;
export const INGREDIENT_ABSENCE_RESOLUTIONS=Object.freeze([
  'CONFIRMED_EXHAUSTED',
  'PRESERVE_EXISTING_NOT_CAPTURED',
]);

export const LEGACY_INGREDIENT_IDENTITY_RENAMES=Object.freeze({
  '特選酪梨':'嫩亮酪梨',
});

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;

function dbRows(db,sql,params=[]){
  const statement=db.prepare(sql);statement.bind(params);const output=[];
  while(statement.step())output.push(statement.getAsObject());statement.free();return output;
}
function dbScalar(db,sql,params=[]){const result=dbRows(db,sql,params);return result.length?Object.values(result[0])[0]:null;}

/**
 * Migration 12 corrects a legacy canonical-name residue without ever summing
 * two player quantities. When both names exist with different values, the
 * legacy row is archived as evidence and the current canonical row wins.
 */
export function applyIngredientInventoryIdentityMigration(db){
  db.run(`CREATE TABLE IF NOT EXISTS ingredient_inventory_identity_archive(
    archive_id TEXT PRIMARY KEY,
    legacy_name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    legacy_quantity INTEGER NOT NULL,
    canonical_quantity INTEGER,
    legacy_updated_at TEXT,
    legacy_source_update_id TEXT,
    reason TEXT NOT NULL,
    archived_at TEXT NOT NULL
  )`);
  const audit=[];
  for(const [legacyName,canonicalName] of Object.entries(LEGACY_INGREDIENT_IDENTITY_RENAMES)){
    const legacy=dbRows(db,'SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[legacyName])[0]||null;
    const canonical=dbRows(db,'SELECT * FROM ingredient_inventory WHERE ingredient_name=?',[canonicalName])[0]||null;
    if(legacy&&!canonical){
      db.run('UPDATE ingredient_inventory SET ingredient_name=? WHERE ingredient_name=?',[canonicalName,legacyName]);
      audit.push({legacy_name:legacyName,canonical_name:canonicalName,action:'REKEYED_LEGACY_ONLY',quantity:Number(legacy.quantity||0),review_required:false});
    }else if(legacy&&canonical){
      const sameQuantity=Number(legacy.quantity||0)===Number(canonical.quantity||0);
      const reason=sameQuantity?'LEGACY_DUPLICATE_SAME_VALUE':'LEGACY_CANONICAL_CONFLICT_CANONICAL_WINS_NO_SUM';
      const archiveId=`ingredient-identity-v12-${legacyName}-${canonicalName}`;
      db.run(`INSERT OR REPLACE INTO ingredient_inventory_identity_archive(
        archive_id,legacy_name,canonical_name,legacy_quantity,canonical_quantity,
        legacy_updated_at,legacy_source_update_id,reason,archived_at
      ) VALUES(?,?,?,?,?,?,?,?,datetime('now'))`,[
        archiveId,legacyName,canonicalName,Number(legacy.quantity||0),Number(canonical.quantity||0),
        legacy.updated_at||null,legacy.source_update_id||null,reason,
      ]);
      db.run('DELETE FROM ingredient_inventory WHERE ingredient_name=?',[legacyName]);
      audit.push({legacy_name:legacyName,canonical_name:canonicalName,action:reason,legacy_quantity:Number(legacy.quantity||0),canonical_quantity:Number(canonical.quantity||0),review_required:!sameQuantity});
    }
    // ingredient_master is public authority. A stale legacy master row must
    // not keep rendering an obsolete item after the canonical master changed.
    db.run('DELETE FROM ingredient_master WHERE ingredient_name=?',[legacyName]);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('ingredient_inventory_identity_migration_v12',?,datetime('now'))`,[JSON.stringify({version:INGREDIENT_INVENTORY_INTEGRITY_VERSION,audit,review_required:audit.some(item=>item.review_required===true)})]);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(${INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION},datetime('now'))`);
  return {changed:audit.length>0,audit,review_required:audit.some(item=>item.review_required===true)};
}

export function buildIngredientAbsenceCandidates({coverage,recognizedIngredientNames=[],establishedInventoryRows=[],confirmations=[]}={}){
  if(coverage!=='USER_CONFIRMED_COMPLETE')return [];
  const recognized=new Set(recognizedIngredientNames.map(clean).filter(Boolean));
  const confirmed=new Map((Array.isArray(confirmations)?confirmations:[]).map(item=>[clean(item?.ingredient_name),item]));
  return (Array.isArray(establishedInventoryRows)?establishedInventoryRows:[])
    .filter(row=>clean(row?.ingredient_name)&&!recognized.has(clean(row.ingredient_name)))
    .map(row=>{
      const name=clean(row.ingredient_name),confirmation=confirmed.get(name)||null;
      const resolution=confirmation?.confirmed_by_user===true&&INGREDIENT_ABSENCE_RESOLUTIONS.includes(confirmation?.resolution)?confirmation.resolution:null;
      return Object.freeze({
        ingredient_name:name,
        previous_quantity:Number(row.quantity||0),
        status:resolution?'RESOLVED':'REVIEW_REQUIRED',
        resolution,
        confirmed_by_user:confirmation?.confirmed_by_user===true,
        reason:'ABSENT_FROM_USER_CONFIRMED_COMPLETE_CAPTURE',
      });
    });
}

export function normalizeIngredientAbsenceConfirmations(confirmations=[]){
  const output=[];
  for(const item of Array.isArray(confirmations)?confirmations:[]){
    const name=clean(item?.ingredient_name),resolution=item?.resolution;
    if(!name||!INGREDIENT_ABSENCE_RESOLUTIONS.includes(resolution)||item?.confirmed_by_user!==true)continue;
    output.push({
      ingredient_name:name,
      previous_quantity:nonNegativeInteger(Number(item.previous_quantity))?Number(item.previous_quantity):0,
      resolution,
      confirmed_by_user:true,
      confirmed_at:clean(item.confirmed_at)||new Date().toISOString(),
    });
  }
  return output;
}

export function ingredientNamesFromUpdatePackage(payload){
  return [...new Set((Array.isArray(payload?.operations)?payload.operations:[])
    .filter(operation=>operation?.entity==='ingredient_inventory')
    .map(operation=>clean(operation?.key?.ingredient_name)).filter(Boolean))];
}

export function applyIngredientAbsenceConfirmations(payload,confirmations,{sourceImageRefs=[]}={}){
  const copy=clone(payload),normalized=normalizeIngredientAbsenceConfirmations(confirmations);
  copy.operations=Array.isArray(copy.operations)?copy.operations:[];
  const existing=new Set(ingredientNamesFromUpdatePackage(copy));
  const previousSummary=copy.inventory_capture_reconciliation||{};
  const previousVisibleCount=Number(previousSummary.visible_target_count);
  const visibleTargetCount=Number.isInteger(previousVisibleCount)&&previousVisibleCount>=0?previousVisibleCount:existing.size;
  copy.inventory_absence_confirmations=normalized;
  for(const [index,item] of normalized.entries()){
    if(item.resolution!=='CONFIRMED_EXHAUSTED'||existing.has(item.ingredient_name))continue;
    copy.operations.push({
      operation_id:`ABSENCE-${String(index+1).padStart(3,'0')}`,
      entity:'ingredient_inventory',
      action:'upsert',
      key:{ingredient_name:item.ingredient_name},
      data:{quantity:0},
      clear_fields:[],
      evidence:{
        source_type:'user_confirmed_complete_capture_absence',
        source_image_refs:[...new Set(sourceImageRefs.map(clean).filter(Boolean))],
        confidence:1,
        confirmation_scope:'USER_CONFIRMED_COMPLETE',
        confirmed_by_user:true,
        absence_reason:'CONFIRMED_EXHAUSTED',
        previous_quantity:item.previous_quantity,
      },
      review_required:false,
    });
    existing.add(item.ingredient_name);
  }
  copy.inventory_capture_reconciliation={
    coverage:'USER_CONFIRMED_COMPLETE',
    visible_target_count:visibleTargetCount,
    confirmed_absence_count:normalized.length,
    explicit_zero_count:normalized.filter(item=>item.resolution==='CONFIRMED_EXHAUSTED').length,
    operation_count:copy.operations.filter(operation=>operation?.entity==='ingredient_inventory').length,
    missing_is_zero:false,
    explicit_zero_requires_user_confirmation:true,
  };
  return copy;
}

export function validateIngredientAbsenceConfirmationPackage(payload,{coverage='PARTIAL'}={}){
  const errors=[],confirmations=normalizeIngredientAbsenceConfirmations(payload?.inventory_absence_confirmations||[]);
  if((payload?.inventory_absence_confirmations||[]).length!==confirmations.length)errors.push('inventory_absence_confirmations 含有未明確確認或不支援的 resolution');
  if(confirmations.length&&coverage!=='USER_CONFIRMED_COMPLETE')errors.push('inventory_absence_confirmations 只允許 USER_CONFIRMED_COMPLETE');
  const zeroByName=new Map((payload?.operations||[]).filter(operation=>operation?.entity==='ingredient_inventory'&&operation?.data?.quantity===0).map(operation=>[clean(operation?.key?.ingredient_name),operation]));
  const operationIds=(payload?.operations||[]).map(operation=>clean(operation?.operation_id)).filter(Boolean);
  if(new Set(operationIds).size!==operationIds.length)errors.push('operation_id 不可重複');
  for(const item of confirmations){
    if(item.resolution==='CONFIRMED_EXHAUSTED'){
      const operation=zeroByName.get(item.ingredient_name);
      if(!operation)errors.push(`${item.ingredient_name} 已確認用罄，但缺少 explicit quantity=0 operation`);
      if(operation&&operation?.evidence?.confirmed_by_user!==true)errors.push(`${item.ingredient_name} explicit zero 缺少 confirmed_by_user evidence`);
      if(operation&&operation?.evidence?.absence_reason!=='CONFIRMED_EXHAUSTED')errors.push(`${item.ingredient_name} explicit zero 缺少 CONFIRMED_EXHAUSTED lineage`);
    }
  }
  return {ok:errors.length===0,errors:[...new Set(errors)],confirmations,confirmed_absence_count:confirmations.length,explicit_zero_count:confirmations.filter(item=>item.resolution==='CONFIRMED_EXHAUSTED').length};
}

export function inspectIngredientInventoryMigrationState(db){
  const auditSetting=dbRows(db,"SELECT value_json FROM settings WHERE key='ingredient_inventory_identity_migration_v12'")[0]?.value_json||null;
  let audit=null;try{audit=auditSetting?JSON.parse(auditSetting):null;}catch{}
  return {
    migration_applied:Number(dbScalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION])||0)>0,
    legacy_inventory_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='特選酪梨'")||0),
    canonical_inventory_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='嫩亮酪梨'")||0),
    legacy_master_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name='特選酪梨'")||0),
    review_required:audit?.review_required===true,
    audit:audit?.audit||[],
  };
}