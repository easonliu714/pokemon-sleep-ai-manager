export const G121_AUTHORITY_SCHEMA_MIGRATION_VERSION=16;
export const G121_AUTHORITY_VERSION='g121-authority-2026-09-08-a';
export const G121_ITEM_ACQUISITION_AUTHORITY_VERSION='g121-item-acquisition-authority-2026-09-08-a';
export const G121_PLAYER_RESOURCE_AUTHORITY_VERSION='g121-player-resource-authority-2026-09-08-a';
export const G121_STATUS_AUTHORITY_VERSION='g121-status-vocabulary-2026-09-08-a';

export const G121_EVOLUTION_STATUS=Object.freeze({
  READY_NOW:'ready_now',
  MISSING_SLEEP_HOURS:'missing_sleep_hours',
  MISSING_LEVEL:'missing_level',
  MISSING_CANDY:'missing_candy',
  MISSING_ITEM:'missing_item',
  MISSING_DREAM_SHARDS:'missing_dream_shards',
  TIME_WINDOW_PENDING:'time_window_pending',
  MULTIPLE_REQUIREMENTS_MISSING:'multiple_requirements_missing',
  DATA_INCOMPLETE:'data_incomplete',
  EVOLUTION_NOT_RECOMMENDED_YET:'evolution_not_recommended_yet',
});

export const G121_PLAYER_RESOURCE_KEYS=Object.freeze([
  'dream_shards',
  'sleep_points',
  'diamonds',
  'premium_pass_state',
]);

export const G121_ACQUISITION_TYPES=Object.freeze([
  'regular_sleep_point_exchange',
  'premium_sleep_point_exchange',
  'diamond_shop_fixed',
  'diamond_bundle_limited',
  'mission',
  'achievement',
  'event_reward',
  'research_reward',
  'unavailable_now',
  'unknown',
]);

const sqlRows=(db,sql,params=[])=>{
  const statement=db.prepare(sql);
  statement.bind(params);
  const output=[];
  while(statement.step())output.push(statement.getAsObject());
  statement.free();
  return output;
};
const scalar=(db,sql,params=[])=>{
  const rows=sqlRows(db,sql,params);
  return rows.length?Object.values(rows[0])[0]:null;
};
const tableColumns=(db,table)=>new Set(sqlRows(db,`PRAGMA table_info("${table}")`).map(row=>row.name));
const addColumnIfMissing=(db,table,column,definition)=>{
  if(tableColumns(db,table).has(column))return false;
  db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  return true;
};

export const g121EvolutionRouteId=(fromSpecies,toSpecies)=>`sleep-evolution:${String(fromSpecies||'').trim()}→${String(toSpecies||'').trim()}`;
export const g121EvolutionBranchId=fromSpecies=>`sleep-evolution-branch:${String(fromSpecies||'').trim()}`;

