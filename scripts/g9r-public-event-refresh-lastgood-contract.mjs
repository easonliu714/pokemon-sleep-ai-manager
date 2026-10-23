// G9-R: execute the actual .22 refresh module against an isolated, in-memory
// SQLite API mock. Future event is SYNTHETIC, never shipped as public data.
// Proves the network/validation/transaction/last-good state machine without
// touching browser player data or requiring a new PWA runtime version.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import * as contract from '../assets/js/public-event-master-contract.js';

const read=p=>readFileSync(p,'utf8');
const original=read('assets/js/public-event-master-store.js');
const dbImport="import {begin,commit,isDatabaseReady,isRescueReadonly,persist,rollback,rows,run} from './database.js';";
const contractImport="import {nextPublicEventBoundary,PUBLIC_EVENT_MASTER_SCHEMA,resolvePublicEventProjection,validatePublicEventManifest,validatePublicEventPayload} from './public-event-master-contract.js';";
assert.ok(original.includes(dbImport)&&original.includes(contractImport),'Actual .22 refresh entrypoints must remain wired');
const previousCrypto=globalThis.crypto;
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const database={settings:new Map(),events:[],phases:[],privateRows:[{pokemon_id:'PRIVATE_SENTINEL',level:29}],transaction:null};
const privateBefore=JSON.stringify(database.privateRows);
let persistCount=0,beginCount=0,commitCount=0,rollbackCount=0,failNextEventWrite=false;
function rows(sql,args=[]){
  if(sql.startsWith('SELECT value_json FROM settings')){
    const val=database.settings.get(args[0]);return val===undefined?[]:[{value_json:val}];
  }
  if(sql.startsWith('PRAGMA integrity_check'))return [{integrity_check:'ok'}];
  if(sql.startsWith('SELECT COUNT(*) AS count FROM public_event_master'))return [{count:database.events.length}];
  if(sql.startsWith('SELECT COUNT(*) AS count FROM public_event_phase'))return [{count:database.phases.length}];
  if(sql.startsWith('SELECT event_id,title,locale,region,start_at,end_at,camp_scope_json'))
    return [...database.events].sort((a,b)=>a.start_at.localeCompare(b.start_at)||a.event_id.localeCompare(b.event_id));
  if(sql.startsWith('SELECT event_id,phase_id,title,start_at,end_at,effects_json'))
    return [...database.phases].sort((a,b)=>a.event_id.localeCompare(b.event_id)||a.start_at.localeCompare(b.start_at));
  throw new Error('G9R_UNEXPECTED_SQL_QUERY:'+sql);
}
function run(sql,params=[]){
  if(/(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?(?:pokemon|ingredient_inventory|item_inventory|candy_inventory|weekly_context|recipes)\b/i.test(sql))
    throw new Error('G9R_PLAYER_TABLE_WRITE_FORBIDDEN:'+sql);
  if(sql==='DELETE FROM public_event_phase'){database.phases=[];return;}
  if(sql==='DELETE FROM public_event_master'){database.events=[];return;}
  if(sql.startsWith('INSERT INTO public_event_master')){
    if(failNextEventWrite){failNextEventWrite=false;throw new Error('G9R_SYNTHETIC_SQLITE_WRITE_FAULT');}
    const names=['event_id','title','locale','region','start_at','end_at','camp_scope_json','effects_json','missions_json','rewards_json','limited_mechanics_json','authority_status','source_json','field_provenance_json','data_version','updated_at'];
    database.events.push(Object.fromEntries(names.map((key,i)=>[key,params[i]])));return;
  }
  if(sql.startsWith('INSERT INTO public_event_phase')){
    const names=['event_id','phase_id','title','start_at','end_at','effects_json','mission_period_json','authority_status','source_json','data_version','updated_at'];
    database.phases.push(Object.fromEntries(names.map((key,i)=>[key,params[i]])));return;
  }
  if(sql.startsWith('INSERT OR REPLACE INTO settings')){
    database.settings.set(params[0],params[1]);return;
  }
  throw new Error('G9R_UNEXPECTED_SQL_WRITE:'+sql);
}
const begin=()=>{assert.equal(database.transaction,null,'No nested transaction');database.transaction={
  settings:new Map(database.settings),events:structuredClone(database.events),phases:structuredClone(database.phases),
};beginCount++;};
const commit=()=>{assert.ok(database.transaction);database.transaction=null;commitCount++;};
const rollback=()=>{assert.ok(database.transaction);database.settings=database.transaction.settings;
  database.events=database.transaction.events;database.phases=database.transaction.phases;
  database.transaction=null;rollbackCount++;};
const persist=async()=>{assert.equal(database.transaction,null);persistCount++;};
globalThis.__g9rRefreshContract=contract;
globalThis.__g9rRefreshDb={begin,commit,isDatabaseReady:()=>true,isRescueReadonly:()=>false,persist,rollback,rows,run};
const transformed=original.replace(dbImport,'const {begin,commit,isDatabaseReady,isRescueReadonly,persist,rollback,rows,run}=globalThis.__g9rRefreshDb;')
  .replace(contractImport,'const {nextPublicEventBoundary,PUBLIC_EVENT_MASTER_SCHEMA,resolvePublicEventProjection,validatePublicEventManifest,validatePublicEventPayload}=globalThis.__g9rRefreshContract;');
assert.ok(!transformed.includes(dbImport)&&!transformed.includes(contractImport));
const store=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));

