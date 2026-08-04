export const CANONICAL_REGISTRY_VERSION='canonical-registry-2026-08-04-a';

const RELEASE={
  release_id:'game-data-2026-08-04',
  game_version:'current-as-observed-2026-08-04',
  locale:'zh-Hant',
  effective_from:'2026-08-04',
  source_type:'game_screenshot_verified+official_announcement+raenonx_structured',
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

function q(value){return String(value).replaceAll("'","''");}

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
  db.run(`INSERT OR REPLACE INTO game_data_release(release_id,game_version,locale,effective_from,source_type,data_version,status)
    VALUES(?,?,?,?,?,?,?)`,[RELEASE.release_id,RELEASE.game_version,RELEASE.locale,RELEASE.effective_from,RELEASE.source_type,CANONICAL_REGISTRY_VERSION,'active']);

  const masters=[
    ['ingredient','ingredient_master','ingredient_name'],
    ['item','item_master','item_name'],
    ['recipe','recipe_master','recipe_name'],
    ['berry','berry_master','berry_name'],
  ];
  for(const [entity,table,column] of masters){
    const rows=[];
    const statement=db.prepare(`SELECT ${column} AS name,source_type,source_ref,verified_at FROM ${table}`);
    while(statement.step()) rows.push(statement.getAsObject());
    statement.free();
    for(const row of rows){
      const termId=`${entity}:${String(row.name).normalize('NFKC').toLowerCase().replace(/\s+/g,'-')}`;
      db.run(`INSERT INTO canonical_term(term_id,entity_type,canonical_name_zh_tw,game_release_id,is_active,verification_status,data_version)
        VALUES(?,?,?,?,1,?,?) ON CONFLICT(term_id) DO UPDATE SET canonical_name_zh_tw=excluded.canonical_name_zh_tw,
        game_release_id=excluded.game_release_id,is_active=1,verification_status=excluded.verification_status,data_version=excluded.data_version`,
        [termId,entity,row.name,RELEASE.release_id,row.source_type==='game_screenshot_verified'?'GAME_SCREENSHOT_VERIFIED':'REFERENCE_VERIFIED',CANONICAL_REGISTRY_VERSION]);
      db.run(`INSERT OR REPLACE INTO canonical_term_source(source_id,term_id,source_type,source_ref,observed_name,observed_at,confidence)
        VALUES(?,?,?,?,?,?,?)`,[`source:${termId}`,termId,row.source_type||'shared_master',row.source_ref||'',row.name,row.verified_at||RELEASE.effective_from,1]);
    }
  }
  for(const [alias,canonical] of Object.entries(INGREDIENT_ALIASES)){
    const term=db.prepare(`SELECT term_id FROM canonical_term WHERE entity_type='ingredient' AND canonical_name_zh_tw=?`);
    term.bind([canonical]);
    const termId=term.step()?term.getAsObject().term_id:null;
    term.free();
    if(!termId) continue;
    const safe=['辣味香草','品質雞蛋','特殊蛋','豆製香腸','豆製火腿'].includes(alias)?1:0;
    db.run(`INSERT OR REPLACE INTO canonical_term_alias(alias_id,term_id,alias_text,alias_type,locale,confidence,is_auto_replace_safe,source_type)
      VALUES(?,?,?,?,?,?,?,?)`,[`alias:ingredient:${alias}`,termId,alias,'ocr_ai_confusion','zh-Hant',safe?1:0.9,safe,'manual_verified_from_game_screenshot']);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('canonical_registry_version',?,datetime('now'))`,[JSON.stringify(CANONICAL_REGISTRY_VERSION)]);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(7,datetime('now'))`);
}

export function resolveCanonicalTerm(db,{entityType,rawValue}){
  const raw=String(rawValue??'').normalize('NFKC').trim();
  if(!raw) return {raw_value:raw,canonical_value:'',resolution:'EMPTY',confidence:0,requires_review:true};
  let s=db.prepare(`SELECT term_id,canonical_name_zh_tw FROM canonical_term WHERE entity_type=? AND canonical_name_zh_tw=? AND is_active=1`);
  s.bind([entityType,raw]);
  if(s.step()){
    const row=s.getAsObject();s.free();
    return {raw_value:raw,canonical_value:row.canonical_name_zh_tw,term_id:row.term_id,resolution:'CANONICAL_EXACT',confidence:1,requires_review:false};
  }
  s.free();
  s=db.prepare(`SELECT t.term_id,t.canonical_name_zh_tw,a.confidence,a.is_auto_replace_safe FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE t.entity_type=? AND a.alias_text=? AND a.locale='zh-Hant' AND t.is_active=1`);
  s.bind([entityType,raw]);
  if(s.step()){
    const row=s.getAsObject();s.free();
    return {raw_value:raw,canonical_value:row.canonical_name_zh_tw,term_id:row.term_id,resolution:row.is_auto_replace_safe?'CANONICAL_ALIAS_SAFE':'CANONICAL_ALIAS_REVIEW',confidence:Number(row.confidence||0),requires_review:!row.is_auto_replace_safe};
  }
  s.free();
  return {raw_value:raw,canonical_value:'',resolution:'CANONICAL_UNKNOWN',confidence:0,requires_review:true};
}
