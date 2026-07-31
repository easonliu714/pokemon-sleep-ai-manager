import {loadDatabaseBytes,saveDatabaseBytes,createSnapshot} from './storage.js';
import {DDL,SEED_SQL} from './schema.js';
import {applyG2ASeed} from './seed-data.js';
import {applySharedMasterSchema} from './shared-master-schema.js';
import {applySharedMasterData} from './shared-master-data.js';
let SQL=null,db=null;

function tableColumns(table){
  return new Set(rows(`PRAGMA table_info("${table}")`).map(x=>x.name));
}

function addColumnIfMissing(table,column,definition){
  const columns=tableColumns(table);
  if(!columns.has(column)) db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}

function applyIdentityMigration(){
  addColumnIfMissing('pokemon','pokemon_instance_id','TEXT');
  addColumnIfMissing('pokemon','game_pokemon_id','TEXT');
  addColumnIfMissing('pokemon','registered_at','TEXT');
  addColumnIfMissing('pokemon','original_species','TEXT');
  addColumnIfMissing('pokemon','current_species','TEXT');
  addColumnIfMissing('pokemon','identity_fingerprint','TEXT');
  addColumnIfMissing('pokemon','identity_confidence','REAL');
  addColumnIfMissing('pokemon','identity_review_required','INTEGER NOT NULL DEFAULT 0');

  db.run(`UPDATE pokemon SET pokemon_instance_id=pokemon_id WHERE pokemon_instance_id IS NULL OR pokemon_instance_id=''`);
  db.run(`UPDATE pokemon SET current_species=species WHERE current_species IS NULL OR current_species=''`);
  db.run(`UPDATE pokemon SET original_species=species WHERE original_species IS NULL OR original_species=''`);
  db.run(`UPDATE pokemon SET registered_at=obtained_at WHERE (registered_at IS NULL OR registered_at='') AND obtained_at IS NOT NULL`);

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_instance_id ON pokemon(pokemon_instance_id) WHERE pokemon_instance_id IS NOT NULL AND pokemon_instance_id<>''`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_game_id ON pokemon(game_pokemon_id) WHERE game_pokemon_id IS NOT NULL AND game_pokemon_id<>''`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pokemon_identity_fingerprint ON pokemon(identity_fingerprint,registered_at)`);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'))`);
}

function applyGameDataMigration(){
  const hasSubskills=scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='pokemon_subskills'");
  if(hasSubskills){
    db.run(`INSERT OR REPLACE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked)
      SELECT pokemon_id,70,subskill_name,is_unlocked FROM pokemon_subskills WHERE unlock_level=75`);
    db.run(`DELETE FROM pokemon_subskills WHERE unlock_level=75`);
    db.run(`INSERT OR REPLACE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked)
      SELECT pokemon_id,80,subskill_name,is_unlocked FROM pokemon_subskills WHERE unlock_level=100`);
    db.run(`DELETE FROM pokemon_subskills WHERE unlock_level=100`);
  }
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(3,datetime('now'))`);
}

function applySharedKnowledgeBase(){
  applySharedMasterSchema(db);
  applySharedMasterData(db);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(4,datetime('now'))`);
}

export async function initializeDatabase(){
  if(typeof initSqlJs!=='function') throw new Error('sql.js 載入失敗，請確認網路後重新整理');
  SQL=await initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`});
  const bytes=await loadDatabaseBytes();
  db=bytes?new SQL.Database(new Uint8Array(bytes)):new SQL.Database();
  db.run(DDL);
  if((scalar('SELECT COUNT(*) FROM schema_migrations')||0)===0) db.run(SEED_SQL);
  applyIdentityMigration();
  applyGameDataMigration();
  applySharedKnowledgeBase();
  const seeded=applyG2ASeed(db);
  await persist();
  return {seeded};
}
export function rows(sql,params=[]){const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;}
export function scalar(sql,params=[]){const r=rows(sql,params);return r.length?Object.values(r[0])[0]:null;}
export function run(sql,params=[]){db.run(sql,params);}
export async function persist(){await saveDatabaseBytes(db.export());}
export async function snapshot(reason){return createSnapshot(db.export(),reason);}
export function exportBytes(){return db.export();}
export async function replaceDatabase(bytes){
  if(db)db.close();
  db=new SQL.Database(bytes);
  const check=rows('PRAGMA integrity_check');
  if(!check.length||check[0].integrity_check!=='ok') throw new Error('SQLite integrity_check 未通過');
  db.run(DDL);
  applyIdentityMigration();
  applyGameDataMigration();
  applySharedKnowledgeBase();
  applyG2ASeed(db);
  await persist();
}
export function begin(){run('BEGIN IMMEDIATE');}
export function commit(){run('COMMIT');}
export function rollback(){try{run('ROLLBACK')}catch{}}
