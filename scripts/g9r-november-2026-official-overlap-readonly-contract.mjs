import assert from 'node:assert/strict';
import {
  PUBLIC_EVENT_MASTER_SCHEMA,validatePublicEventPayload,
  resolvePublicEventProjection,nextPublicEventBoundary,
} from '../assets/js/public-event-master-contract.js';

// Source-only acceptance candidate, NEVER a production Public Master write.
// Official zh-TW announcements: exact dates/camp_scope and typed evidenced
// values only; conditional bonuses remain REVIEW_REQUIRED, not global numeric.
const newMoonUrl='https://www.pokemonsleep.net/zh/news/343537333337383034343630393136373338/';
const prepUrl='https://www.pokemonsleep.net/zh/news/343537333139333632303937383430313332/';
const official=(name,url)=>({
  source_type:'OFFICIAL_ANNOUNCEMENT',
  source_name:name,source_ref:url,
  note:'Source-bound synthetic test; production admission requires separate manifest SHA gate',
});
const event=(id,title,start,end,url,effects,limited_mechanics=[])=>({
  event_id:id,title,locale:'zh-TW',region:'GLOBAL',
  start_at:start,end_at:end,camp_scope:['*'],
  effects,phases:[],missions:[],rewards:[],limited_mechanics,
  authority_status:'PARTIAL_VERIFIED',source:official(title,url),
  field_provenance:{
    identity:{status:'VERIFIED',source_ref:url},
    period:{status:'VERIFIED',end_exclusive:true,time_zone:'Asia/Taipei',source_ref:url},
    event_effects:{status:'PARTIAL_VERIFIED',deterministic_authority:false,
      note:'Scoped reward/encounter chance is not a global multiplier'},
  },
});
const newMoon=event(
  'new_moon_day_19_2026_11','第19次「新月日」',
  '2026-11-08T04:00:00+08:00','2026-11-11T04:00:00+08:00',
  newMoonUrl,{
    shiny_encounter_possible:true,
    unknown_effects:[
      {source_text:'第1次點心時間不容易吃飽；不可推導確切機率'},
      {source_text:'達克萊伊特別機率提升；每次研究遇見特別提升對象友情點數+3，非全域數值'},
    ],
  },['適用所有營地，觀察到的睡眠測量開始時間決定是否享有獎勵'],
);
const prep=event(
  'meal_prep_week_vol1_2026_11','備料週vol.1',
  '2026-11-09T04:00:00+08:00','2026-11-16T04:00:00+08:00',
  prepUrl,{
    recipe_final_energy_multiplier:1.25,
    cross_sleep_type_encounters:true,
    limited_feature:'迷你糖果增強',
    unknown_effects:[
      {source_text:'研究食材專長或食材精選S對象的糖果／夢之碎片×1.5，僅符合條件者'},
      {source_text:'特定寶可夢較容易遇見，未公布定量出現機率'},
    ],
  },[
    '迷你糖果增強係使用糖果的EXP×2、夢之碎片消耗×4、每日最多50顆，與睡眠研究糖果不同',
    '研究獎勵若跨活動重疊按官方同類獎勵最高倍率；尚無 scoped numeric consumer，保持 review',
  ],
);
const payload=validatePublicEventPayload({
  schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'isolated-g9r-november-2026-source-candidate',
  locale:'zh-TW',region:'TW',events:[newMoon,prep],
});
const at=(iso,camp='黃金舊發電廠')=>resolvePublicEventProjection(payload,{date:new Date(iso),camp});
const before=at('2026-11-08T03:59:59+08:00');
assert.equal(before.active_event_count,0);
const day1=at('2026-11-08T04:00:00+08:00');
assert.equal(day1.active_event_count,1);
assert.equal(day1.active_events[0].event_id,newMoon.event_id);
assert.equal(day1.strategy_event_effects.recipe_final_energy_multiplier,undefined);
const both=at('2026-11-09T04:00:00+08:00');
assert.equal(both.active_event_count,2);
assert.deepEqual(both.active_events.map(x=>x.event_id),[newMoon.event_id,prep.event_id]);
assert.equal(both.strategy_event_effects.recipe_final_energy_multiplier,1.25);
assert.equal(both.feature_only_event_effects.cross_sleep_type_encounters,true);
assert.equal(both.feature_only_event_effects.limited_feature,'迷你糖果增強');
assert.equal(both.review_event_effects.length,4);
assert.equal(both.event_authority_status,'PARTIAL_VERIFIED');
assert.deepEqual(both.effect_conflicts,[]);
assert.equal(both.camp,'黃金舊發電廠');
assert.equal(at('2026-11-09T04:00:00+08:00','萌綠之島').active_event_count,2);
assert.equal(at('2026-11-09T04:00:00+08:00','萌綠之島').camp,'萌綠之島');
assert.equal(at('2026-11-11T03:59:59+08:00').active_event_count,2);
assert.equal(at('2026-11-11T04:00:00+08:00').active_event_count,1);
assert.equal(at('2026-11-16T04:00:00+08:00').active_event_count,0);
assert.equal(at('2026-11-16T04:00:00+08:00').event_effects.recipe_final_energy_multiplier,undefined);
assert.equal(nextPublicEventBoundary(payload,{
  date:new Date('2026-11-08T04:00:00+08:00'),camp:'黃金舊發電廠'
}).at_iso,'2026-11-08T20:00:00.000Z');
console.log('PASS G9R_NOVEMBER_OFFICIAL_TWO_EVENTS_OVERLAP_0400_HALF_OPEN_AND_CAMP_UNCHANGED');

// Negative: an unrelated same-key bonus without an audited merge rule MUST
// fail closed as review, not be multiplied, last-writer-wins, or silently maxed.
const conflictPayload=validatePublicEventPayload({
  schema:PUBLIC_EVENT_MASTER_SCHEMA,master_version:'isolated-g9r-overlap-conflict-negative',
  events:[{...newMoon,effects:{...newMoon.effects,recipe_final_energy_multiplier:1.5}},prep],
});
const conflicting=resolvePublicEventProjection(conflictPayload,{
  date:new Date('2026-11-09T12:00:00+08:00'),camp:'黃金舊發電廠',
});
assert.equal(conflicting.event_effects.recipe_final_energy_multiplier,undefined);
assert.equal(conflicting.strategy_event_effects.recipe_final_energy_multiplier,undefined);
assert.equal(conflicting.event_authority_status,'REVIEW_REQUIRED');
assert.equal(conflicting.effect_conflicts[0].effect_key,'recipe_final_energy_multiplier');
console.log('PASS G9R_NOVEMBER_UNPROVEN_DIFFERING_MULTIPLIER_CONFLICT_FAIL_CLOSED');

// Explicit absence of an exact Banquet Week end time in the advance preview:
// do NOT invent a production interval, schema field, pot number or active bonus.
const banquetPreview={
  announced_start_day:'2026-11-16',confirmed_end:null,
  preview_only:true,deterministic_effects:{},
  source_ref:'https://www.pokemonsleep.net/zh/news/343535303736323034303630333434333236/',
};
assert.equal(banquetPreview.confirmed_end,null);
assert.deepEqual(banquetPreview.deterministic_effects,{});
assert.equal(payload.events.some(x=>/banquet/.test(x.event_id)),false);
console.log('PASS G9R_NOVEMBER_BANQUET_PREVIEW_UNVERIFIED_DETAILS_NOT_PROMOTED');
console.log('HOLD G9R_NOVEMBER_DATA_RELEASE_SHA_MANIFEST_AND_ANDROID_OWNER_UAT');
