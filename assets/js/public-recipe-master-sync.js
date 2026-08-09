import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_ALIASES,
  PUBLIC_RECIPE_MASTER_VERSION,
} from './public-recipe-master.js';

function queryRows(db,sql,params=[]){
  const statement=db.prepare(sql);
  statement.bind(params);
  const output=[];
  while(statement.step())output.push(statement.getAsObject());
  statement.free();
  return output;
}

function recreateRecipeCatalogView(db){
  db.run('DROP VIEW IF EXISTS recipe_catalog_state');
  // Keep player/master identity compatibility explicit instead of relying on
  // nested correlated subqueries. SQLite/SQL.js can then resolve the view
  // consistently in fresh, upgraded and restored databases.
  db.run(`CREATE VIEW recipe_catalog_state AS
    WITH candidate_matches AS (
      SELECT m.recipe_id AS master_recipe_id,r.recipe_id AS player_recipe_id,
             r.unlocked,r.recipe_level,r.current_energy,r.updated_at,r.notes,0 AS match_priority
        FROM recipe_master m JOIN recipes r ON r.recipe_id=m.recipe_id
      UNION ALL
      SELECT m.recipe_id,r.recipe_id,r.unlocked,r.recipe_level,r.current_energy,r.updated_at,r.notes,1
        FROM recipe_master m JOIN recipes r ON r.recipe_name=m.recipe_name
       WHERE r.recipe_id<>m.recipe_id
      UNION ALL
      SELECT m.recipe_id,r.recipe_id,r.unlocked,r.recipe_level,r.current_energy,r.updated_at,r.notes,2
        FROM recipe_master m
        JOIN recipe_master_alias a ON a.recipe_id=m.recipe_id AND a.alias_type='legacy_recipe_id'
        JOIN recipes r ON r.recipe_id=a.alias_value
       WHERE r.recipe_id<>m.recipe_id
      UNION ALL
      SELECT m.recipe_id,r.recipe_id,r.unlocked,r.recipe_level,r.current_energy,r.updated_at,r.notes,3
        FROM recipe_master m
        JOIN recipe_master_alias a ON a.recipe_id=m.recipe_id AND a.alias_type='legacy_recipe_name'
        JOIN recipes r ON r.recipe_name=a.alias_value
       WHERE r.recipe_id<>m.recipe_id AND r.recipe_name<>m.recipe_name
    ),
    ranked_matches AS (
      SELECT candidate_matches.*,
             ROW_NUMBER() OVER(
               PARTITION BY master_recipe_id
               ORDER BY match_priority,player_recipe_id
             ) AS match_rank
        FROM candidate_matches
    ),
    chosen_matches AS (
      SELECT * FROM ranked_matches WHERE match_rank=1
    ),
    matched_player_ids AS (
      SELECT DISTINCT player_recipe_id FROM candidate_matches
    )
    SELECT m.recipe_id,m.category,m.recipe_name,m.base_energy,m.total_ingredients,
           COALESCE(c.unlocked,0) AS unlocked,
           COALESCE(c.recipe_level,1) AS recipe_level,
           c.current_energy,c.updated_at,c.notes,c.player_recipe_id,
           CASE WHEN c.player_recipe_id IS NULL THEN 0 ELSE 1 END AS player_record_exists,
           m.data_version
      FROM recipe_master m
      LEFT JOIN chosen_matches c ON c.master_recipe_id=m.recipe_id
    UNION ALL
    SELECT r.recipe_id,r.category,r.recipe_name,NULL,COALESCE(r.total_ingredients,0),
           COALESCE(r.unlocked,0),COALESCE(r.recipe_level,1),r.current_energy,r.updated_at,r.notes,
           r.recipe_id,1,'PLAYER_ONLY'
      FROM recipes r
     WHERE NOT EXISTS(
       SELECT 1 FROM matched_player_ids p WHERE p.player_recipe_id=r.recipe_id
     )`);
}

function ensureAliasSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS recipe_master_alias(
    alias_value TEXT NOT NULL,
    alias_type TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1,
    is_auto_replace_safe INTEGER NOT NULL DEFAULT 0,
    source_type TEXT,
    data_version TEXT NOT NULL,
    PRIMARY KEY(alias_value,alias_type)
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_recipe_master_alias_recipe ON recipe_master_alias(recipe_id,alias_type)');
}

function upsertAliases(db){
  for(const alias of PUBLIC_RECIPE_ALIASES){
    db.run(`INSERT INTO recipe_master_alias(
      alias_value,alias_type,recipe_id,confidence,is_auto_replace_safe,source_type,data_version
    ) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(alias_value,alias_type) DO UPDATE SET
      recipe_id=excluded.recipe_id,
      confidence=excluded.confidence,
      is_auto_replace_safe=excluded.is_auto_replace_safe,
      source_type=excluded.source_type,
      data_version=excluded.data_version`,[
      alias.alias_value,alias.alias_type,alias.recipe_id,alias.confidence,
      alias.is_auto_replace_safe?1:0,alias.source_type,alias.data_version,
    ]);
  }
}

