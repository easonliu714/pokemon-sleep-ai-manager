import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PUBLIC_RECIPE_MASTER,
  PUBLIC_RECIPE_MASTER_VERSION,
  PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES,
  PUBLIC_RECIPE_FORMULA_OVERRIDES,
  PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS,
  resolvePublicRecipeName,
} from '../assets/js/public-recipe-canonical-authority.js';
import {
  PUBLIC_RECIPE_MASTER as RAW_PUBLIC_RECIPE_MASTER,
} from '../assets/js/public-recipe-master.js';
import {PUBLIC_RECIPE_ALIAS_VERSION} from '../assets/js/public-recipe-alias-master.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
  isLockedUnknownRecipePlaceholder,
} from '../assets/js/public-master-recognition.js';
import {buildUcImgDiagnosticBundle} from '../assets/js/uc-img-gemini-adapter.js';
import {
  buildUcImgDiagnosticFilename,
  downloadUcImgDiagnosticJson,
} from '../assets/js/uc-img-diagnostic-export.js';
import {PUBLIC_RECIPE_PROVENANCE,PUBLIC_RECIPE_PROVENANCE_VERSION} from '../assets/js/public-recipe-provenance.js';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const signature=recipe=>[...(recipe.ingredients||[])].map(row=>`${row.ingredient_name}=${Number(row.quantity)}`).sort((a,b)=>a.localeCompare(b,'zh-Hant')).join('|');

assert.equal(PUBLIC_RECIPE_MASTER_VERSION,'public-recipe-master-2026-08-11-c');
assert.equal(PUBLIC_RECIPE_CANONICAL_NAME_VERSION,'public-recipe-zh-tw-names-2026-08-11-b');
assert.equal(PUBLIC_RECIPE_ALIAS_VERSION,'public-recipe-alias-2026-08-11-b');
assert.equal(PUBLIC_RECIPE_PROVENANCE_VERSION,'public-recipe-provenance-2026-08-11-c');
assert.equal(PUBLIC_RECIPE_MASTER.length,76);
assert.equal(RAW_PUBLIC_RECIPE_MASTER.length,76);
assert.equal(PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,34,'33 v0.4.3 names + current-game 迷昏拳 resolution expected');
assert.equal(PUBLIC_RECIPE_FORMULA_OVERRIDES.length,1,'only 親子愛咖哩 formula has new public evidence');

