export const DDL=`
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS account_capacity(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER NOT NULL,used_count INTEGER,updated_at TEXT NOT NULL,source TEXT);
CREATE TABLE IF NOT EXISTS pokemon(
  pokemon_id TEXT PRIMARY KEY,
  pokemon_instance_id TEXT,
  game_pokemon_id TEXT,
  registered_at TEXT,
  original_species TEXT,
  current_species TEXT,
  identity_fingerprint TEXT,
  identity_confidence REAL,
  identity_review_required INTEGER NOT NULL DEFAULT 0,
  species TEXT NOT NULL,
  original_label TEXT,
  nickname TEXT,
  nickname_halfwidth_units INTEGER,
  nickname_valid INTEGER NOT NULL DEFAULT 1,
  level INTEGER,
  sp INTEGER,
  specialty TEXT,
  type TEXT,
  nature TEXT,
  nature_bonus TEXT,
  nature_penalty TEXT,
  main_skill TEXT,
  main_skill_level INTEGER,
  helper_seconds INTEGER,
  carry_limit INTEGER,
  favorite_berry TEXT,
  rating TEXT,
  ai_score REAL,
  status TEXT NOT NULL DEFAULT 'active',
  core_role TEXT,
  recommendation TEXT,
  item_advice TEXT,
  scenarios TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_main INTEGER NOT NULL DEFAULT 0,
  obtained_at TEXT,
  last_updated_at TEXT NOT NULL,
  source_update_id TEXT
);
CREATE TABLE IF NOT EXISTS pokemon_subskills(pokemon_id TEXT NOT NULL,unlock_level INTEGER NOT NULL,subskill_name TEXT NOT NULL,is_unlocked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(pokemon_id,unlock_level));
CREATE TABLE IF NOT EXISTS pokemon_ingredients(pokemon_id TEXT NOT NULL,unlock_level INTEGER NOT NULL,ingredient_name TEXT NOT NULL,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level));
CREATE TABLE IF NOT EXISTS pokemon_history(history_id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT NOT NULL,event_type TEXT NOT NULL,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS pokemon_evolution_history(evolution_id TEXT PRIMARY KEY,pokemon_instance_id TEXT NOT NULL,from_species TEXT,to_species TEXT NOT NULL,evolved_at TEXT,source_image_ref TEXT,confidence REAL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS pokemon_identity_evidence(evidence_id TEXT PRIMARY KEY,pokemon_instance_id TEXT NOT NULL,evidence_type TEXT NOT NULL,evidence_value TEXT,source_image_ref TEXT,confidence REAL,observed_at TEXT,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS discarded_pokemon(discard_id TEXT PRIMARY KEY,species TEXT NOT NULL,observed_json TEXT,reason TEXT NOT NULL,discarded_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS item_inventory(item_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,safe_reserve INTEGER NOT NULL DEFAULT 0,recommendation TEXT,updated_at TEXT NOT NULL,source_update_id TEXT);
CREATE TABLE IF NOT EXISTS recipes(recipe_id TEXT PRIMARY KEY,category TEXT NOT NULL,recipe_name TEXT NOT NULL UNIQUE,unlocked INTEGER NOT NULL DEFAULT 0,total_ingredients INTEGER NOT NULL DEFAULT 0,source TEXT);
CREATE TABLE IF NOT EXISTS recipe_ingredients(recipe_id TEXT NOT NULL,ingredient_name TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(recipe_id,ingredient_name));
CREATE TABLE IF NOT EXISTS weekly_plan(plan_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_summary TEXT,target_summary TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_context(context_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,camp TEXT,dish_category TEXT,favorite_berry_1 TEXT,favorite_berry_2 TEXT,favorite_berry_3 TEXT,event_name TEXT,event_effects TEXT,pot_size INTEGER,base_notes TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS weekly_strategy(strategy_id TEXT PRIMARY KEY,week_start TEXT NOT NULL,team_summary TEXT,substitution_rules TEXT,time_schedule TEXT,meal_strategy TEXT,ingredient_estimate REAL,berry_estimate REAL,shard_estimate REAL,snorlax_energy_estimate REAL,assumptions TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS strategy_goal_profile(
  goal_profile_id TEXT PRIMARY KEY,
  profile_name TEXT,
  primary_goal TEXT NOT NULL,
  secondary_goals_json TEXT NOT NULL DEFAULT '[]',
  weights_json TEXT NOT NULL DEFAULT '{}',
  hard_constraints_json TEXT NOT NULL DEFAULT '{}',
  profile_version TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strategy_goal_profile_active ON strategy_goal_profile(is_active,updated_at);
CREATE TABLE IF NOT EXISTS pokemon_evaluation_snapshot(
  evaluation_id TEXT PRIMARY KEY,
  pokemon_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  context_id TEXT,
  goal_profile_id TEXT,
  master_versions_json TEXT NOT NULL DEFAULT '{}',
  rule_version TEXT NOT NULL,
  intrinsic_score REAL,
  current_readiness_score REAL,
  weekly_fit_score REAL,
  roster_marginal_value_score REAL,
  training_roi_score REAL,
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  missing_inputs_json TEXT NOT NULL DEFAULT '[]',
  hard_constraint_status TEXT NOT NULL DEFAULT 'REVIEW',
  failed_constraints_json TEXT NOT NULL DEFAULT '[]',
  evaluation_status TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  stale_at TEXT,
  UNIQUE(pokemon_id,input_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_pokemon_evaluation_snapshot_current ON pokemon_evaluation_snapshot(pokemon_id,stale_at,evaluated_at);
CREATE INDEX IF NOT EXISTS idx_pokemon_evaluation_snapshot_fingerprint ON pokemon_evaluation_snapshot(input_fingerprint);
CREATE TABLE IF NOT EXISTS collection_targets(target_id TEXT PRIMARY KEY,species TEXT NOT NULL,target_type TEXT,priority TEXT,camp TEXT,desired_traits TEXT,capture_strategy TEXT,status TEXT,notes TEXT,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT NOT NULL,generated_at TEXT NOT NULL,imported_at TEXT NOT NULL,source TEXT,operation_count INTEGER NOT NULL,result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_changes(id INTEGER PRIMARY KEY AUTOINCREMENT,update_id TEXT NOT NULL,operation_index INTEGER NOT NULL,entity TEXT NOT NULL,action TEXT NOT NULL,key_json TEXT NOT NULL,before_json TEXT,after_json TEXT,status TEXT NOT NULL,message TEXT);
`;

// Public deployments seed schema only. Official game terms are populated by
// shared master migrations; player-owned quantities, unlocks and capacities
// must originate from local user input/import and are never preloaded.
export const SEED_SQL=`
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
`;
