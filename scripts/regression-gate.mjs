import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import initSqlJs from 'sql.js';
import {DDL,SEED_SQL} from '../assets/js/schema.js';
import {applyAllMigrations} from '../assets/js/migrations.js';

const root=new URL('../',import.meta.url);
const text=async path=>readFile(new URL(path,root),'utf8');
const require=createRequire(import.meta.url);

function queryRows(db,sql){const statement=db.prepare(sql);const output=[];while(statement.step())output.push(statement.getAsObject());statement.free();return output;}
function scalar(db,sql){const result=queryRows(db,sql);return result.length?Object.values(result[0])[0]:null;}
async function listJs(dirUrl){const out=[];for(const name of await readdir(dirUrl)){const url=new URL(`${name}${(await stat(new URL(name,dirUrl))).isDirectory()?'/':''}`,dirUrl);if((await stat(url)).isDirectory())out.push(...await listJs(url));else if(name.endsWith('.js'))out.push(url);}return out;}

async function syntaxGate(){
  const temp=await mkdtemp(join(tmpdir(),'pokemon-sleep-regression-'));
  try{const files=[...await listJs(new URL('assets/js/',root)),new URL('service-worker.js',root)];for(const file of files){const target=join(temp,relative(new URL('.',root).pathname,file.pathname).replaceAll('/','__')+'.mjs');await writeFile(target,await readFile(file,'utf8'));const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});assert.equal(result.status,0,`JavaScript syntax error: ${file.pathname}\n${result.stderr}`);}console.log(`PASS syntax: ${files.length} JavaScript files`);}finally{await rm(temp,{recursive:true,force:true});}
}

async function migrationStaticGate(){
  const schema=await text('assets/js/schema.js');const database=await text('assets/js/database.js');const migrations=await text('assets/js/migrations.js');const canonical=await text('assets/js/canonical-registry.js');
  for(const field of ['recipe_level','current_energy','updated_at','notes'])assert.match(migrations,new RegExp(`addColumnIfMissing\\(db,'recipes','${field}'`),`missing recipe migration field: ${field}`);
  for(const version of [1,2,3,4,5,6,7])assert.match(`${schema}\n${migrations}\n${canonical}`,new RegExp(`schema_migrations[^\\n]*${version}|VALUES\\(${version},`),`migration ${version} is not registered`);
  const initialization=database.match(/export async function initializeDatabase\(\)[\s\S]*?\n\}/u)?.[0]||'';
  const replacement=database.match(/export async function replaceDatabase\(bytes\)[\s\S]*?await persist\(\);\n\}/u)?.[0]||'';
  assert.match(initialization,/applyAllMigrations\(db\)/u,'migrations missing from initializeDatabase');
  assert.match(replacement,/applyAllMigrations\(db\)/u,'migrations missing from replaceDatabase');
  assert.match(migrations,/SELECT pokemon_id,70[\s\S]*unlock_level=75/u,'75→70 migration missing');
  assert.match(migrations,/SELECT pokemon_id,80[\s\S]*unlock_level=100/u,'100→80 migration missing');
  assert.match(migrations,/pokemon_analysis_observation/u,'analysis observation migration missing');
  assert.match(canonical,/CREATE TABLE IF NOT EXISTS canonical_term/u,'canonical term table missing');
  assert.match(canonical,/CREATE TABLE IF NOT EXISTS canonical_term_alias/u,'canonical alias table missing');
  console.log('PASS migration structure: schema versions 1-7 and lifecycle hooks');
}

