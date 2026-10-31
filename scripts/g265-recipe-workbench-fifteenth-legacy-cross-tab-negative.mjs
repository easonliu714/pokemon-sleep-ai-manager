// G265 fifteenth distinct Legacy Direct Writer: recipe-unified-player-workbench.js::saveRecipeState().
// Source-bound two-tab NEGATIVE, with disposable SQL.js and synthetic import audit tables.
// Two successful legacy acknowledgments can lose a newer recipe edit and its audit batch.
// This fixture is not production admission, player-data access, or Android Owner UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-unified-player-workbench.js',import.meta.url),'utf8');
const start='async function saveRecipeState(row,{unlocked,level,energy}){';
const end='\nfunction bindTable(';
assert.equal(source.split(start).length,2,'saveRecipeState original source must occur exactly once');
assert.equal(source.split(end).length,2,'source function boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/await snapshot\(/);
assert.match(operation,/begin\(\);[\s\S]*?commit\(\);await persist\(\)/);
assert.match(operation,/INSERT INTO import_batches/);
assert.match(operation,/INSERT INTO import_changes/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_FIFTEENTH_RECIPE_WORKBENCH_EXACT_LEGACY_SAVE_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE recipes(recipe_id TEXT PRIMARY KEY,category TEXT,recipe_name TEXT,unlocked INTEGER,total_ingredients INTEGER,source TEXT,recipe_level INTEGER,current_energy INTEGER,updated_at TEXT,notes TEXT)');
seed.run('CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT,generated_at TEXT,imported_at TEXT,source TEXT,operation_count INTEGER,result_json TEXT)');
seed.run('CREATE TABLE import_changes(update_id TEXT,operation_index INTEGER,entity TEXT,action TEXT,key_json TEXT,before_json TEXT,after_json TEXT,status TEXT,message TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO recipes VALUES('seed','synthetic','baseline',1,1,'fixture',1,10,'fixture','')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acknowledgments=0,snapshots=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  let transaction=false;
  const ctx={
    dbReady:()=>true,
    rows(sql,params=[]){
      const statement=local.prepare(sql);
      try{if(params.length)statement.bind(params);const out=[];while(statement.step())out.push(statement.getAsObject());return out;}
      finally{statement.free();}
    },
    async snapshot(reason){assert.ok(reason.startsWith('manual:recipe:'));snapshots++;return {status:'SYNTHETIC'};},
    begin(){assert.equal(transaction,false);local.run('BEGIN IMMEDIATE');transaction=true;},
    run(sql,params=[]){assert.equal(transaction,true);local.run(sql,params);},
    commit(){assert.equal(transaction,true);local.run('COMMIT');transaction=false;},
    rollback(){if(transaction){local.run('ROLLBACK');transaction=false;}},
    async persist(){
      assert.equal(transaction,false);
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    localIso:()=> '2026-11-01T03:55:00+08:00',
    Date:{now:()=>label==='A'?1793480000001:1793480000002},
    Math:{random:()=>label==='A'?0.125:0.625},
    JSON,Number,String,Promise,Error,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(operation+'\n;globalThis.__saveRecipeState=saveRecipeState;',context,{timeout:3000});
  return {save:context.__saveRecipeState,close:()=>local.close()};
}
const row=(label)=>({recipe_id:'recipe_'+label,category:'synthetic',recipe_name:'fixture_'+label,total_ingredients:3});
const first=makeTab('A',true);
const pending=first.save(row('A'),{unlocked:true,level:2,energy:20});
await firstPersistEntered;
const second=makeTab('B',false);
const secondResult=await second.save(row('B'),{unlocked:true,level:3,energy:30});
assert.equal(secondResult.recipe_id,'recipe_B');
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
assert.equal(reloaded.exec("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_B'")[0].values[0][0],1);
assert.equal(reloaded.exec("SELECT COUNT(*) FROM import_batches")[0].values[0][0],1);
reloaded.close();
releaseFirst();
const firstResult=await pending;
assert.equal(firstResult.recipe_id,'recipe_A');
assert.equal(acknowledgments,2,'both legacy saves returned acknowledged');
assert.equal(snapshots,2);
reloaded=new SQL.Database(durable);
const count=(sql)=>reloaded.exec(sql)[0].values[0][0];
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_A'"),1);
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='recipe_B'"),0,'newer acknowledged recipe edit lost');
assert.equal(count('SELECT COUNT(*) FROM import_batches'),1,'newer acknowledged import batch lost');
assert.equal(count('SELECT COUNT(*) FROM import_changes'),1,'newer acknowledged audit change lost');
assert.equal(count("SELECT COUNT(*) FROM recipes WHERE recipe_id='seed'"),1);
assert.equal(count("SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reloaded.close();first.close();second.close();
console.log('PASS G265_FIFTEENTH_RECIPE_WORKBENCH_TWO_ACK_STALE_RECIPE_AND_AUDIT_LOST_NEGATIVE');
console.log('HOLD G265_RECIPE_WORKBENCH_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
