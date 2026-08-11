import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES,
  PUBLIC_RECIPE_FORMULA_OVERRIDES,
  resolvePublicRecipeName,
} from '../assets/js/public-recipe-canonical-authority.js';
import {PUBLIC_RECIPE_ALIAS_VERSION} from '../assets/js/public-recipe-alias-master.js';
import {PUBLIC_RECIPE_PROVENANCE_VERSION} from '../assets/js/public-recipe-provenance.js';
import {
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
  isLockedUnknownRecipePlaceholder,
} from '../assets/js/public-master-recognition.js';
import {buildUcImgDiagnosticBundle} from '../assets/js/uc-img-gemini-adapter.js';
import {buildUcImgDiagnosticFilename,serializeUcImgDiagnosticBundle} from '../assets/js/uc-img-diagnostic-export.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.11.4');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04114-recipe-zh-tw-diagnostic-export');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.4-v04114-recipe-zh-tw-diagnostic-export');
assert.ok(version.includes("// app_version: 'v0.4.11.3'"),'v0.4.11.4 must retain v0.4.11.3 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v04113-weekly-recipe-semantic-safety'"));

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-11-c');
assert.equal(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-11-b');
assert.equal(PUBLIC_RECIPE_ALIAS_VERSION,'public-recipe-alias-2026-08-11-b');
assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-11-c');
assert.equal(PUBLIC_MASTER_RECOGNITION_VERSION,'public-master-recognition-2026-08-11-b-recipe-canonical');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,34);
assert.equal(PUBLIC_RECIPE_FORMULA_OVERRIDES.length,1);

const byId=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
assert.equal(byId.get('curry_soft_corn')?.recipe_name,'柔軟玉米濃湯');
assert.equal(byId.get('recipe_curry_015')?.recipe_name,'入口即化蛋捲咖哩');
assert.equal(byId.get('curry_dizzy_punch')?.recipe_name,'迷昏拳辣味咖哩');
assert.equal(byId.get('curry_parent_child')?.recipe_name,'親子愛咖哩');
assert.deepEqual(byId.get('curry_parent_child')?.ingredients,[
  {ingredient_name:'甜甜蜜',quantity:12},
  {ingredient_name:'好眠番茄',quantity:11},
  {ingredient_name:'特選蛋',quantity:8},
  {ingredient_name:'窩心洋芋',quantity:4},
]);
assert.deepEqual(byId.get('curry_dizzy_punch')?.ingredients,[
  {ingredient_name:'火辣香草',quantity:11},
  {ingredient_name:'甜甜蜜',quantity:11},
  {ingredient_name:'醒腦咖啡豆',quantity:11},
]);
const legacySoftCorn=resolvePublicRecipeName('玉米濃湯');
assert.equal(legacySoftCorn?.recipe_id,'curry_soft_corn');
assert.equal(legacySoftCorn?.recipe_name,'柔軟玉米濃湯');
assert.equal(legacySoftCorn?.commit_allowed,true);
const legacyDizzy=resolvePublicRecipeName('暈眩拳辣味咖哩');
assert.equal(legacyDizzy?.recipe_id,'curry_dizzy_punch');
assert.equal(legacyDizzy?.recipe_name,'迷昏拳辣味咖哩');
assert.equal(legacyDizzy?.commit_allowed,true);

const snapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(snapshot.data_version,PUBLIC_RECIPE_MASTER_VERSION);
assert.equal(snapshot.identity_alias_version,PUBLIC_RECIPE_ALIAS_VERSION);
assert.equal(snapshot.row_count,76);
assert.equal(snapshot.rows.find(row=>row.recipe_id==='curry_soft_corn')?.recipe_name,'柔軟玉米濃湯');
assert.equal(snapshot.rows.find(row=>row.recipe_id==='curry_dizzy_punch')?.recipe_name,'迷昏拳辣味咖哩');

const locked={observation_id:'locked',status:'UNMATCHED',observed_text:'4種食材的沙拉',observed_data:{unlocked:false},source_image_ref:'image-locked',confidence:0.99,reason:'LOCKED_UNKNOWN_RECIPE_SLOT'};
assert.equal(isLockedUnknownRecipePlaceholder(locked),true);
const lockedPayload={schema:'pokemon-sleep-public-master-recognition/1.0',recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'recipe_status_update',authority:'recipe_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-08-11T10:45:00Z',visible_target_count:1,observations:[locked]};
const lockedCompiled=compilePublicMasterRecognitionToUpdatePackage(lockedPayload,'recipes',{allowedImageRefs:['image-locked']});
assert.equal(lockedCompiled.errors.length,0);
assert.equal(lockedCompiled.unresolved.length,0);
assert.equal(lockedCompiled.update_package.operations.length,0);
assert.equal(lockedCompiled.summary.ignored_count,1);

const authorityAudit={authority_version:'weekly-platform-authority-release',week_start:'2026-08-10',context_id:'weekly_context_2026-08-10_import',generated_at:'2026-08-11T10:45:00Z',update_id:'UPD-TEST',provider_original_generated_at:'2024-07-15T00:00:00Z',provider_original_week_start:'2024-07-15'};
const diagnostic=buildUcImgDiagnosticBundle({appVersion:'v0.4.11.4',session:{session_id:'ucimg-release'},scenarioKey:'weekly',config:{scenario:'weekly_context_update'},coverage:'USER_CONFIRMED_COMPLETE',rawResponse:'{}',validation:{ok:true,errors:[],warnings:[],review:[],summary:{}},providerMeta:{provider:'gemini',model:'gemini-test',project_alias:'Project A',image_count:2,response_contract:'update-package-v1.1',platform_authority:authorityAudit}});
assert.deepEqual(diagnostic.platform_authority,authorityAudit);
assert.equal(diagnostic.safety.api_key_included,false);
assert.equal(diagnostic.safety.screenshot_bytes_included,false);
assert.equal(diagnostic.safety.sqlite_export_included,false);
const exportedJson=serializeUcImgDiagnosticBundle(diagnostic);
assert.equal(JSON.parse(exportedJson).app_version,'v0.4.11.4');
assert.ok(buildUcImgDiagnosticFilename({appVersion:'v0.4.11.4',scenarioKey:'weekly',sessionId:'ucimg-release',generatedAt:'2026-08-11T10:45:00Z'}).endsWith('.json'));

const ui=read('assets/js/unified-screenshot-update-center.js');
assert.ok(ui.includes('匯出 AI 診斷包'));
assert.equal(ui.includes('複製 AI 診斷包'),false);
assert.ok(ui.includes('platform_authority:analysis.platform_authority||null'));
assert.equal((ui.match(/applyPayload\(/g)||[]).length,1,'v0.4.11.4 must retain exactly one UC.IMG Apply bridge');
const recognitionSource=read('assets/js/public-master-recognition.js');
assert.ok(recognitionSource.includes("from './public-recipe-canonical-authority.js'"));
assert.equal(recognitionSource.includes("from './public-recipe-master.js'"),false,'Recognition must not bypass canonical recipe authority');
for(const forbidden of ['INSERT INTO','UPDATE recipes','DELETE FROM','applyPayload(','dryRun('])assert.equal(recognitionSource.includes(forbidden),false,`Recognition owns forbidden write path: ${forbidden}`);
const exportSource=read('assets/js/uc-img-diagnostic-export.js');
for(const forbidden of ['localStorage','sessionStorage','indexedDB','api_key','screenshot_bytes'])assert.equal(exportSource.includes(forbidden),false,`diagnostic export helper owns forbidden data: ${forbidden}`);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.11.4 must remain SQLite-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.11.4_RELEASE_CONTRACT',app_version:'v0.4.11.4',
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  canonical_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  alias_version:PUBLIC_RECIPE_ALIAS_VERSION,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  active_recipe_count:PUBLIC_RECIPE_MASTER.length,
  current_zh_tw_name_override_count:PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,
  formula_corrections:['curry_parent_child'],
  dizzy_old_ocr_conflict_closed:true,
  locked_unknown_slot_not_master_gap:true,
  weekly_authority_diagnostic:true,
  diagnostic_json_export:true,
  player_data_write:false,
  screenshot_bytes_persisted:false,
  sqlite_migration_added:false,
  single_apply_bridge:true,
},null,2));