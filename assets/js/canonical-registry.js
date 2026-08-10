export const CANONICAL_REGISTRY_VERSION='canonical-registry-2026-08-10-a';
export const CANONICAL_RESOLUTION_STATUSES=Object.freeze({
  EXACT:'CANONICAL_EXACT',
  ALIAS_SAFE:'CANONICAL_ALIAS_SAFE',
  ALIAS_REVIEW:'CANONICAL_ALIAS_REVIEW',
  UNKNOWN:'CANONICAL_UNKNOWN',
  EMPTY:'EMPTY',
});

const RELEASE={
  release_id:'game-data-2026-08-10',
  game_version:'current-as-observed-2026-08-10',
  locale:'zh-Hant',
  effective_from:'2026-08-10',
  source_type:'game_screenshot_verified+official_announcement+reference_structured',
};

const INGREDIENT_ALIASES={
  '辣味香草':'火辣香草',
  '暖暖香草':'火辣香草',
  '品質雞蛋':'特選蛋',
  '特殊蛋':'特選蛋',
  '雞蛋':'特選蛋',
  '豆製香腸':'豆製肉',
  '豆製火腿':'豆製肉',
};

const SAFE_INGREDIENT_ALIASES=new Set(['辣味香草','品質雞蛋','特殊蛋','豆製香腸','豆製火腿']);

function normalizedText(value){
  return String(value??'').normalize('NFKC').trim();
}

function idPart(value){
  return normalizedText(value).toLowerCase().replace(/\s+/g,'-');
}

function nowIso(){
  return new Date().toISOString();
}

