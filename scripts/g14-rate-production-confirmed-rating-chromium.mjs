// G14 RATE.4 production-function source in genuine native Chromium/SQL.js.
// Disposable local origin + synthetic bytes ONLY; never imports a player PWA DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import initSqlJs from 'sql.js';

const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1');
const manual=fs.readFileSync('assets/js/manual-editor.js','utf8');
const anchor='export async function saveConfirmedPokemonSuggestedRating(';
assert.equal(manual.split(anchor).length,2,'production function must be unique');
const operation=manual.slice(manual.indexOf(anchor)).replace(/^export /,'');
for(const fragment of ['beginSqliteExclusiveWriteWindow','withPrimarySqliteMutationLock',
 'snapshot(\'rate4:confirmed:',"rating IS ?",'audit(\'pokemon\'',
 'persist({primaryMutationLease:lease})','if(!committed)withSqliteCoordinatedMutation(rollback)'])
 assert.ok(operation.includes(fragment),'missing safety boundary '+fragment);
const SQL=await initSqlJs();
const db=new SQL.Database();
db.run("CREATE TABLE pokemon(pokemon_id TEXT PRIMARY KEY,pokemon_instance_id TEXT NOT NULL,species TEXT,level INTEGER,specialty TEXT,nature TEXT,nature_bonus TEXT,nature_penalty TEXT,main_skill TEXT,main_skill_level INTEGER,rating TEXT,status TEXT,last_updated_at TEXT,source_update_id TEXT)");
db.run("CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER)");
db.run("CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT)");
db.run("CREATE TABLE rating_audit(pokemon_id TEXT,old_rating TEXT,new_rating TEXT,scope TEXT)");
db.run("CREATE TABLE public_master(marker TEXT PRIMARY KEY)");
db.run("INSERT INTO public_master VALUES('UNCHANGED')");
db.run("INSERT INTO pokemon(pokemon_id,pokemon_instance_id,species,level,specialty,nature,nature_bonus,nature_penalty,main_skill,main_skill_level,rating,status) VALUES('fixture','instance-X','synthetic',20,'樹果','固執','幫忙速度','食材機率','能量填充S',1,'D-','active')");
const names=['樹果數量S','幫手獎勵','幫忙速度M','幫忙速度S','睡眠EXP獎勵'];
for(let i=0;i<5;i++)db.run('INSERT INTO pokemon_subskills VALUES(?,?,?,0)',
 ['fixture',[10,25,50,70,80][i],names[i]]);