const payloadBefore=read('assets/data/public-event-master.json');
const manifestBefore=read('assets/data/public-event-master-manifest.json');
const base=JSON.parse(payloadBefore);
const baseManifest=JSON.parse(manifestBefore);
const date=new Date('2026-10-13T19:00:00+08:00');
let offeredPayload=payloadBefore,offeredManifest=manifestBefore,offline=false,badFetch=false;
const fetchImpl=async (url,options)=>{
  assert.equal(options?.cache,'no-store');
  assert.equal(options?.credentials,'same-origin');
  assert.ok(String(url).includes('__public_event_refresh='),'Manifest and payload must be network fresh');
  if(offline)throw new Error('SYNTHETIC_NETWORK_OFFLINE');
  return {ok:!badFetch,status:badFetch?503:200,
    text:async()=>String(url).includes('public-event-master-manifest')?offeredManifest:offeredPayload};
};
const opts={fetchImpl,date,camp:'黃金舊發電廠'};
const cold=await store.refreshPublicEventMaster(opts);
assert.equal(cold.status,'UPDATED');
assert.equal(cold.cached_version,base.master_version);
assert.equal(database.events.length,4,'2026 official Halloween event must be loaded alongside frozen original three');
assert.ok(database.events.some(x=>x.event_id==='halloween_double_candy_2026_10'));
assert.equal(database.privateRows[0].pokemon_id,'PRIVATE_SENTINEL');
assert.equal(JSON.stringify(database.privateRows),privateBefore);
assert.equal(database.settings.get('public_event_master_payload_sha256'),JSON.stringify(baseManifest.payload_sha256));

const same=await store.refreshPublicEventMaster(opts);
assert.equal(same.status,'UNCHANGED');
assert.equal(persistCount,1,'Same manifest must not rewrite even public cache');

