import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import initSqlJs from 'sql.js';
import {DDL,SEED_SQL} from '../assets/js/schema.js';
import {applyAllMigrations,applySharedKnowledgeBase} from '../assets/js/migrations.js';

const require=createRequire(import.meta.url);
const SQL=await initSqlJs({locateFile:file=>join(dirname(require.resolve('sql.js')),file)});
const db=new SQL.Database();
db.run(DDL);
db.run(SEED_SQL);
applyAllMigrations(db);

db.run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
  VALUES('PERSONAL-C-001','甜點','個人測試料理',1,25,'game-screen',33,9876,'2026-07-31T00:00:00+08:00','玩家備註')`);
db.run(`INSERT INTO recipe_ingredients(recipe_id,ingredient_name,quantity) VALUES('PERSONAL-C-001','甜甜蜜',15),('PERSONAL-C-001','哞哞鮮奶',10)`);
db.run(`INSERT INTO ingredient_inventory(ingredient_name,quantity,updated_at,source_update_id)
  VALUES('甜甜蜜',77,'2026-07-31T00:00:00+08:00','PERSONAL-INVENTORY')`);

function rows(sql){
  const statement=db.prepare(sql);
  const output=[];
  while(statement.step()) output.push(statement.getAsObject());
  statement.free();
  return output;
}

const personalSnapshot=()=>({
  recipe:rows("SELECT * FROM recipes WHERE recipe_id='PERSONAL-C-001'")[0],
  ingredients:rows("SELECT * FROM recipe_ingredients WHERE recipe_id='PERSONAL-C-001' ORDER BY ingredient_name"),
  inventory:rows("SELECT * FROM ingredient_inventory WHERE ingredient_name='甜甜蜜'")[0]
});

const before=personalSnapshot();
applySharedKnowledgeBase(db);
applySharedKnowledgeBase(db);
const after=personalSnapshot();

assert.deepEqual(after,before,'shared knowledge refresh modified personal data');
assert.ok(rows("SELECT COUNT(*) AS count FROM recipe_master")[0].count>0,'shared recipe master was not populated');
assert.ok(rows("SELECT COUNT(*) AS count FROM recipe_master_ingredients")[0].count>0,'shared recipe ingredients were not populated');
assert.equal(rows('PRAGMA integrity_check')[0].integrity_check,'ok');

console.log(`PASS shared/personal isolation: recipe fields=${Object.keys(before.recipe).length}, ingredients=${before.ingredients.length}, inventory quantity=${before.inventory.quantity} preserved`);
db.close();
