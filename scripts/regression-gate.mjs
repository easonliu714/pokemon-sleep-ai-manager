import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const text=async path=>readFile(new URL(path,root),'utf8');

async function listJs(dirUrl){
  const out=[];
  for(const name of await readdir(dirUrl)){
    const url=new URL(`${name}${(await stat(new URL(name,dirUrl))).isDirectory()?'/':''}`,dirUrl);
    if((await stat(url)).isDirectory()) out.push(...await listJs(url));
    else if(name.endsWith('.js')) out.push(url);
  }
  return out;
}

async function syntaxGate(){
  const temp=await mkdtemp(join(tmpdir(),'pokemon-sleep-regression-'));
  try{
    const files=[...await listJs(new URL('assets/js/',root)),new URL('service-worker.js',root)];
    for(const file of files){
      const target=join(temp,relative(new URL('.',root).pathname,file.pathname).replaceAll('/','__')+'.mjs');
      await writeFile(target,await readFile(file,'utf8'));
      const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
      assert.equal(result.status,0,`JavaScript syntax error: ${file.pathname}\n${result.stderr}`);
    }
    console.log(`PASS syntax: ${files.length} JavaScript files`);
  }finally{
    await rm(temp,{recursive:true,force:true});
  }
}

async function migrationGate(){
  const schema=await text('assets/js/schema.js');
  const database=await text('assets/js/database.js');
  for(const field of ['recipe_level','current_energy','updated_at','notes']){
    assert.match(database,new RegExp(`addColumnIfMissing\\('recipes','${field}'`),`missing recipe migration field: ${field}`);
  }
  for(const version of [1,2,3,4,5]){
    assert.match(`${schema}\n${database}`,new RegExp(`schema_migrations[^\\n]*${version}|VALUES\\(${version},`),`migration ${version} is not registered`);
  }
  const initialization=database.match(/export async function initializeDatabase\(\)[\s\S]*?return \{seeded\};/u)?.[0]||'';
  const replacement=database.match(/export async function replaceDatabase\(bytes\)[\s\S]*?await persist\(\);\n\}/u)?.[0]||'';
  for(const fn of ['applyIdentityMigration','applyGameDataMigration','applySharedKnowledgeBase','applyPersonalRecipeMigration']){
    assert.match(initialization,new RegExp(`${fn}\\(\\)`),`${fn} missing from initializeDatabase`);
    assert.match(replacement,new RegExp(`${fn}\\(\\)`),`${fn} missing from replaceDatabase`);
  }
  assert.match(database,/SELECT pokemon_id,70[\s\S]*unlock_level=75/u,'75→70 migration missing');
  assert.match(database,/SELECT pokemon_id,80[\s\S]*unlock_level=100/u,'100→80 migration missing');
  console.log('PASS migrations: schema versions 1-5 and game-data migrations');
}

async function knowledgeGate(){
  const master=await text('assets/js/shared-master-data.js');
  const ui=await text('assets/js/shared-knowledge-ui.js');
  const app=await text('assets/js/app.js');
  const expected={草:'金枕果',飛行:'椰木果',龍:'番荔果',毒:'零餘果'};
  for(const [type,berry] of Object.entries(expected)){
    assert.ok(master.includes(`['${type}','${berry}']`),`berry mapping mismatch: ${type}→${berry}`);
  }
  assert.match(app,/\$\('recipeTable'\)/,'personal recipe renderer must keep recipeTable');
  assert.match(ui,/id="referenceRecipeTable"/,'reference recipe table is missing');
  assert.match(ui,/document\.getElementById\('referenceRecipeTable'\)/,'shared UI must render referenceRecipeTable');
  assert.doesNotMatch(ui,/table\(recipeTable,recipes/u,'shared recipes must not overwrite personal recipeTable');
  console.log('PASS knowledge UI: personal/reference recipes separated and berry mappings verified');
}

async function serviceWorkerGate(){
  const sw=await text('service-worker.js');
  for(const asset of ['shared-master-schema.js','shared-master-data.js','shared-knowledge-ui.js']){
    assert.ok(sw.includes(asset),`service-worker cache missing ${asset}`);
  }
  assert.match(sw,/skipWaiting\(\)/,'service worker must call skipWaiting');
  assert.match(sw,/clients\.claim\(\)/,'service worker must claim clients');
  assert.match(sw,/keys\.filter\(\(key\) => key !== CACHE\)/,'service worker must delete stale caches');
  console.log('PASS service worker: shared modules cached and stale caches removed');
}

await syntaxGate();
await migrationGate();
await knowledgeGate();
await serviceWorkerGate();
console.log('REGRESSION GATE PASS');