async function migrationFixtureGate(){
  const SQL=await initSqlJs({locateFile:file=>join(dirname(require.resolve('sql.js')),file)});
  const fresh=new SQL.Database();fresh.run(DDL);fresh.run(SEED_SQL);applyAllMigrations(fresh);
  assert.equal(scalar(fresh,'PRAGMA integrity_check'),'ok','fresh DB integrity check failed');
  assert.deepEqual(queryRows(fresh,'SELECT version FROM schema_migrations ORDER BY version').map(row=>row.version),[1,2,3,4,5,6,7]);
  assert.equal(scalar(fresh,'SELECT COUNT(*) FROM pokemon'),0,'public master must not seed Pokémon');
  assert.equal(scalar(fresh,'SELECT COUNT(*) FROM ingredient_inventory'),0,'public master must not seed ingredient quantities');
  assert.equal(scalar(fresh,'SELECT COUNT(*) FROM item_inventory'),0,'public master must not seed item quantities');
  assert.equal(scalar(fresh,'SELECT COUNT(*) FROM recipes'),0,'public master must not seed recipe unlock state');
  assert.ok(scalar(fresh,'SELECT COUNT(*) FROM ingredient_catalog_state')>0,'ingredient public catalog missing');
  assert.ok(scalar(fresh,'SELECT COUNT(*) FROM item_catalog_state')>0,'item public catalog missing');
  assert.ok(scalar(fresh,'SELECT COUNT(*) FROM recipe_catalog_state')>0,'recipe public catalog missing');
  assert.ok(scalar(fresh,'SELECT COUNT(*) FROM canonical_term')>0,'canonical registry is empty');
  assert.equal(scalar(fresh,"SELECT canonical_name_zh_tw FROM canonical_term_alias a JOIN canonical_term t ON t.term_id=a.term_id WHERE a.alias_text='辣味香草'"),'火辣香草','safe ingredient alias mismatch');
  for(const field of ['recipe_level','current_energy','updated_at','notes'])assert.ok(queryRows(fresh,"PRAGMA table_info('recipes')").some(row=>row.name===field),`fresh DB missing recipes.${field}`);
  for(const field of ['sleep_hours','sleep_time_text','evolution_sleep_hours_required','source_image_refs_json'])assert.ok(queryRows(fresh,"PRAGMA table_info('pokemon')").some(row=>row.name===field),`fresh DB missing pokemon.${field}`);

  const legacy=new SQL.Database();
  legacy.run(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
    INSERT INTO schema_migrations VALUES(1,datetime('now'));
    CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,species TEXT NOT NULL,original_label TEXT,nickname TEXT,nickname_halfwidth_units INTEGER,nickname_valid INTEGER NOT NULL DEFAULT 1,level INTEGER,sp INTEGER,specialty TEXT,type TEXT,nature TEXT,nature_bonus TEXT,nature_penalty TEXT,main_skill TEXT,main_skill_level INTEGER,helper_seconds INTEGER,carry_limit INTEGER,favorite_berry TEXT,rating TEXT,ai_score REAL,status TEXT NOT NULL DEFAULT 'active',core_role TEXT,recommendation TEXT,item_advice TEXT,scenarios TEXT,is_favorite INTEGER NOT NULL DEFAULT 0,is_main INTEGER NOT NULL DEFAULT 0,obtained_at TEXT,last_updated_at TEXT NOT NULL,source_update_id TEXT);
    CREATE TABLE pokemon_subskills(pokemon_id TEXT NOT NULL,unlock_level INTEGER NOT NULL,subskill_name TEXT NOT NULL,is_unlocked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(pokemon_id,unlock_level));
    CREATE TABLE recipes(recipe_id TEXT PRIMARY KEY,category TEXT NOT NULL,recipe_name TEXT NOT NULL UNIQUE,unlocked INTEGER NOT NULL DEFAULT 0,total_ingredients INTEGER NOT NULL DEFAULT 0,source TEXT);
    CREATE TABLE recipe_ingredients(recipe_id TEXT NOT NULL,ingredient_name TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(recipe_id,ingredient_name));
    INSERT INTO pokemon(pokemon_id,species,type,obtained_at,last_updated_at) VALUES('LEGACY-001','七夕青鳥','龍','2026-07-01','2026-07-01');
    INSERT INTO pokemon_subskills VALUES('LEGACY-001',75,'幫手速度S',1),('LEGACY-001',100,'技能機率M',0);
    INSERT INTO recipes VALUES('PERSONAL-001','甜點','測試料理',1,12,'personal');
    INSERT INTO recipe_ingredients VALUES('PERSONAL-001','甜甜蜜',12);
  `);
  const before={pokemon:scalar(legacy,'SELECT COUNT(*) FROM pokemon'),recipes:scalar(legacy,'SELECT COUNT(*) FROM recipes'),ingredients:scalar(legacy,'SELECT COUNT(*) FROM recipe_ingredients')};
  legacy.run(DDL);applyAllMigrations(legacy);const exported=legacy.export();legacy.close();
  const restored=new SQL.Database(exported);assert.equal(scalar(restored,'PRAGMA integrity_check'),'ok','restored legacy DB integrity check failed');applyAllMigrations(restored);assert.equal(scalar(restored,'PRAGMA integrity_check'),'ok','post-restore migration integrity check failed');
  const after={pokemon:scalar(restored,'SELECT COUNT(*) FROM pokemon'),recipes:scalar(restored,'SELECT COUNT(*) FROM recipes'),ingredients:scalar(restored,'SELECT COUNT(*) FROM recipe_ingredients')};
  assert.deepEqual(after,before,'personal row counts changed during migration/restore');
  assert.equal(scalar(restored,"SELECT unlocked FROM recipes WHERE recipe_id='PERSONAL-001'"),1,'personal recipe unlocked state changed');
  assert.equal(scalar(restored,"SELECT quantity FROM recipe_ingredients WHERE recipe_id='PERSONAL-001' AND ingredient_name='甜甜蜜'"),12,'personal recipe ingredient changed');
  assert.equal(scalar(restored,"SELECT pokemon_instance_id FROM pokemon WHERE pokemon_id='LEGACY-001'"),'LEGACY-001');
  assert.equal(scalar(restored,"SELECT COUNT(*) FROM pokemon_subskills WHERE unlock_level IN (75,100)"),0,'legacy subskill levels remain');
  assert.equal(scalar(restored,"SELECT COUNT(*) FROM pokemon_subskills WHERE unlock_level IN (70,80)"),2,'migrated subskill levels missing');
  assert.deepEqual(queryRows(restored,'SELECT version FROM schema_migrations ORDER BY version').map(row=>row.version),[1,2,3,4,5,6,7]);
  restored.close();fresh.close();
  console.log(`PASS SQLite fixtures: fresh integrity=ok; canonical migration=6; detail observation migration=7; legacy restore integrity=ok; personal rows ${JSON.stringify(before)} preserved`);
}

async function knowledgeGate(){
  const master=await text('assets/js/shared-master-data.js');const ui=await text('assets/js/shared-knowledge-ui.js');const app=await text('assets/js/app.js');const catalog=await text('assets/js/public-catalog-workbench.js');
  const expected={草:'金枕果',飛行:'椰木果',龍:'番荔果',毒:'零餘果'};for(const [type,berry] of Object.entries(expected))assert.ok(master.includes(`['${type}','${berry}']`),`berry mapping mismatch: ${type}→${berry}`);
  assert.match(app,/\$\('recipeTable'\)/,'personal recipe renderer must keep recipeTable');
  assert.match(ui,/id="referenceRecipeTable"/,'reference recipe table is missing');
  assert.match(ui,/document\.getElementById\('referenceRecipeTable'\)/,'shared UI must render referenceRecipeTable');
  assert.doesNotMatch(ui,/table\(recipeTable,recipes/u,'shared recipes must not overwrite personal recipeTable');
  assert.match(catalog,/ingredient_catalog_state/u,'ingredient catalog view not used');
  assert.match(catalog,/item_catalog_state/u,'item catalog view not used');
  assert.match(catalog,/recipe_catalog_state/u,'recipe catalog view not used');
  console.log('PASS knowledge UI: public zero-state catalogs editable; personal/reference data separated');
}

async function serviceWorkerGate(){const sw=await text('service-worker.js');for(const asset of ['shared-master-schema.js','shared-master-data.js','public-empty-profile-master.js','canonical-registry.js','public-catalog-workbench.js','shared-knowledge-ui.js'])assert.ok(sw.includes(asset),`service-worker cache missing ${asset}`);assert.match(sw,/skipWaiting\(\)/,'service worker must call skipWaiting');assert.match(sw,/clients\.claim\(\)/,'service worker must claim clients');assert.match(sw,/keys\.filter\(\(key\) => key !== CACHE\)/,'service worker must delete stale caches');console.log('PASS service worker: canonical/public catalog modules cached and stale caches removed');}

await syntaxGate();await migrationStaticGate();await migrationFixtureGate();await knowledgeGate();await serviceWorkerGate();console.log('REGRESSION GATE PASS');
