import {
  PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
  resolvePublicCandyFamilyForSpecies,
} from './public-candy-family-authority.js';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS,
} from './public-candy-display-name-authority.js';

export const CANDY_FAMILY_STORAGE_AUTHORITY_VERSION='candy-family-storage-authority-2026-09-01-b';
export const CANDY_FAMILY_STORAGE_MIGRATION_VERSION=15;
export const CANDY_FAMILY_STORAGE_STATUS='ACTIVE_CANONICAL_FAMILY_STORAGE_WITH_CHRONOLOGY_RECONCILIATION';
export const CANDY_MUTATION_TYPES=Object.freeze({
  DELTA_EVENT:'DELTA_EVENT',
  ABSOLUTE_SNAPSHOT:'ABSOLUTE_SNAPSHOT',
});

const clean=value=>String(value??'').normalize('NFKC').trim();
const validQuantity=value=>Number.isInteger(Number(value))&&Number(value)>=0;
const parseJson=value=>{try{return value==null?null:JSON.parse(value);}catch{return null;}};
const dbRows=(db,sql,params=[])=>{const statement=db.prepare(sql);statement.bind(params);const output=[];while(statement.step())output.push(statement.getAsObject());statement.free();return output;};
const dbScalar=(db,sql,params=[])=>{const result=dbRows(db,sql,params);return result.length?Object.values(result[0])[0]:null;};
const timestampMs=value=>{const text=String(value??'').trim();if(!text)return null;const parsed=Date.parse(text);return Number.isFinite(parsed)?parsed:null;};
export const canonicalCandyEventTimestamp=value=>{const parsed=timestampMs(value);return parsed===null?null:new Date(parsed).toISOString();};
const isoCompare=(a,b)=>{const am=timestampMs(a),bm=timestampMs(b);if(am!==null&&bm!==null)return am-bm;if(am!==null)return -1;if(bm!==null)return 1;return String(a||'').localeCompare(String(b||''));};
const unique=values=>[...new Set(values.filter(Boolean))];

function displayAuthorityForFamily(familyId){
  return PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS.find(row=>row.status==='MATCH'&&row.family_id===familyId&&row.candy_display_name_authority===true)||null;
}

export function resolveCandyFamilyStorageForSpecies(speciesName){
  const family=resolvePublicCandyFamilyForSpecies(speciesName);
  if(family.status!=='MATCH')return Object.freeze({
    status:'REVIEW_REQUIRED',
    reason:'PUBLIC_CANDY_FAMILY_AUTHORITY_REQUIRED',
    observed_species_name:String(speciesName??'').trim(),
    family_id:null,
    canonical_species_name:null,
    canonical_candy_display_name:null,
    family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
    display_name_authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  });
  const display=displayAuthorityForFamily(family.family_id);
  if(!display)return Object.freeze({
    status:'REVIEW_REQUIRED',
    reason:'PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_REQUIRED_FOR_CANONICAL_STORAGE',
    observed_species_name:String(speciesName??'').trim(),
    family_id:family.family_id,
    canonical_species_name:null,
    canonical_candy_display_name:null,
    family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
    display_name_authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  });
  return Object.freeze({
    status:'MATCH',
    reason:'GOVERNED_FAMILY_AND_EXPLICIT_DISPLAY_REFERENCE_BOUND',
    observed_species_name:String(speciesName??'').trim(),
    family_id:family.family_id,
    member_species_names:Object.freeze([...(family.member_species_names||[])]),
    canonical_species_name:display.reference_species_name,
    canonical_candy_display_name:display.candy_display_name,
    family_authority_version:PUBLIC_CANDY_FAMILY_AUTHORITY_VERSION,
    display_name_authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
    storage_authority_version:CANDY_FAMILY_STORAGE_AUTHORITY_VERSION,
  });
}

