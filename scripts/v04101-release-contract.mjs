import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UPDATE_PACKAGE_REQUIRED_ROOT,
  UPDATE_PACKAGE_SCHEMA_VERSION,
  UPDATE_PACKAGE_SOURCE,
  buildUpdatePackageRootInstruction,
} from '../assets/js/update-package-contract.js';
import {PROMPT_CATALOG,buildScenarioTemplate} from '../assets/js/prompt-catalog.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionTuple=value=>{const text=String(value||'');if(!/^v\d+(?:\.\d+){2,}$/.test(text))return null;return text.slice(1).split('.').map(Number);};
const versionAtLeast=(value,minimum)=>{const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;const length=Math.max(a.length,b.length);for(let i=0;i<length;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return true;};
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(versionAtLeast(appVersion,'v0.4.10.1'),'v0.4.10.1+ successor version must remain parseable');
const exactRelease=appVersion==='v0.4.10.1';
if(exactRelease){
  assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260811-v04101-update-package-root-contract');
  assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.10.1-v04101-update-package-root-contract');
}else{
  assert.ok(version.includes("// app_version: 'v0.4.10.1'"),'successor must retain v0.4.10.1 legacy bridge');
  assert.ok(version.includes("// app_build: '20260811-v04101-update-package-root-contract'"));
}
assert.ok(version.includes("// app_version: 'v0.4.10'"));
assert.deepEqual(UPDATE_PACKAGE_REQUIRED_ROOT,['schema_version','update_id','generated_at','source','operations']);
assert.equal(UPDATE_PACKAGE_SCHEMA_VERSION,'1.1');
assert.equal(UPDATE_PACKAGE_SOURCE,'ai_screenshot_analysis');

const keys=['ingredients','items','candies','recipes','capacity','discard','weekly'];
for(const key of keys){
  const entry=PROMPT_CATALOG[key];
  assert.equal(entry.contract,'update-package-v1.1');
  assert.ok(entry.scenario);
  const prompt=entry.prompt;
  for(const root of UPDATE_PACKAGE_REQUIRED_ROOT)assert.ok(prompt.includes(root),`${key} prompt missing ${root}`);
  assert.ok(prompt.includes('schema_version 必須是字串 "1.1"'));
  assert.ok(prompt.includes('source 必須是字串 "ai_screenshot_analysis"'));
  assert.ok(prompt.includes('scenario 必須保留在 payload root'));
  const template=buildScenarioTemplate(key);
  assert.equal(template.schema_version,'1.1');
  assert.equal(template.source,'ai_screenshot_analysis');
  assert.equal(template.scenario,entry.scenario);
}
assert.equal(PROMPT_CATALOG.pokemon.contract,'observation-v2');
assert.equal(PROMPT_CATALOG.pokemon.prompt.includes('Update Package v1.1 外層契約'),false);
assert.ok(buildUpdatePackageRootInstruction({scenario:'ingredient_inventory_update'}).includes('不可使用 schema 取代'));

const legacy={
  schema:'pokemon-sleep-update-package/1.1',
  scenario:'ingredient_inventory_update',
  generated_at:'2026-08-11T00:35:47.000Z',
  session_id:'ucimg-msnx7rbz-g47l9z',
  operations:[],
};
const invalid=validateWorkflow(legacy);
for(const field of ['schema_version','update_id','source'])assert.ok(invalid.errors.some(value=>value.includes(`缺少根欄位：${field}`)));
assert.ok(invalid.errors.some(value=>value.includes('外層不是目前 Update Package v1.1 envelope')));
assert.ok(invalid.errors.some(value=>value.includes('不會自動猜測或補寫 root 後套用')));

const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.10.1+ root-contract successors must remain schema-migration-free unless explicitly versioned');

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.10.1_RELEASE_CONTRACT_SUCCESSOR_AWARE',
  app_version:appVersion,nested_hotfix_version_supported:true,
  historical_behavior_compatible:true,
  exact_release_authority_enforced:exactRelease,
  shared_root_contract:true,
  prompt_catalog_checked:keys,
  observation_v2_isolated:true,
  legacy_gemini_shape_fail_closed:true,
  sqlite_migration_added:false,
  public_master_mutated:false,
},null,2));