function makeResolutionId({entityType,rawValue,sourceRef=''}){
  const basis=`${entityType}|${normalizedText(rawValue)}|${normalizedText(sourceRef)}|${Date.now()}|${Math.random()}`;
  let hash=2166136261;
  for(let index=0;index<basis.length;index++){
    hash^=basis.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return `resolution:${entityType}:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

function masterVerificationStatus(row){
  if(row.source_type==='game_screenshot_verified')return 'GAME_SCREENSHOT_VERIFIED';
  if(row.source_type==='public_pokemon_name_projection')return 'PUBLIC_POKEMON_NAME_DERIVED';
  if(row.source_type==='migration_baseline')return 'REVIEW_REQUIRED';
  if(row.source_type==='current_reference_crosscheck')return 'REFERENCE_VERIFIED';
  return 'REFERENCE_VERIFIED';
}

export function applyCanonicalRegistry(db){
  db.run(`CREATE TABLE IF NOT EXISTS game_data_release(
    release_id TEXT PRIMARY KEY,
    game_version TEXT NOT NULL,
    locale TEXT NOT NULL,
    effective_from TEXT,
    effective_until TEXT,
    source_type TEXT NOT NULL,
    data_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS canonical_term(
    term_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    canonical_name_zh_tw TEXT NOT NULL,
    game_release_id TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    verification_status TEXT NOT NULL,
    data_version TEXT NOT NULL,
    UNIQUE(entity_type,canonical_name_zh_tw)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS canonical_term_alias(
    alias_id TEXT PRIMARY KEY,
    term_id TEXT NOT NULL,
    alias_text TEXT NOT NULL,
    alias_type TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'zh-Hant',
    confidence REAL NOT NULL DEFAULT 1,
    is_auto_replace_safe INTEGER NOT NULL DEFAULT 0,
    source_type TEXT,
    UNIQUE(alias_text,locale)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS canonical_term_source(
    source_id TEXT PRIMARY KEY,
    term_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT,
    observed_name TEXT,
    observed_at TEXT,
    evidence_sha256 TEXT,
    confidence REAL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS canonical_resolution_log(
    resolution_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    resolution_status TEXT NOT NULL,
    term_id TEXT,
    canonical_name_zh_tw TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    requires_review INTEGER NOT NULL DEFAULT 1,
    source_type TEXT,
    source_ref TEXT,
    evidence_revision TEXT,
    observed_at TEXT NOT NULL,
    committed_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS canonical_alias_candidate(
    candidate_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    normalized_text TEXT NOT NULL,
    suggested_term_id TEXT,
    suggested_canonical_name_zh_tw TEXT,
    source_type TEXT,
    source_ref TEXT,
    evidence_revision TEXT,
    hit_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TEXT NOT NULL,
    latest_seen_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_note TEXT,
    UNIQUE(entity_type,normalized_text)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_canonical_resolution_status ON canonical_resolution_log(resolution_status,observed_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_canonical_alias_candidate_status ON canonical_alias_candidate(status,latest_seen_at)`);
  db.run(`INSERT OR REPLACE INTO game_data_release(release_id,game_version,locale,effective_from,source_type,data_version,status)
    VALUES(?,?,?,?,?,?,?)`,[RELEASE.release_id,RELEASE.game_version,RELEASE.locale,RELEASE.effective_from,RELEASE.source_type,CANONICAL_REGISTRY_VERSION,'active']);

  // A master refresh must retire terms that disappeared from the current authority.
  // Historical resolution logs remain immutable; only active projection changes.
  db.run(`UPDATE canonical_term SET is_active=0 WHERE entity_type IN ('ingredient','item','recipe','berry','candy')`);

  const masters=[
    ['ingredient','ingredient_master','ingredient_name'],
    ['item','item_master','item_name'],
    ['recipe','recipe_master','recipe_name'],
    ['berry','berry_master','berry_name'],
    ['candy','candy_master','candy_name'],
  ];
  for(const [entity,table,column] of masters){
    const values=[];
    const statement=db.prepare(`SELECT ${column} AS name,source_type,source_ref,verified_at FROM ${table}`);
    while(statement.step()) values.push(statement.getAsObject());
    statement.free();
    for(const row of values){
      const termId=`${entity}:${idPart(row.name)}`;
      db.run(`INSERT INTO canonical_term(term_id,entity_type,canonical_name_zh_tw,game_release_id,is_active,verification_status,data_version)
        VALUES(?,?,?,?,1,?,?) ON CONFLICT(term_id) DO UPDATE SET canonical_name_zh_tw=excluded.canonical_name_zh_tw,
        game_release_id=excluded.game_release_id,is_active=1,verification_status=excluded.verification_status,data_version=excluded.data_version`,
        [termId,entity,row.name,RELEASE.release_id,masterVerificationStatus(row),CANONICAL_REGISTRY_VERSION]);
      db.run(`INSERT OR REPLACE INTO canonical_term_source(source_id,term_id,source_type,source_ref,observed_name,observed_at,confidence)
        VALUES(?,?,?,?,?,?,?)`,[`source:${termId}`,termId,row.source_type||'shared_master',row.source_ref||'',row.name,row.verified_at||RELEASE.effective_from,1]);
    }
  }

  for(const [alias,canonical] of Object.entries(INGREDIENT_ALIASES)){
    const term=db.prepare(`SELECT term_id FROM canonical_term WHERE entity_type='ingredient' AND canonical_name_zh_tw=? AND is_active=1`);
    term.bind([canonical]);
    const termId=term.step()?term.getAsObject().term_id:null;
    term.free();
    if(!termId) continue;
    const safe=SAFE_INGREDIENT_ALIASES.has(alias)?1:0;
    db.run(`INSERT OR REPLACE INTO canonical_term_alias(alias_id,term_id,alias_text,alias_type,locale,confidence,is_auto_replace_safe,source_type)
      VALUES(?,?,?,?,?,?,?,?)`,[`alias:ingredient:${alias}`,termId,alias,'ocr_ai_confusion','zh-Hant',safe?1:0.9,safe,'manual_verified_from_game_screenshot']);
  }

  // Recipe display-name compatibility is owned by the public recipe master.
  // ID aliases are for player-row joins only and therefore are not terminology aliases.
  const recipeAliases=[];
  try{
    const statement=db.prepare(`SELECT a.alias_value,a.confidence,a.is_auto_replace_safe,a.source_type,m.recipe_name
      FROM recipe_master_alias a JOIN recipe_master m ON m.recipe_id=a.recipe_id
      WHERE a.alias_type='legacy_recipe_name'`);
    while(statement.step())recipeAliases.push(statement.getAsObject());
    statement.free();
  }catch{
    // Pre-v0.4.2 databases have no recipe_master_alias until recipe sync runs.
  }
  for(const alias of recipeAliases){
    const termId=`recipe:${idPart(alias.recipe_name)}`;
    db.run(`INSERT OR REPLACE INTO canonical_term_alias(alias_id,term_id,alias_text,alias_type,locale,confidence,is_auto_replace_safe,source_type)
      VALUES(?,?,?,?,?,?,?,?)`,[
      `alias:recipe:${idPart(alias.alias_value)}`,termId,alias.alias_value,'legacy_recipe_name','zh-Hant',
      Number(alias.confidence||0),Number(alias.is_auto_replace_safe||0),alias.source_type||'public_recipe_master',
    ]);
  }

  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('canonical_registry_version',?,datetime('now'))`,[JSON.stringify(CANONICAL_REGISTRY_VERSION)]);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(6,datetime('now'))`);
}

export function resolveCanonicalTerm(db,{entityType,rawValue}){
  const raw=normalizedText(rawValue);
  if(!raw) return {raw_value:raw,canonical_value:'',resolution:CANONICAL_RESOLUTION_STATUSES.EMPTY,confidence:0,requires_review:true,commit_allowed:false};
  let statement=db.prepare(`SELECT term_id,canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1`);
  statement.bind([entityType,raw]);
  if(statement.step()){
    const row=statement.getAsObject();statement.free();
    return {raw_value:raw,canonical_value:row.canonical_name_zh_tw,term_id:row.term_id,resolution:CANONICAL_RESOLUTION_STATUSES.EXACT,confidence:1,requires_review:false,commit_allowed:true};
  }
  statement.free();
  statement=db.prepare(`SELECT t.term_id,t.canonical_name_zh_tw,a.confidence,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`);
  statement.bind([entityType,raw]);
  if(statement.step()){
    const row=statement.getAsObject();statement.free();
    const safe=Boolean(Number(row.is_auto_replace_safe));
    return {raw_value:raw,canonical_value:row.canonical_name_zh_tw,term_id:row.term_id,resolution:safe?CANONICAL_RESOLUTION_STATUSES.ALIAS_SAFE:CANONICAL_RESOLUTION_STATUSES.ALIAS_REVIEW,confidence:Number(row.confidence||0),requires_review:!safe,commit_allowed:safe};
  }
  statement.free();
  return {raw_value:raw,canonical_value:'',resolution:CANONICAL_RESOLUTION_STATUSES.UNKNOWN,confidence:0,requires_review:true,commit_allowed:false};
}

export function resolveAndRecordCanonicalTerm(db,{entityType,rawValue,sourceType='recognition',sourceRef='',evidenceRevision=''}){
  const result=resolveCanonicalTerm(db,{entityType,rawValue});
  const observedAt=nowIso();
  const resolutionId=makeResolutionId({entityType,rawValue:result.raw_value,sourceRef});
  db.run(`INSERT INTO canonical_resolution_log(
    resolution_id,entity_type,raw_text,normalized_text,resolution_status,term_id,canonical_name_zh_tw,
    confidence,requires_review,source_type,source_ref,evidence_revision,observed_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    resolutionId,entityType,String(rawValue??''),result.raw_value,result.resolution,result.term_id||null,
    result.canonical_value||null,result.confidence,result.requires_review?1:0,sourceType,sourceRef,evidenceRevision,observedAt,
  ]);
  if(result.resolution===CANONICAL_RESOLUTION_STATUSES.UNKNOWN||result.resolution===CANONICAL_RESOLUTION_STATUSES.ALIAS_REVIEW){
    const candidateId=`candidate:${entityType}:${idPart(result.raw_value)}`;
    db.run(`INSERT INTO canonical_alias_candidate(
      candidate_id,entity_type,raw_text,normalized_text,suggested_term_id,suggested_canonical_name_zh_tw,
      source_type,source_ref,evidence_revision,hit_count,first_seen_at,latest_seen_at,status
    ) VALUES(?,?,?,?,?,?,?,?,?,1,?,?, 'pending')
    ON CONFLICT(entity_type,normalized_text) DO UPDATE SET
      raw_text=excluded.raw_text,
      suggested_term_id=COALESCE(excluded.suggested_term_id,canonical_alias_candidate.suggested_term_id),
      suggested_canonical_name_zh_tw=COALESCE(excluded.suggested_canonical_name_zh_tw,canonical_alias_candidate.suggested_canonical_name_zh_tw),
      source_type=excluded.source_type,
      source_ref=excluded.source_ref,
      evidence_revision=excluded.evidence_revision,
      hit_count=canonical_alias_candidate.hit_count+1,
      latest_seen_at=excluded.latest_seen_at`,[
      candidateId,entityType,String(rawValue??''),result.raw_value,result.term_id||null,result.canonical_value||null,
      sourceType,sourceRef,evidenceRevision,observedAt,observedAt,
    ]);
  }
  return {...result,resolution_id:resolutionId,observed_at:observedAt};
}

export function markCanonicalResolutionCommitted(db,resolutionId){
  db.run(`UPDATE canonical_resolution_log SET committed_at=? WHERE resolution_id=? AND requires_review=0`,[nowIso(),resolutionId]);
}

export function listPendingCanonicalCandidates(db,{entityType=null,limit=200}={}){
  const safeLimit=Math.max(1,Math.min(1000,Number(limit)||200));
  const rows=[];
  const sql=entityType
    ? `SELECT * FROM canonical_alias_candidate WHERE status='pending' AND entity_type=? ORDER BY hit_count DESC,latest_seen_at DESC LIMIT ${safeLimit}`
    : `SELECT * FROM canonical_alias_candidate WHERE status='pending' ORDER BY hit_count DESC,latest_seen_at DESC LIMIT ${safeLimit}`;
  const statement=db.prepare(sql);
  if(entityType) statement.bind([entityType]);
  while(statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

export function buildCanonicalReviewModel(result){
  return {
    raw_value:result.raw_value,
    canonical_value:result.canonical_value,
    status:result.resolution,
    confidence:result.confidence,
    requires_review:Boolean(result.requires_review),
    commit_allowed:Boolean(result.commit_allowed),
    display_message:result.resolution===CANONICAL_RESOLUTION_STATUSES.EXACT
      ?'已符合正式名稱'
      :result.resolution===CANONICAL_RESOLUTION_STATUSES.ALIAS_SAFE
        ?`已安全正名為「${result.canonical_value}」`
        :result.resolution===CANONICAL_RESOLUTION_STATUSES.ALIAS_REVIEW
          ?`建議正名為「${result.canonical_value}」，需人工確認`
          :'無法對應公版正式名稱，已阻擋寫入並加入待覆核',
  };
}