// G9-R 2026-10-26 OWNER READINESS: actual published Halloween payload,
// real refresh store + mock-only public SQLite with network unavailable.
// This is a synthetic temporal/preflight contract, NOT Android/offline Owner PASS.
const officialFrozenRows=JSON.stringify(database.events);
const officialFrozenPhases=JSON.stringify(database.phases);
const officialFrozenSha=database.settings.get('public_event_master_payload_sha256');
const officialFrozenVersion=base.master_version;
const phaseCases=[
  {at:'2026-10-26T03:59:59+08:00',camp:'萌綠之島',phase:null,candy:null},
  {at:'2026-10-26T04:00:00+08:00',camp:'萌綠之島',phase:'halloween_regular_days',candy:2},
  {at:'2026-10-30T23:59:59+08:00',camp:'萌綠之島EX',phase:'halloween_regular_days',candy:2},
  {at:'2026-10-31T03:59:59+08:00',camp:'萌綠之島',phase:'halloween_regular_days',candy:2},
  {at:'2026-10-31T04:00:00+08:00',camp:'萌綠之島',phase:'halloween_final_two_days',candy:3},
  {at:'2026-11-01T12:00:00+08:00',camp:'萌綠之島EX',phase:'halloween_final_two_days',candy:3},
  {at:'2026-10-31T04:00:00+08:00',camp:'黃金舊發電廠',phase:null,candy:null},
  {at:'2026-11-02T03:59:59+08:00',camp:'萌綠之島',phase:'halloween_final_two_days',candy:3},
  {at:'2026-11-02T04:00:00+08:00',camp:'萌綠之島',phase:null,candy:null},
];
offline=true;
for(const testCase of phaseCases){
  const observed=await store.refreshPublicEventMaster({
    ...opts,date:new Date(testCase.at),camp:testCase.camp,
  });
  assert.equal(observed.status,'OFFLINE_CACHED','published official master offline reuse: '+testCase.at);
  assert.equal(observed.updated,false,'offline must not persist public or player rows');
  assert.equal(observed.cached_version,officialFrozenVersion);
  assert.ok(observed.error?.includes('SYNTHETIC_NETWORK_OFFLINE'));
  const projection=observed.projection;
  assert.equal(projection?.master_version,officialFrozenVersion);
  assert.equal(projection?.active_event_count,testCase.phase?1:0,'camp/clock scope: '+testCase.at);
  if(testCase.phase){
    assert.equal(projection.active_events[0].event_id,'halloween_double_candy_2026_10');
    assert.equal(projection.active_events[0].phase_id,testCase.phase);
    assert.equal(projection.feature_only_event_effects.pokemon_candy_multiplier,testCase.candy);
    assert.equal(projection.event_authority_status,'PARTIAL_VERIFIED');
    assert.equal(projection.event_effect_review_required,true);
  }else{
    assert.ok(!Object.hasOwn(projection.feature_only_event_effects,'pokemon_candy_multiplier'));
  }
  assert.ok(!Object.hasOwn(projection.strategy_event_effects,'pokemon_candy_multiplier'),
    'first sleep research candy cannot become player candy inventory or deterministic strategy');
  assert.equal(JSON.stringify(database.events),officialFrozenRows,'offline event rows must remain byte-for-byte unchanged');
  assert.equal(JSON.stringify(database.phases),officialFrozenPhases,'offline phase rows must remain unchanged');
  assert.equal(database.settings.get('public_event_master_payload_sha256'),officialFrozenSha);
  assert.equal(JSON.stringify(database.privateRows),privateBefore);
  assert.equal(persistCount,1,'offline phase rollover must not persist account/public data');
}
offline=false;
console.log('PASS G9R_20261026_OFFLINE_LASTGOOD_VERIFIED_HALLOWEEN_SCOPE_PHASE_X2_X3_NO_PLAYER_WRITE');
console.log('NOTE G9R_20261026_SYNTHETIC_CLOCK_AND_MOCK_DB_ONLY_ANDROID_OWNER_OFFLINE_PENDING');

const mockNext=structuredClone(base);
mockNext.master_version='SYNTHETIC_g9r_new_sha_not_published';
mockNext.generated_at='2026-10-13T11:00:00Z';
const synthetic=structuredClone(base.events.find(x=>x.event_id==='growth_week_vol6_2026_10'));
synthetic.event_id='growth_week_vol7_2026_10_SYNTHETIC';
synthetic.title='SYNTHETIC NEXT EVENT — NEVER OFFICIAL';
synthetic.start_at='2026-10-19T04:00:00+08:00';
synthetic.end_at='2026-10-26T04:00:00+08:00';
synthetic.source.note='SYNTHETIC TEST ONLY — NOT AN OFFICIAL ANNOUNCEMENT';
mockNext.events.push(synthetic);
offeredPayload=JSON.stringify(mockNext,null,2)+'\n';
offeredManifest=JSON.stringify({...baseManifest,master_version:mockNext.master_version,
  generated_at:mockNext.generated_at,payload_sha256:createHash('sha256').update(offeredPayload).digest('hex')},null,2)+'\n';
