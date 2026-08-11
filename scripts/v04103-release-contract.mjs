import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(['v0.4.10.3','v0.4.11','v0.4.11.1','v0.4.11.2','v0.4.11.3','v0.4.11.4'].includes(appVersion),`unexpected v0.4.10.3 successor: ${appVersion}`);
if(appVersion==='v0.4.10.3'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04103-ingredient-key-contract-hotfix');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10.3-v04103-ingredient-key-contract-hotfix');
}else if(appVersion==='v0.4.11'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v0411-public-master-constrained-recognition');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11-v0411-public-master-constrained-recognition');
  assert.ok(version.includes("// app_version: 'v0.4.10.3'"),'v0.4.11 must retain v0.4.10.3 legacy bridge');
}else if(appVersion==='v0.4.11.1'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04111-uc-img-session-timestamp');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.1-v04111-uc-img-session-timestamp');
  assert.ok(version.includes("// app_version: 'v0.4.11'"),'v0.4.11.1 must retain v0.4.11 legacy bridge');
  assert.ok(version.includes("// app_version: 'v0.4.10.3'"),'v0.4.11.1 must retain v0.4.10.3 legacy bridge');
}else if(appVersion==='v0.4.11.2'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04112-android-eager-image-bytes');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.2-v04112-android-eager-image-bytes');
  assert.ok(version.includes("// app_version: 'v0.4.11.1'"),'v0.4.11.2 must retain v0.4.11.1 legacy bridge');
  assert.ok(version.includes("// app_version: 'v0.4.11'"),'v0.4.11.2 must retain v0.4.11 legacy bridge');
  assert.ok(version.includes("// app_version: 'v0.4.10.3'"),'v0.4.11.2 must retain v0.4.10.3 legacy bridge');
}else if(appVersion==='v0.4.11.3'){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04113-weekly-recipe-semantic-safety');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.3-v04113-weekly-recipe-semantic-safety');
  for(const predecessor of ['v0.4.11.2','v0.4.11.1','v0.4.11','v0.4.10.3'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.11.3 must retain ${predecessor} legacy bridge`);
}else{
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04114-recipe-zh-tw-diagnostic-export');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.11.4-v04114-recipe-zh-tw-diagnostic-export');
  for(const predecessor of ['v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11','v0.4.10.3'])assert.ok(version.includes(`// app_version: '${predecessor}'`),`v0.4.11.4 must retain ${predecessor} legacy bridge`);
}
assert.ok(version.includes("// app_version: 'v0.4.10.2'"),'hotfix lineage must retain v0.4.10.2 legacy bridge');

const schema=buildUpdatePackageJsonSchema({scenario:'ingredient_inventory_update',entities:['ingredient_inventory','account_capacity']});
const keySchema=schema.properties.operations.items.properties.key;
assert.equal(keySchema.additionalProperties,false);
assert.ok(keySchema.properties.ingredient_name);
assert.equal('ingredient_id' in keySchema.properties,false);

const prompt=read('assets/js/prompt-catalog.js');
assert.ok(prompt.includes('key.ingredient_name 必須逐字使用畫面顯示的繁體中文食材名稱'));
assert.ok(prompt.includes('不得自行建立 ingredient_id'));

const workflow=read('assets/js/ai-workflow.js');
assert.ok(workflow.includes('ingredient_inventory key 缺少 ingredient_name'));

const recognition=read('assets/js/public-master-recognition.js');
if(['v0.4.11','v0.4.11.1','v0.4.11.2','v0.4.11.3','v0.4.11.4'].includes(appVersion)){
  assert.ok(recognition.includes("authority:'ingredient_master'"));
  assert.ok(recognition.includes("canonical_key_fields:Object.freeze(['ingredient_name'])"));
  assert.ok(recognition.includes('不得自行創造 ID 或 canonical 名稱'));
}

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.3 lineage through v0.4.11.4 must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10.3_RELEASE_CONTRACT',
  app_version:appVersion,canonical_ingredient_key:'ingredient_name',
  ai_invented_ingredient_id:false,early_validation:true,
  public_master_constrained_successor:['v0.4.11','v0.4.11.1','v0.4.11.2','v0.4.11.3','v0.4.11.4'].includes(appVersion),
  sqlite_migration_added:false,public_master_mutated:false,
},null,2));
