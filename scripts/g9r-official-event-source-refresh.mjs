// G9-R: conservatively promote only EXACT, officially published Growth Week notices.
// Unknown/new effect families, malformed notices and changed known facts FAIL CLOSED.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validatePublicEventManifest,validatePublicEventPayload} from '../assets/js/public-event-master-contract.js';

const BASE='https://www.pokemonsleep.net';
const INDEX=BASE+'/zh/news/';
const PAYLOAD='assets/data/public-event-master.json';
const MANIFEST='assets/data/public-event-master-manifest.json';
const ID_RE=/^https:\/\/www\.pokemonsleep\.net\/zh\/news\/[0-9]+\/$/;
const digest=s=>createHash('sha256').update(s,'utf8').digest('hex');

function htmlText(html){
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<\/(?:p|h1|h2|h3|li|div|section|br)>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v)))
    .normalize('NFKC').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n');
}
export function discoverOfficialNoticeUrls(html){
  const urls=new Set();
  for(const match of String(html).matchAll(/href=["'](https:\/\/www\.pokemonsleep\.net\/zh\/news\/[0-9]+\/|\/zh\/news\/[0-9]+\/)["']/g)){
    const url=new URL(match[1],BASE).href;if(ID_RE.test(url))urls.add(url);
  }
  return [...urls].slice(0,40);
}
function isoAt(year,month,day){
  const local=new Date(Date.UTC(year,month-1,day)); // validate the calendar date, render exact event-local 04:00 without guessed offsets
  if(local.getUTCFullYear()!==year||local.getUTCMonth()+1!==month||local.getUTCDate()!==day)throw new Error('G9R_DATE_INVALID');
  return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')+'T04:00:00+08:00';
}
export function parseVerifiedGrowthNotice(html,url,{now=new Date()}={}){
  if(!ID_RE.test(url))throw new Error('G9R_OFFICIAL_DOMAIN_ONLY');
  const text=htmlText(html);
  const title=text.match(/寶可夢快快長大週\s*vol\.?\s*(\d+)/i);
  if(!title)return null; // Other activity families remain unsupported by this exact adapter.
  if(!/所有營地/.test(text))throw new Error('G9R_GROWTH_CAMP_NOT_VERIFIED');
  const pub=text.match(/202[0-9]\/(\d{1,2})\/(\d{1,2})/);
  const yearText=text.match(/(202[0-9])\/\d{1,2}\/\d{1,2}/);
  if(!yearText||!pub)throw new Error('G9R_GROWTH_PUBLICATION_YEAR_NOT_VERIFIED');
  const period=text.match(/(\d{1,2})\/(\d{1,2})[^\n]{0,35}?4:00\s*[～~−–\-]\s*(\d{1,2})\/(\d{1,2})[^\n]{0,35}?3:59/);
  if(!period)throw new Error('G9R_GROWTH_PERIOD_NOT_VERIFIED');
  let year=Number(yearText[1]),m=Number(period[1]),day=Number(period[2]);
  if(m<Number(pub[1])-6)year+=1;
  const start=isoAt(year,m,day);
  const endYear=Number(period[3])<m?year+1:year;
  const end=isoAt(endYear,Number(period[3]),Number(period[4]));
  if(Date.parse(end)-Date.parse(start)!==7*24*3600000)throw new Error('G9R_GROWTH_NOT_SEVEN_DAYS');
  if(Date.parse(start)<now.getTime()-21*24*3600000||Date.parse(start)>now.getTime()+90*24*3600000)
    return null; // no backfill of stale historic notices in scheduled auto mode
  const exp=/幫手寶可夢.{0,8}睡眠\s*EXP.{0,16}1[.,]5\s*倍/i.test(text);
  const candy=/(?:當天|1日|每日).{0,6}第\s*1\s*次.{0,20}睡眠研究.{0,28}糖果.{0,20}1[.,]5\s*倍/.test(text)
   || /當天第1次睡眠研究後的糖果獲得量.{0,10}1[.,]5倍/.test(text);
  if(!exp||!candy)throw new Error('G9R_GROWTH_EFFECT_NOT_EXACTLY_VERIFIED');
  // G9R: the exact two documented bonuses are the ONLY admitted auto-VERIFIED
  // source lines. Additional or reformulated bonuses require human review.
  // This intentionally fails closed if the official article structure changes.
  const allDays=text.match(/〖所有日子〗([\s\S]*?)(?:注意事項|〖注意事項〗)/);
  if(!allDays)throw new Error('G9R_GROWTH_BONUS_SECTION_REVIEW_REQUIRED');
  const bonusLines=allDays[1].split('\n').map(line=>line.trim().replace(/^[・•]\s*/,'')).filter(Boolean);
  const exactSleep=line=>/^幫手寶可夢(?:的)?睡眠\s*EXP\s*[:：]?\s*1[.,]5\s*倍\s*[。.]?$/.test(line);
  const exactCandy=line=>/^當天第\s*1\s*次睡眠研究後的糖果獲得量(?:變成)?\s*1[.,]5\s*倍\s*[。.]?$/.test(line);
  if(bonusLines.length!==2||!bonusLines.some(exactSleep)||!bonusLines.some(exactCandy))
    throw new Error('G9R_GROWTH_UNRECOGNIZED_BONUS_REVIEW_REQUIRED');
  const id='growth_week_vol'+String(Number(title[1]))+'_'+String(year)+'_'+String(m).padStart(2,'0');
  const verifiedAt=new Date().toISOString();
  return {
    event_id:id,title:'寶可夢快快長大週 vol.'+String(Number(title[1])),locale:'zh-TW',region:'GLOBAL',
    start_at:start,end_at:end,camp_scope:['*'],effects:{sleep_exp_multiplier:1.5,pokemon_candy_multiplier:1.5},
    phases:[],missions:[],rewards:[],
    limited_mechanics:['幫手睡眠 EXP 1.5 倍，依睡眠資料開始測量時間判定','當日第一次睡眠研究獲得糖果 1.5 倍，第二次研究不適用；不是使用糖果 EXP 倍率','相同活動效果重疊取最大；薰香倍率獨立疊加'],
    authority_status:'VERIFIED',
    source:{source_type:'OFFICIAL_ANNOUNCEMENT',source_name:'Pokémon Sleep 官方網站：寶可夢快快長大週 vol.'+String(Number(title[1])),source_ref:url,verified_at:verifiedAt,note:'G9-R 僅限已鎖定且具 exact official text pattern 的睡眠 EXP 和首次研究糖果。新效果維持 REVIEW_REQUIRED。'},
    field_provenance:{
      identity:{status:'VERIFIED',source_ref:url},period:{status:'VERIFIED',time_zone:'Asia/Taipei',end_exclusive:true,source_ref:url},
      event_effects:{status:'VERIFIED',source_ref:url,verified_keys:['sleep_exp_multiplier','pokemon_candy_multiplier'],
        pokemon_candy_multiplier_scope:'FIRST_SLEEP_RESEARCH_OF_DAY_ONLY',
        sleep_exp_scope:'HELPER_SLEEP_TRACKING_STARTED_INSIDE_EVENT',same_key_overlaps:'MAX',incense_stacking:'SEPARATE',
        not_candy_use_exp:true,deterministic_model_status:'FEATURE_ONLY_NOT_PLAYER_WRITE',
        verification_method:'EXACT_SUPPORTED_OFFICIAL_TEXT_CONTRACT'}
    }
  };
}
// DATA-ONLY release admission: both old and new manifest bytes are validated,
// every preexisting public event stays immutable, and only independently parsed,
// exact official Growth Week candidates may be appended. No player data or app
// runtime artifact is ever accepted as an input to this gate.
export function verifyG9RDataOnlyRelease({
  beforePayloadText,beforeManifestText,afterPayloadText,afterManifestText,expectedNewEvents,
}={}){
  const require=(ok,reason)=>{if(!ok)throw new Error('G9R_DATA_ONLY_RELEASE_HOLD:'+reason);};
  const beforeManifest=validatePublicEventManifest(JSON.parse(beforeManifestText));
  const afterManifest=validatePublicEventManifest(JSON.parse(afterManifestText));
  require(digest(beforePayloadText)===beforeManifest.payload_sha256,'BASE_SHA256_MISMATCH');
  require(digest(afterPayloadText)===afterManifest.payload_sha256,'CANDIDATE_SHA256_MISMATCH');
  require(beforeManifest.payload_path===afterManifest.payload_path,'PAYLOAD_PATH_CHANGED');
  require(beforeManifest.schema===afterManifest.schema&&beforeManifest.locale===afterManifest.locale
    &&beforeManifest.region===afterManifest.region&&beforeManifest.authority_version===afterManifest.authority_version,
    'MANIFEST_AUTHORITY_CHANGED');
  require(afterManifest.master_version!==beforeManifest.master_version,'MASTER_VERSION_NOT_ROTATED');
  require(afterManifest.payload_sha256!==beforeManifest.payload_sha256,'PAYLOAD_SHA_NOT_CHANGED');
  const beforeRaw=JSON.parse(beforePayloadText),afterRaw=JSON.parse(afterPayloadText);
  const before=validatePublicEventPayload(beforeRaw,{expectedVersion:beforeManifest.master_version});
  const after=validatePublicEventPayload(afterRaw,{expectedVersion:afterManifest.master_version});
  require(before.schema===after.schema&&before.locale===after.locale&&before.region===after.region
    &&before.registry_version===after.registry_version,'PAYLOAD_AUTHORITY_CHANGED');
  require(Array.isArray(expectedNewEvents)&&expectedNewEvents.length>0,'NO_NEW_VERIFIED_EVENTS');
  require(afterRaw.events.length===beforeRaw.events.length+expectedNewEvents.length,'APPEND_ONLY_COUNT');
  for(let i=0;i<beforeRaw.events.length;i++){
    require(JSON.stringify(beforeRaw.events[i])===JSON.stringify(afterRaw.events[i]),'EXISTING_EVENT_MUTATED:'+i);
  }
  for(let i=0;i<expectedNewEvents.length;i++){
    const event=afterRaw.events[beforeRaw.events.length+i];
    require(JSON.stringify(event)===JSON.stringify(expectedNewEvents[i]),'EVENT_NOT_EXACT_SOURCE_PROJECTION:'+i);
    require(/^growth_week_vol[0-9]+_20[0-9]{2}_[0-9]{2}$/.test(event.event_id),'UNSUPPORTED_EVENT_FAMILY');
    require(event.authority_status==='VERIFIED'&&event.field_provenance?.event_effects?.verification_method
      ==='EXACT_SUPPORTED_OFFICIAL_TEXT_CONTRACT','UNVERIFIED_EVENT');
    require(/^https:\/\/www\.pokemonsleep\.net\/zh\/news\/[0-9]+\/$/.test(event.source?.source_ref||''),
      'OFFICIAL_SOURCE_REQUIRED');
    require(event.field_provenance?.event_effects?.not_candy_use_exp===true
      &&event.field_provenance?.event_effects?.deterministic_model_status==='FEATURE_ONLY_NOT_PLAYER_WRITE',
      'FEATURE_ONLY_SCOPE');
    require(event.start_at.endsWith('T04:00:00+08:00')&&event.end_at.endsWith('T04:00:00+08:00')
      &&Date.parse(event.end_at)-Date.parse(event.start_at)===7*86400000,'TIME_BOUNDARY');
  }
  // The validator also checks unique event ids, supported typed effects and source fields.
  require(after.events.length===afterRaw.events.length,'NORMALIZED_EVENT_COUNT');
  return Object.freeze({status:'READY_FOR_CONTROLLED_DATA_ONLY_PR',from_version:before.master_version,
    to_version:after.master_version,new_event_count:expectedNewEvents.length,
    payload_sha256:afterManifest.payload_sha256,player_write:false,app_version_bump:false});
}

async function get(url){
  if(!url.startsWith(INDEX))throw new Error('G9R_UNTRUSTED_FETCH_URL');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(url,{headers:{'Accept':'text/html','User-Agent':'PokemonSleepAIMgr-G9R-SourceVerification/1.0'},signal:controller.signal,redirect:'error'});
    if(!response.ok)throw new Error('G9R_OFFICIAL_FETCH_'+response.status);
    return await response.text();
  }finally{clearTimeout(timeout);}
}
export async function discoverAndStage({fetchHtml=get,write=false,now=new Date()}={}){
  const base=JSON.parse(readFileSync(PAYLOAD,'utf8'));
  const manifest=JSON.parse(readFileSync(MANIFEST,'utf8'));
  if(!base.events||!Array.isArray(base.events)||manifest.master_version!==base.master_version)throw new Error('G9R_LOCAL_SEED_NOT_MATCHED');
  if(digest(readFileSync(PAYLOAD,'utf8'))!==manifest.payload_sha256)throw new Error('G9R_LOCAL_PAYLOAD_SHA_MISMATCH');
  const listing=await fetchHtml(INDEX);
  const links=discoverOfficialNoticeUrls(listing);
  if(!links.length)throw new Error('G9R_NO_OFFICIAL_LINKS');
  let pagesRead=0;const newEvents=[];
  // Deliberately serial to avoid hammering the official service.
  for(const url of links.slice(0,30)){
    let html;
    try{html=await fetchHtml(url);pagesRead+=1;}catch(error){
      console.warn('G9R_SOURCE_PAGE_NOT_AVAILABLE',url,error?.message||String(error));continue;
    }
    const candidate=parseVerifiedGrowthNotice(html,url,{now});
    if(!candidate)continue;
    const existing=base.events.find(event=>event.event_id===candidate.event_id);
    if(existing){
      const fields=['title','start_at','end_at','camp_scope','effects'];
      for(const field of fields)if(JSON.stringify(existing[field])!==JSON.stringify(candidate[field]))
        throw new Error('G9R_OFFICIAL_AMENDED_FACT_REVIEW_REQUIRED:'+candidate.event_id+':'+field);
      continue;
    }
    if(!newEvents.find(e=>e.event_id===candidate.event_id))newEvents.push(candidate);
  }
  if(!pagesRead)throw new Error('G9R_NO_OFFICIAL_ARTICLE_READABLE');
  if(!newEvents.length)return Object.freeze({status:'UNCHANGED',pagesRead,scanned:links.length});
  newEvents.sort((a,b)=>a.start_at.localeCompare(b.start_at));
  base.events.push(...newEvents);
  base.master_version='public-event-master-tw-'+newEvents[newEvents.length-1].start_at.slice(0,10)+'-growth-feed-'+newEvents.length;
  base.generated_at=new Date().toISOString();
  validatePublicEventPayload(base,{expectedVersion:base.master_version});
  const payloadText=JSON.stringify(base,null,2)+'\n';
  manifest.master_version=base.master_version;
  manifest.generated_at=base.generated_at;
  manifest.payload_sha256=digest(payloadText);
  const releaseGate=verifyG9RDataOnlyRelease({
    beforePayloadText:readFileSync(PAYLOAD,'utf8'),
    beforeManifestText:readFileSync(MANIFEST,'utf8'),
    afterPayloadText:payloadText,
    afterManifestText:JSON.stringify(manifest,null,2)+'\n',
    expectedNewEvents:newEvents,
  });
  if(releaseGate.status!=='READY_FOR_CONTROLLED_DATA_ONLY_PR')throw new Error('G9R_RELEASE_NOT_ADMITTED');
  if(write){
    // The scheduler will propose these bytes via a PR; never commit directly to main.
    writeFileSync(PAYLOAD,payloadText);
    writeFileSync(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
  }
  return Object.freeze({status:write?'STAGED_FOR_PR':'DRY_RUN_NEW_EVENTS',events:newEvents.map(x=>x.event_id),
    pagesRead,sha256:manifest.payload_sha256,player_write:false,app_version_bump:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  discoverAndStage({write:process.argv.includes('--write')})
    .then(result=>console.log('G9R_OFFICIAL_DISCOVERY='+JSON.stringify(result)))
    .catch(error=>{console.error('G9R_HOLD_SOURCE_REVIEW',error?.message||String(error));process.exitCode=1;});
}