export function reconcileCandyFamilyTimeline(events,{unknown_rows=[]}={}){
  const relevant=(events||[]).map(event=>({
    ...event,
    mutation_type:String(event?.mutation_type||''),
    quantity_value:Number(event?.quantity_value),
    event_at:String(event?.event_at||''),
    event_id:String(event?.event_id||''),
  })).filter(event=>Object.values(CANDY_MUTATION_TYPES).includes(event.mutation_type)&&validQuantity(event.quantity_value));
  const invalidTime=relevant.find(event=>timestampMs(event.event_at)===null);
  if(invalidTime)return Object.freeze({status:'HOLD',reason:'INVALID_EVENT_TIMESTAMP',current_quantity:null,baseline_event:null,post_snapshot_deltas:Object.freeze([]),invalid_event:invalidTime});
  const normalized=relevant.map(event=>({...event,event_at:canonicalCandyEventTimestamp(event.event_at)}));
  normalized.sort((a,b)=>isoCompare(a.event_at,b.event_at)||a.event_id.localeCompare(b.event_id));
  const snapshots=normalized.filter(event=>event.mutation_type===CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT);
  if(!snapshots.length)return Object.freeze({status:'HOLD',reason:'NO_TRUSTED_ABSOLUTE_SNAPSHOT',current_quantity:null,baseline_event:null,post_snapshot_deltas:Object.freeze([])});
  const baseline=snapshots[snapshots.length-1];
  const sameTimeDelta=normalized.find(event=>event.mutation_type===CANDY_MUTATION_TYPES.DELTA_EVENT&&isoCompare(event.event_at,baseline.event_at)===0);
  if(sameTimeDelta)return Object.freeze({status:'HOLD',reason:'AMBIGUOUS_SAME_TIMESTAMP_SNAPSHOT_AND_DELTA',current_quantity:null,baseline_event:baseline,post_snapshot_deltas:Object.freeze([])});
  const postDeltas=normalized.filter(event=>event.mutation_type===CANDY_MUTATION_TYPES.DELTA_EVENT&&isoCompare(event.event_at,baseline.event_at)>0);
  const unsafeUnknown=(unknown_rows||[]).filter(row=>timestampMs(row?.updated_at)===null||isoCompare(row.updated_at,baseline.event_at)>0);
  if(unsafeUnknown.length)return Object.freeze({status:'HOLD',reason:'UNKNOWN_PROVENANCE_AFTER_LATEST_SNAPSHOT',current_quantity:null,baseline_event:baseline,post_snapshot_deltas:Object.freeze(postDeltas),unknown_rows:Object.freeze(unsafeUnknown)});
  const quantity=Number(baseline.quantity_value)+postDeltas.reduce((sum,event)=>sum+Number(event.quantity_value),0);
  return Object.freeze({status:'READY',reason:'LATEST_ABSOLUTE_PLUS_LATER_DELTAS',current_quantity:quantity,baseline_event:baseline,post_snapshot_deltas:Object.freeze(postDeltas)});
}

function ensureSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS candy_inventory_events(
    event_id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    canonical_candy_id TEXT NOT NULL,
    source_candy_id TEXT,
    mutation_type TEXT NOT NULL,
    quantity_value INTEGER NOT NULL,
    event_at TEXT NOT NULL,
    source_update_id TEXT,
    authority TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_candy_inventory_events_family_time ON candy_inventory_events(family_id,event_at,event_id)');
  db.run(`CREATE TABLE IF NOT EXISTS candy_inventory_identity_archive(
    archive_id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    legacy_candy_id TEXT NOT NULL,
    canonical_candy_id TEXT NOT NULL,
    row_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    archived_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS candy_family_storage_migration_audit(
    family_id TEXT PRIMARY KEY,
    canonical_candy_id TEXT,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    before_rows_json TEXT NOT NULL DEFAULT '[]',
    after_row_json TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    audited_at TEXT NOT NULL
  )`);
}

function normalizeExistingEventTimes(db){
  const existing=dbRows(db,'SELECT event_id,event_at,created_at FROM candy_inventory_events');
  let changed=0,invalid=0;
  for(const row of existing){
    const eventAt=canonicalCandyEventTimestamp(row.event_at);
    if(!eventAt){invalid++;continue;}
    const createdAt=canonicalCandyEventTimestamp(row.created_at)||eventAt;
    if(eventAt===String(row.event_at||'')&&createdAt===String(row.created_at||''))continue;
    db.run('UPDATE candy_inventory_events SET event_at=?,created_at=? WHERE event_id=?',[eventAt,createdAt,row.event_id]);
    changed++;
  }
  return {changed,invalid};
}

