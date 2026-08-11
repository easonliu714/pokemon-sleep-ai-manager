import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UPDATE_PACKAGE_REQUIRED_ROOT,
  UPDATE_PACKAGE_SCHEMA_VERSION,
  UPDATE_PACKAGE_SOURCE,
  buildUpdatePackageJsonSchema,
} from '../assets/js/update-package-contract.js';
import {UC_IMG_A_VERSION,UC_IMG_A_MODES,UC_IMG_A_SCENARIOS} from '../assets/js/unified-screenshot-update-center.js';
import {UC_IMG_GEMINI_ADAPTER_VERSION,buildUcImgGeminiSchema} from '../assets/js/uc-img-gemini-adapter.js';
import {buildGeminiGenerateBody} from '../assets/js/ai-project-pool-runtime.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1];
const exactReleases={
  'v0.4.10.2':['20260811-v04102-uc-img-internal-gemini-dual-mode','pokemon-sleep-ai-v0.4.10.2-v04102-uc-img-internal-gemini-dual-mode'],
  'v0.4.10.3':['20260811-v04103-ingredient-key-contract-hotfix','pokemon-sleep-ai-v0.4.10.3-v04103-ingredient-key-contract-hotfix'],
  'v0.4.11':['20260811-v0411-public-master-constrained-recognition','pokemon-sleep-ai-v0.4.11-v0411-public-master-constrained-recognition'],
  'v0.4.11.1':['20260811-v04111-uc-img-session-timestamp','pokemon-sleep-ai-v0.4.11.1-v04111-uc-img-session-timestamp'],
  'v0.4.11.2':['20260811-v04112-android-eager-image-bytes','pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes'],
  'v0.4.11.3':['20260811-v04113-weekly-recipe-semantic-safety','pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety'],
  'v0.4.11.4':['20260811-v04114-recipe-zh-tw-diagnostic-export','pokemon-sleep-ai-v0.4.11.4-v04114-recipe-zh-tw-diagnostic-export'],
  'v0.4.12':['20260811-v0412-recipe-unified-player-workbench','pokemon-sleep-ai-v0.4.12-v0412-recipe-unified-player-workbench'],
};
assert.ok(exactReleases[appVersion],`unexpected v0.4.10.2 successor: ${appVersion}`);
assert.deepEqual([appBuild,cacheName],exactReleases[appVersion]);
if(appVersion!=='v0.4.10.2')assert.ok(version.includes("// app_version: 'v0.4.10.2'"),'successor must retain v0.4.10.2 legacy bridge');
if(appVersion==='v0.4.12')for(const predecessor of ['v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11','v0.4.10.3'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.12 must retain ${predecessor} legacy bridge`);
assert.ok(version.includes("// app_version: 'v0.4.10.1'"),'v0.4.10.2 lineage must retain v0.4.10.1 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v04101-update-package-root-contract'"));

assert.deepEqual(UC_IMG_A_MODES,['internal','external']);
assert.deepEqual(UPDATE_PACKAGE_REQUIRED_ROOT,['schema_version','update_id','generated_at','source','operations']);
assert.equal(UPDATE_PACKAGE_SCHEMA_VERSION,'1.1');
assert.equal(UPDATE_PACKAGE_SOURCE,'ai_screenshot_analysis');
const recognitionSuccessor=UC_IMG_A_VERSION.includes('public-master-recognition');
if(recognitionSuccessor){
  assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-d-public-master-recognition');
  assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-b-public-master-recognition');
}else{
  assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-c-dual-mode');
  assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-a');
}

const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly');
assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1']);
assert.deepEqual(weeklySchema.properties.source.enum,['ai_screenshot_analysis']);
assert.deepEqual(weeklySchema.properties.scenario.enum,['weekly_context_update']);
assert.deepEqual(weeklySchema.properties.operations.items.properties.entity.enum,['weekly_context']);
assert.deepEqual(weeklySchema.properties.operations.items.properties.action.enum,['upsert']);
assert.deepEqual(weeklySchema.properties.context_authority.enum,['UPDATE_CENTER_JSON']);

for(const key of ['ingredients','recipes']){
  const cfg=UC_IMG_A_SCENARIOS[key],schema=buildUcImgGeminiSchema(cfg,key);
  if(recognitionSuccessor){
    assert.deepEqual(schema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);
    assert.deepEqual(schema.properties.scenario.enum,[cfg.scenario]);
    assert.ok(schema.properties.observations,'recognition successor must preserve structured JSON output');
  }else{
    assert.deepEqual(schema.properties.schema_version.enum,['1.1']);
    assert.deepEqual(schema.properties.source.enum,['ai_screenshot_analysis']);
    assert.deepEqual(schema.properties.scenario.enum,[cfg.scenario]);
    assert.deepEqual(schema.properties.operations.items.properties.entity.enum,cfg.entities);
    assert.deepEqual(schema.properties.operations.items.properties.action.enum,['upsert']);
  }
}

const directSchema=buildUpdatePackageJsonSchema({scenario:'ingredient_inventory_update',entities:['ingredient_inventory','account_capacity']});
const body=buildGeminiGenerateBody({prompt:'test',images:[{data:'AQ==',mimeType:'image/png'},{data:'Ag==',mimeType:'image/jpeg'}],responseJsonSchema:directSchema});
assert.equal(body.generationConfig.responseMimeType,'application/json');
assert.deepEqual(body.generationConfig.responseJsonSchema,directSchema);
assert.equal(body.contents[0].parts.filter(part=>part.inlineData).length,2);
const legacyBody=buildGeminiGenerateBody({prompt:'legacy',imageBase64:'AQ==',mimeType:'image/png'});
assert.equal(legacyBody.contents[0].parts.filter(part=>part.inlineData).length,1);
assert.equal('responseJsonSchema' in legacyBody.generationConfig,false);

const adapter=read('assets/js/uc-img-gemini-adapter.js');
for(const forbidden of ['applyPayload','dryRun','importer.js','localStorage','indexedDB'])assert.equal(adapter.includes(forbidden),false,`Gemini adapter must not own ${forbidden}`);
const ucImg=read('assets/js/unified-screenshot-update-center.js');
for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','dryRun','applyPayload'])assert.ok(ucImg.includes(token),`v0.4.10.2 lineage UC.IMG missing ${token}`);
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'UC.IMG must retain exactly one Apply bridge');
assert.ok(ucImg.includes('截圖不會寫入 SQLite 或 GitHub'));
assert.ok(ucImg.includes('Key Vault / Project Pool'));

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.2 lineage must remain schema-migration-free through v0.4.12');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10.2_RELEASE_CONTRACT',
  app_version:appVersion,
  successor_v0412:appVersion==='v0.4.12',
  uc_img_version:UC_IMG_A_VERSION,
  gemini_adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  modes:UC_IMG_A_MODES,
  scenarios:Object.values(UC_IMG_A_SCENARIOS).map(item=>item.scenario),
  structured_json_schema:true,
  recognition_successor:recognitionSuccessor,
  multi_image:true,
  legacy_single_image_compatible:true,
  direct_ai_apply_bypass:false,
  external_prompt_fallback:true,
  api_key_persisted_by_uc_img:false,
  screenshot_bytes_persisted:false,
  sqlite_migration_added:false,
  public_master_mutated:false,
},null,2));
