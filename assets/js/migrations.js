import {applySharedMasterSchema} from './shared-master-schema.js';
import {applySharedMasterData,MASTER_DATA_VERSION} from './shared-master-data.js';
import {applyPublicEmptyProfileMaster} from './public-empty-profile-master.js';
import {PUBLIC_ITEM_MASTER_VERSION} from './public-item-master.js';
import {applyCanonicalRegistry,CANONICAL_REGISTRY_VERSION} from './canonical-registry.js';

function rows(db,sql,params=[]){const statement=db.prepare(sql);statement.bind(params);const output=[];while(statement.step())output.push(statement.getAsObject());statement.free();return output;}
function scalar(db,sql,params=[]){const result=rows(db,sql,params);return result.length?Object.values(result[0])[0]:null;}
function hasMigration(db,version){return Number(scalar(db,'SELECT COUNT(*) FROM schema_migrations WHERE version=?',[version])||0)>0;}
function tableColumns(db,table){return new Set(rows(db,`PRAGMA table_info("${table}")`).map(item=>item.name));}
function addColumnIfMissing(db,table,column,definition){if(!tableColumns(db,table).has(column)){db.run(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);return true;}return false;}
function settingValue(db,key){try{const raw=scalar(db,'SELECT value_json FROM settings WHERE key=?',[key]);return raw==null?null:JSON.parse(raw);}catch{return null;}}

