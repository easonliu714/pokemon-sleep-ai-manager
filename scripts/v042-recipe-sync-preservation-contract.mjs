import path from 'node:path';
import initSqlJs from 'sql.js';
import {DDL,SEED_SQL} from '../assets/js/schema.js';
import {applySharedMasterSchema} from '../assets/js/shared-master-schema.js';
import {syncPublicRecipeMaster} from '../assets/js/public-recipe-master-sync.js';
import {PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-current-authority.js';

const SQL=await initSqlJs({locateFile:file=>path.resolve('node_modules/sql.js/dist',file)});
const db=new SQL.Database();
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const query=(sql,params=[])=>{const statement=db.prepare(sql);statement.bind(params);const out=[];while(statement.step())out.push(statement.getAsObject());statement.free();return out;};
const one=(sql,params=[])=>query(sql,params)[0]||null;

db.run(DDL);
db.run(SEED_SQL);
applySharedMasterSchema(db);
for(const [column,definition] of [
  ['recipe_level','INTEGER'],['current_energy','INTEGER'],['updated_at','TEXT'],['notes','TEXT'],
]){
  const exists=query('PRAGMA table_info(recipes)').some(row=>row.name===column);
  if(!exists)db.run(`ALTER TABLE recipes ADD COLUMN ${column} ${definition}`);
}

// Simulate known historical public-master shapes plus one unrecognized future row.
db.run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['recipe_public_cda4c4be','咖哩／濃湯','忍者咖哩',null,50,'legacy','v0383','legacy:v0383',null,'legacy-v0383']);
db.run(`INSERT INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)`,['recipe_public_cda4c4be','火辣香草',5]);
db.run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['curry_dream_eater','咖哩／濃湯','夢食奶油咖哩',9010,55,'legacy','v0.4.2','legacy:v042',null,'public-recipe-master-2026-08-09-a']);
db.run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['curry_soft_corn','咖哩／濃湯','玉米濃湯',4670,30,'legacy','v0.4.2','legacy:v042',null,'public-recipe-master-2026-08-09-a']);
db.run(`INSERT INTO recipe_master(recipe_id,category,recipe_name,base_energy,total_ingredients,source_type,source_name,source_ref,verified_at,data_version)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['future_unknown_recipe','沙拉','未辨識保留料理',1,1,'future','unknown-fixture','fixture:unknown',null,'future-version']);

// Player state intentionally uses old IDs/names and must survive byte-for-byte unchanged.
db.run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['recipe_public_cda4c4be','咖哩／濃湯','忍者咖哩',1,50,'player',12,12345,'2026-08-01T00:00:00+08:00','keep-ninja']);
db.run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['curry_dream_eater','咖哩／濃湯','夢食奶油咖哩',1,55,'player',8,9999,'2026-08-02T00:00:00+08:00','keep-dream-v042-name']);
db.run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
  VALUES(?,?,?,?,?,?,?,?,?,?)`,['curry_soft_corn','咖哩／濃湯','玉米濃湯',1,30,'player',5,4567,'2026-08-03T00:00:00+08:00','keep-corn-v042-name']);

const playerBefore=JSON.stringify(query('SELECT * FROM recipes ORDER BY recipe_id'));
const first=syncPublicRecipeMaster(db);
const playerAfterFirst=JSON.stringify(query('SELECT * FROM recipes ORDER BY recipe_id'));
assert(playerAfterFirst===playerBefore,'player_recipe_rows_changed_on_first_sync');
assert(first.player_rows_modified===false,'sync_report_player_write_true');
assert(first.retired_legacy_rows.some(row=>row.legacy_recipe_id==='recipe_public_cda4c4be'&&row.canonical_recipe_id==='curry_ninja'),'legacy_hash_master_not_retired');
assert(first.preserved_unrecognized_master_rows.some(row=>row.recipe_id==='future_unknown_recipe'),'unrecognized_master_not_preserved');

const ninjaMaster=one('SELECT * FROM recipe_master WHERE recipe_id=?',['curry_ninja']);
assert(ninjaMaster?.recipe_name==='忍者咖哩','canonical_ninja_master_missing');
assert(!one('SELECT * FROM recipe_master WHERE recipe_id=?',['recipe_public_cda4c4be']),'legacy_hash_master_still_active');
const dreamMaster=one('SELECT * FROM recipe_master WHERE recipe_id=?',['curry_dream_eater']);
assert(dreamMaster?.recipe_name==='絕對睡眠奶油咖哩','v043_dream_name_not_canonicalized');
const cornMaster=one('SELECT * FROM recipe_master WHERE recipe_id=?',['curry_soft_corn']);
assert(cornMaster?.recipe_name==='柔軟玉米濃湯','v043_corn_name_not_canonicalized');
assert(one('SELECT * FROM recipe_master WHERE recipe_id=?',['future_unknown_recipe'])?.recipe_name==='未辨識保留料理','unknown_master_removed');