const beforeTuple=read('assets/js/version-authority.js');
const updated=await store.refreshPublicEventMaster({...opts,date:new Date('2026-10-19T04:00:00+08:00')});
assert.equal(updated.status,'UPDATED');
assert.equal(updated.cached_version,mockNext.master_version);
assert.equal(updated.manifest.payload_sha256,JSON.parse(offeredManifest).payload_sha256);
assert.equal(store.loadCachedPublicEventPayload().events.length,5);
assert.ok(updated.projection.active_events.some(x=>x.event_id===synthetic.event_id));
assert.equal(updated.projection.feature_only_event_effects.sleep_exp_multiplier,1.5);
assert.equal(JSON.stringify(database.privateRows),privateBefore);
assert.equal(read('assets/js/version-authority.js'),beforeTuple);
assert.equal(read('assets/data/public-event-master.json'),payloadBefore);
assert.equal(read('assets/data/public-event-master-manifest.json'),manifestBefore);
assert.equal(persistCount,2);

offline=true;
const cachedOffline=await store.refreshPublicEventMaster(opts);
assert.equal(cachedOffline.status,'OFFLINE_CACHED');
assert.equal(cachedOffline.cached_version,mockNext.master_version);
assert.equal(JSON.stringify(database.privateRows),privateBefore);
assert.equal(persistCount,2);
offline=false;
offeredManifest=JSON.stringify({...JSON.parse(offeredManifest),master_version:'SYNTHETIC_BAD_SHA',
  payload_sha256:'a'.repeat(64)})+'\n';
const rejectedSha=await store.refreshPublicEventMaster(opts);
assert.equal(rejectedSha.status,'OFFLINE_CACHED');
assert.match(rejectedSha.error,/PUBLIC_EVENT_SHA256_MISMATCH/);
assert.equal(rejectedSha.cached_version,mockNext.master_version);
assert.equal(store.loadCachedPublicEventPayload().events.length,5);
assert.equal(persistCount,2);

offeredPayload=JSON.stringify({...mockNext,master_version:'SYNTHETIC_SQL_ROLLBACK'},null,2)+'\n';
offeredManifest=JSON.stringify({...baseManifest,master_version:'SYNTHETIC_SQL_ROLLBACK',
  payload_sha256:createHash('sha256').update(offeredPayload).digest('hex')})+'\n';
failNextEventWrite=true;
const rolledBack=await store.refreshPublicEventMaster(opts);
assert.equal(rolledBack.status,'OFFLINE_CACHED');
assert.match(rolledBack.error,/G9R_SYNTHETIC_SQLITE_WRITE_FAULT/);
assert.equal(rolledBack.cached_version,mockNext.master_version);
assert.equal(database.events.length,5);
assert.equal(database.transaction,null);
assert.equal(rollbackCount,1);
assert.equal(beginCount,3);
assert.equal(commitCount,2);
assert.equal(persistCount,2);
assert.equal(JSON.stringify(database.privateRows),privateBefore);
globalThis.__g9rRefreshContract=undefined;
globalThis.__g9rRefreshDb=undefined;
if(previousCrypto===undefined)delete globalThis.crypto;
console.log('PASS G9R_ACTUAL_REFRESH_NEW_SHA_AND_UNCHANGED_VERSION_SYNTHETIC');
console.log('PASS G9R_ACTUAL_REFRESH_BAD_SHA_OFFLINE_LAST_GOOD_AND_SQL_ROLLBACK');
console.log('PASS G9R_ACTUAL_REFRESH_NO_PLAYER_TABLE_WRITE');
