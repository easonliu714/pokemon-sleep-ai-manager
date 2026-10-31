// G265 sixteenth distinct Legacy Direct Writer: recipe-display-name-evidence.js::persistConfirmedRecipeDisplayNamesFromUcImg().
// Exact production source is executed only in disposable SQL.js VM tabs with synthetic confirmed recipe observations.
// Two acknowledged full-image persists can erase the newer evidence and canonical-resolution audit.
// PASS means an UNSAFE negative was reproduced; it does NOT admit production, access player data or authorize Android UAT.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/recipe-display-name-evidence.js',import.meta.url),'utf8');
const start='export async function persistConfirmedRecipeDisplayNamesFromUcImg(){';
const end='\nasync function onDataChanged(';
assert.equal(source.split(start).length,2,'exact recipe evidence writer must be unique');
assert.equal(source.split(end).length,2,'recipe evidence source boundary changed');
const operation=source.slice(source.indexOf(start),source.indexOf(end));
assert.match(operation,/ensureRecipeDisplayNameEvidenceSchema\(\)/);
assert.match(operation,/INSERT OR IGNORE INTO recipe_display_name_evidence/);
assert.match(operation,/INSERT OR IGNORE INTO canonical_resolution_log/);
assert.match(operation,/if\(confirmed\.length\)await persist\(\)/);
assert.doesNotMatch(operation,/runSqliteWriteSession|navigator\.locks|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_SIXTEENTH_RECIPE_DISPLAY_NAME_EXACT_LEGACY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
seed.run('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)');
seed.run('INSERT INTO schema_migrations VALUES(1)');
seed.run('CREATE TABLE canonical_resolution_log(resolution_id TEXT PRIMARY KEY,entity_type TEXT,raw_text TEXT,normalized_text TEXT,resolution_status TEXT,term_id TEXT,canonical_name_zh_tw TEXT,confidence REAL,requires_review INTEGER,source_type TEXT,source_ref TEXT,evidence_revision TEXT,observed_at TEXT,committed_at TEXT)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT)');
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();
let acknowledgments=0,releaseFirst,firstWaiting;
const firstPersistEntered=new Promise(resolve=>{firstWaiting=resolve;});
const session=label=>({
  schema:'pokemon-sleep-uc-img-a-session/1.0',
  session_id:'synthetic_session_'+label,
  scenario_state:{recipes:{
    last_apply_status:'APPLIED',
    last_update_id:'synthetic_update_'+label,
    raw_response:JSON.stringify({
      schema:'pokemon-sleep-public-master-recognition/1.0',
      scenario:'recipe_status_update',
      recognition_version:'synthetic',
      observations:[{
        status:'MATCHED',observation_id:'synthetic_observation_'+label,
        canonical_key:{recipe_id:'synthetic_recipe_'+label},
        observed_text:'synthetic_display_'+label,
        canonical_name:'synthetic_canonical_'+label,
        confidence:0.99,source_image_ref:'synthetic_image_'+label,
        user_resolution:{action:'USER_CONFIRMED_MATCH',confirmed_at:'2026-11-01T00:00:00Z'}
      }]
    })
  }}
});
function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const ctx={
    rows(sql,params=[]){
      const statement=local.prepare(sql);
      try{if(params.length)statement.bind(params);const out=[];while(statement.step())out.push(statement.getAsObject());return out;}
      finally{statement.free();}
    },
    run(sql,params=[]){local.run(sql,params);},
    isRescueReadonly:()=>false,
    localStorage:{getItem:key=>key==='pokemon-sleep-uc-img-a-session-v1'?JSON.stringify(session(label)):null},
    async persist(){
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;firstWaiting();});
      durable=bytes;acknowledgments++;
    },
    JSON,Number,String,Promise,Error,Map,console,
  };
  const context=vm.createContext(ctx);
  vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')+
    '\n;globalThis.__persistEvidence=persistConfirmedRecipeDisplayNamesFromUcImg;',context,{timeout:3000});
  return {save:context.__persistEvidence,close:()=>local.close()};
}
const first=makeTab('A',true);
const pending=first.save();
await firstPersistEntered;
const second=makeTab('B',false);
const secondResult=await second.save();
assert.equal(secondResult.recorded_count,1);
assert.equal(acknowledgments,1);
let reloaded=new SQL.Database(durable);
const count=(db,sql)=>db.exec(sql)[0].values[0][0];
assert.equal(count(reloaded,"SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_B'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM canonical_resolution_log WHERE raw_text='synthetic_display_B'"),1);
reloaded.close();
releaseFirst();
const firstResult=await pending;
assert.equal(firstResult.recorded_count,1);
assert.equal(acknowledgments,2,'both legacy writers returned after durable persist');
reloaded=new SQL.Database(durable);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_A'"),1);
assert.equal(count(reloaded,"SELECT COUNT(*) FROM recipe_display_name_evidence WHERE recipe_id='synthetic_recipe_B'"),0,'newer acknowledged recipe name evidence lost');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM canonical_resolution_log WHERE raw_text='synthetic_display_B'"),0,'newer acknowledged resolution audit lost');
assert.equal(count(reloaded,"SELECT COUNT(*) FROM synthetic_public_master WHERE id='public' AND value='IMMUTABLE'"),1);
reloaded.close();first.close();second.close();
console.log('PASS G265_SIXTEENTH_RECIPE_DISPLAY_NAME_TWO_ACK_STALE_EVIDENCE_AND_AUDIT_LOST_NEGATIVE');
console.log('HOLD G265_RECIPE_DISPLAY_NAME_LEGACY_UNADMITTED_CROSS_TAB_ANDROID_OWNER_DOD');