const ninjaView=one('SELECT * FROM recipe_catalog_state WHERE recipe_id=?',['curry_ninja']);
assert(ninjaView?.player_recipe_id==='recipe_public_cda4c4be','legacy_player_id_not_resolved');
assert(Number(ninjaView?.unlocked)===1&&Number(ninjaView?.recipe_level)===12&&Number(ninjaView?.current_energy)===12345&&ninjaView?.notes==='keep-ninja','legacy_player_state_projection_mismatch');
const dreamView=one('SELECT * FROM recipe_catalog_state WHERE recipe_id=?',['curry_dream_eater']);
assert(dreamView?.recipe_name==='絕對睡眠奶油咖哩','dream_view_not_new_canonical_name');
assert(dreamView?.player_recipe_id==='curry_dream_eater','dream_player_id_not_preserved');
assert(Number(dreamView?.unlocked)===1&&Number(dreamView?.recipe_level)===8&&Number(dreamView?.current_energy)===9999&&dreamView?.notes==='keep-dream-v042-name','dream_player_state_projection_mismatch');
const cornView=one('SELECT * FROM recipe_catalog_state WHERE recipe_id=?',['curry_soft_corn']);
assert(cornView?.recipe_name==='柔軟玉米濃湯','corn_view_not_new_canonical_name');
assert(cornView?.player_recipe_id==='curry_soft_corn','corn_player_id_not_preserved');
assert(Number(cornView?.unlocked)===1&&Number(cornView?.recipe_level)===5&&Number(cornView?.current_energy)===4567&&cornView?.notes==='keep-corn-v042-name','corn_player_state_projection_mismatch');

const second=syncPublicRecipeMaster(db);
const playerAfterSecond=JSON.stringify(query('SELECT * FROM recipes ORDER BY recipe_id'));
assert(playerAfterSecond===playerBefore,'player_recipe_rows_changed_on_second_sync');
assert(second.retired_legacy_rows.length===0,'second_sync_not_idempotent_for_legacy_retirement');
assert(query('SELECT recipe_id FROM recipe_master WHERE recipe_id=?',['curry_ninja']).length===1,'canonical_recipe_duplicated');
assert(query('SELECT recipe_id FROM recipe_master WHERE recipe_id=?',['curry_dream_eater']).length===1,'renamed_dream_recipe_duplicated');
assert(query('SELECT recipe_id FROM recipe_master WHERE recipe_id=?',['curry_soft_corn']).length===1,'renamed_corn_recipe_duplicated');
assert(query('SELECT recipe_id FROM recipe_master WHERE recipe_id=?',['future_unknown_recipe']).length===1,'preserved_unknown_duplicated_or_removed');

const version=JSON.parse(one("SELECT value_json FROM settings WHERE key='public_recipe_master_version'")?.value_json||'null');
assert(version===PUBLIC_RECIPE_MASTER_VERSION,'recipe_master_version_not_recorded');
const syncReport=JSON.parse(one("SELECT value_json FROM settings WHERE key='public_recipe_master_sync_report'")?.value_json||'null');
assert(syncReport?.player_rows_modified===false,'persisted_sync_report_player_write_true');
assert(syncReport?.preserved_unrecognized_master_rows?.some(row=>row.recipe_id==='future_unknown_recipe'),'persisted_sync_report_missing_preserved_unknown');

console.log(JSON.stringify({
  status:'PASS',
  schema:'pokemon-sleep-recipe-sync-preservation-contract/1.2',
  master_version:PUBLIC_RECIPE_MASTER_VERSION,
  player_rows_before:JSON.parse(playerBefore).length,
  player_rows_after:query('SELECT * FROM recipes').length,
  player_rows_modified:false,
  legacy_hash_retired:true,
  v042_player_names_preserved:true,
  current_master_names_projected:true,
  unrecognized_master_preserved:true,
  legacy_player_projection_resolved:true,
  second_sync_idempotent:true,
},null,2));