const rawById=new Map(RAW_PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
const canonicalById=new Map(PUBLIC_RECIPE_MASTER.map(row=>[row.recipe_id,row]));
assert.deepEqual([...canonicalById.keys()].sort(),[...rawById.keys()].sort(),'stable 76 recipe IDs must remain identical');

const expectedCurrentNames=new Map([
  ['curry_soft_corn','柔軟玉米濃湯'],
  ['recipe_curry_015','入口即化蛋捲咖哩'],
  ['recipe_curry_010','單純白醬濃湯'],
  ['recipe_curry_011','豆製肉排咖哩'],
  ['curry_dream_eater','絕對睡眠奶油咖哩'],
  ['curry_solar_tomato','太陽之力番茄咖哩'],
  ['curry_dizzy_punch','迷昏拳辣味咖哩'],
  ['recipe_salad_009','哞哞起司番茄沙拉'],
  ['salad_tofu','濕潤豆腐沙拉'],
  ['dessert_warm_milk','哞哞熱鮮奶'],
  ['recipe_dessert_005','火花薑茶'],
  ['recipe_dessert_004','手製勁爽汽水'],
]);
for(const [id,name] of expectedCurrentNames)assert.equal(canonicalById.get(id)?.recipe_name,name,`current zh-TW canonical drifted: ${id}`);

const snapshot=buildPublicMasterCatalogSnapshot('recipes');
assert.equal(snapshot.data_version,PUBLIC_RECIPE_MASTER_VERSION);
assert.equal(snapshot.identity_alias_version,PUBLIC_RECIPE_ALIAS_VERSION);
assert.equal(snapshot.row_count,76);
for(const [id,name] of expectedCurrentNames){
  const row=snapshot.rows.find(item=>item.recipe_id===id);
  assert.equal(row?.recipe_name,name,`Recognition catalog bypassed canonical recipe authority: ${id}`);
}
assert.equal(snapshot.rows.some(row=>row.recipe_id==='curry_soft_corn'&&row.recipe_name==='玉米濃湯'),false,'raw migration name must not be Recognition canonical');

const legacySoftCorn=resolvePublicRecipeName('玉米濃湯');
assert.equal(legacySoftCorn?.recipe_id,'curry_soft_corn');
assert.equal(legacySoftCorn?.recipe_name,'柔軟玉米濃湯');
assert.equal(legacySoftCorn?.resolution,'LEGACY_NAME_ALIAS_SAFE');
const legacyDizzy=resolvePublicRecipeName('暈眩拳辣味咖哩');
assert.equal(legacyDizzy?.recipe_id,'curry_dizzy_punch');
assert.equal(legacyDizzy?.recipe_name,'迷昏拳辣味咖哩');
assert.equal(legacyDizzy?.commit_allowed,true);

const formulaChanges=[];
for(const [id,raw] of rawById){
  const current=canonicalById.get(id);
  if(signature(raw)!==signature(current))formulaChanges.push(id);
}
assert.deepEqual(formulaChanges,['curry_parent_child'],'no formula outside explicit screenshot evidence may change');
assert.equal(signature(canonicalById.get('curry_parent_child')),'好眠番茄=11|特選蛋=8|甜甜蜜=12|窩心洋芋=4');
assert.equal(canonicalById.get('curry_parent_child').total_ingredients,35);
assert.equal(signature(canonicalById.get('curry_dizzy_punch')),'火辣香草=11|甜甜蜜=11|醒腦咖啡豆=11');
const dizzyReview=PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.find(row=>row.recipe_id==='curry_dizzy_punch');
const parentReview=PUBLIC_RECIPE_FORMULA_CONFLICT_REVIEWS.find(row=>row.recipe_id==='curry_parent_child');
assert.equal(dizzyReview?.resolution,'CURRENT_PUBLIC_FORMULA_CONFIRMED_OLD_OCR_EVIDENCE_REJECTED');
assert.equal(parentReview?.resolution,'OBSERVED_FORMULA_PROMOTED_TO_CURRENT_PUBLIC_AUTHORITY');
assert.equal(PUBLIC_RECIPE_PROVENANCE.find(row=>row.recipe_id==='curry_parent_child')?.formula_evidence,'GAME_SCREENSHOT_VERIFIED');

const lockedObservation={observation_id:'locked-1',status:'UNMATCHED',observed_text:'4種食材的咖哩',observed_data:{unlocked:false},source_image_ref:'image-locked',confidence:0.99,reason:'LOCKED_UNKNOWN_RECIPE_SLOT'};
assert.equal(isLockedUnknownRecipePlaceholder(lockedObservation),true);
const lockedPayload={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',authority:'recipe_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-08-11T10:00:00Z',visible_target_count:1,observations:[lockedObservation],
};
const lockedCompiled=compilePublicMasterRecognitionToUpdatePackage(lockedPayload,'recipes',{allowedImageRefs:['image-locked']});
assert.equal(lockedCompiled.errors.length,0);
assert.equal(lockedCompiled.unresolved.length,0,'locked unknown slot is coverage evidence, not a Master gap review');
assert.equal(lockedCompiled.update_package.operations.length,0,'locked unknown slot must never invent a recipe operation');
assert.equal(lockedCompiled.summary.ignored_count,1);

const authorityAudit={authority_version:'weekly-platform-authority-test',week_start:'2026-08-10',context_id:'weekly_context_2026-08-10_import',generated_at:'2026-08-11T09:28:18.577Z',update_id:'UPD-TEST',provider_original_generated_at:'2024-07-15T00:00:00Z',provider_original_week_start:'2024-07-15'};
const diagnostic=buildUcImgDiagnosticBundle({
  appVersion:'v0.4.11.3',
  session:{session_id:'ucimg-test'},scenarioKey:'weekly',config:{scenario:'weekly_context_update'},coverage:'USER_CONFIRMED_COMPLETE',
  rawResponse:JSON.stringify({schema_version:'1.1'}),validation:{ok:true,errors:[],warnings:[],review:[],summary:{}},
  providerMeta:{provider:'gemini',model:'gemini-test',project_alias:'Project A',response_contract:'update-package-v1.1',image_count:2,platform_authority:authorityAudit},
});
assert.deepEqual(diagnostic.platform_authority,authorityAudit,'Weekly platform authority audit must survive into diagnostic bundle');
assert.equal(diagnostic.safety.api_key_included,false);
assert.equal(diagnostic.safety.screenshot_bytes_included,false);
assert.equal(diagnostic.safety.sqlite_export_included,false);

let downloadedBlob=null,clicked=false,downloadName=null,revoked=false;
const fakeDocument={
  body:{appendChild(){}},
  createElement(tag){assert.equal(tag,'a');return {style:{},set href(value){this._href=value;},get href(){return this._href;},set download(value){downloadName=value;},click(){clicked=true;},remove(){}};},
};
const fakeUrl={createObjectURL(blob){downloadedBlob=blob;return 'blob:test';},revokeObjectURL(){revoked=true;}};
const filename=downloadUcImgDiagnosticJson(diagnostic,{documentRef:fakeDocument,urlApi:fakeUrl,BlobCtor:Blob,filename:buildUcImgDiagnosticFilename({appVersion:'v0.4.11.4',scenarioKey:'weekly',sessionId:'ucimg-test',generatedAt:'2026-08-11T10:00:00Z'})});
assert.equal(clicked,true);
assert.equal(downloadName,filename);
assert.ok(filename.endsWith('.json'));
const downloaded=JSON.parse(await downloadedBlob.text());
assert.equal(downloaded.schema,'pokemon-sleep-uc-img-ai-diagnostic/1.0');
assert.equal(downloaded.safety.api_key_included,false);
assert.equal(downloaded.safety.screenshot_bytes_included,false);
assert.equal(downloaded.safety.sqlite_export_included,false);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(revoked,true);

const uiSource=read('assets/js/unified-screenshot-update-center.js');
assert.ok(uiSource.includes('匯出 AI 診斷包'));
assert.equal(uiSource.includes('複製 AI 診斷包'),false);
assert.ok(uiSource.includes('platform_authority:analysis.platform_authority||null'),'Internal Gemini provider metadata must retain platform authority audit');
assert.ok(uiSource.includes('downloadUcImgDiagnosticJson(bundle)'));
const exportSource=read('assets/js/uc-img-diagnostic-export.js');
for(const forbidden of ['localStorage','sessionStorage','indexedDB','api_key','screenshot_bytes'])assert.equal(exportSource.includes(forbidden),false,`diagnostic export helper must remain storage/secret agnostic: ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V04114_RECIPE_ZH_TW_AUTHORITY_DIAGNOSTIC_EXPORT',
  recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  canonical_name_version:PUBLIC_RECIPE_CANONICAL_NAME_VERSION,
  alias_version:PUBLIC_RECIPE_ALIAS_VERSION,
  recipe_count:PUBLIC_RECIPE_MASTER.length,
  current_zh_tw_name_overrides:PUBLIC_RECIPE_ZH_TW_NAME_OVERRIDES.length,
  explicit_formula_changes:formulaChanges,
  locked_unknown_recipe_slot_review:false,
  weekly_platform_authority_diagnostic:true,
  diagnostic_json_download:true,
  screenshot_bytes_in_export:false,
  api_key_in_export:false,
  sqlite_in_export:false,
},null,2));
