export const INGREDIENT_INVENTORY_INTEGRITY_VERSION='ingredient-inventory-integrity-2026-08-16-b-unlock-state';
export const INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION=12;
export const INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION=13;
export const INGREDIENT_UNLOCK_STATES=Object.freeze(['UNLOCKED','NOT_UNLOCKED','UNKNOWN','NO_PLAYER_RECORD']);
export const INGREDIENT_ABSENCE_RESOLUTIONS=Object.freeze([
  'CONFIRMED_EXHAUSTED',
  'PRESERVE_EXISTING_NOT_CAPTURED',
  'CONFIRMED_NOT_UNLOCKED',
  'CONFIRMED_UNLOCKED_ZERO',
  'PRESERVE_UNLOCK_UNKNOWN',
]);

export const LEGACY_INGREDIENT_IDENTITY_RENAMES=Object.freeze({
  '特選酪梨':'嫩亮酪梨',
});

const clone=value=>JSON.parse(JSON.stringify(value));
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonNegativeInteger=value=>Number.isInteger(value)&&value>=0;
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);

function dbRows(db,sql,params=[]){
  const statement=db.prepare(sql);statement.bind(params);const output=[];
  while(statement.step())output.push(statement.getAsObject());statement.free();return output;
}
function dbScalar(db,sql,params=[]){const result=dbRows(db,sql,params);return result.length?Object.values(result[0])[0]:null;}
function dbColumns(db,table){return new Set(dbRows(db,`PRAGMA table_info("${table}")`).map(row=>row.name));}
function normalizedUnlockState(row){
  const quantity=Number(row?.quantity||0);
  if(quantity>0)return 'UNLOCKED';
  const projected=clean(row?.unlock_state);
  if(INGREDIENT_UNLOCK_STATES.includes(projected))return projected;
  if(row?.unlocked===1||row?.unlocked===true)return 'UNLOCKED';
  if(row?.unlocked===0||row?.unlocked===false)return 'NOT_UNLOCKED';
  return row?.player_record_exists===0?'NO_PLAYER_RECORD':'UNKNOWN';
}
function reviewKindFor(row){
  const state=normalizedUnlockState(row),quantity=Number(row?.quantity||0);
  if(state==='NOT_UNLOCKED'||state==='NO_PLAYER_RECORD')return null;
  if(state==='UNLOCKED'&&quantity===0)return null;
  if(state==='UNLOCKED')return 'INVENTORY_QUANTITY_REVIEW';
  return 'UNLOCK_STATE_REVIEW';
}
function allowedResolutions(reviewKind){
  if(reviewKind==='INVENTORY_QUANTITY_REVIEW')return ['CONFIRMED_EXHAUSTED','PRESERVE_EXISTING_NOT_CAPTURED'];
  if(reviewKind==='UNLOCK_STATE_REVIEW')return ['CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO','PRESERVE_UNLOCK_UNKNOWN'];
  return [];
}

/**
 * Migration 12 corrects a legacy canonical-name residue without ever summing
 * two player quantities. Migration 13 is then applied by the same lifecycle
 * entry point so existing v0.4.27.1 databases that already contain migration
 * 12 still receive the unlock-state semantic migration.
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
    db.run('DELETE FROM ingredient_master WHERE ingredient_name=?',[legacyName]);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('ingredient_inventory_identity_migration_v12',?,datetime('now'))`,[JSON.stringify({version:'ingredient-inventory-integrity-2026-08-16-a',audit,review_required:audit.some(item=>item.review_required===true)})]);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(${INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION},datetime('now'))`);
  const unlock=applyIngredientUnlockStateMigration(db);
  return {changed:audit.length>0||unlock.changed,audit,review_required:audit.some(item=>item.review_required===true),unlock};
}

/**
 * Migration 13 separates player progression from inventory quantity:
 * unlocked=1 means unlocked, unlocked=0 means explicitly not unlocked, NULL
 * means legacy/unknown. Positive quantity is deterministic evidence of unlock;
 * zero quantity alone is deliberately left UNKNOWN.
 */