const seed=Array.from(db.export());db.close();
const wasm=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm');
const js=fs.readFileSync('node_modules/sql.js/dist/sql-wasm.js');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const pages=[];
await context.route('**/g14-rate4-production-blank',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>RATE4 isolated production function</title>'}));
await context.route('**/g14-rate4-production.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:js}));
await context.route('**/g14-rate4-production.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:wasm}));
async function tab(){
 const page=await context.newPage();pages.push(page);
 await page.goto(new URL('g14-rate4-production-blank',base).href);
 await page.addScriptTag({url:new URL('g14-rate4-production.js',base).href});
 return page;
}
async function install(page){
 await page.evaluate(async operation=>{
  const storage=await import('/assets/js/storage.js');
  const guard=await import('/assets/js/sqlite-direct-write-window-guard.js');
  const score=await import('/assets/js/pokemon-provisional-rating.js');
  const readOnly=await import('/assets/js/pokemon-roster-rating-preview.js');
  const SQL=await window.initSqlJs({locateFile:()=>'/g14-rate4-production.wasm'});
  const bytes=await storage.loadDatabaseBytes();
  if(!bytes)throw Error('DISPOSABLE_SQLITE_NOT_SEEDED');
  const db=new SQL.Database(new Uint8Array(bytes));
  const v={storage,db,snapshots:0,sqlWrites:0,ackLoss:false,auditFail:false,persists:0,commits:0,
    events:0,preImage:null};
  const query=(sql,params=[])=>{
    const statement=db.prepare(sql);
    try{statement.bind(params);const out=[];while(statement.step())out.push(statement.getAsObject());return out;}
    finally{statement.free();}
  };
  const execute=(sql,params=[])=>{v.sqlWrites++;db.run(sql,params);};
  const current=()=>{
    const pokemon=query("SELECT * FROM pokemon WHERE pokemon_id='fixture'")[0];
    const ingredients=query("SELECT * FROM pokemon_ingredients WHERE pokemon_id='fixture' ORDER BY unlock_level");
    const subskills=query("SELECT * FROM pokemon_subskills WHERE pokemon_id='fixture' ORDER BY unlock_level");
    const token=readOnly.sourceTokenForPokemonRating({pokemon:[pokemon],ingredients,subskills});
    return {pokemon,ingredients,subskills,token};
  };
  const env={
    beginSqliteExclusiveWriteWindow:guard.beginSqliteExclusiveWriteWindow,
    withSqliteCoordinatedMutation:guard.withSqliteCoordinatedMutation,
    withPrimarySqliteMutationLock:storage.withPrimarySqliteMutationLock,
    rows:query,run:execute,
    begin:()=>execute('BEGIN IMMEDIATE'),
    commit:()=>{execute('COMMIT');v.commits++;},
    rollback:()=>execute('ROLLBACK'),
    now:()=>'2026-11-09T21:00:00+08:00',
    async snapshot(){
      v.snapshots++;
      v.preImage=Array.from(new Uint8Array(await storage.loadDatabaseBytes()));
    },
    async audit(_type,_identity,before,after){
      if(v.auditFail)throw Error('SYNTHETIC_RATING_AUDIT_ABORT');
      execute('INSERT INTO rating_audit VALUES(?,?,?,?)',
        ['fixture',before.rating,after.rating,after.scope]);
    },
    async persist({primaryMutationLease}={}){
      v.persists++;
      await storage.saveDatabaseBytes(db.export(),{primaryMutationLease});
      if(v.ackLoss)throw Error('SYNTHETIC_ACK_LOSS_AFTER_DURABLE_COMMIT');
    },
    emitPokemonEvaluationInputChanged(){v.events++;},
    scorePokemonProvisionalRating:score.scorePokemonProvisionalRating,
    POKEMON_PROVISIONAL_RATING_RULE_VERSION:score.POKEMON_PROVISIONAL_RATING_RULE_VERSION,
    // Synthetic disposable-origin tests explicitly opt in; production defaults OFF.
    RATE4_PRODUCTION_APPLY_ENABLED:true,
    sourceTokenForPokemonRating:readOnly.sourceTokenForPokemonRating,
    Error,Object,String,
  };
  v.current=current;
  v.action=new Function('env','with(env){'+operation+';return saveConfirmedPokemonSuggestedRating;}')(env);
  v.disabledAction=new Function('env','with(env){'+operation+';return saveConfirmedPokemonSuggestedRating;}')(
    {...env,RATE4_PRODUCTION_APPLY_ENABLED:false});
  v.save=async(scope,opts={})=>{
    const source=current(),result=score.scorePokemonProvisionalRating({
      pokemon:source.pokemon,ingredients:source.ingredients,subskills:source.subskills});
    const grade=scope==='CURRENT'?result.current_rating:result.future_rating;
    try{
      const out=await v.action('fixture',{instanceId:source.pokemon.pokemon_instance_id,
        expectedSourceToken:opts.token??source.token,scope,expectedGrade:grade,
        confirmed:opts.confirmed??true});
      return {ok:true,out};
    }catch(e){return {ok:false,code:e.code||e.message};}
  };
  window.__rate=v;
 },operation);
}
const persisted=page=>page.evaluate(async()=>Array.from(new Uint8Array(
 await window.__rate.storage.loadDatabaseBytes())));
const inspect=bytes=>{
 const d=new SQL.Database(Uint8Array.from(bytes));
 try{
  const table=sql=>d.exec(sql)?.[0]?.values||[];
  return {rating:table("SELECT rating FROM pokemon WHERE pokemon_id='fixture'")[0]?.[0],
    audit:table('SELECT old_rating,new_rating,scope FROM rating_audit ORDER BY rowid'),
    level:table("SELECT level FROM pokemon WHERE pokemon_id='fixture'")[0]?.[0],
    nature:table("SELECT nature FROM pokemon WHERE pokemon_id='fixture'")[0]?.[0],
    master:table('SELECT marker FROM public_master')[0]?.[0]};
 }finally{d.close();}
};
try{
 const seedPage=await tab();
 await seedPage.evaluate(async bytes=>{
  const s=await import('/assets/js/storage.js');
  await s.loadDatabaseBytes();
  await s.saveDatabaseBytes(Uint8Array.from(bytes));
 },seed);
 await install(seedPage);
 const second=await tab();await install(second);
 assert.equal(await seedPage.evaluate(()=>typeof navigator.locks?.request),'function');
 const blocked=await seedPage.evaluate(async()=>{
  try{await window.__rate.disabledAction('fixture',{confirmed:true});return 'UNEXPECTED_AUTHORIZED';}
  catch(error){return error.message;}
 });
 assert.equal(blocked,'RATE4_PRODUCTION_APPLY_NOT_AUTHORIZED');
 assert.equal(await seedPage.evaluate(()=>window.__rate.sqlWrites),0);
 console.log('PASS G14_RATE_PRODUCTION_DEFAULT_OFF_NO_SQL_NO_SNAPSHOT');
 const first=await seedPage.evaluate(()=>window.__rate.save('CURRENT'));
 assert.equal(first.ok,true);
 assert.equal(first.out.grade,'S-');
 assert.equal(inspect(await persisted(seedPage)).rating,'S-');
 const stale=await second.evaluate(()=>window.__rate.save('FUTURE'));
 assert.equal(stale.ok,false);
 assert.match(stale.code,/STALE_REVISION_RELOAD_REQUIRED/);
 assert.equal(await second.evaluate(()=>window.__rate.sqlWrites),0);
 assert.deepEqual(inspect(await persisted(seedPage)).audit,[['D-','S-','CURRENT']]);
 console.log('PASS G14_RATE_PRODUCTION_CURRENT_DURABLE_NATIVE_TWO_TAB_STALE_REJECT');

 const fresh=await tab();await install(fresh);
 const denied=await fresh.evaluate(()=>window.__rate.save('FUTURE',{confirmed:false}));
 assert.equal(denied.ok,false);assert.equal(denied.code,'RATE4_EXPLICIT_CONFIRMATION_REQUIRED');
 assert.equal(await fresh.evaluate(()=>window.__rate.snapshots),0);
 const mismatched=await fresh.evaluate(()=>window.__rate.save('FUTURE',{token:'STALE_OR_UNTRUSTED'}));
 assert.equal(mismatched.ok,false);assert.equal(mismatched.code,'RATE4_STALE_SOURCE_RELOAD_REQUIRED');
 assert.equal(await fresh.evaluate(()=>window.__rate.snapshots),0);
 // The above preflight rejects without a DB mutation, but the exclusive
 // same-page error may quarantine the tab. Use new document for positive.
 const positive=await tab();await install(positive);
 const secondApplied=await positive.evaluate(()=>window.__rate.save('FUTURE'));
 assert.equal(secondApplied.ok,true);assert.equal(secondApplied.out.grade,'S+');
 const state=inspect(await persisted(positive));
 assert.equal(state.rating,'S+');assert.deepEqual(state.audit,
  [['D-','S-','CURRENT'],['S-','S+','FUTURE']]);
 assert.equal(state.level,20);assert.equal(state.nature,'固執');
 assert.equal(state.master,'UNCHANGED');
 console.log('PASS G14_RATE_PRODUCTION_EXPLICIT_FUTURE_AUDIT_AND_ALL_OTHER_FIELDS_PRESERVED');

 const failedTab=await tab();await install(failedTab);
 await failedTab.evaluate(()=>{window.__rate.auditFail=true;});
 const failed=await failedTab.evaluate(()=>window.__rate.save('CURRENT'));
 assert.equal(failed.ok,false);assert.equal(failed.code,'SYNTHETIC_RATING_AUDIT_ABORT');
 assert.deepEqual(inspect(await persisted(positive)),state);
 console.log('PASS G14_RATE_PRODUCTION_LATE_AUDIT_FAIL_SQL_ROLLBACK_NO_DURABLE_WRITE');

 const ackTab=await tab();await install(ackTab);
 await ackTab.evaluate(()=>{window.__rate.ackLoss=true;});
 const loss=await ackTab.evaluate(()=>window.__rate.save('CURRENT'));
 assert.equal(loss.ok,false);assert.equal(loss.code,'SYNTHETIC_ACK_LOSS_AFTER_DURABLE_COMMIT');
 const retry=await ackTab.evaluate(()=>window.__rate.save('FUTURE'));
 assert.equal(retry.ok,false);assert.match(retry.code,/UNVERIFIED_RELOAD_REQUIRED/);
 assert.equal(await ackTab.evaluate(()=>window.__rate.persists),1);
 assert.equal(inspect(await persisted(positive)).master,'UNCHANGED');
 console.log('PASS G14_RATE_PRODUCTION_POST_COMMIT_ACK_LOSS_STICKY_HOLD_NO_BLIND_RETRY');
}finally{
 for(const p of pages)if(!p.isClosed())await p.close();
 await context.close();await browser.close();
}