function insertEvent(db,event){
  const eventAt=canonicalCandyEventTimestamp(event?.event_at);
  const createdAt=canonicalCandyEventTimestamp(event?.created_at)||eventAt;
  if(!event?.event_id||!event?.family_id||!event?.canonical_candy_id||!Object.values(CANDY_MUTATION_TYPES).includes(event.mutation_type)||!validQuantity(event.quantity_value)||!eventAt)return false;
  db.run(`INSERT OR IGNORE INTO candy_inventory_events(event_id,family_id,canonical_candy_id,source_candy_id,mutation_type,quantity_value,event_at,source_update_id,authority,evidence_json,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[
    event.event_id,event.family_id,event.canonical_candy_id,event.source_candy_id||null,event.mutation_type,Number(event.quantity_value),eventAt,event.source_update_id||null,event.authority||'UNKNOWN',JSON.stringify(event.evidence||{}),createdAt,
  ]);
  return true;
}

export function recordCandyInventoryEvent(runSql,event){
  if(typeof runSql!=='function')throw new Error('candy_inventory_event_run_required');
  if(!event?.event_id||!event?.family_id||!event?.canonical_candy_id)throw new Error('candy_inventory_event_identity_required');
  if(!Object.values(CANDY_MUTATION_TYPES).includes(event.mutation_type))throw new Error('candy_inventory_event_mutation_type_invalid');
  if(!validQuantity(event.quantity_value))throw new Error('candy_inventory_event_quantity_invalid');
  const eventAt=canonicalCandyEventTimestamp(event.event_at);
  if(!eventAt)throw new Error('candy_inventory_event_time_required');
  const createdAt=canonicalCandyEventTimestamp(event.created_at)||eventAt;
  runSql(`INSERT INTO candy_inventory_events(event_id,family_id,canonical_candy_id,source_candy_id,mutation_type,quantity_value,event_at,source_update_id,authority,evidence_json,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,[
    event.event_id,event.family_id,event.canonical_candy_id,event.source_candy_id||null,event.mutation_type,Number(event.quantity_value),eventAt,event.source_update_id||null,event.authority||'UNKNOWN',JSON.stringify(event.evidence||{}),createdAt,
  ]);
}

function canonicalGroups(db){
  const masters=dbRows(db,"SELECT candy_id,candy_name,candy_type,target_species_name FROM candy_master WHERE candy_type='species'");
  const groups=new Map();
  for(const master of masters){
    const storage=resolveCandyFamilyStorageForSpecies(master.target_species_name);
    if(storage.status!=='MATCH')continue;
    let group=groups.get(storage.family_id);
    if(!group){group={storage,member_rows:[],canonical_master:null};groups.set(storage.family_id,group);}
    group.member_rows.push(master);
    if(clean(master.target_species_name)===clean(storage.canonical_species_name))group.canonical_master=master;
  }
  return groups;
}

function legacyImportEvents(db,group,memberIds){
  const events=[];
  const changes=dbRows(db,`SELECT c.id,c.update_id,c.operation_index,c.key_json,c.before_json,c.after_json,b.generated_at,b.imported_at,b.source
    FROM import_changes c JOIN import_batches b ON b.update_id=c.update_id
    WHERE c.entity='candy_inventory' AND c.status='applied' ORDER BY c.id`);
  for(const change of changes){
    const key=parseJson(change.key_json)||{},after=parseJson(change.after_json)||{};
    const candyId=String(after.candy_id||key.candy_id||'');
    if(!memberIds.has(candyId)||!validQuantity(after.quantity))continue;
    const eventAt=canonicalCandyEventTimestamp(after.updated_at||change.imported_at||change.generated_at||'');
    if(!eventAt)continue;
    events.push({
      event_id:`legacy-import:${change.update_id}:${change.operation_index}`,
      family_id:group.storage.family_id,
      canonical_candy_id:group.canonical_master.candy_id,
      source_candy_id:candyId,
      mutation_type:CANDY_MUTATION_TYPES.ABSOLUTE_SNAPSHOT,
      quantity_value:Number(after.quantity),
      event_at:eventAt,
      source_update_id:change.update_id,
      authority:'LEGACY_IMPORT_ABSOLUTE_STATE_WRITE',
      evidence:{import_change_id:change.id,source:change.source||null,before:parseJson(change.before_json),after},
      created_at:canonicalCandyEventTimestamp(change.imported_at||after.updated_at||change.generated_at||'')||eventAt,
    });
  }
  return events;
}

function legacyProfessorEvents(db,group,memberIds){
  const events=[];
  const history=dbRows(db,"SELECT history_id,event_at,after_json,source_update_id FROM pokemon_history WHERE event_type='sent_to_professor' ORDER BY history_id");
  for(const row of history){
    const after=parseJson(row.after_json)||{},transfer=after.professor_transfer||{},inventoryAfter=after.candy_inventory_after||{};
    const candyId=String(inventoryAfter.candy_id||'');
    if(!memberIds.has(candyId)||transfer.inventory_mutation!=='OBSERVED_DELTA_INCREMENT'||transfer.candy_inventory_applied!==true||!validQuantity(transfer.observed_candy_quantity))continue;
    const eventAt=canonicalCandyEventTimestamp(row.event_at||transfer.transferred_at||'');
    if(!eventAt)continue;
    events.push({
      event_id:`legacy-professor:${row.history_id}`,
      family_id:group.storage.family_id,
      canonical_candy_id:group.canonical_master.candy_id,
      source_candy_id:candyId,
      mutation_type:CANDY_MUTATION_TYPES.DELTA_EVENT,
      quantity_value:Number(transfer.observed_candy_quantity),
      event_at:eventAt,
      source_update_id:row.source_update_id||null,
      authority:transfer.quantity_authority||'USER_DIRECT_OBSERVATION_ONLY',
      evidence:{history_id:row.history_id,professor_transfer:transfer,candy_inventory_before:after.candy_inventory_before||null,candy_inventory_after:inventoryAfter},
      created_at:eventAt,
    });
  }
  return events;
}

function auditFamily(db,{familyId,canonicalCandyId,status,reason,beforeRows,afterRow,details,auditedAt}){
  db.run(`INSERT INTO candy_family_storage_migration_audit(family_id,canonical_candy_id,status,reason,before_rows_json,after_row_json,details_json,audited_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(family_id) DO UPDATE SET canonical_candy_id=excluded.canonical_candy_id,status=excluded.status,reason=excluded.reason,before_rows_json=excluded.before_rows_json,after_row_json=excluded.after_row_json,details_json=excluded.details_json,audited_at=excluded.audited_at`,[
    familyId,canonicalCandyId||null,status,reason,JSON.stringify(beforeRows||[]),afterRow?JSON.stringify(afterRow):null,JSON.stringify(details||{}),auditedAt,
  ]);
}

export function applyCandyFamilyStorageMigration(db){
  ensureSchema(db);
  const timestampNormalization=normalizeExistingEventTimes(db);
  const alreadyApplied=Number(dbScalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[CANDY_FAMILY_STORAGE_MIGRATION_VERSION])||0)>0;
  if(alreadyApplied)return {database_changed:timestampNormalization.changed>0,migration_version:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,applied:0,held:timestampNormalization.invalid,no_op:true,normalized_event_times:timestampNormalization.changed,invalid_event_times:timestampNormalization.invalid};
  const auditedAt=new Date().toISOString();
  let applied=0,held=0,unchanged=0;
  db.run('BEGIN IMMEDIATE');
  try{
    const groups=canonicalGroups(db);
    for(const [familyId,group] of groups){
      if(!group.canonical_master){held++;auditFamily(db,{familyId,canonicalCandyId:null,status:'HOLD',reason:'CANONICAL_CANDY_MASTER_ROW_MISSING',beforeRows:[],afterRow:null,details:{storage:group.storage},auditedAt});continue;}
      const memberIds=new Set(group.member_rows.map(row=>String(row.candy_id)));
      const placeholders=[...memberIds].map(()=>'?').join(',');
      const inventory=memberIds.size?dbRows(db,`SELECT * FROM candy_inventory WHERE candy_id IN (${placeholders})`,[...memberIds]):[];
      if(!inventory.length){unchanged++;continue;}
      const events=[...legacyImportEvents(db,group,memberIds),...legacyProfessorEvents(db,group,memberIds)];
      for(const event of events)insertEvent(db,event);
      const trustedSources=new Set(events.map(event=>event.source_update_id).filter(Boolean));
      const unknownRows=inventory.filter(row=>!row.source_update_id||!trustedSources.has(row.source_update_id));
      const canonicalOnly=inventory.length===1&&String(inventory[0].candy_id)===String(group.canonical_master.candy_id);
      if(canonicalOnly){
        unchanged++;
        auditFamily(db,{familyId,canonicalCandyId:group.canonical_master.candy_id,status:'NOOP',reason:'ALREADY_CANONICAL_SINGLE_ROW',beforeRows:inventory,afterRow:inventory[0],details:{event_count:events.length,unknown_provenance_count:unknownRows.length},auditedAt});
        continue;
      }
      if(inventory.length>1&&inventory.some(row=>Number(row.safe_reserve||0)!==0)){
        held++;auditFamily(db,{familyId,canonicalCandyId:group.canonical_master.candy_id,status:'HOLD',reason:'DUPLICATE_FAMILY_SAFE_RESERVE_REQUIRES_REVIEW',beforeRows:inventory,afterRow:null,details:{event_count:events.length},auditedAt});continue;
      }
      let finalQuantity=null,reconciliation=null;
      if(inventory.length===1){
        if(unknownRows.length){held++;auditFamily(db,{familyId,canonicalCandyId:group.canonical_master.candy_id,status:'HOLD',reason:'SINGLE_LEGACY_ROW_PROVENANCE_UNKNOWN',beforeRows:inventory,afterRow:null,details:{event_count:events.length},auditedAt});continue;}
        finalQuantity=Number(inventory[0].quantity||0);
        reconciliation={status:'READY',reason:'SINGLE_GOVERNED_ROW_REKEY_NO_QUANTITY_MERGE'};
      }else{
        reconciliation=reconcileCandyFamilyTimeline(events,{unknown_rows:unknownRows});
        if(reconciliation.status!=='READY'){
          held++;auditFamily(db,{familyId,canonicalCandyId:group.canonical_master.candy_id,status:'HOLD',reason:reconciliation.reason,beforeRows:inventory,afterRow:null,details:{event_count:events.length,unknown_provenance_count:unknownRows.length},auditedAt});continue;
        }
        finalQuantity=Number(reconciliation.current_quantity);
      }
      for(const row of inventory){
        const archiveId=`v15:${familyId}:${row.candy_id}`;
        db.run(`INSERT OR IGNORE INTO candy_inventory_identity_archive(archive_id,family_id,legacy_candy_id,canonical_candy_id,row_json,reason,archived_at) VALUES(?,?,?,?,?,?,?)`,[
          archiveId,familyId,row.candy_id,group.canonical_master.candy_id,JSON.stringify(row),reconciliation.reason,auditedAt,
        ]);
      }
      db.run(`DELETE FROM candy_inventory WHERE candy_id IN (${placeholders})`,[...memberIds]);
      const latestAt=events.map(event=>event.event_at).filter(Boolean).sort(isoCompare).at(-1)||inventory.map(row=>row.updated_at).filter(Boolean).sort(isoCompare).at(-1)||auditedAt;
      const afterRow={candy_id:group.canonical_master.candy_id,quantity:finalQuantity,safe_reserve:inventory.length===1?Number(inventory[0].safe_reserve||0):0,updated_at:latestAt,source_update_id:`candy-family-migration:v15:${familyId}`};
      db.run('INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id) VALUES(?,?,?,?,?)',[afterRow.candy_id,afterRow.quantity,afterRow.safe_reserve,afterRow.updated_at,afterRow.source_update_id]);
      auditFamily(db,{familyId,canonicalCandyId:group.canonical_master.candy_id,status:'APPLIED',reason:reconciliation.reason,beforeRows:inventory,afterRow,details:{event_count:events.length,unknown_provenance_count:unknownRows.length,baseline_event_id:reconciliation.baseline_event?.event_id||null,post_snapshot_delta_count:reconciliation.post_snapshot_deltas?.length||0},auditedAt});
      applied++;
    }
    db.run('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)',[CANDY_FAMILY_STORAGE_MIGRATION_VERSION,auditedAt]);
    db.run('COMMIT');
    return {database_changed:true,migration_version:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,applied,held,unchanged,no_op:false,normalized_event_times:timestampNormalization.changed,invalid_event_times:timestampNormalization.invalid};
  }catch(error){try{db.run('ROLLBACK');}catch{}throw error;}
}

export const CANDY_FAMILY_STORAGE_POLICY=Object.freeze({
  canonical_identity_source:'PUBLIC_SPECIES + PUBLIC_CANDY_FAMILY + PUBLIC_CANDY_DISPLAY_NAME',
  display_text_dedupe:false,
  fuzzy_match:false,
  species_string_guess:false,
  arbitrary_duplicate_sum:false,
  older_delta_then_later_absolute:'ABSOLUTE_WINS',
  older_absolute_then_later_delta:'ABSOLUTE_PLUS_LATER_DELTA',
  ambiguous_provenance:'HOLD_FAIL_CLOSED',
  explicit_zero_valid:true,
  public_master_player_quantity:false,
  historical_evidence_preserved:true,
  migration_transaction:'BEGIN_IMMEDIATE_COMMIT_OR_ROLLBACK',
  timestamp_ordering:'PARSED_INSTANT_UTC_CANONICAL',
  mixed_timezone_offsets_supported:true,
});