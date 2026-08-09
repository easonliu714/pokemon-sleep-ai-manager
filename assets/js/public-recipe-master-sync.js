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
  const match=`(
    r.recipe_id=m.recipe_id
    OR r.recipe_name=m.recipe_name
    OR EXISTS(
      SELECT 1 FROM recipe_master_alias a
       WHERE a.recipe_id=m.recipe_id
         AND (
           (a.alias_type='legacy_recipe_id' AND r.recipe_id=a.alias_value)
           OR (a.alias_type='legacy_recipe_name' AND r.recipe_name=a.alias_value)
         )
    )
  )`;
  const priority=`CASE
    WHEN r.recipe_id=m.recipe_id THEN 0
    WHEN r.recipe_name=m.recipe_name THEN 1
    WHEN EXISTS(SELECT 1 FROM recipe_master_alias a WHERE a.recipe_id=m.recipe_id AND a.alias_type='legacy_recipe_id' AND r.recipe_id=a.alias_value) THEN 2
    ELSE 3 END`;
  db.run(`CREATE VIEW recipe_catalog_state AS
    SELECT m.recipe_id,m.category,m.recipe_name,m.base_energy,m.total_ingredients,
           COALESCE((SELECT r.unlocked FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1),0) AS unlocked,
           COALESCE((SELECT r.recipe_level FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1),1) AS recipe_level,
           (SELECT r.current_energy FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1) AS current_energy,
           (SELECT r.updated_at FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1) AS updated_at,
           (SELECT r.notes FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1) AS notes,
           (SELECT r.recipe_id FROM recipes r WHERE ${match} ORDER BY ${priority} LIMIT 1) AS player_recipe_id,
           CASE WHEN EXISTS(SELECT 1 FROM recipes r WHERE ${match}) THEN 1 ELSE 0 END AS player_record_exists,
           m.data_version
      FROM recipe_master m
    UNION ALL
    SELECT r.recipe_id,r.category,r.recipe_name,NULL,COALESCE(r.total_ingredients,0),
           COALESCE(r.unlocked,0),COALESCE(r.recipe_level,1),r.current_energy,r.updated_at,r.notes,
           r.recipe_id,1,'PLAYER_ONLY'
      FROM recipes r
     WHERE NOT EXISTS(
       SELECT 1 FROM recipe_master m
        WHERE r.recipe_id=m.recipe_id
           OR r.recipe_name=m.recipe_name
           OR EXISTS(
             SELECT 1 FROM recipe_master_alias a
              WHERE a.recipe_id=m.recipe_id
                AND (
                  (a.alias_type='legacy_recipe_id' AND r.recipe_id=a.alias_value)
                  OR (a.alias_type='legacy_recipe_name' AND r.recipe_name=a.alias_value)
                )
           )
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
