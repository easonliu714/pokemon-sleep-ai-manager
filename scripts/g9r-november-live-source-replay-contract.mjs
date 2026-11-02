// G9R: read-only, exact-official-URL HTML replay against the immutable published Master.
// CI uses injected OFFLINE source responses; --live explicitly requests the current official HTML.
// Never writes files, player state, public Master, SW, app version or new inferred effects.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  validatePublicEventManifest,validatePublicEventPayload,resolvePublicEventProjection,
} from '../assets/js/public-event-master-contract.js';
import {
  NOVEMBER_OFFICIAL_NOTICE_URLS,parseVerifiedNovemberOfficialNotice,
} from './g9r-november-official-notice-strict-parser.mjs';
import {validateNovemberPublishedEvent} from './g9r-november-data-only-admission-contract.mjs';
import {moonHtml,prepHtml} from './g9r-november-official-notice-strict-contract.mjs';

const PAYLOAD='assets/data/public-event-master.json';
const MANIFEST='assets/data/public-event-master-manifest.json';
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const fail=reason=>{throw new Error('G9R_NOVEMBER_LIVE_SOURCE_HOLD:'+reason);};
const canonical=value=>JSON.stringify(value,(_,v)=>{
  if(v&&typeof v==='object'&&!Array.isArray(v))
    return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)));
  return v;
});
const EXPECTED=Object.freeze([
  {key:'new_moon',id:'new_moon_day_19_2026_11'},
  {key:'meal_prep',id:'meal_prep_week_vol1_2026_11'},
]);

// All evidence is derived from the official HTML and compared with already-published
// bytes. A changed announcement is REVIEW_REQUIRED, never auto-published.
export async function replayNovemberOfficialHtml({
  fetchImpl=globalThis.fetch,
  payloadText=readFileSync(PAYLOAD,'utf8'),
  manifestText=readFileSync(MANIFEST,'utf8'),
}={}){
  if(typeof fetchImpl!=='function')fail('FETCH_UNAVAILABLE');
  const manifest=validatePublicEventManifest(JSON.parse(manifestText));
  if(hash(payloadText)!==manifest.payload_sha256)fail('PUBLISHED_MANIFEST_SHA256');
  const payload=validatePublicEventPayload(JSON.parse(payloadText),
    {expectedVersion:manifest.master_version});
  const verifiedAt=payload.events.find(e=>e.event_id===EXPECTED[0].id)?.source?.verified_at;
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(verifiedAt||''))
    fail('PUBLISHED_SOURCE_VERIFIED_AT_MISSING');
  const observed=[];
  for(const item of EXPECTED){
    const url=NOVEMBER_OFFICIAL_NOTICE_URLS[item.key];
    let response;
    try{
      response=await fetchImpl(url,{
        redirect:'error',headers:{accept:'text/html'},
        signal:AbortSignal.timeout(12000),
      });
    }catch(error){fail('OFFICIAL_FETCH_FAILED:'+item.key+':'+(error?.name||'ERROR'));}
    if(!response?.ok||response.status!==200)fail('OFFICIAL_HTTP_NOT_200:'+item.key);
    if(response.url!==url)fail('OFFICIAL_URL_REDIRECT_OR_MISMATCH:'+item.key);
    if(!/^text\/html(?:\s*;|$)/i.test(response.headers?.get?.('content-type')||''))
      fail('OFFICIAL_CONTENT_TYPE_NOT_HTML:'+item.key);
    const html=await response.text();
    if(typeof html!=='string'||html.length<100||html.length>512000||!/<html\b/i.test(html))
      fail('OFFICIAL_HTML_SIZE_OR_DOCUMENT:'+item.key);
    const parsed=parseVerifiedNovemberOfficialNotice(html,url,{verifiedAt});
    if(parsed.event_id!==item.id)fail('CROSS_SOURCE_EVENT_ID:'+item.key);
    validateNovemberPublishedEvent(parsed);
    const published=payload.events.find(e=>e.event_id===item.id);
    if(!published||canonical(published)!==canonical(parsed))
      fail('PUBLISHED_EVENT_SOURCE_DRIFT:'+item.key);
    observed.push(Object.freeze({event_id:item.id,url,html_sha256:hash(html)}));
  }
  if(new Set(observed.map(x=>x.url)).size!==2)fail('SOURCES_NOT_INDEPENDENT');
  for(const camp of ['黃金舊發電廠','萌綠之島','萌綠之島EX']){
    const at=time=>resolvePublicEventProjection(payload,{date:new Date(time),camp});
    if(at('2026-11-08T03:59:59+08:00').active_event_count!==0||
       at('2026-11-08T04:00:00+08:00').active_event_count!==1||
       at('2026-11-09T04:00:00+08:00').active_event_count!==2||
       at('2026-11-11T04:00:00+08:00').active_event_count!==1||
       at('2026-11-16T04:00:00+08:00').active_event_count!==0)
      fail('0400_HALF_OPEN_CAMP_INDEPENDENT:'+camp);
    const overlap=at('2026-11-09T04:00:00+08:00');
    if(overlap.camp!==camp||overlap.strategy_event_effects.recipe_final_energy_multiplier!==1.25||
       Object.hasOwn(overlap.event_effects,'pokemon_candy_multiplier')||
       Object.hasOwn(overlap.event_effects,'dream_shards_multiplier'))
      fail('CAMP_OR_CONDITIONAL_REWARD_SCOPE:'+camp);
  }
  return Object.freeze({status:'SOURCE_HTML_MATCHES_PUBLISHED_MASTER',
    master_sha256:manifest.payload_sha256,observed,
    player_write:false,master_write:false,app_version_bump:false,
    android_owner_uat:'NOT_VERIFIED'});
}