export function applyG121AuthoritySchemaMigration(db){
  let changed=false;

  // Evolution route authority metadata. Existing rule values are not inferred or
  // rewritten; route/branch IDs are deterministic identities and confidence is
  // derived only from the existing source-verification status.
  changed=addColumnIfMissing(db,'pokemon_evolution_master','route_id','TEXT')||changed;
  changed=addColumnIfMissing(db,'pokemon_evolution_master','evolution_branch_id','TEXT')||changed;
  changed=addColumnIfMissing(db,'pokemon_evolution_master','effective_from','TEXT')||changed;
  changed=addColumnIfMissing(db,'pokemon_evolution_master','effective_until','TEXT')||changed;
  changed=addColumnIfMissing(db,'pokemon_evolution_master','confidence','REAL')||changed;
  changed=addColumnIfMissing(db,'pokemon_evolution_master','effective_period_status',"TEXT NOT NULL DEFAULT 'CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW'")||changed;

  db.run(`UPDATE pokemon_evolution_master
    SET route_id='sleep-evolution:'||from_species||'→'||to_species
    WHERE route_id IS NULL OR route_id=''`);
  db.run(`UPDATE pokemon_evolution_master
    SET evolution_branch_id='sleep-evolution-branch:'||from_species
    WHERE evolution_branch_id IS NULL OR evolution_branch_id=''`);
  db.run(`UPDATE pokemon_evolution_master
    SET confidence=CASE
      WHEN verification_status IN ('OFFICIAL_VERIFIED','REFERENCE_VERIFIED') THEN 1.0
      ELSE NULL
    END
    WHERE confidence IS NULL`);
  db.run(`UPDATE pokemon_evolution_master
    SET effective_period_status='CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW'
    WHERE effective_period_status IS NULL OR effective_period_status=''`);
  db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_g121_evolution_route_id ON pokemon_evolution_master(route_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_g121_evolution_branch_id ON pokemon_evolution_master(evolution_branch_id)');

  // Acquisition authority is intentionally separate from item identity. Initial
  // rows may explicitly be UNKNOWN; absence/unknown must never be converted into
  // a purchase recommendation.
  db.run(`CREATE TABLE IF NOT EXISTS item_acquisition_master(
    acquisition_id TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    acquisition_type TEXT NOT NULL,
    shop_type TEXT,
    sleep_point_cost INTEGER,
    diamond_cost INTEGER,
    exchange_limit INTEGER,
    premium_only INTEGER,
    mission_or_achievement TEXT,
    event_limited INTEGER NOT NULL DEFAULT 0,
    bundle_name TEXT,
    available_from TEXT,
    available_until TEXT,
    source_url TEXT,
    verified_at TEXT,
    confidence REAL,
    authority_status TEXT NOT NULL,
    data_version TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_g121_item_acquisition_item ON item_acquisition_master(item_name,authority_status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_g121_item_acquisition_window ON item_acquisition_master(available_from,available_until)');

  // Player resources are device-local. UNKNOWN is a first-class state and is
  // seeded explicitly so downstream logic cannot confuse "missing row" with zero.
  db.run(`CREATE TABLE IF NOT EXISTS player_resource_state(
    resource_key TEXT PRIMARY KEY,
    resource_kind TEXT NOT NULL,
    knowledge_state TEXT NOT NULL,
    numeric_value REAL,
    text_value TEXT,
    updated_at TEXT,
    source_update_id TEXT,
    authority_version TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_g121_player_resource_state ON player_resource_state(knowledge_state,resource_key)');
  for(const [resourceKey,resourceKind] of [
    ['dream_shards','numeric'],
    ['sleep_points','numeric'],
    ['diamonds','numeric'],
    ['premium_pass_state','enum'],
  ]){
    db.run(`INSERT OR IGNORE INTO player_resource_state(
      resource_key,resource_kind,knowledge_state,numeric_value,text_value,updated_at,source_update_id,authority_version
    ) VALUES(?,?,'UNKNOWN',NULL,NULL,NULL,NULL,?)`,[
      resourceKey,resourceKind,G121_PLAYER_RESOURCE_AUTHORITY_VERSION,
    ]);
  }

  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('g121_authority_version',?,datetime('now'))`,[JSON.stringify(G121_AUTHORITY_VERSION)]);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('g121_status_authority',?,datetime('now'))`,[JSON.stringify({
      version:G121_STATUS_AUTHORITY_VERSION,
      statuses:Object.values(G121_EVOLUTION_STATUS),
      unknown_is_zero:false,
      account_sleep_time_substitution_forbidden:true,
      ai_inference_for_missing_authority_forbidden:true,
    })]);

  const alreadyApplied=Number(scalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[G121_AUTHORITY_SCHEMA_MIGRATION_VERSION])||0)>0;
  db.run('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,datetime(\'now\'))',[G121_AUTHORITY_SCHEMA_MIGRATION_VERSION]);
  return {
    database_changed:changed||!alreadyApplied,
    migration_version:G121_AUTHORITY_SCHEMA_MIGRATION_VERSION,
    authority_version:G121_AUTHORITY_VERSION,
    already_applied:alreadyApplied,
    player_resource_keys:[...G121_PLAYER_RESOURCE_KEYS],
    status_vocabulary:[...Object.values(G121_EVOLUTION_STATUS)],
  };
}

export function seedUnknownEvolutionItemAcquisitionRows(db,itemNames=[]){
  let inserted=0;
  for(const rawName of itemNames){
    const itemName=String(rawName||'').trim();
    if(!itemName)continue;
    const acquisitionId=`unknown:${itemName}`;
    const before=Number(scalar(db,'SELECT COUNT(*) FROM item_acquisition_master WHERE acquisition_id=?',[acquisitionId])||0);
    db.run(`INSERT OR IGNORE INTO item_acquisition_master(
      acquisition_id,item_name,acquisition_type,shop_type,sleep_point_cost,diamond_cost,exchange_limit,
      premium_only,mission_or_achievement,event_limited,bundle_name,available_from,available_until,
      source_url,verified_at,confidence,authority_status,data_version
    ) VALUES(?,?,'unknown',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,0,'MISSING_AUTHORITY',?)`,[
      acquisitionId,itemName,G121_ITEM_ACQUISITION_AUTHORITY_VERSION,
    ]);
    if(!before)inserted+=1;
  }
  return {inserted,data_version:G121_ITEM_ACQUISITION_AUTHORITY_VERSION};
}

export function normalizeG121PlayerResourceRows(rows=[]){
  const byKey=new Map(rows.map(row=>[String(row.resource_key||''),row]));
  return Object.fromEntries(G121_PLAYER_RESOURCE_KEYS.map(key=>{
    const row=byKey.get(key);
    const knowledgeState=row?.knowledge_state==='KNOWN'?'KNOWN':'UNKNOWN';
    return [key,{
      resource_key:key,
      resource_kind:row?.resource_kind||(key==='premium_pass_state'?'enum':'numeric'),
      knowledge_state:knowledgeState,
      known:knowledgeState==='KNOWN',
      numeric_value:knowledgeState==='KNOWN'&&row?.numeric_value!=null?Number(row.numeric_value):null,
      text_value:knowledgeState==='KNOWN'&&row?.text_value!=null?String(row.text_value):null,
      updated_at:row?.updated_at||null,
      source_update_id:row?.source_update_id||null,
      authority_version:row?.authority_version||G121_PLAYER_RESOURCE_AUTHORITY_VERSION,
    }];
  }));
}
