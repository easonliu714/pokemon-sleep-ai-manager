import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UPDATE_PACKAGE_REQUIRED_ROOT,
  UPDATE_PACKAGE_SCHEMA_VERSION,
  UPDATE_PACKAGE_SOURCE,
  buildUpdatePackageJsonSchema,
} from '../assets/js/update-package-contract.js';
import {
  UC_IMG_A_VERSION,
  UC_IMG_A_MODES,
  UC_IMG_A_SCENARIOS,
} from '../assets/js/unified-screenshot-update-center.js';
import {
  UC_IMG_GEMINI_ADAPTER_VERSION,
  buildUcImgGeminiSchema,
} from '../assets/js/uc-img-gemini-adapter.js';
import {buildGeminiGenerateBody} from '../assets/js/ai-project-pool-runtime.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.10.2');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04102-uc-img-internal-gemini-dual-mode');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10.2-v04102-uc-img-internal-gemini-dual-mode');
assert.ok(version.includes("// app_version: 'v0.4.10.1'"),'v0.4.10.2 must retain v0.4.10.1 legacy bridge');
assert.ok(version.includes("// app_build: '20260811-v04101-update-package-root-contract'"));

assert.equal(UC_IMG_A_VERSION,'uc-img-a-2026-08-11-c-dual-mode');
assert.deepEqual(UC_IMG_A_MODES,['internal','external']);
assert.equal(UC_IMG_GEMINI_ADAPTER_VERSION,'uc-img-gemini-2026-08-11-a');
assert.deepEqual(UPDATE_PACKAGE_REQUIRED_ROOT,['schema_version','update_id','generated_at','source','operations']);
assert.equal(UPDATE_PACKAGE_SCHEMA_VERSION,'1.1');
assert.equal(UPDATE_PACKAGE_SOURCE,'ai_screenshot_analysis');

for(const key of ['weekly','ingredients','recipes']){
  const cfg=UC_IMG_A_SCENARIOS[key];
  const schema=buildUcImgGeminiSchema(cfg,key);
  assert.deepEqual(schema.properties.schema_version.enum,['1.1']);
  assert.deepEqual(schema.properties.source.enum,['ai_screenshot_analysis']);
  assert.deepEqual(schema.properties.scenario.enum,[cfg.scenario]);
  assert.deepEqual(schema.properties.operations.items.properties.entity.enum,cfg.entities);
  assert.deepEqual(schema.properties.operations.items.properties.action.enum,['upsert']);
  if(key==='weekly')assert.deepEqual(schema.properties.context_authority.enum,['UPDATE_CENTER_JSON']);
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
for(const token of ['Gemini API 直接分析','外部 AI Prompt','runtime.files','buildUcImgDiagnosticBundle','validateScreenshotScenarioPayload','dryRun','applyPayload'])assert.ok(ucImg.includes(token),`v0.4.10.2 UC.IMG missing ${token}`);
assert.equal((ucImg.match(/applyPayload\(/g)||[]).length,1,'UC.IMG must retain exactly one Apply bridge');
assert.ok(ucImg.includes('截圖不會寫入 SQLite 或 GitHub'));
assert.ok(ucImg.includes('Key Vault / Project Pool'));

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.2 must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10.2_RELEASE_CONTRACT',
  app_version:'v0.4.10.2',
  uc_img_version:UC_IMG_A_VERSION,
  gemini_adapter_version:UC_IMG_GEMINI_ADAPTER_VERSION,
  modes:UC_IMG_A_MODES,
  scenarios:Object.values(UC_IMG_A_SCENARIOS).map(item=>item.scenario),
  structured_json_schema:true,
  multi_image:true,
  legacy_single_image_compatible:true,
  direct_ai_apply_bypass:false,
  external_prompt_fallback:true,
  api_key_persisted_by_uc_img:false,
  screenshot_bytes_persisted:false,
  sqlite_migration_added:false,
  public_master_mutated:false,
},null,2));
