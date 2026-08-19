import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const versionSource=fs.readFileSync('assets/js/version-authority.js','utf8');
const versionSandbox={};versionSandbox.globalThis=versionSandbox;vm.runInNewContext(versionSource,versionSandbox,{filename:'version-authority.js'});
const authority=versionSandbox.PokemonSleepVersionAuthority;
assert.equal(authority.app_version,'v0.4.27.14');
assert.equal(authority.app_build,'20260819-v042714-nickname-guard-bidirectional-review');
assert.ok(versionSource.includes("// app_version: 'v0.4.27.13'"),'v0.4.27.13 lineage marker missing');

const multi=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
const workbench=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');

// Evaluate only the pure normalization prefix from the real multicapture runtime.
const prefixStart=multi.indexOf('const VERSION=');
const prefixEnd=multi.indexOf('const MERGE_FIELDS=');
assert.ok(prefixStart>=0&&prefixEnd>prefixStart,'multicapture normalization prefix not found');
const sandbox={console,Map,Set,JSON,Date,Number,String,Boolean,Math,Object};
sandbox.globalThis=sandbox;
sandbox.PokemonSleepVersionAuthority={app_version:authority.app_version,app_build:authority.app_build};
sandbox.UpdateCenterLiveDebug={record(){}};
sandbox.DebugTrace={record(){}};
vm.createContext(sandbox);
vm.runInContext(`${multi.slice(prefixStart,prefixEnd)}\nglobalThis.__normalizeRevision=normalizeRevision;`,sandbox,{filename:'multicapture-normalization-prefix.js'});
const normalize=sandbox.__normalizeRevision;
assert.equal(typeof normalize,'function');

// Physical evidence fixture from 內部多圖片解析_v042713.zip:
// Observation said species/current_species=魔尼尼 while editable header + nickname compatibility fields copied 小鍛匠.
// Platform must prefer observation species and reject nickname without independent direct nickname evidence.
const contaminated={
  analysis_type:'ai',
  analysis_id:'fixture-contaminated',
  source_image_ref:'1000110321.png',
  result:{analysis:{
    pokemon_name:'小鍛匠',
    nickname:'小鍛匠',
    observations:[{
      identity:{current_species_id:'魔尼尼'},
      profile:{species:'魔尼尼',species_observation_basis:'DIRECT_IMAGE',header_name_text:'小鍛匠',nickname:'小鍛匠',level:14,sp:467},
      evidence:{field_confidence:{}},
      ingredients:[],
      subskills:[],
    }],
  }},
};
const guarded=normalize(contaminated);
assert.equal(guarded.species,'魔尼尼','observation species must outrank editable/compatibility header name');
assert.equal(guarded.nickname,'','unproven nickname must fail closed');
assert.equal(guarded.identity_guard_warnings.length,1);
assert.equal(guarded.identity_guard_warnings[0].candidate,'小鍛匠');
assert.equal(guarded.identity_guard_warnings[0].reason,'NICKNAME_REQUIRES_DIRECT_EXPLICIT_FIELD');

// A normal Iron/Caterpie-like observation with no nickname must remain blank rather than inherit a prior revision.
const ironLike={
  analysis_type:'ai',
  analysis_id:'fixture-iron',
  source_image_ref:'1000110474.png',
  result:{analysis:{
    pokemon_name:'鐵甲蛹',
    nickname:null,
    observations:[{
      identity:{current_species_id:null},
      profile:{species:null,header_name_text:'鐵甲蛹',nickname:null,level:16,sp:451},
      evidence:{field_confidence:{}},
      ingredients:[],
      subskills:[],
    }],
  }},
};
const cleanIron=normalize(ironLike);
assert.equal(cleanIron.species,'鐵甲蛹');
assert.equal(cleanIron.nickname,'');
assert.equal(cleanIron.identity_guard_warnings.length,0);

// Future explicit nickname evidence remains possible, but must use an explicit independent basis.
const explicitNickname={
  analysis_type:'ai',
  analysis_id:'fixture-explicit-nickname',
  source_image_ref:'nickname.png',
  result:{analysis:{
    pokemon_name:'皮卡丘',
    observations:[{
      profile:{species:'皮卡丘',header_name_text:'皮卡丘',nickname:'小黃',nickname_observation_basis:'DIRECT_EXPLICIT_NICKNAME_FIELD'},
      ingredients:[],
      subskills:[],
    }],
  }},
};
assert.equal(normalize(explicitNickname).nickname,'小黃');

// Bidirectional navigation must preserve current manual edits before switching.
for(const token of [
  'function getNavigationState()',
  'previous_group_id',
  'next_group_id',
  'function replaceActiveDraft(',
  'function navigateReviewGroup(',
  "direction:step<0?'previous':'next'",
  'bidirectional_review_navigation:true',
])assert.ok(multi.includes(token),`bidirectional multicapture runtime missing ${token}`);

for(const token of [
  'id="previousAnalysisGroup"',
  '← 上一隻寶可夢',
  'id="nextAnalysisGroup"',
  '下一隻寶可夢 →',
  'consistency.replaceActiveDraft?.(draft',
  'consistency.navigateReviewGroup?.(offset',
  'readDraft(root,{requireSpecies:false})',
])assert.ok(workbench.includes(token),`confirmation navigation UI missing ${token}`);

assert.ok(multi.includes("if(!next||next.status==='closed')return null"),'closed groups must not be reopened for accidental duplicate writes');
assert.ok(workbench.includes('Identity Guard'),'confirmation UI must disclose rejected nickname candidates');

// Existing terminal actions and 4/7 numeric authority stay unchanged.
for(const terminal of ['held','discarded','applied'])assert.ok(workbench.includes(`dispatchConfirmationTerminal('${terminal}'`),`terminal action missing ${terminal}`);
const production=fs.readFileSync('assets/js/production-authority-registry.js','utf8');
for(const token of [
  "ingredient_probability_per_help',status:'NOT_YET_VERIFIED'",
  "main_skill_trigger_probability:Object.freeze({dimension:'main_skill_trigger_probability',status:'NOT_YET_VERIFIED'",
  "main_skill_effect_value:Object.freeze({dimension:'main_skill_effect_value',status:'NOT_YET_VERIFIED'",
])assert.ok(production.includes(token),`production authority changed unexpectedly: ${token}`);

const sw=fs.readFileSync('service-worker.js','utf8');
for(const asset of ['./assets/js/data-consistency-multicapture.js','./assets/js/analysis-confirmation-workbench.js','./assets/js/version-authority.js'])assert.ok(sw.includes(`'${asset}'`),`PWA precache missing ${asset}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042714_NICKNAME_FAIL_CLOSED_BIDIRECTIONAL_REVIEW',
  physical_evidence_fixture:'內部多圖片解析_v042713.zip',
  checks:{
    observation_species_priority:true,
    unproven_nickname_rejected:true,
    stale_nickname_not_inherited:true,
    explicit_future_nickname_basis_supported:true,
    previous_next_navigation:true,
    manual_draft_preserved_on_navigation:true,
    closed_group_reopen:false,
    production_numeric_authority:'4/7',
  },
},null,2));
