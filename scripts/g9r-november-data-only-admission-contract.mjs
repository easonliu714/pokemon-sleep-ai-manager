// G9R November: source/test-only append-only admission. NEVER publishes or writes player data.
// Official source parser is the only candidate producer; this is a byte-bound release guard.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validatePublicEventManifest,validatePublicEventPayload,resolvePublicEventProjection} from '../assets/js/public-event-master-contract.js';
import {parseVerifiedNovemberOfficialNotice,NOVEMBER_OFFICIAL_NOTICE_URLS} from './g9r-november-official-notice-strict-parser.mjs';
import {moonHtml,prepHtml} from './g9r-november-official-notice-strict-contract.mjs';

const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const fail=reason=>{throw new Error('G9R_NOVEMBER_DATA_ONLY_HOLD:'+reason);};
const need=(ok,why)=>{if(!ok)fail(why);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rules=Object.freeze([
  {id:'new_moon_day_19_2026_11',url:NOVEMBER_OFFICIAL_NOTICE_URLS.new_moon,
    start:'2026-11-08T04:00:00+08:00',end:'2026-11-11T04:00:00+08:00',
    keys:['shiny_encounter_possible','unknown_effects']},
  {id:'meal_prep_week_vol1_2026_11',url:NOVEMBER_OFFICIAL_NOTICE_URLS.meal_prep,
    start:'2026-11-09T04:00:00+08:00',end:'2026-11-16T04:00:00+08:00',
    keys:['recipe_final_energy_multiplier','cross_sleep_type_encounters','limited_feature','unknown_effects']},
]);

export function validateNovemberPublishedEvent(event){
  const r=rules.find(x=>x.id===event?.event_id);
  need(Boolean(r),'UNSUPPORTED_EVENT_ID');
  need(event.start_at===r.start&&event.end_at===r.end,'0400_HALF_OPEN_BOUNDARY');
  need(event.locale==='zh-TW'&&event.region==='GLOBAL'&&equal(event.camp_scope,['*']),'ALL_CAMPS_NOT_PLAYER_CAMP');
  need(event.authority_status==='PARTIAL_VERIFIED','PARTIAL_VERIFIED_REQUIRED');
  need(equal(event.phases,[])&&equal(event.missions,[])&&equal(event.rewards,[]),'UNVERIFIED_MISSION_OR_PHASE');
  need(event.source?.source_type==='OFFICIAL_ANNOUNCEMENT'&&event.source?.source_ref===r.url,'OFFICIAL_SOURCE_MISMATCH');
  const f=event.field_provenance;
  for(const key of ['identity','period','camp_scope']){
    need(f?.[key]?.source_ref===r.url&&f?.[key]?.status==='VERIFIED','FIELD_SOURCE_'+key);
  }
  need(f.period.end_exclusive===true,'END_EXCLUSIVE');
  const e=f?.event_effects;
  need(e?.source_ref===r.url&&e?.status==='PARTIAL_VERIFIED'
    &&e?.verification_method==='EXACT_OFFICIAL_ZH_TW_NOVEMBER_2026_NOTICE_CONTRACT'
    &&e?.conditional_research_rewards_not_global===true
    &&e?.same_key_overlaps==='MAX_IF_SOURCE_PROVEN_ELSE_REVIEW','EFFECT_SOURCE_SCOPE');
  need(equal(Object.keys(event.effects||{}),r.keys),'UNKNOWN_OR_MISSING_EFFECT_KEYS');
  need(Array.isArray(event.effects.unknown_effects)&&event.effects.unknown_effects.length===2
    &&event.effects.unknown_effects.every(x=>typeof x?.source_text==='string'&&x.source_text.length>15),'REVIEW_QUEUE_MISSING');
  for(const key of ['pokemon_candy_multiplier','dream_shards_multiplier','research_exp_multiplier','drowsy_power_multiplier','main_skill_trigger_multiplier','sunday_pot_multiplier'])
    need(!Object.hasOwn(event.effects,key),'CONDITIONAL_EFFECT_GLOBALIZED_'+key);
  if(r.id===rules[0].id){
    need(event.effects.shiny_encounter_possible===true
      &&e.unmodeled?.includes('DARKRAI_ENCOUNTER_CHANCE')
      &&e.unmodeled?.includes('DARKRAI_SCOPED_FRIENDSHIP_POINTS_PLUS_3'),'DARKRAI_UNMODELED_SCOPE');
  }else{
    need(event.effects.recipe_final_energy_multiplier===1.25
      &&event.effects.cross_sleep_type_encounters===true
      &&event.effects.limited_feature==='迷你糖果增強','PREP_TYPED_FACTS');
    for(const key of ['INGREDIENT_SPECIALTY_RESEARCH_CANDY_AND_SHARDS_X1_5',
      'INGREDIENT_FINDER_S_RESEARCH_CANDY_AND_SHARDS_X1_5','MINI_CANDY_USE_EXP_AND_SHARD_COST'])
      need(e.unmodeled?.includes(key),'CONDITIONAL_PREP_SCOPE_'+key);
  }
  return true;
}

export function verifyNovemberDataOnlyRelease({beforePayloadText,beforeManifestText,afterPayloadText,
  afterManifestText,sourceParsedEvents}={}){
  const oldManifest=validatePublicEventManifest(JSON.parse(beforeManifestText));
  const nextManifest=validatePublicEventManifest(JSON.parse(afterManifestText));
  need(hash(beforePayloadText)===oldManifest.payload_sha256,'BASE_SHA256_MISMATCH');
  need(hash(afterPayloadText)===nextManifest.payload_sha256,'NEW_SHA256_MISMATCH');
  need(oldManifest.master_version!==nextManifest.master_version,'MASTER_VERSION_UNCHANGED');
  for(const key of ['schema','payload_path','locale','region','authority_version'])
    need(oldManifest[key]===nextManifest[key],'MANIFEST_AUTHORITY_CHANGED_'+key);
  const oldRaw=JSON.parse(beforePayloadText),nextRaw=JSON.parse(afterPayloadText);
  const old=validatePublicEventPayload(oldRaw,{expectedVersion:oldManifest.master_version});
  const next=validatePublicEventPayload(nextRaw,{expectedVersion:nextManifest.master_version});
  for(const key of ['schema','locale','region','registry_version'])
    need(old[key]===next[key],'PAYLOAD_AUTHORITY_CHANGED_'+key);
  need(Array.isArray(sourceParsedEvents)&&sourceParsedEvents.length===2,'TWO_INDEPENDENT_PARSED_NOTICES_REQUIRED');
  need(nextRaw.events.length===oldRaw.events.length+2,'APPEND_ONLY_COUNT');
  oldRaw.events.forEach((e,i)=>need(equal(e,nextRaw.events[i]),'EXISTING_EVENT_CHANGED_'+i));
  rules.forEach((r,i)=>{
    const parsed=sourceParsedEvents[i],published=nextRaw.events[oldRaw.events.length+i];
    need(parsed?.event_id===r.id,'PARSED_EVENT_ORDER');
    validateNovemberPublishedEvent(parsed);
    need(equal(published,parsed),'PUBLISHED_NOT_EXACT_PARSED_SOURCE_'+r.id);
    validateNovemberPublishedEvent(published);
  });
  need(next.events.length===nextRaw.events.length,'NORMALIZED_EVENT_COUNT');
  for(const camp of ['黃金舊發電廠','萌綠之島','萌綠之島EX']){
    const at=iso=>resolvePublicEventProjection(next,{date:new Date(iso),camp});
    need(at('2026-11-08T03:59:59+08:00').active_event_count===0,'PRE_START');
    const overlap=at('2026-11-09T04:00:00+08:00');
    need(overlap.active_event_count===2&&overlap.camp===camp,'TWO_CAMPAIGNS_NO_CAMP_MUTATION');
    need(overlap.strategy_event_effects.recipe_final_energy_multiplier===1.25,'RECIPE_TYPED_125');
    need(!Object.hasOwn(overlap.event_effects,'pokemon_candy_multiplier')
      &&!Object.hasOwn(overlap.event_effects,'dream_shards_multiplier'),'NO_GLOBAL_RESEARCH_REWARDS');
    need(at('2026-11-11T04:00:00+08:00').active_event_count===1,'MOON_END_EXCLUSIVE');
    need(at('2026-11-16T04:00:00+08:00').active_event_count===0,'PREP_END_EXCLUSIVE');
  }
  return Object.freeze({status:'READY_FOR_CONTROLLED_DATA_ONLY_PR',
    payload_sha256:nextManifest.payload_sha256,new_events:rules.map(x=>x.id),
    player_write:false,app_version_bump:false});
}

// Test-only synthetic after-image; no filesystem writes and no production publication.
if(process.argv[1]?.endsWith('/g9r-november-data-only-admission-contract.mjs')){
  const beforePayloadText=readFileSync('assets/data/public-event-master.json','utf8');
  const beforeManifestText=readFileSync('assets/data/public-event-master-manifest.json','utf8');
  const events=[
    parseVerifiedNovemberOfficialNotice(moonHtml,rules[0].url,{verifiedAt:'2026-11-02T04:50:00.000Z'}),
    parseVerifiedNovemberOfficialNotice(prepHtml,rules[1].url,{verifiedAt:'2026-11-02T04:50:00.000Z'}),
  ];
  const before=JSON.parse(beforePayloadText),oldManifest=JSON.parse(beforeManifestText);
  // If data has already been released, use only the historical prefix for synthetic
  // admission, never mutate or re-append the published events.
  const prefix=before.events.filter(e=>!rules.some(r=>r.id===e.event_id));
  const base={...before,events:prefix};
  const baseText=JSON.stringify(base,null,2)+'\n';
  const baseManifestText=JSON.stringify({...oldManifest,payload_sha256:hash(baseText)},null,2)+'\n';
  const next={...base,master_version:'synthetic-november-admission-only',
    events:[...prefix,...events]};
  const nextText=JSON.stringify(next,null,2)+'\n';
  const nextManifestText=JSON.stringify({...oldManifest,master_version:next.master_version,
    payload_sha256:hash(nextText)},null,2)+'\n';
  const args={beforePayloadText:baseText,beforeManifestText:baseManifestText,
    afterPayloadText:nextText,afterManifestText:nextManifestText,sourceParsedEvents:events};
  assert.equal(verifyNovemberDataOnlyRelease(args).status,'READY_FOR_CONTROLLED_DATA_ONLY_PR');
  const rejects=(change,label)=>{
    const draft=JSON.parse(nextText);change(draft);
    const bytes=JSON.stringify(draft,null,2)+'\n';
    const manifestText=JSON.stringify({...JSON.parse(nextManifestText),payload_sha256:hash(bytes)},null,2)+'\n';
    assert.throws(()=>verifyNovemberDataOnlyRelease({...args,afterPayloadText:bytes,afterManifestText:manifestText}),
      /G9R_NOVEMBER_DATA_ONLY_HOLD|public event|effect/i,label);
  };
  rejects(d=>{d.events[0].title+='tamper';},'immutable old events');
  rejects(d=>{d.events.at(-1).effects.recipe_final_energy_multiplier=1.5;},'numeric drift');
  rejects(d=>{d.events.at(-1).effects.pokemon_candy_multiplier=1.5;},'conditional global candy');
  rejects(d=>{d.events.at(-1).camp_scope=['萌綠之島'];},'camp narrowing');
  rejects(d=>{d.events.at(-1).source.source_ref=rules[0].url;},'source collision');
  rejects(d=>{d.events.at(-1).end_at='2026-11-17T04:00:00+08:00';},'boundary drift');
  rejects(d=>{d.events.at(-1).field_provenance.event_effects.verification_method='AI_GUESS';},'source not verified');
  rejects(d=>{d.events.push({...d.events.at(-1),event_id:'banquet_2026_11'});},'banquet preview unsupported');
  assert.throws(()=>verifyNovemberDataOnlyRelease({...args,afterManifestText:baseManifestText}),
    /G9R_NOVEMBER_DATA_ONLY_HOLD/);
  console.log('PASS G9R_NOVEMBER_SYNTHETIC_APPEND_ONLY_SHA_PROVENANCE_0400_OVERLAP');
  console.log('PASS G9R_NOVEMBER_NEGATIVE_EXISTING_SOURCE_SCOPE_NUMERIC_BANQUET_FAIL_CLOSED');
  console.log('HOLD G9R_NOVEMBER_LIVE_OFFICIAL_HTML_AND_ACTUAL_DATA_ONLY_RELEASE_ANDROID_UAT');
}