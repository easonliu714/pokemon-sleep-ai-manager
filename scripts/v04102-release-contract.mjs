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
const versionTuple=value=>{const match=String(value||'').match(/^v(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);return match?match.slice(1).map(part=>Number(part||0)):null;};
const versionAtLeast=(value,minimum)=>{const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;for(let i=0;i<4;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};
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
  'v0.4.13':['20260811-v0413-g7-recipe-portfolio-contention','pokemon-sleep-ai-v0.4.13-v0413-g7-recipe-portfolio-contention'],
  'v0.4.13.1':['20260811-v04131-data-preservation-hotfix','pokemon-sleep-ai-v0.4.13.1-v04131-data-preservation-hotfix'],
  'v0.4.13.2':['20260812-v04132-pot-authority-recipe78','pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78'],
};
assert.ok(versionAtLeast(appVersion,'v0.4.10.2'),`unexpected v0.4.10.2 successor: ${appVersion}`);
if(exactReleases[appVersion])assert.deepEqual([appBuild,cacheName],exactReleases[appVersion]);
else{
  for(const predecessor of ['v0.4.13.2','v0.4.13.1','v0.4.13','v0.4.12','v0.4.11','v0.4.10.3','v0.4.10.2'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`missing successor lineage ${predecessor}`);
}
if(appVersion!=='v0.4.10.2')assert.ok(version.includes("// app_version: 'v0.4.10.2'"));
assert.ok(version.includes("// app_version: 'v0.4.10.1'"));assert.ok(version.includes("// app_build: '20260811-v04101-update-package-root-contract'"));

assert.deepEqual(UC_IMG_A_MODES,['internal','external']);assert.deepEqual(UPDATE_PACKAGE_REQUIRED_ROOT,['schema_version','update_id','generated_at','source','operations']);assert.equal(UPDATE_PACKAGE_SCHEMA_VERSION,'1.1');assert.equal(UPDATE_PACKAGE_SOURCE,'ai_screenshot_analysis');
const recognitionSuccessor=versionAtLeast(appVersion,'v0.4.11');
const ucImgAuthorityDate=UC_IMG_A_VERSION.match(/^uc-img-a-(\d{4}-\d{2}-\d{2})-/)?.[1]||null;
const adapterAuthorityDate=UC_IMG_GEMINI_ADAPTER_VERSION.match(/^uc-img-gemini-(\d{4}-\d{2}-\d{2})-/)?.[1]||null;
if(recognitionSuccessor){
  assert.ok(ucImgAuthorityDate&&ucImgAuthorityDate>='2026-08-11',`unexpected recognition UC.IMG successor: ${UC_IMG_A_VERSION}`);
  assert.ok(adapterAuthorityDate&&adapterAuthorityDate>='2026-08-11',`unexpected recognition adapter successor: ${UC_IMG_GEMINI_ADAPTER_VERSION}`);
}else{
  assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-c-dual-mode');assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-a');
}

const weeklySchema=buildUcImgGeminiSchema(UC_IMG_A_SCENARIOS.weekly,'weekly');assert.deepEqual(weeklySchema.properties.schema_version.enum,['1.1']);assert.deepEqual(weeklySchema.properties.source.enum,['ai_screenshot_analysis']);assert.deepEqual(weeklySchema.properties.scenario.enum,['weekly_context_update']);assert.deepEqual(weeklySchema.properties.operations.items.properties.entity.enum,['weekly_context']);assert.deepEqual(weeklySchema.properties.operations.items.properties.action.enum,['upsert']);assert.deepEqual(weeklySchema.properties.context_authority.enum,['UPDATE_CENTER_JSON']);assert.equal('capacity_observations' in weeklySchema.properties,false,'Weekly must not inherit base pot authority');
let recipePotCapacitySuccessor=false;
for(const key of ['ingredients','recipes']){
  const cfg=UC_IMG_A_SCENARIOS[key],schema=buildUcImgGeminiSchema(cfg,key);
  if(recognitionSuccessor){
    assert.deepEqual(schema.properties.schema.enum,[PUBLIC_MASTER_RECOGNITION_SCHEMA]);assert.deepEqual(schema.properties.scenario.enum,[cfg.scenario]);assert.ok(schema.properties.observations);
    if(key==='recipes')recipePotCapacitySuccessor=Boolean(schema.properties.capacity_observations);
  }else{assert.deepEqual(schema.properties.schema_version.enum,['1.1']);assert.deepEqual(schema.properties.source.enum,['ai_screenshot_analysis']);assert.deepEqual(schema.properties.scenario.enum,[cfg.scenario]);assert.deepEqual(schema.properties.operations.items.properties.entity.enum,cfg.entities);assert.deepEqual(schema.properties.operations.items.properties.action.enum,['upsert']);}
}
if(versionAtLeast(appVersion,'v0.4.13.2'))assert.equal(recipePotCapacitySuccessor,true,'Recipe successor must expose pot capacity schema');

const directSchema=buildUpdatePackageJsonSchema({scenario:'ingredient_inventory_update',entities:['ingredient_inventory','account_capacity']});const body=buildGeminiGenerateBody({prompt:'test',images:[{data:'AQ==',mimeType:'image/png'},{data:'Ag==',mimeType:'image/jpeg'}],responseJsonSchema:directSchema});assert.equal(body.generationConfig.responseMimeType,'application/json');assert.deepEqual(body.generationConfig.responseJsonSchema,directSchema);assert.equal(body.contents[0].parts.filter(part=>part.inlineData).length,2);const legacyBody=buildGeminiGenerateBody({prompt:'legacy',imageBase64:'AQ==',mimeType:'image/png'});assert.equal(legacyBody.contents[0].parts.filter(part=>part.inlineData).length,1);assert.equal('responseJsonSchema' in legacyBody.generationConfig,false);
const adapter=read('assets/js/uc-img-gemini-adapter.js');for(const forbidden of ['applyPayload','dryRun','importer.js','localStorage','indexedDB'])assert.equal(adapter.includes(forbidden),false);
const ucImg=read('assets/js/unified-screenshot-update-center.js');for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','dryRun','applyPayload'])assert.ok(ucImg.includes(token));assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1);assert.ok(ucImg.includes('截圖不會寫入 SQLite 或 GitHub'));assert.ok(ucImg.includes('Key Vault / Project Pool'));
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.2 lineage remains schema-migration-free');
console.log(JSON.stringify({status:'PASS',gate:'V0.4.10.2_RELEASE_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,uc_img_version:UC_IMG_A_VERSION,uc_img_authority_date:ucImgAuthorityDate,gemini_adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,gemini_adapter_authority_date:adapterAuthorityDate,modes:UC_IMG_A_MODES,scenarios:Object.values(UC_IMG_A_SCENARIOS).map(item=>item.scenario),structured_json_schema:true,recognition_successor:recognitionSuccessor,recipe_pot_capacity_successor:recipePotCapacitySuccessor,weekly_base_pot_authority:false,multi_image:true,legacy_single_image_compatible:true,direct_ai_apply_bypass:false,external_prompt_fallback:true,api_key_persisted_by_uc_img:false,screenshot_bytes_persisted:false,sqlite_migration_added:false,public_master_mutated:false},null,2));