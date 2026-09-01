import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  page.on('console',message=>console.log(`[B6-BROWSER:${message.type()}] ${message.text()}`));
  page.on('pageerror',error=>console.error(`[B6-BROWSER:pageerror] ${error?.stack||error}`));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof globalThis.initSqlJs==='function',{timeout:60000});

  const result=await page.evaluate(async()=>{
    const storage=await import('./assets/js/candy-family-storage-authority.js?gate=v042755-browser');
    const publicCandy=await import('./assets/js/public-candy-master.js?gate=v042755-browser');
    const SQL=await initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`});
    const publicRows=publicCandy.buildPublicCandyMasterRows();
    const pichu=publicRows.find(row=>row.candy_type==='species'&&row.target_species_name==='皮丘');
    const pikachu=publicRows.find(row=>row.candy_type==='species'&&row.target_species_name==='皮卡丘');
    if(!pichu||!pikachu)throw new Error('pikachu_family_master_fixture_missing');

    const schema=db=>{
      db.run(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
        CREATE TABLE candy_master(candy_id TEXT PRIMARY KEY,candy_name TEXT NOT NULL UNIQUE,candy_type TEXT NOT NULL,target_species_name TEXT,target_type_name TEXT,name_rule TEXT NOT NULL,verification_status TEXT NOT NULL,source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL);
        CREATE TABLE candy_inventory(candy_id TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,safe_reserve INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,source_update_id TEXT);
        CREATE TABLE import_batches(update_id TEXT PRIMARY KEY,schema_version TEXT NOT NULL,generated_at TEXT NOT NULL,imported_at TEXT NOT NULL,source TEXT,operation_count INTEGER NOT NULL,result_json TEXT NOT NULL);
        CREATE TABLE import_changes(id INTEGER PRIMARY KEY AUTOINCREMENT,update_id TEXT NOT NULL,operation_index INTEGER NOT NULL,entity TEXT NOT NULL,action TEXT NOT NULL,key_json TEXT NOT NULL,before_json TEXT,after_json TEXT,status TEXT NOT NULL,message TEXT);
        CREATE TABLE pokemon_history(history_id INTEGER PRIMARY KEY AUTOINCREMENT,pokemon_id TEXT,event_at TEXT NOT NULL,event_type TEXT NOT NULL,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT);`);
      db.run("INSERT INTO schema_migrations(version,applied_at) VALUES(1,'2026-08-01T00:00:00.000Z')");
      for(const row of [pichu,pikachu])db.run(`INSERT INTO candy_master(candy_id,candy_name,candy_type,target_species_name,target_type_name,name_rule,verification_status,source_type,source_name,source_ref,verified_at,data_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[row.candy_id,row.candy_name,row.candy_type,row.target_species_name,row.target_type_name,row.name_rule,row.verification_status,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version]);
    };
    const rows=(db,sql,params=[])=>{const stmt=db.prepare(sql);stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());stmt.free();return out;};

    const addAbsolute=(db,{at='2026-09-01T12:00:00.000Z',quantity=288,updateId='UPD-PIKA-288'}={})=>{
      db.run('INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id) VALUES(?,?,?,?,?)',[pikachu.candy_id,quantity,0,at,updateId]);
      db.run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[updateId,'1',at,at,'candy_screenshot_confirmed',1,'{}']);
      db.run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[updateId,0,'candy_inventory','upsert',JSON.stringify({candy_id:pikachu.candy_id}),null,JSON.stringify({candy_id:pikachu.candy_id,quantity,safe_reserve:0,updated_at:at,source_update_id:updateId}),'applied','fixture absolute snapshot']);
    };
    const addDelta=(db,{at='2026-08-30T10:00:00.000Z',quantity=5,sourceId='professor-transfer:legacy-pichu-5'}={})=>{
      db.run('INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id) VALUES(?,?,?,?,?)',[pichu.candy_id,quantity,0,at,sourceId]);
      const transfer={inventory_mutation:'OBSERVED_DELTA_INCREMENT',candy_inventory_applied:true,observed_candy_quantity:quantity,quantity_authority:'USER_DIRECT_OBSERVATION_ONLY',transferred_at:at};
      const after={professor_transfer:transfer,candy_inventory_before:null,candy_inventory_after:{candy_id:pichu.candy_id,quantity,safe_reserve:0,updated_at:at,source_update_id:sourceId}};
      db.run('INSERT INTO pokemon_history(pokemon_id,event_at,event_type,before_json,after_json,reason,source_update_id) VALUES(?,?,?,?,?,?,?)',['fixture-pichu',at,'sent_to_professor','{}',JSON.stringify(after),'fixture delta',sourceId]);
    };

    const dbA=new SQL.Database();schema(dbA);addDelta(dbA);addAbsolute(dbA);
    const first=storage.applyCandyFamilyStorageMigration(dbA);
    const rowsA=rows(dbA,'SELECT * FROM candy_inventory ORDER BY candy_id');
    const eventsA=rows(dbA,'SELECT mutation_type,quantity_value,event_at FROM candy_inventory_events ORDER BY event_at,event_id');
    const auditA=rows(dbA,'SELECT status,reason,canonical_candy_id,details_json FROM candy_family_storage_migration_audit')[0]||null;
    const rerun=storage.applyCandyFamilyStorageMigration(dbA);
    const rerunRows=rows(dbA,'SELECT * FROM candy_inventory ORDER BY candy_id');

    const dbB=new SQL.Database();schema(dbB);addAbsolute(dbB,{at:'2026-09-01T10:00:00.000Z'});addDelta(dbB,{at:'2026-09-01T11:00:00.000Z'});
    const reverse=storage.applyCandyFamilyStorageMigration(dbB);
    const rowsB=rows(dbB,'SELECT * FROM candy_inventory ORDER BY candy_id');

    const dbC=new SQL.Database();schema(dbC);addAbsolute(dbC,{at:'2026-09-01T12:00:00.000Z'});
    dbC.run('INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id) VALUES(?,?,?,?,?)',[pichu.candy_id,5,0,'2026-09-01T13:00:00.000Z',null]);
    const ambiguous=storage.applyCandyFamilyStorageMigration(dbC);
    const rowsC=rows(dbC,'SELECT * FROM candy_inventory ORDER BY candy_id');
    const auditC=rows(dbC,'SELECT status,reason FROM candy_family_storage_migration_audit')[0]||null;

    const dbD=new SQL.Database();schema(dbD);addDelta(dbD);addAbsolute(dbD);
    dbD.run(`CREATE TRIGGER force_family_migration_abort BEFORE INSERT ON candy_inventory
      WHEN NEW.source_update_id LIKE 'candy-family-migration:%'
      BEGIN SELECT RAISE(ABORT,'forced_family_migration_abort'); END;`);
    let rollbackError=null;
    try{storage.applyCandyFamilyStorageMigration(dbD);}catch(error){rollbackError=String(error?.message||error);}
    const rowsD=rows(dbD,'SELECT * FROM candy_inventory ORDER BY candy_id');
    const migration15D=rows(dbD,'SELECT version FROM schema_migrations WHERE version=15');

    return {
      ids:{pichu:pichu.candy_id,pikachu:pikachu.candy_id},
      first,rowsA,eventsA,auditA,rerun,rerunRows,
      reverse,rowsB,
      ambiguous,rowsC,auditC,
      rollbackError,rowsD,migration15D,
    };
  });

  assert.equal(result.first.applied,1);
  assert.equal(result.first.held,0);
  assert.equal(result.rowsA.length,1,'delta + later snapshot must consolidate to one row');
  assert.equal(result.rowsA[0].candy_id,result.ids.pikachu,'Pikachu B4 reference must be canonical storage key');
  assert.equal(result.rowsA[0].quantity,288,'older +5 must not be double-counted after snapshot 288');
  assert.equal(result.eventsA.length,2,'legacy evidence must be reconstructed into the event ledger');
  assert.deepEqual(result.eventsA.map(row=>row.mutation_type),['DELTA_EVENT','ABSOLUTE_SNAPSHOT']);
  assert.equal(result.auditA.status,'APPLIED');
  assert.equal(result.rerun.no_op,true,'migration rerun after closure must be idempotent');
  assert.deepEqual(result.rerunRows,result.rowsA,'idempotent rerun must not alter current state');

  assert.equal(result.reverse.applied,1);
  assert.equal(result.rowsB.length,1);
  assert.equal(result.rowsB[0].candy_id,result.ids.pikachu);
  assert.equal(result.rowsB[0].quantity,293,'snapshot 288 followed by observed +5 must produce 293');

  assert.equal(result.ambiguous.held,1);
  assert.equal(result.ambiguous.applied,0);
  assert.equal(result.rowsC.length,2,'ambiguous later provenance must fail closed without destructive merge');
  assert.equal(result.auditC.status,'HOLD');
  assert.equal(result.auditC.reason,'UNKNOWN_PROVENANCE_AFTER_LATEST_SNAPSHOT');

  assert.match(result.rollbackError||'',/forced_family_migration_abort/,'forced SQL failure must propagate');
  assert.equal(result.rowsD.length,2,'rollback must restore both legacy rows after failed migration');
  assert.equal(result.migration15D.length,0,'failed migration must not mark schema migration 15 complete');

  console.log(JSON.stringify({status:'PASS',gate:'V042755_P0B6_CANDY_FAMILY_STORAGE_BROWSER_SQLITE',result},null,2));
}finally{await browser.close();}
