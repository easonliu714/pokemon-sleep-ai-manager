export const DDL=`
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER NOT NULL,used_count INTEGER,updated_at TEXT NOT NULL,source TEXT);
CREATE TABLE IF NOT EXISTS pokemon(pokemon_id TEXT PRIMARY KEY,species TEXT NOT NULL,original_label TEXT,nickname TEXT,nickname_halfwidth_units INTEGER,nickname_valid INTEGER NOT NULL DEFAULT 1,level INTEGER,sp INTEGER,specialty TEXT,type TEXT,nature TEXT,nature_bonus TEXT,nature_penalty TEXT,main_skill TEXT,main_skill_level INTEGER,helper_seconds INTEGER,carry_limit INTEGER,favorite_berry TEXT,rating TEXT,ai_score REAL,status TEXT NOT NULL DEFAULT 'active',core_role TEXT,recommendation TEXT,item_advice TEXT,scenarios TEXT,is_favorite INTEGER NOT NULL DEFAULT 0,is_main INTEGER NOT NULL DEFAULT 0,obtained_at TEXT,last_updated_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS pokemon_subskills(pokemon_id TEXT NOT NULL,unlock_level INTEGER NOT NULL,subskill_name TEXT NOT NULL,is_unlocked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(pokemon_id,unlock_level));
CREATE TABLE IF NOT EXISTS pokemon_ingredients(pokemon_id TEXT NOT NULL,unlock_level INTEGER NOT NULL,ingredient_name TEXT NOT NULL,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level));
CREATE TABLE IF NOT EXISTS pokemon_history(history_id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT NOT NULL,event_type TEXT NOT NULL,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS discarded_pokemon(discard_id TEXT PRIMARY KEY,species TEXT NOT NULL,observed_json TEXT,reason TEXT NOT NULL,discarded_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS item_inventory(item_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,safe_reserve INTEGER NOT NULL DEFAULT 0,recommendation TEXT,updated_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS recipes(recipe_id TEXT PRIMARY KEY,category TEXT NOT NULL,recipe_name TEXT NOT NULL UNIQUE,unlocked INTEGER NOT NULL DEFAULT 0,total_ingredients INTEGER NOT NULL DEFAULT 0,source TEXT);
CREATE TABLE IF NOT EXISTS recipe_ingredients(recipe_id TEXT NOT NULL,ingredient_name TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(recipe_id,ingredient_name));
CREATE TABLE IF NOT EXISTS weekly_plan(plan_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_summary TEXT,target_summary TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT NOT NULL,generated_at TEXT NOT NULL,imported_at TEXT NOT NULL,source TEXT,operation_count INTEGER NOT NULL,result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_changes(id INTEGER PRIMARY KEY AUTOINCREMENT,update_id TEXT NOT NULL,operation_index INTEGER NOT NULL,entity TEXT NOT NULL,action TEXT NOT NULL,key_json TEXT NOT NULL,before_json TEXT,after_json TEXT,status TEXT NOT NULL,message TEXT);
`;
export const SEED_SQL=`
INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));
INSERT OR IGNORE INTO account_capacity VALUES('pot',57,NULL,datetime('now'),'Phase A'),('ingredient_bag',380,292,datetime('now'),'Phase A'),('item_bag',220,174,datetime('now'),'Phase A'),('pokemon_box',120,75,datetime('now'),'Phase A');
INSERT OR IGNORE INTO ingredient_inventory VALUES('沉甸甸南瓜',9,datetime('now'),'SEED-PHASE-A'),('醒腦咖啡豆',16,datetime('now'),'SEED-PHASE-A'),('萌綠玉米',21,datetime('now'),'SEED-PHASE-A'),('萌綠大豆',6,datetime('now'),'SEED-PHASE-A'),('放鬆可可',26,datetime('now'),'SEED-PHASE-A'),('好眠番茄',3,datetime('now'),'SEED-PHASE-A'),('暖暖薑',29,datetime('now'),'SEED-PHASE-A'),('純粹油',6,datetime('now'),'SEED-PHASE-A'),('甜甜蜜',113,datetime('now'),'SEED-PHASE-A'),('哞哞鮮奶',10,datetime('now'),'SEED-PHASE-A'),('豆製肉',7,datetime('now'),'SEED-PHASE-A'),('火辣香草',21,datetime('now'),'SEED-PHASE-A'),('特選蘋果',7,datetime('now'),'SEED-PHASE-A'),('窩心洋芋',8,datetime('now'),'SEED-PHASE-A'),('特選蛋',1,datetime('now'),'SEED-PHASE-A'),('粗枝大蔥',9,datetime('now'),'SEED-PHASE-A'),('品鮮蘑菇',0,datetime('now'),'SEED-PHASE-A'),('美味尾巴',0,datetime('now'),'SEED-PHASE-A'),('特選酪梨',0,datetime('now'),'SEED-PHASE-A');
`;
