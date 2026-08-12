import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const exactReleases={
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
assert.ok(exactReleases[appVersion],`unexpected v0.4.10.3 successor: ${appVersion}`);
assert.deepEqual([version.match(/app_build:\s*'([^']+)'/)?.[1],version.match(/cache_name:\s*'([^']+)'/)?.[1]],exactReleases[appVersion]);
if(appVersion!=='v0.4.10.3')assert.ok(version.includes("// app_version: 'v0.4.10.3'"),'successor must retain v0.4.10.3 legacy bridge');
for(const successor of ['v0.4.12','v0.4.13','v0.4.13.1','v0.4.13.2'])if(appVersion===successor){
  const required=successor==='v0.4.12'?['v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11']:
    successor==='v0.4.13'?['v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11']:
    successor==='v0.4.13.1'?['v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11']:
    ['v0.4.13.1','v0.4.13','v0.4.12','v0.4.11.4','v0.4.11.3','v0.4.11.2','v0.4.11.1','v0.4.11'];
  for(const predecessor of required)assert.ok(version.includes(`// app_version: '${predecessor}'`),`${successor} must retain ${predecessor} legacy bridge`);
}
assert.ok(version.includes("// app_version: 'v0.4.10.2'"));

const schema=buildUpdatePackageJsonSchema({scenario:'ingredient_inventory_update',entities:['ingredient_inventory','account_capacity']});
const keySchema=schema.properties.operations.items.properties.key;
assert.equal(keySchema.additionalProperties,false);assert.ok(keySchema.properties.ingredient_name);assert.equal('ingredient_id' in keySchema.properties,false);
const prompt=read('assets/js/prompt-catalog.js');assert.ok(prompt.includes('key.ingredient_name 必須逐字使用畫面顯示的繁體中文食材名稱'));assert.ok(prompt.includes('不得自行建立 ingredient_id'));
const workflow=read('assets/js/ai-workflow.js');assert.ok(workflow.includes('ingredient_inventory key 缺少 ingredient_name'));
const recognition=read('assets/js/public-master-recognition.js');if(appVersion!=='v0.4.10.3'){assert.ok(recognition.includes("authority:'ingredient_master'"));assert.ok(recognition.includes("canonical_key_fields:Object.freeze(['ingredient_name'])"));assert.ok(recognition.includes('不得自行創造 ID 或 canonical 名稱'));}
const migrations=read('assets/js/migrations.js');assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.3 lineage remains schema-migration-free');
console.log(JSON.stringify({status:'PASS',gate:'V0.4.10.3_RELEASE_CONTRACT_SUCCESSOR_AWARE',app_version:appVersion,canonical_ingredient_key:'ingredient_name',ai_invented_ingredient_id:false,early_validation:true,public_master_constrained_successor:appVersion!=='v0.4.10.3',successor_v04132:appVersion==='v0.4.13.2',sqlite_migration_added:false,public_master_mutated:false},null,2));