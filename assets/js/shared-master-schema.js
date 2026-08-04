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
}
