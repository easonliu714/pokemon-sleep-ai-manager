function hasColumn(db,table,column){
  const statement=db.prepare(`PRAGMA table_info("${table}")`);const names=[];
  while(statement.step())names.push(statement.getAsObject().name);statement.free();return names.includes(column);
}

export function applySharedMasterSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS berry_master(
    type_name TEXT PRIMARY KEY,
    berry_name TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_ref TEXT,
    verified_at TEXT,
    data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ingredient_master(
    ingredient_name TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_ref TEXT,
    verified_at TEXT,
    data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS item_master(
    item_name TEXT PRIMARY KEY,
    item_category TEXT,
    effect_description_zh_tw TEXT,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_ref TEXT,
    verified_at TEXT,
    data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS recipe_master(
    recipe_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    recipe_name TEXT NOT NULL UNIQUE,
    base_energy INTEGER,
    total_ingredients INTEGER NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_ref TEXT,
    verified_at TEXT,
    data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS recipe_master_ingredients(
    recipe_id TEXT NOT NULL,
    ingredient_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY(recipe_id,ingredient_name)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_recipe_master_category ON recipe_master(category,base_energy DESC)');

  const ingredientUnlockProjection=hasColumn(db,'ingredient_inventory','unlocked');
  db.run('DROP VIEW IF EXISTS ingredient_catalog_state');
  db.run(ingredientUnlockProjection?`CREATE VIEW IF NOT EXISTS ingredient_catalog_state AS
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
      LEFT JOIN ingredient_inventory i ON i.ingredient_name=m.ingredient_name`:`CREATE VIEW IF NOT EXISTS ingredient_catalog_state AS
    SELECT m.ingredient_name,
           COALESCE(i.quantity,0) AS quantity,
           NULL AS stored_unlocked,
           CASE WHEN i.ingredient_name IS NOT NULL AND COALESCE(i.quantity,0)>0 THEN 1 ELSE NULL END AS unlocked,
           CASE
             WHEN i.ingredient_name IS NULL THEN 'NO_PLAYER_RECORD'
             WHEN COALESCE(i.quantity,0)>0 THEN 'UNLOCKED'
             ELSE 'UNKNOWN'
           END AS unlock_state,
           CASE WHEN i.ingredient_name IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           i.updated_at,
           m.data_version
      FROM ingredient_master m
      LEFT JOIN ingredient_inventory i ON i.ingredient_name=m.ingredient_name`);
  db.run(`CREATE VIEW IF NOT EXISTS item_catalog_state AS
    SELECT m.item_name,m.item_category,m.effect_description_zh_tw,
           COALESCE(i.quantity,0) AS quantity,
           COALESCE(i.safe_reserve,0) AS safe_reserve,
           i.recommendation,
           CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           i.updated_at,
           m.data_version
      FROM item_master m
      LEFT JOIN item_inventory i ON i.item_name=m.item_name`);
  db.run(`CREATE VIEW IF NOT EXISTS recipe_catalog_state AS
    SELECT m.recipe_id,m.category,m.recipe_name,m.base_energy,m.total_ingredients,
           COALESCE(r.unlocked,0) AS unlocked,
           r.recipe_level,r.current_energy,r.updated_at,r.notes,
           CASE WHEN r.recipe_id IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           m.data_version
      FROM recipe_master m
      LEFT JOIN recipes r ON r.recipe_id=m.recipe_id`);
}
