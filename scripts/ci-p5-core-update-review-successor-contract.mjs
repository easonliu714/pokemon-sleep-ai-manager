import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWorkflow} from '../assets/js/ai-workflow.js';
import {buildScenarioReviewSummary} from '../assets/js/update-review-summary.js';

export const CI_P5_CORE_UPDATE_REVIEW_SUCCESSOR_VERSION='ci-p5-core-update-review-successor-2026-08-18-b-v042712-registered-date-compat';
export const PREDECESSOR_RUNTIME_FIXTURE=Object.freeze({
  workflow:'v0399-human-readable-diff-review.yml',
  historical_runtime:'v0.4.1',
  historical_build:'20260808-v041-evolution-master-coverage-completion',
});

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{
  const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){
    const a=left[index]||0,b=right[index]||0;
    if(a!==b)return a>b;
  }
  return true;
};

const version=read('assets/js/version-authority.js');
const currentApp=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(currentApp,PREDECESSOR_RUNTIME_FIXTURE.historical_runtime),true,`P5 successor requires ${PREDECESSOR_RUNTIME_FIXTURE.historical_runtime} behavior or later: ${currentApp}`);

// Preserve the executable Update Package classification behavior from the retired wrapper.
const manifest={
  generated_at:'2026-08-08T00:00:00+08:00',
  target_runtime:PREDECESSOR_RUNTIME_FIXTURE.historical_runtime,
  files:[{file:'ingredient.json'},{file:'item.json'}],
  safety:{private_data_must_not_be_committed_to_github:true},
};
const manifestResult=validateWorkflow(manifest);
assert.equal(manifestResult.errors.length,1,`manifest should have one targeted blocking message: ${JSON.stringify(manifestResult)}`);
assert.match(manifestResult.errors[0],/Package Manifest/,'manifest targeted message missing');
assert.equal(manifestResult.summary.file_kind,'package_manifest');
assert.equal(manifestResult.summary.non_executable_manifest,true);

const base={schema_version:'1.1',generated_at:'2026-08-08T00:00:00+08:00',source:'synthetic contract fixture'};
const ingredient={...base,update_id:'TEST-INGREDIENT',scenario:'ingredient_inventory_update',operations:[{operation_id:'OP-1',entity:'ingredient_inventory',action:'upsert',key:{ingredient_name:'好眠番茄'},data:{quantity:0},clear_fields:[],review_required:false}]};
const ingredientResult=validateWorkflow(ingredient);
assert.equal(ingredientResult.errors.length,0,JSON.stringify(ingredientResult));
assert.equal(ingredientResult.review.length,0,JSON.stringify(ingredientResult));
const item={...base,update_id:'TEST-ITEM',scenario:'item_inventory_update',operations:[{operation_id:'OP-1',entity:'item_inventory',action:'upsert',key:{item_name:'月之石'},data:{quantity:1},clear_fields:[],review_required:false}]};
const itemResult=validateWorkflow(item);
assert.equal(itemResult.errors.length,0,JSON.stringify(itemResult));
assert.equal(itemResult.review.length,0,JSON.stringify(itemResult));

// Preserve scenario-aware, human-readable review summaries.
const field=(existing,effective)=>({existing,effective});
const ingredientSummary=buildScenarioReviewSummary(
  {scenario:'ingredient_inventory_update'},
  {changes:[{entity:'ingredient_inventory',field_audit:[field(null,9),field(null,'2026-08-08'),field(null,'UPD-1')]}]},
);
assert.equal(ingredientSummary?.title,'1 筆食材庫存資料將更新');
assert.equal(ingredientSummary?.changed_field_count,3);
assert.match(ingredientSummary?.detail||'',/不包含玩家寶可夢能力更新/);
const itemSummary=buildScenarioReviewSummary(
  {scenario:'item_inventory_update'},
  {changes:[{entity:'item_inventory',field_audit:[field(1,1),field('old','old')]}]},
);
assert.equal(itemSummary?.title,'✓ 1 筆道具庫存資料無差異');
const pokemonSummary=buildScenarioReviewSummary(
  {scenario:'pokemon_profile_field_audit_update'},
  {changes:[{entity:'pokemon',field_audit:[field(1,2)]}]},
);
assert.equal(pokemonSummary,null,'Pokemon packages must keep the dedicated Pokemon review summary');

// Preserve the review-only / game-native / mobile-safe static invariants from v0.3.99.x–v0.4.1.
const UI=read('assets/js/general-update-field-audit-ui.js');
const REVIEW_SUMMARY=read('assets/js/update-review-summary.js');
const DETAIL=read('assets/js/pokemon-detail.js');
const MANUAL=read('assets/js/manual-editor.js');
const OBS=read('assets/js/ai-observation.js');
const GUIDED=read('assets/js/v03992-update-center-guided-ux.js');
const DEBUG=read('assets/js/debug-trace-manager.js');
const WORKFLOW=read('assets/js/ai-workflow.js');
const CSS=read('assets/css/v0399-review.css');

