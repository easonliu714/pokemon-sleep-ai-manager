// G9-R: conservatively promote only EXACT, officially published Growth Week notices.
// Unknown/new effect families, malformed notices and changed known facts FAIL CLOSED.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validatePublicEventPayload} from '../assets/js/public-event-master-contract.js';

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
