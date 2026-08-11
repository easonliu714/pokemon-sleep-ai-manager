import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildUpdatePackageJsonSchema} from '../assets/js/update-package-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.10.2.1');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v041021-ingredient-key-contract-hotfix');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10.2.1-v041021-ingredient-key-contract-hotfix');
assert.ok(version.includes("// app_version: 'v0.4.10.2'"),'hotfix must retain v0.4.10.2 legacy bridge');

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

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.2.1 must remain schema-migration-free');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10.2.1_RELEASE_CONTRACT',
  app_version:'v0.4.10.2.1',canonical_ingredient_key:'ingredient_name',
  ai_invented_ingredient_id:false,early_validation:true,
  sqlite_migration_added:false,public_master_mutated:false,
},null,2));