export function applyIdentityMigration(db){
  addColumnIfMissing(db,'pokemon','pokemon_instance_id','TEXT');addColumnIfMissing(db,'pokemon','game_pokemon_id','TEXT');addColumnIfMissing(db,'pokemon','registered_at','TEXT');addColumnIfMissing(db,'pokemon','original_species','TEXT');addColumnIfMissing(db,'pokemon','current_species','TEXT');addColumnIfMissing(db,'pokemon','identity_fingerprint','TEXT');addColumnIfMissing(db,'pokemon','identity_confidence','REAL');addColumnIfMissing(db,'pokemon','identity_review_required','INTEGER NOT NULL DEFAULT 0');
  db.run(`UPDATE pokemon SET pokemon_instance_id=pokemon_id WHERE pokemon_instance_id IS NULL OR pokemon_instance_id=''`);db.run(`UPDATE pokemon SET current_species=species WHERE current_species IS NULL OR current_species=''`);db.run(`UPDATE pokemon SET original_species=species WHERE original_species IS NULL OR original_species=''`);db.run(`UPDATE pokemon SET registered_at=obtained_at WHERE (registered_at IS NULL OR registered_at='') AND obtained_at IS NOT NULL`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_instance_id ON pokemon(pokemon_instance_id) WHERE pokemon_instance_id IS NOT NULL AND pokemon_instance_id<>''`);db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_game_id ON pokemon(game_pokemon_id) WHERE game_pokemon_id IS NOT NULL AND game_pokemon_id<>''`);db.run(`CREATE INDEX IF NOT EXISTS idx_pokemon_identity_fingerprint ON pokemon(identity_fingerprint,registered_at)`);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'))`);
}
export function applyGameDataMigration(db){const hasSubskills=scalar(db,"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='pokemon_subskills'");if(hasSubskills){db.run(`INSERT OR REPLACE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) SELECT pokemon_id,70,subskill_name,is_unlocked FROM pokemon_subskills WHERE unlock_level=75`);db.run(`DELETE FROM pokemon_subskills WHERE unlock_level=75`);db.run(`INSERT OR REPLACE INTO pokemon_subskills(pokemon_id,unlock_level,subskill_name,is_unlocked) SELECT pokemon_id,80,subskill_name,is_unlocked FROM pokemon_subskills WHERE unlock_level=100`);db.run(`DELETE FROM pokemon_subskills WHERE unlock_level=100`);}db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(3,datetime('now'))`);}
export function applySharedKnowledgeBase(db){applySharedMasterSchema(db);applySharedMasterData(db);db.run(`UPDATE pokemon SET favorite_berry=(SELECT berry_name FROM berry_master WHERE type_name=pokemon.type) WHERE EXISTS(SELECT 1 FROM berry_master WHERE type_name=pokemon.type)`);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(4,datetime('now'))`);}
export function applyPersonalRecipeMigration(db){addColumnIfMissing(db,'recipes','recipe_level','INTEGER');addColumnIfMissing(db,'recipes','current_energy','INTEGER');addColumnIfMissing(db,'recipes','updated_at','TEXT');addColumnIfMissing(db,'recipes','notes','TEXT');db.run(`UPDATE recipes SET updated_at=datetime('now') WHERE updated_at IS NULL OR updated_at=''`);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(5,datetime('now'))`);}
export function applyPublicProfileContract(db){applyPublicEmptyProfileMaster(db);}
export function applyCanonicalTerminologyMigration(db){applyCanonicalRegistry(db);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(6,datetime('now'))`);}
export function applyCompletePokemonDetailMigration(db){addColumnIfMissing(db,'pokemon','sleep_hours','REAL');addColumnIfMissing(db,'pokemon','sleep_time_text','TEXT');addColumnIfMissing(db,'pokemon','evolution_level_required','INTEGER');addColumnIfMissing(db,'pokemon','evolution_sleep_hours_required','REAL');addColumnIfMissing(db,'pokemon','evolution_candy_required','INTEGER');addColumnIfMissing(db,'pokemon','evolution_item_required','TEXT');addColumnIfMissing(db,'pokemon','evolution_other_requirement','TEXT');addColumnIfMissing(db,'pokemon','main_skill_description','TEXT');addColumnIfMissing(db,'pokemon','field_evidence_json','TEXT');addColumnIfMissing(db,'pokemon','source_image_refs_json','TEXT');db.run(`CREATE TABLE IF NOT EXISTS pokemon_analysis_observation(observation_id TEXT PRIMARY KEY,pokemon_id TEXT,identity_group_key TEXT,source_image_ref TEXT NOT NULL,analysis_id TEXT,revision_no INTEGER,observed_json TEXT NOT NULL,canonical_json TEXT,conflict_json TEXT,created_at TEXT NOT NULL,applied_at TEXT)`);db.run(`CREATE INDEX IF NOT EXISTS idx_pokemon_analysis_observation_group ON pokemon_analysis_observation(identity_group_key,created_at)`);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(7,datetime('now'))`);}
export function applyStandardCatalogCompatibilityMigration(db){
  applySharedMasterSchema(db);
  const changed=addColumnIfMissing(db,'item_master','effect_description_zh_tw','TEXT');
  if(!changed)return false;
  db.run('DROP VIEW IF EXISTS item_catalog_state');
  db.run(`CREATE VIEW item_catalog_state AS SELECT m.item_name,m.item_category,m.effect_description_zh_tw,COALESCE(i.quantity,0) quantity,COALESCE(i.safe_reserve,0) safe_reserve,i.recommendation,CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END player_record_exists,i.updated_at,m.data_version FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name`);
  return true;
}

export function auditAndSyncPublicMasters(db,{force=false}={}){
  applySharedMasterSchema(db);
  const applied={
    shared:settingValue(db,'shared_master_version'),
    items:settingValue(db,'public_item_master_version'),
    canonical:settingValue(db,'canonical_registry_version'),
  };
  const expected={shared:MASTER_DATA_VERSION,items:PUBLIC_ITEM_MASTER_VERSION,canonical:CANONICAL_REGISTRY_VERSION};
  const updated=[];
  if(force||applied.shared!==expected.shared){applySharedMasterData(db);updated.push('shared');}
  if(force||applied.items!==expected.items){applyPublicEmptyProfileMaster(db);updated.push('items');}
  if(force||updated.length>0||applied.canonical!==expected.canonical){applyCanonicalRegistry(db);updated.push('canonical');}
  return {updated:updated.length>0,updated_authorities:updated,applied,expected};
}

export function applyFreshDatabaseBootstrap(db){
  applySharedMasterSchema(db);
  applyIdentityMigration(db);applyGameDataMigration(db);applyPersonalRecipeMigration(db);applyCompletePokemonDetailMigration(db);applyStandardCatalogCompatibilityMigration(db);
  db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(4,datetime('now'))`);db.run(`INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(6,datetime('now'))`);
  const publicMaster=auditAndSyncPublicMasters(db,{force:true});
  return {database_changed:true,public_master:publicMaster};
}

export function applyAllMigrations(db){
  let databaseChanged=false;
  if(!hasMigration(db,2)){applyIdentityMigration(db);databaseChanged=true;}
  if(!hasMigration(db,3)){applyGameDataMigration(db);databaseChanged=true;}
  if(!hasMigration(db,4)){applySharedKnowledgeBase(db);databaseChanged=true;}
  if(!hasMigration(db,5)){applyPersonalRecipeMigration(db);databaseChanged=true;}
  if(!hasMigration(db,6)){applyPublicProfileContract(db);applyCanonicalTerminologyMigration(db);databaseChanged=true;}
  if(!hasMigration(db,7)){applyCompletePokemonDetailMigration(db);databaseChanged=true;}
  if(applyStandardCatalogCompatibilityMigration(db))databaseChanged=true;
  const publicMaster=auditAndSyncPublicMasters(db);
  return {database_changed:databaseChanged||publicMaster.updated,public_master:publicMaster};
}