export function applyIngredientUnlockStateMigration(db){
  let columnAdded=false;
  if(!dbColumns(db,'ingredient_inventory').has('unlocked')){
    db.run('ALTER TABLE ingredient_inventory ADD COLUMN unlocked INTEGER');
    columnAdded=true;
  }
  const positiveBefore=Number(dbScalar(db,'SELECT COUNT(*) FROM ingredient_inventory WHERE quantity>0 AND unlocked IS NOT 1')||0);
  db.run('UPDATE ingredient_inventory SET unlocked=1 WHERE quantity>0 AND unlocked IS NOT 1');
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_ingredient_inventory_unlock_positive_insert
    AFTER INSERT ON ingredient_inventory
    WHEN NEW.quantity>0 AND NEW.unlocked IS NOT 1
    BEGIN
      UPDATE ingredient_inventory SET unlocked=1 WHERE ingredient_name=NEW.ingredient_name;
    END`);
  db.run(`CREATE TRIGGER IF NOT EXISTS trg_ingredient_inventory_unlock_positive_update
    AFTER UPDATE OF quantity ON ingredient_inventory
    WHEN NEW.quantity>0 AND NEW.unlocked IS NOT 1
    BEGIN
      UPDATE ingredient_inventory SET unlocked=1 WHERE ingredient_name=NEW.ingredient_name;
    END`);
  db.run('DROP VIEW IF EXISTS ingredient_catalog_state');
  db.run(`CREATE VIEW ingredient_catalog_state AS
    SELECT m.ingredient_name,
           COALESCE(i.quantity,0) AS quantity,
           i.unlocked AS stored_unlocked,
           CASE
             WHEN i.ingredient_name IS NULL THEN NULL
             WHEN COALESCE(i.quantity,0)>0 THEN 1
             ELSE i.unlocked
           END AS unlocked,
           CASE
             WHEN i.ingredient_name IS NULL THEN 'NO_PLAYER_RECORD'
             WHEN COALESCE(i.quantity,0)>0 OR i.unlocked=1 THEN 'UNLOCKED'
             WHEN i.unlocked=0 THEN 'NOT_UNLOCKED'
             ELSE 'UNKNOWN'
           END AS unlock_state,
           CASE WHEN i.ingredient_name IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           i.updated_at,
           m.data_version
      FROM ingredient_master m
      LEFT JOIN ingredient_inventory i ON i.ingredient_name=m.ingredient_name`);
  const unknownZeroCount=Number(dbScalar(db,'SELECT COUNT(*) FROM ingredient_inventory WHERE quantity=0 AND unlocked IS NULL')||0);
  const notUnlockedCount=Number(dbScalar(db,'SELECT COUNT(*) FROM ingredient_inventory WHERE quantity=0 AND unlocked=0')||0);
  const unlockedCount=Number(dbScalar(db,'SELECT COUNT(*) FROM ingredient_inventory WHERE quantity>0 OR unlocked=1')||0);
  const audit={
    version:INGREDIENT_INVENTORY_INTEGRITY_VERSION,
    migration_version:INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,
    column_added:columnAdded,
    positive_quantity_promoted_to_unlocked:positiveBefore,
    unknown_zero_count:unknownZeroCount,
    explicit_not_unlocked_count:notUnlockedCount,
    unlocked_count:unlockedCount,
    zero_quantity_implies_not_unlocked:false,
  };
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('ingredient_unlock_state_migration_v13',?,datetime('now'))`,[JSON.stringify(audit)]);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(${INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION},datetime('now'))`);
  return {changed:columnAdded||positiveBefore>0,...audit};
}

export function buildIngredientAbsenceCandidates({coverage,recognizedIngredientNames=[],establishedInventoryRows=[],confirmations=[]}={}){
  if(coverage!=='USER_CONFIRMED_COMPLETE')return [];
  const recognized=new Set(recognizedIngredientNames.map(clean).filter(Boolean));
  const confirmed=new Map((Array.isArray(confirmations)?confirmations:[]).map(item=>[clean(item?.ingredient_name),item]));
  return (Array.isArray(establishedInventoryRows)?establishedInventoryRows:[])
    .filter(row=>clean(row?.ingredient_name)&&!recognized.has(clean(row.ingredient_name)))
    .map(row=>{
      const name=clean(row.ingredient_name),quantity=Number(row.quantity||0),unlockState=normalizedUnlockState(row),reviewKind=reviewKindFor(row);
      if(!reviewKind)return null;
      const confirmation=confirmed.get(name)||null;
      const allowed=allowedResolutions(reviewKind);
      const resolution=confirmation?.confirmed_by_user===true&&allowed.includes(confirmation?.resolution)?confirmation.resolution:null;
      return Object.freeze({
        ingredient_name:name,
        previous_quantity:quantity,
        unlock_state:unlockState,
        review_kind:reviewKind,
        available_resolutions:Object.freeze([...allowed]),
        status:resolution?'RESOLVED':'REVIEW_REQUIRED',
        resolution,
        confirmed_by_user:confirmation?.confirmed_by_user===true,
        reason:reviewKind==='UNLOCK_STATE_REVIEW'?'ABSENT_ZERO_ROW_UNLOCK_STATE_UNKNOWN':'ABSENT_FROM_USER_CONFIRMED_COMPLETE_CAPTURE',
      });
    })
    .filter(Boolean);
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

function confirmationOperation(item,index,sourceImageRefs){
  let data=null,sourceType='user_confirmed_complete_capture_absence';
  if(item.resolution==='CONFIRMED_EXHAUSTED')data={quantity:0,unlocked:1};
  else if(item.resolution==='CONFIRMED_NOT_UNLOCKED'){data={unlocked:0};sourceType='user_confirmed_ingredient_unlock_state';}
  else if(item.resolution==='CONFIRMED_UNLOCKED_ZERO'){data={unlocked:1};sourceType='user_confirmed_ingredient_unlock_state';}
  if(!data)return null;
  return {
    operation_id:`ABSENCE-${String(index+1).padStart(3,'0')}`,
    entity:'ingredient_inventory',
    action:'upsert',
    key:{ingredient_name:item.ingredient_name},
    data,
    clear_fields:[],
    evidence:{
      source_type:sourceType,
      source_image_refs:[...new Set(sourceImageRefs.map(clean).filter(Boolean))],
      confidence:1,
      confirmation_scope:'USER_CONFIRMED_COMPLETE',
      confirmed_by_user:true,
      absence_reason:item.resolution,
      previous_quantity:item.previous_quantity,
      quantity_observed_in_image:false,
      unlock_state_observed_in_image:false,
    },
    review_required:false,
  };
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
    if(existing.has(item.ingredient_name))continue;
    const operation=confirmationOperation(item,index,sourceImageRefs);
    if(!operation)continue;
    copy.operations.push(operation);existing.add(item.ingredient_name);
  }
  copy.inventory_capture_reconciliation={
    coverage:'USER_CONFIRMED_COMPLETE',
    visible_target_count:visibleTargetCount,
    confirmed_absence_count:normalized.length,
    explicit_zero_count:normalized.filter(item=>item.resolution==='CONFIRMED_EXHAUSTED').length,
    unlock_state_confirmation_count:normalized.filter(item=>['CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO'].includes(item.resolution)).length,
    preserved_unknown_count:normalized.filter(item=>item.resolution==='PRESERVE_UNLOCK_UNKNOWN').length,
    operation_count:copy.operations.filter(operation=>operation?.entity==='ingredient_inventory').length,
    missing_is_zero:false,
    zero_quantity_implies_not_unlocked:false,
    explicit_zero_requires_user_confirmation:true,
    unlock_state_requires_explicit_evidence_when_quantity_is_zero:true,
  };
  return copy;
}

export function validateIngredientAbsenceConfirmationPackage(payload,{coverage='PARTIAL'}={}){
  const errors=[],confirmations=normalizeIngredientAbsenceConfirmations(payload?.inventory_absence_confirmations||[]);
  if((payload?.inventory_absence_confirmations||[]).length!==confirmations.length)errors.push('inventory_absence_confirmations 含有未明確確認或不支援的 resolution');
  if(confirmations.length&&coverage!=='USER_CONFIRMED_COMPLETE')errors.push('inventory_absence_confirmations 只允許 USER_CONFIRMED_COMPLETE');
  const operationsByName=new Map((payload?.operations||[]).filter(operation=>operation?.entity==='ingredient_inventory').map(operation=>[clean(operation?.key?.ingredient_name),operation]));
  const operationIds=(payload?.operations||[]).map(operation=>clean(operation?.operation_id)).filter(Boolean);
  if(new Set(operationIds).size!==operationIds.length)errors.push('operation_id 不可重複');
  for(const item of confirmations){
    const operation=operationsByName.get(item.ingredient_name);
    if(item.resolution==='CONFIRMED_EXHAUSTED'){
      if(!operation||operation?.data?.quantity!==0)errors.push(`${item.ingredient_name} 已確認用罄，但缺少 explicit quantity=0 operation`);
      if(operation&&operation?.data?.unlocked!==1)errors.push(`${item.ingredient_name} 已用罄必須維持 unlocked=1`);
    }
    if(item.resolution==='CONFIRMED_NOT_UNLOCKED'){
      if(!operation||operation?.data?.unlocked!==0)errors.push(`${item.ingredient_name} 已確認未解鎖，但缺少 unlocked=0 operation`);
      if(operation&&hasOwn(operation.data,'quantity'))errors.push(`${item.ingredient_name} 未解鎖確認不得偽造成 quantity=0 圖片觀測`);
    }
    if(item.resolution==='CONFIRMED_UNLOCKED_ZERO'){
      if(!operation||operation?.data?.unlocked!==1)errors.push(`${item.ingredient_name} 已確認解鎖且目前為 0，但缺少 unlocked=1 operation`);
      if(item.previous_quantity!==0)errors.push(`${item.ingredient_name} CONFIRMED_UNLOCKED_ZERO 只允許既有 quantity=0`);
    }
    if(operation&&['CONFIRMED_EXHAUSTED','CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO'].includes(item.resolution)){
      if(operation?.evidence?.confirmed_by_user!==true)errors.push(`${item.ingredient_name} confirmation operation 缺少 confirmed_by_user evidence`);
      if(operation?.evidence?.absence_reason!==item.resolution)errors.push(`${item.ingredient_name} confirmation operation lineage 不一致`);
    }
  }
  return {
    ok:errors.length===0,
    errors:[...new Set(errors)],
    confirmations,
    confirmed_absence_count:confirmations.length,
    explicit_zero_count:confirmations.filter(item=>item.resolution==='CONFIRMED_EXHAUSTED').length,
    unlock_state_confirmation_count:confirmations.filter(item=>['CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO'].includes(item.resolution)).length,
    preserved_unknown_count:confirmations.filter(item=>item.resolution==='PRESERVE_UNLOCK_UNKNOWN').length,
  };
}

export function inspectIngredientInventoryMigrationState(db){
  const identityRaw=dbRows(db,"SELECT value_json FROM settings WHERE key='ingredient_inventory_identity_migration_v12'")[0]?.value_json||null;
  const unlockRaw=dbRows(db,"SELECT value_json FROM settings WHERE key='ingredient_unlock_state_migration_v13'")[0]?.value_json||null;
  let identity=null,unlock=null;try{identity=identityRaw?JSON.parse(identityRaw):null;}catch{}try{unlock=unlockRaw?JSON.parse(unlockRaw):null;}catch{}
  const hasUnlockColumn=dbColumns(db,'ingredient_inventory').has('unlocked');
  return {
    identity_migration_applied:Number(dbScalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION])||0)>0,
    unlock_migration_applied:Number(dbScalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION])||0)>0,
    migration_applied:Number(dbScalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION])||0)>0,
    legacy_inventory_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='特選酪梨'")||0),
    canonical_inventory_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='嫩亮酪梨'")||0),
    legacy_master_count:Number(dbScalar(db,"SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name='特選酪梨'")||0),
    unknown_zero_count:hasUnlockColumn?Number(dbScalar(db,'SELECT COUNT(*) FROM ingredient_inventory WHERE quantity=0 AND unlocked IS NULL')||0):null,
    review_required:identity?.review_required===true,
    audit:identity?.audit||[],
    unlock_audit:unlock,
  };
}