function retireExactLegacyIdConflict(db,recipe,retired){
  const conflicts=queryRows(db,
    'SELECT recipe_id,recipe_name FROM recipe_master WHERE recipe_name=? AND recipe_id<>?',
    [recipe.recipe_name,recipe.recipe_id]);
  for(const row of conflicts){
    const permitted=PUBLIC_RECIPE_ALIASES.some(alias=>
      alias.recipe_id===recipe.recipe_id
      && alias.alias_type==='legacy_recipe_id'
      && alias.alias_value===row.recipe_id);
    if(!permitted)continue;
    db.run('DELETE FROM recipe_master_ingredients WHERE recipe_id=?',[row.recipe_id]);
    db.run('DELETE FROM recipe_master WHERE recipe_id=? AND recipe_name=?',[row.recipe_id,row.recipe_name]);
    retired.push({reason:'legacy_recipe_id',legacy_recipe_id:row.recipe_id,legacy_recipe_name:row.recipe_name,canonical_recipe_id:recipe.recipe_id});
  }
}

function upsertCanonicalRecipes(db,retired){
  for(const recipe of PUBLIC_RECIPE_MASTER){
    retireExactLegacyIdConflict(db,recipe,retired);
    db.run(`INSERT INTO recipe_master(
      recipe_id,category,recipe_name,base_energy,total_ingredients,
      source_type,source_name,source_ref,verified_at,data_version
    ) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(recipe_id) DO UPDATE SET
      category=excluded.category,
      recipe_name=excluded.recipe_name,
      base_energy=excluded.base_energy,
      total_ingredients=excluded.total_ingredients,
      source_type=excluded.source_type,
      source_name=excluded.source_name,
      source_ref=excluded.source_ref,
      verified_at=excluded.verified_at,
      data_version=excluded.data_version`,[
      recipe.recipe_id,recipe.category,recipe.recipe_name,recipe.base_energy,
      recipe.total_ingredients,recipe.source_type,recipe.source_name,
      recipe.source_ref,recipe.verified_at,recipe.data_version,
    ]);
    db.run('DELETE FROM recipe_master_ingredients WHERE recipe_id=?',[recipe.recipe_id]);
    for(const ingredient of recipe.ingredients){
      db.run(`INSERT INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity)
        VALUES(?,?,?)`,[recipe.recipe_id,ingredient.ingredient_name,ingredient.quantity]);
    }
  }
}

function retireExplicitLegacyNames(db,retired){
  for(const alias of PUBLIC_RECIPE_ALIASES.filter(row=>row.alias_type==='legacy_recipe_name')){
    const rows=queryRows(db,
      'SELECT recipe_id,recipe_name FROM recipe_master WHERE recipe_name=? AND recipe_id<>?',
      [alias.alias_value,alias.recipe_id]);
    for(const row of rows){
      db.run('DELETE FROM recipe_master_ingredients WHERE recipe_id=?',[row.recipe_id]);
      db.run('DELETE FROM recipe_master WHERE recipe_id=? AND recipe_name=?',[row.recipe_id,row.recipe_name]);
      retired.push({reason:'legacy_recipe_name',legacy_recipe_id:row.recipe_id,legacy_recipe_name:row.recipe_name,canonical_recipe_id:alias.recipe_id});
    }
  }
}

export function syncPublicRecipeMaster(db){
  ensureAliasSchema(db);
  upsertAliases(db);
  const retired=[];
  upsertCanonicalRecipes(db,retired);
  retireExplicitLegacyNames(db,retired);
  recreateRecipeCatalogView(db);

  const canonicalIds=new Set(PUBLIC_RECIPE_MASTER.map(row=>row.recipe_id));
  const remaining=queryRows(db,'SELECT recipe_id,recipe_name,data_version FROM recipe_master ORDER BY recipe_name');
  const extraMasterRows=remaining.filter(row=>!canonicalIds.has(row.recipe_id));

  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_recipe_master_version',?,datetime('now'))`,[JSON.stringify(PUBLIC_RECIPE_MASTER_VERSION)]);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_recipe_master_sync_report',?,datetime('now'))`,[JSON.stringify({
      version:PUBLIC_RECIPE_MASTER_VERSION,
      canonical_recipe_count:PUBLIC_RECIPE_MASTER.length,
      retired_legacy_rows:retired,
      preserved_unrecognized_master_rows:extraMasterRows,
      player_rows_modified:false,
    })]);

  return {
    version:PUBLIC_RECIPE_MASTER_VERSION,
    canonical_recipe_count:PUBLIC_RECIPE_MASTER.length,
    retired_legacy_rows:retired,
    preserved_unrecognized_master_rows:extraMasterRows,
    player_rows_modified:false,
  };
}