async function offlineRegression(){
  const originalPayload=readFileSync(PAYLOAD,'utf8');
  const originalManifest=readFileSync(MANIFEST,'utf8');
  const source=new Map([
    [NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,moonHtml],
    [NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,prepHtml],
  ]);
  const mock=(override={})=>async url=>{
    if(override.throwNetwork)throw new TypeError('network offline');
    const body=(override.pages||source).get(url);
    return {ok:override.ok??true,status:override.status??200,
      url:override.redirectUrl||url,
      headers:{get:()=>override.contentType||'text/html; charset=utf-8'},
      text:async()=>body||''};
  };
  const baseline=await replayNovemberOfficialHtml({fetchImpl:mock(),
    payloadText:originalPayload,manifestText:originalManifest});
  assert.equal(baseline.status,'SOURCE_HTML_MATCHES_PUBLISHED_MASTER');
  assert.equal(baseline.observed.length,2);
  assert.notEqual(baseline.observed[0].html_sha256,baseline.observed[1].html_sha256);
  assert.equal(baseline.player_write,false);
  assert.equal(baseline.master_write,false);
  assert.equal(baseline.app_version_bump,false);
  const rejects=async(fetchImpl,label)=>assert.rejects(
    replayNovemberOfficialHtml({fetchImpl,payloadText:originalPayload,manifestText:originalManifest}),
    /G9R_NOVEMBER_(LIVE_SOURCE_HOLD|OFFICIAL_REVIEW_REQUIRED)/,label);
  const altered=(url,body)=>new Map([...source].map(([u,h])=>[u,u===url?body:h]));
  await rejects(mock({pages:altered(NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,
    prepHtml.replace('1.25倍','1.50倍'))}),'recipe amount changed');
  await rejects(mock({pages:altered(NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,
    moonHtml.replace('友情點數皆會提升3','友情點數皆會提升4'))}),'scoped friendship changed');
  await rejects(mock({pages:new Map([
    [NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,prepHtml],
    [NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,moonHtml],
  ])}),'source swapped');
  await rejects(mock({contentType:'text/plain'}),'content type changed');
  await rejects(mock({redirectUrl:'https://example.com/'}),'redirected source');
  await rejects(mock({ok:false,status:503}),'source unavailable');
  await rejects(mock({throwNetwork:true}),'network error');
  await rejects(mock({pages:new Map()}),'missing source');
  await assert.rejects(replayNovemberOfficialHtml({fetchImpl:mock(),
    payloadText:originalPayload+' ',manifestText:originalManifest}),
    /G9R_NOVEMBER_LIVE_SOURCE_HOLD:PUBLISHED_MANIFEST_SHA256/);
  assert.equal(readFileSync(PAYLOAD,'utf8'),originalPayload,'No Master mutation');
  assert.equal(readFileSync(MANIFEST,'utf8'),originalManifest,'No manifest mutation');
  console.log('PASS G9R_NOVEMBER_OFFLINE_INJECTED_TWO_OFFICIAL_HTML_REPLAY_SHA256_0400');
  console.log('PASS G9R_NOVEMBER_SOURCE_DRIFT_REDIRECT_NETWORK_CONTENT_TYPE_FAIL_CLOSED');
  console.log('HOLD G9R_NOVEMBER_LIVE_NETWORK_HTML_REPLAY_AND_ANDROID_OWNER_UAT');
}

const direct=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(direct&&process.argv.includes('--live')){
  replayNovemberOfficialHtml().then(result=>
    console.log('G9R_NOVEMBER_LIVE_SOURCE_REPLAY='+JSON.stringify(result)))
    .catch(error=>{console.error('HOLD G9R_NOVEMBER_LIVE_SOURCE_REPLAY',
      error?.message||String(error));process.exitCode=1;});
}else{
  await offlineRegression();
}
