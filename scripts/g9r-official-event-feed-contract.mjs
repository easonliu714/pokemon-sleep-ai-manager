import assert from 'node:assert/strict';
import {discoverOfficialNoticeUrls,parseVerifiedGrowthNotice,discoverAndStage,verifyG9RDataOnlyRelease} from './g9r-official-event-source-refresh.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  validatePublicEventManifest,
  validatePublicEventPayload,
  resolvePublicEventProjection,
  nextPublicEventBoundary,
} from '../assets/js/public-event-master-contract.js';

const raw=readFileSync('assets/data/public-event-master.json','utf8');
const manifest=validatePublicEventManifest(JSON.parse(readFileSync('assets/data/public-event-master-manifest.json','utf8')));
const digest=createHash('sha256').update(raw,'utf8').digest('hex');
assert.equal(digest,manifest.payload_sha256,'The published manifest MUST bind every payload byte to SHA-256');
const payload=validatePublicEventPayload(JSON.parse(raw),{expectedVersion:manifest.master_version});
assert.equal(manifest.payload_path,'./assets/data/public-event-master.json');
assert.equal(payload.registry_version,'weekly-event-effect-registry-2026-08-17-b-public-event-master');
assert.ok(payload.events.length>=3,'Preserve the original August + October official evidence; allow ONLY independently validated future Growth Week occurrences');
for(const e of payload.events.slice(3)){
  if(e.event_id==='halloween_double_candy_2026_10'){
    assert.equal(e.authority_status,'PARTIAL_VERIFIED');
    assert.equal(e.source.source_type,'OFFICIAL_ANNOUNCEMENT');
    assert.equal(e.source.source_ref,'https://www.pokemonsleep.net/news/343433383634343334313633353830393330/');
    assert.equal(e.field_provenance.identity.official_published_on,'2026-10-14');
    assert.equal(e.field_provenance.event_effects.verification_method,'MANUAL_OFFICIAL_JA_PLUS_OWNER_ZH_TW_NOTICE');
    assert.equal(e.field_provenance.event_effects.not_candy_use_exp,true);
    assert.equal(e.field_provenance.event_effects.deterministic_model_status,'FEATURE_ONLY_NOT_PLAYER_WRITE');
    assert.deepEqual(e.camp_scope,['萌綠之島','萌綠之島EX']);
    assert.equal(e.start_at,'2026-10-26T04:00:00+08:00');
    assert.equal(e.end_at,'2026-11-02T04:00:00+08:00');
    assert.equal(e.effects.cross_sleep_type_encounters,true);
    assert.ok(e.effects.unknown_effects.every(x=>x.rule_status==='REVIEW_REQUIRED'),'Ghost-specific bonuses must remain type-scoped REVIEW, not global numeric values');
    for(const k of ['ingredient_help_quantity_bonus','main_skill_trigger_multiplier','main_skill_level_bonus','pokemon_candy_multiplier'])
      assert.ok(!Object.hasOwn(e.effects,k),'G9R ghost buffs and phase candy must not be lifted to event-wide global effect: '+k);
    assert.equal(e.phases.length,2);
    assert.deepEqual(e.phases.map(p=>[p.phase_id,p.start_at,p.end_at,p.effects.pokemon_candy_multiplier]),[
      ['halloween_regular_days','2026-10-26T04:00:00+08:00','2026-10-31T04:00:00+08:00',2],
      ['halloween_final_two_days','2026-10-31T04:00:00+08:00','2026-11-02T04:00:00+08:00',3],
    ]);
    assert.equal(e.phases[0].end_at,e.phases[1].start_at);
    assert.ok(e.phases.every(p=>p.authority_status==='VERIFIED'&&Object.keys(p.effects).length===1));
    assert.deepEqual(e.missions,[],'No official per-mission rewards have been verified, keep blank');
    continue;
  }
  assert.match(e.event_id,/^growth_week_vol[0-9]+_20[0-9]{2}_[0-9]{2}$/,'Only fully verified known-pattern future events may join the automatic feed');
  assert.equal(e.authority_status,'VERIFIED');
  assert.equal(e.field_provenance.event_effects.verification_method,'EXACT_SUPPORTED_OFFICIAL_TEXT_CONTRACT');
  assert.equal(e.field_provenance.event_effects.not_candy_use_exp,true);
  assert.equal(e.field_provenance.event_effects.pokemon_candy_multiplier_scope,'FIRST_SLEEP_RESEARCH_OF_DAY_ONLY');
  assert.equal(Date.parse(e.end_at)-Date.parse(e.start_at),7*24*3600000);
  assert.deepEqual(e.camp_scope,['*']);
}
assert.equal(payload.events[0].event_id,'pokemon_horizons_special_collaboration_2026');
assert.equal(payload.events[0].authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(payload.events[0].effects,{});
assert.ok(payload.events[0].field_provenance.event_effects.deterministic_authority===false);

const cooking=payload.events.find(x=>x.event_id==='cooking_week_vol3_2026_10');
const growth=payload.events.find(x=>x.event_id==='growth_week_vol6_2026_10');
assert.ok(cooking&&growth);
const cookingUrl='https://www.pokemonsleep.net/zh/news/343430323735323935393936343737343435/';
const growthUrl='https://www.pokemonsleep.net/zh/news/343430333034343435353738383035323530/';
assert.equal(cooking.source.source_ref,cookingUrl);
assert.equal(growth.source.source_ref,growthUrl);
assert.equal(cooking.authority_status,'PARTIAL_VERIFIED','Not all cooking multipliers have model consumers');
assert.equal(growth.authority_status,'VERIFIED');
assert.deepEqual(cooking.camp_scope,['*']);
assert.deepEqual(growth.camp_scope,['*']);
assert.equal(growth.field_provenance.event_effects.pokemon_candy_multiplier_scope,'FIRST_SLEEP_RESEARCH_OF_DAY_ONLY');
assert.equal(growth.field_provenance.event_effects.not_candy_use_exp,true);
assert.equal(growth.field_provenance.event_effects.deterministic_model_status,'FEATURE_ONLY_NOT_PLAYER_WRITE');

const halloween=payload.events.find(x=>x.event_id==='halloween_double_candy_2026_10');
assert.ok(halloween,'Official 2026/10/14 Halloween scoped event must be in the public master');
const ht=(at,camp)=>resolvePublicEventProjection(payload,{date:new Date(at),camp});
const gh='萌綠之島',ex='萌綠之島EX',otherCamp='黃金舊發電廠';
const beforeHalloween=ht('2026-10-26T03:59:59+08:00',gh);
const firstDay=ht('2026-10-26T04:00:00+08:00',gh);
const dayFive=ht('2026-10-31T03:59:59+08:00',gh);
const halloweenNight=ht('2026-10-31T04:00:00+08:00',gh);
const lastDay=ht('2026-11-01T04:00:00+08:00',ex);
const excluded=ht('2026-11-01T12:00:00+08:00',otherCamp);
const afterHalloween=ht('2026-11-02T04:00:00+08:00',gh);
assert.equal(beforeHalloween.active_event_count,0);
assert.equal(firstDay.active_event_count,1);
assert.equal(firstDay.active_events[0].phase_id,'halloween_regular_days');
assert.equal(firstDay.feature_only_event_effects.pokemon_candy_multiplier,2);
assert.equal(dayFive.feature_only_event_effects.pokemon_candy_multiplier,2);
assert.equal(halloweenNight.active_events[0].phase_id,'halloween_final_two_days');
assert.equal(halloweenNight.feature_only_event_effects.pokemon_candy_multiplier,3);
assert.equal(lastDay.feature_only_event_effects.pokemon_candy_multiplier,3);
assert.equal(excluded.active_event_count,0,'Halloween must never apply to other camps');
assert.ok(!Object.hasOwn(excluded.feature_only_event_effects,'pokemon_candy_multiplier'));
assert.equal(afterHalloween.active_event_count,0);
for(const projection of [firstDay,halloweenNight,lastDay]){
  assert.equal(projection.event_authority_status,'PARTIAL_VERIFIED');
  assert.equal(projection.event_effect_review_required,true);
  assert.ok(!Object.hasOwn(projection.strategy_event_effects,'pokemon_candy_multiplier'));
  for(const k of ['ingredient_help_quantity_bonus','main_skill_trigger_multiplier','main_skill_level_bonus'])
    assert.ok(!Object.hasOwn(projection.strategy_event_effects,k),'Ghost buff must not contaminate team-wide strategy');
}
const boundary=nextPublicEventBoundary(payload,{date:new Date('2026-10-31T03:59:59+08:00'),camp:gh});
assert.equal(boundary.at_iso,'2026-10-30T20:00:00.000Z');
assert.equal(boundary.kind,'GAME_DAY_04');
assert.equal(readFileSync('assets/js/version-authority.js','utf8').includes("app_version: 'v0.4.27.55.3.3.22'"),true);
console.log('PASS G9R_REAL_OFFICIAL_2026_HALLOWEEN_SCOPED_CAMP_AND_PHASE_BONUSES');
console.log('PASS G9R_REAL_OFFICIAL_2026_HALLOWEEN_GHOST_ONLY_FAIL_CLOSED');

assert.equal(cooking.field_provenance.event_effects.consumer_semantics,'FEATURE_ONLY_AND_VERIFIED_EXISTING_REGISTRY_ONLY');
const at=(s)=>resolvePublicEventProjection(payload,{date:new Date(s),camp:'黃金舊發電廠'});
const before=at('2026-10-05T03:59:59+08:00');
const cookingStart=at('2026-10-05T04:00:00+08:00');
const cookingEnd=at('2026-10-12T03:59:59+08:00');
const growthStart=at('2026-10-12T04:00:00+08:00');
const growthEnd=at('2026-10-19T03:59:59+08:00');
const after=at('2026-10-19T04:00:00+08:00');
assert.equal(before.active_event_count,0);
assert.equal(cookingStart.active_event_count,1);
assert.equal(cookingEnd.active_event_count,1);
assert.equal(cookingStart.strategy_event_effects.recipe_final_energy_multiplier,1.25);
assert.equal(growthStart.active_event_count,1);
assert.equal(growthStart.event_name,'寶可夢快快長大週 vol.6');
assert.equal(growthStart.feature_only_event_effects.sleep_exp_multiplier,1.5);
assert.equal(growthStart.feature_only_event_effects.pokemon_candy_multiplier,1.5);
assert.ok(!Object.hasOwn(growthStart.strategy_event_effects,'sleep_exp_multiplier'));
assert.ok(!Object.hasOwn(growthStart.strategy_event_effects,'pokemon_candy_multiplier'));
assert.equal(growthEnd.active_event_count,1);
assert.ok(!after.active_events.some(item=>item.event_id==='growth_week_vol6_2026_10'),'The October growth bonus MUST expire exactly at 10/19 04:00 even if future events are present');
const next=nextPublicEventBoundary(payload,{date:new Date('2026-10-12T03:59:59+08:00'),camp:'黃金舊發電廠'});
assert.equal(next.at_iso,'2026-10-11T20:00:00.000Z');
for(const event of [cooking,growth]){
  assert.equal(event.source.source_type,'OFFICIAL_ANNOUNCEMENT');
  assert.ok(event.source.source_ref.startsWith('https://www.pokemonsleep.net/zh/news/'));
  assert.equal(event.field_provenance.period.end_exclusive,true);
}
const version=readFileSync('assets/js/version-authority.js','utf8');
assert.ok(version.includes("app_version: 'v0.4.27.55.3.3.22'"),'One-time network-cache upgrade is .22; subsequent data-only refresh must retain this tuple');
assert.ok(version.includes("app_build: '20261012-v0427553322-g9-official-event-auto-refresh'"));
assert.ok(version.includes("cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.22-v0427553322-g9-official-event-auto-refresh'"));
assert.ok(version.includes("// app_version: 'v0.4.27.55.3.3.21'"),'Previous .21 owner-PASS tuple preserved in historical lineage');
const sw=readFileSync('service-worker.js','utf8');
assert.match(sw,/verifiedEventFeedAsset=sameOrigin&&/);
assert.match(sw,/networkFirst=sameOrigin&&\(authorityAsset\|\|isScript\|\|url\.pathname\.endsWith\('\.html'\)\|\|verifiedEventFeedAsset\)/);
assert.match(sw,/fetch\(event\.request,\{cache:'no-store'\}\)/);
assert.match(sw,/querySafeCacheMatch\(event\.request\)/,'Offline service-worker cache fallback remains available');
const boot=readFileSync('assets/js/public-event-master-bootstrap.js','utf8');
for(const token of ['visibilitychange','pageshow','public-event-boundary-crossed','scheduleRefresh()','PUBLIC_EVENT_FOREGROUND_REFRESH_MIN_GAP_MS'])assert.ok(boot.includes(token),'Verified feed refresh trigger missing: '+token);

const growthHtml='<main><time>2026/10/1</time><h1>〖企畫〗寶可夢快快長大週vol.6</h1>'+
  '<p>〖舉辦期間〗 10/12 (週一) 4:00～10/19 (週一) 3:59</p>'+
  '<p>〖活動營地〗 所有營地</p><p>〖所有日子〗</p><p>・幫手寶可夢的睡眠EXP：1.5倍</p>'+
  '<p>・當天第1次睡眠研究後的糖果獲得量變成1.5倍。</p><p>注意事項</p></main>';
const parsed=parseVerifiedGrowthNotice(growthHtml,growthUrl,{now:new Date('2026-10-12T12:00:00+08:00')});
assert.ok(parsed);
assert.equal(parsed.event_id,'growth_week_vol6_2026_10');
assert.equal(parsed.start_at,'2026-10-12T04:00:00+08:00');
assert.equal(parsed.end_at,'2026-10-19T04:00:00+08:00');
assert.equal(parsed.effects.pokemon_candy_multiplier,1.5);
assert.equal(parsed.field_provenance.event_effects.pokemon_candy_multiplier_scope,'FIRST_SLEEP_RESEARCH_OF_DAY_ONLY');
assert.throws(()=>parseVerifiedGrowthNotice(growthHtml,'https://evil.example/zh/news/123/',{now:new Date('2026-10-12T04:00:00+08:00')}),/G9R_OFFICIAL_DOMAIN_ONLY/);
assert.throws(()=>parseVerifiedGrowthNotice(growthHtml.replace('第1次','第2次'),growthUrl,{now:new Date('2026-10-12T04:00:00+08:00')}),/G9R_GROWTH_EFFECT_NOT_EXACTLY_VERIFIED/);
const discovered=discoverOfficialNoticeUrls('<a href="/zh/news/1234/">official</a><a href="/zh/news/1234/">dup</a><a href="https://evil.example/zh/news/999/">no</a>');
assert.deepEqual(discovered,['https://www.pokemonsleep.net/zh/news/1234/']);
const unchanged=await discoverAndStage({
  now:new Date('2026-10-12T12:00:00+08:00'),
  fetchHtml:async url=>url.endsWith('/zh/news/')?'<a href="/zh/news/343430333034343435353738383035323530/">Growth</a>':growthHtml,
  write:false,
});
assert.equal(unchanged.status,'UNCHANGED','Known official articles must not produce redundant empty PRs');
// SYNTHETIC fixture ONLY: no next-week activity or official article is asserted here.
// Replays a 7-day future announcement through the EXISTING read-only staging code.
const syntheticUrl='https://www.pokemonsleep.net/zh/news/999999900000000001/';
const syntheticHtml=growthHtml.replace('2026/10/1','2026/10/13')
  .replace('vol.6','vol.7')
  .replace('10/12 (週一) 4:00～10/19 (週一) 3:59','10/19 (週一) 4:00～10/26 (週一) 3:59');
const synthetic=parseVerifiedGrowthNotice(syntheticHtml,syntheticUrl,{now:new Date('2026-10-13T14:00:00+08:00')});
assert.equal(synthetic.event_id,'growth_week_vol7_2026_10');
assert.equal(synthetic.start_at,'2026-10-19T04:00:00+08:00');
assert.equal(synthetic.end_at,'2026-10-26T04:00:00+08:00');
assert.equal(synthetic.field_provenance.event_effects.deterministic_model_status,'FEATURE_ONLY_NOT_PLAYER_WRITE');
const manifestBefore=readFileSync('assets/data/public-event-master-manifest.json','utf8');
const rawBefore=readFileSync('assets/data/public-event-master.json','utf8');
const syntheticReplay=await discoverAndStage({
  now:new Date('2026-10-13T14:00:00+08:00'),
  fetchHtml:async url=>url.endsWith('/zh/news/')?'<a href="/zh/news/999999900000000001/">SYNTHETIC future fixture</a>':syntheticHtml,
  write:false,
});
assert.equal(syntheticReplay.status,'DRY_RUN_NEW_EVENTS');
assert.deepEqual(syntheticReplay.events,['growth_week_vol7_2026_10']);
assert.notEqual(syntheticReplay.sha256,manifest.payload_sha256);
assert.equal(syntheticReplay.player_write,false);
assert.equal(syntheticReplay.app_version_bump,false);
assert.equal(readFileSync('assets/data/public-event-master-manifest.json','utf8'),manifestBefore);
assert.equal(readFileSync('assets/data/public-event-master.json','utf8'),rawBefore);
const futureEvents={...payload,events:[...payload.events,synthetic]};
const justBefore=resolvePublicEventProjection(futureEvents,{date:new Date('2026-10-19T03:59:59+08:00'),camp:'黃金舊發電廠'});
const justAfter=resolvePublicEventProjection(futureEvents,{date:new Date('2026-10-19T04:00:00+08:00'),camp:'黃金舊發電廠'});
assert.ok(justBefore.active_events.some(x=>x.event_id==='growth_week_vol6_2026_10'));
assert.ok(!justAfter.active_events.some(x=>x.event_id==='growth_week_vol6_2026_10'));
assert.ok(justAfter.active_events.some(x=>x.event_id==='growth_week_vol7_2026_10'));
assert.throws(()=>parseVerifiedGrowthNotice(
  syntheticHtml.replace('<p>注意事項</p>','<p>・夢之碎片獲得量變成2倍</p><p>注意事項</p>'),
  syntheticUrl,{now:new Date('2026-10-13T14:00:00+08:00')}
),/G9R_GROWTH_UNRECOGNIZED_BONUS_REVIEW_REQUIRED/);
assert.throws(()=>parseVerifiedGrowthNotice(
  syntheticHtml.replace('<p>〖所有日子〗</p>',''),
  syntheticUrl,{now:new Date('2026-10-13T14:00:00+08:00')}
),/G9R_GROWTH_BONUS_SECTION_REVIEW_REQUIRED/);
console.log('PASS G9R_SYNTHETIC_FUTURE_DATA_ONLY_NO_PLAYER_WRITES_NO_APP_BUMP');
console.log('PASS G9R_SYNTHETIC_ROLLOVER_EXCLUSIVE_END');
console.log('PASS G9R_UNMODELED_OFFICIAL_BONUS_REVIEW_HOLD');

// SYNTHETIC release bytes ONLY: prove a governed data-only PR would be
// append-only, byte-exact SHA-256, preserve prior public facts and never
// require a PWA runtime release. This is NOT a published next-week event.
const proposedObject=JSON.parse(rawBefore);
proposedObject.master_version='public-event-master-tw-2026-10-19-SYNTHETIC-NEVER-PUBLISH';
proposedObject.generated_at='2026-10-13T10:00:00Z';
proposedObject.events.push(synthetic);
const proposedPayloadText=JSON.stringify(proposedObject,null,2)+'\n';
const proposedManifestObject=JSON.parse(manifestBefore);
proposedManifestObject.master_version=proposedObject.master_version;
proposedManifestObject.generated_at=proposedObject.generated_at;
proposedManifestObject.payload_sha256=createHash('sha256').update(proposedPayloadText).digest('hex');
const proposedManifestText=JSON.stringify(proposedManifestObject,null,2)+'\n';
const releaseInputs={beforePayloadText:rawBefore,beforeManifestText:manifestBefore,
  afterPayloadText:proposedPayloadText,afterManifestText:proposedManifestText,
  expectedNewEvents:[synthetic]};
const gate=verifyG9RDataOnlyRelease(releaseInputs);
assert.equal(gate.status,'READY_FOR_CONTROLLED_DATA_ONLY_PR');
assert.equal(gate.new_event_count,1);
assert.equal(gate.player_write,false);
assert.equal(gate.app_version_bump,false);
assert.notEqual(gate.payload_sha256,manifest.payload_sha256);
assert.throws(()=>verifyG9RDataOnlyRelease({...releaseInputs,
  afterManifestText:JSON.stringify({...proposedManifestObject,payload_sha256:'f'.repeat(64)})+'\n',
}),/G9R_DATA_ONLY_RELEASE_HOLD:CANDIDATE_SHA256_MISMATCH/);
const taintedObject=structuredClone(proposedObject);
taintedObject.events[2].effects.pokemon_candy_multiplier=2;
const taintedText=JSON.stringify(taintedObject,null,2)+'\n';
assert.throws(()=>verifyG9RDataOnlyRelease({...releaseInputs,afterPayloadText:taintedText,
  afterManifestText:JSON.stringify({...proposedManifestObject,
    payload_sha256:createHash('sha256').update(taintedText).digest('hex')})+'\n',
}),/G9R_DATA_ONLY_RELEASE_HOLD:EXISTING_EVENT_MUTATED:2/);
assert.throws(()=>verifyG9RDataOnlyRelease({...releaseInputs,expectedNewEvents:[]}),
  /G9R_DATA_ONLY_RELEASE_HOLD:NO_NEW_VERIFIED_EVENTS/);
assert.throws(()=>verifyG9RDataOnlyRelease({...releaseInputs,
  expectedNewEvents:[{...synthetic,effects:{sleep_exp_multiplier:4}}],
}),/G9R_DATA_ONLY_RELEASE_HOLD:EVENT_NOT_EXACT_SOURCE_PROJECTION/);
const sameVersionManifest={...proposedManifestObject,master_version:manifest.master_version};
assert.throws(()=>verifyG9RDataOnlyRelease({...releaseInputs,
  afterManifestText:JSON.stringify(sameVersionManifest)+'\n',
}),/G9R_DATA_ONLY_RELEASE_HOLD:MASTER_VERSION_NOT_ROTATED/);
assert.equal(readFileSync('assets/data/public-event-master.json','utf8'),rawBefore);
assert.equal(readFileSync('assets/data/public-event-master-manifest.json','utf8'),manifestBefore);
console.log('PASS G9R_SYNTHETIC_APPEND_ONLY_SHA256_IMMUTABLE_BASE_GATE');
console.log('PASS G9R_SYNTHETIC_DATA_ONLY_PR_BAD_SHA_PRIOR_FACT_TAMPER_AND_SAME_VERSION_HOLD');

console.log('PASS G9R_SOURCE_DISCOVERY_AND_FAIL_CLOSED');

console.log('PASS G9R_VERIFIED_OFFICIAL_SOURCES');
console.log('PASS G9R_MANIFEST_PAYLOAD_SHA256');
console.log('PASS G9R_0400_WEEK_BOUNDARIES');
console.log('PASS G9R_FIRST_SLEEP_CANDY_FEATURE_ONLY');
console.log('PASS G9R_ONE_TIME_PWA_CACHE_FIX_AND_FUTURE_DATA_ONLY_UPDATE');
// Isolated state-machine test loads actual production refresh source with only DB API mocked.
await import('./g9r-public-event-refresh-lastgood-contract.mjs');