for(const token of [
  'human_diff_review_ready','REVIEW-ONLY-','appliedUpdateId','唯讀比對模式','已可執行 Dry Run',
  '進化所需一起睡覺的時間','玩家資料無差異','此次不會改變可見的寶可夢能力','食材配置','副技能',
  'Identity fingerprint','profile_audit_confirmations.map','confirmation_scope',
])assert.ok(UI.includes(token),`general review UI successor missing token: ${token}`);
assert.ok(UI.includes("SLEEP_FIELDS = new Set(['sleep_hours','sleep_time_text'])"),'sleep field grouping contract missing');
assert.ok(UI.includes("sleep_time_text:['一起睡覺的時間']"),'sleep display label contract missing');
assert.ok(CSS.includes('review-detail-grid'),'human-readable review grid missing');
assert.ok(CSS.includes('no-player-change'),'no-player-change review state missing');

// registered_at remains the formal field and label. v0.4.27.12 may read legacy
// obtained_at only as a compatibility source for records created by the v0.4.27.11
// confirmation mapping bug; it must never re-introduce a separate 入手日期 field or editor authority.
const registeredDateFormal=DETAIL.includes("['登錄日期',p.registered_at]");
const registeredDateLegacyReadCompat=DETAIL.includes("['登錄日期',p.registered_at||p.obtained_at]");
assert.ok(registeredDateFormal||registeredDateLegacyReadCompat,'registered date display authority missing');
assert.equal(DETAIL.includes("['入手日期',p.obtained_at]"),false,'legacy obtained_at must not render as a separate Pokemon detail field');
assert.equal(DETAIL.includes("input('obtained_at'"),false,'legacy obtained_at must not remain in manual detail editor');
assert.equal(MANUAL.includes("'obtained_at'"),false,'manual editor must preserve legacy obtained_at rather than overwrite it');
for(const token of ['resolvePublicMainSkillName','PUBLIC_MAIN_SKILL_MASTER','mainSkillDisplay(p,knowledge)','mainSkillDescriptionDisplay(p,knowledge)','原始玩家觀察值仍保留於 SQLite','個體／匯入條件優先','公版進化條件','公版引用'])assert.ok(DETAIL.includes(token),`Pokemon detail successor missing token: ${token}`);
for(const token of ['遊戲畫面若出現「一起睡覺的時間」','sleep_time_text:null,sleep_hours:null','不得由等級、入手日期或其他欄位推算'])assert.ok(OBS.includes(token),`Observation successor missing token: ${token}`);

for(const token of ['ingredient_inventory_update','item_inventory_update','食材庫存資料','道具庫存資料','不包含玩家寶可夢能力更新'])assert.ok(REVIEW_SUMMARY.includes(token),`review summary successor missing token: ${token}`);
for(const token of ['normalized=text.match(/結構錯誤','#workflowSummary{max-height','#workflowIssues{max-height','text.replace(normalized[0],replacement)',"import {scalar} from './database.js'",'function appliedComplete','套用更新已完成；本機 SQLite 已寫入','guided-apply-ready','ingredientInventorySummary','itemInventorySummary','食材類別數','道具類別數','庫存總量','可動用總量'])assert.ok(GUIDED.includes(token),`guided Update Center successor missing token: ${token}`);
for(const token of ["key==='events'?value.slice(-MAX_EVENTS)",'saved.slice(-MAX_EVENTS).map'])assert.ok(DEBUG.includes(token),`Debug Trace retention successor missing token: ${token}`);
for(const token of ['detectNonExecutableFileKind','Package Manifest','non_executable_manifest:true'])assert.ok(WORKFLOW.includes(token),`AI workflow successor missing token: ${token}`);

assert.equal(UI.includes('profile-preview-key'),false,'raw JSON key/value preview must not be the primary review UI');
assert.equal(/DETAIL_FIELDS = .*'sleep_hours'.*'sleep_time_text'/.test(UI),false,'sleep_hours and sleep_time_text must not render as duplicate primary fields');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P5_CORE_UPDATE_REVIEW_SUCCESSOR',
  version:CI_P5_CORE_UPDATE_REVIEW_SUCCESSOR_VERSION,
  current_app_version:currentApp,
  predecessor_runtime_fixture:PREDECESSOR_RUNTIME_FIXTURE,
  update_package_classification:true,
  scenario_review_summary:true,
  human_readable_review:true,
  game_native_sleep_semantics:true,
  registered_date_formal_authority:true,
  legacy_obtained_date_read_compatibility:registeredDateLegacyReadCompat,
  non_executable_manifest_guard:true,
  repository_mutation:false,
},null,2));